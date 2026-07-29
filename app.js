// ===================================================
// APLICATIVO FINANCEIRO DO CASAL v2.0 (LÓGICA GRÁFICOS 2D)
// ===================================================

let supabaseClient = null;
let chartPieInstance = null;
let chartLineInstance = null;

// Estado global da aplicação
let estado = {
  filtroPeriodo: 'mes-atual',
  dataInicio: null,
  dataFim: null,
  filtroMacro: 'todas',
  sobraReal: 3000,
  rendaCasal: 8000,
  transacoes: [],
  categorias: [],
  recorrentes: [],
  regras: []
};

// ===================================================
// INICIALIZAÇÃO
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const defaultUrl = 'https://bsrcbtgdayqsggcijxfu.supabase.co';
  const defaultKey = 'sb_publishable_PEVDs7pauyzHqBRiZNMuLg_tXFhfw0v';

  const savedUrl = localStorage.getItem('SUPABASE_URL') || defaultUrl;
  const savedKey = localStorage.getItem('SUPABASE_ANON_KEY') || defaultKey;

  conectarSupabase(savedUrl, savedKey);
  configurarEventos();
});

// ===================================================
// CONEXÃO COM SUPABASE
// ===================================================
function conectarSupabase(url, key) {
  try {
    supabaseClient = supabase.createClient(url, key);
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
    carregarDados();
  } catch (err) {
    console.error('Erro ao conectar:', err.message);
  }
}

async function carregarDados() {
  if (!supabaseClient) return;

  try {
    const { data: cat } = await supabaseClient.from('categorias').select('*');
    estado.categorias = cat || [];

    const { data: trans } = await supabaseClient.from('transacoes').select('*, categoria:categorias(nome)');
    estado.transacoes = trans || [];

    const { data: rec } = await supabaseClient.from('gastos_recorrentes').select('*');
    estado.recorrentes = rec || [];

    const { data: reg } = await supabaseClient.from('regras_mapeamento').select('*');
    estado.regras = reg || [];

    atualizarUI();
  } catch (e) {
    console.warn('Erro ao carregar dados:', e.message);
    atualizarUI();
  }
}

// ===================================================
// ATUALIZAÇÃO DA INTERFACE & FILTROS GLOBAIS
// ===================================================
function atualizarUI() {
  const filtradas = obterTransacoesFiltradas();

  // 0. NOTIFICAÇÃO DE PENDENTES DE AJUSTE (9.0 OUTROS)
  const pendentes = estado.transacoes.filter(t => t.categoria && t.categoria.nome.includes('9.0 Outros'));
  const alertBox = document.getElementById('alert-pendentes-box');
  if (alertBox) {
    if (pendentes.length > 0) {
      document.getElementById('alert-pendentes-texto').textContent = `Existem ${pendentes.length} lançamento(s) pendentes de classificação em "Outros"!`;
      alertBox.classList.remove('hidden');
    } else {
      alertBox.classList.add('hidden');
    }
  }

  // 1. Total e Média Diária
  const total = filtradas.reduce((s, t) => s + Number(t.valor), 0);
  document.getElementById('val-gastos-totais').textContent = fmt(total);

  const diasNoMes = new Date().getDate();
  const mediaDiaria = total > 0 ? (total / diasNoMes) : 0;
  document.getElementById('val-media-diaria').textContent = `Média: ${fmt(mediaDiaria)}/dia (${filtradas.length} compras)`;

  // 2. Maior Gasto Individual
  let maiorGasto = null;
  filtradas.forEach(t => {
    if (!maiorGasto || Number(t.valor) > Number(maiorGasto.valor)) {
      maiorGasto = t;
    }
  });

  if (maiorGasto) {
    document.getElementById('val-maior-gasto-item').textContent = `${fmt(maiorGasto.valor)}`;
    document.getElementById('val-maior-gasto-detalhe').textContent = `${maiorGasto.descricao} (${maiorGasto.pago_por})`;
  } else {
    document.getElementById('val-maior-gasto-item').textContent = '—';
    document.getElementById('val-maior-gasto-detalhe').textContent = 'Nenhum lançamento no período';
  }

  // 3. Dia da Semana que Mais Gasta
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const somaPorDia = [0, 0, 0, 0, 0, 0, 0];

  filtradas.forEach(t => {
    if (t.data) {
      const d = new Date(t.data).getDay();
      somaPorDia[d] += Number(t.valor);
    }
  });

  let maxDiaIndex = 0;
  somaPorDia.forEach((val, idx) => {
    if (val > somaPorDia[maxDiaIndex]) maxDiaIndex = idx;
  });

  const diaNome = somaPorDia[maxDiaIndex] > 0 ? diasSemana[maxDiaIndex] : '—';
  const pctDia = total > 0 ? ((somaPorDia[maxDiaIndex] / total) * 100).toFixed(0) : 0;
  document.getElementById('val-dia-mais-gasta').textContent = diaNome;
  document.getElementById('val-dia-mais-gasta-sub').textContent = somaPorDia[maxDiaIndex] > 0 ? `${pctDia}% dos gastos (${fmt(somaPorDia[maxDiaIndex])})` : 'Sem dados';

  // 4. Maior vs Menor Centro de Custo Macro
  const mapaMacro = {};
  filtradas.forEach(t => {
    const nomeCat = t.categoria ? t.categoria.nome : '9.0 Outros';
    mapaMacro[nomeCat] = (mapaMacro[nomeCat] || 0) + Number(t.valor);
  });

  let maiorMacro = '—', maiorVal = 0;
  let menorMacro = '—', menorVal = Infinity;

  Object.entries(mapaMacro).forEach(([nome, val]) => {
    if (val > maiorVal) { maiorVal = val; maiorMacro = nome; }
    if (val < menorVal) { menorVal = val; menorMacro = nome; }
  });

  if (menorVal === Infinity) menorVal = 0;

  document.getElementById('val-maior-macro').textContent = maiorVal > 0 ? `${maiorMacro} (${fmt(maiorVal)})` : '—';
  document.getElementById('val-menor-macro').textContent = menorVal > 0 ? `${menorMacro} (${fmt(menorVal)})` : '—';

  // 5. Dica de Economia Potencial
  gerarDica(maiorMacro, maiorVal, total);

  // 6. Preencher Extrato e Gráficos 2D (Pizza + Linha)
  preencherTabelaExtrato(filtradas);
  renderizarGraficoPie(mapaMacro, total);
  renderizarGraficoLinhaEvolucao();

  // 7. Atualizar Módulos Adicionais
  atualizarRecorrentes();
  atualizarInvestimentos();
}

function obterTransacoesFiltradas() {
  let res = estado.transacoes;
  const hoje = new Date();

  if (estado.filtroPeriodo === 'custom' && estado.dataInicio && estado.dataFim) {
    const dIni = new Date(estado.dataInicio);
    const dFim = new Date(estado.dataFim);
    dFim.setHours(23, 59, 59);

    res = res.filter(t => {
      const d = new Date(t.data);
      return d >= dIni && d <= dFim;
    });
  } else if (estado.filtroPeriodo === 'mes-atual') {
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    res = res.filter(t => {
      const d = new Date(t.data);
      return d.getFullYear() === anoAtual && d.getMonth() === mesAtual;
    });
  } else if (estado.filtroPeriodo === 'mes-passado') {
    const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    res = res.filter(t => {
      const d = new Date(t.data);
      return d.getFullYear() === mesPassado.getFullYear() && d.getMonth() === mesPassado.getMonth();
    });
  } else if (estado.filtroPeriodo === '3-meses') {
    const limite3M = new Date();
    limite3M.setMonth(limite3M.getMonth() - 3);
    res = res.filter(t => new Date(t.data) >= limite3M);
  }

  if (estado.filtroMacro !== 'todas') {
    res = res.filter(t => t.categoria && t.categoria.nome.toLowerCase().includes(estado.filtroMacro.toLowerCase()));
  }

  return res;
}

function gerarDica(cat, val, total) {
  const el = document.getElementById('texto-dica-economia');
  if (!el) return;
  if (total === 0) { el.textContent = 'Mande lançamentos no Telegram para ver análises aqui.'; return; }
  const pct = ((val / total) * 100).toFixed(0);
  el.innerHTML = `💡 <strong>Dica de Economia:</strong> A categoria <strong>${cat}</strong> representa <strong>${pct}%</strong> dos gastos da família (${fmt(val)}). Reduzir 15% aqui economiza <strong>${fmt(val * 0.15)}/mês</strong>!`;
}

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ===================================================
// GRÁFICO CIRCULAR DE PIZZA / DONUT (CHART.JS)
// ===================================================
function renderizarGraficoPie(mapaMacro, total) {
  const canvas = document.getElementById('chart-pie-categorias');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = Object.keys(mapaMacro);
  const valores = Object.values(mapaMacro);
  const cores = ['#38bdf8', '#f43f5e', '#10b981', '#a855f7', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];

  if (chartPieInstance) chartPieInstance.destroy();

  chartPieInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['Nenhum gasto'],
      datasets: [{
        data: valores.length > 0 ? valores : [1],
        backgroundColor: valores.length > 0 ? cores.slice(0, labels.length) : ['#1e293b'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// ===================================================
// GRÁFICO DE LINHA: EVOLUÇÃO DE GASTOS MÊS A MÊS
// ===================================================
function renderizarGraficoLinhaEvolucao() {
  const canvas = document.getElementById('chart-line-evolucao');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mapaMeses = {};

  // Agrupar transações pelos últimos 6 meses
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${mesesNomes[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
    mapaMeses[chave] = 0;
  }

  estado.transacoes.forEach(t => {
    if (t.data) {
      const d = new Date(t.data);
      const chave = `${mesesNomes[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
      if (mapaMeses[chave] !== undefined) {
        mapaMeses[chave] += Number(t.valor);
      }
    }
  });

  const labels = Object.keys(mapaMeses);
  const valores = Object.values(mapaMeses);

  if (chartLineInstance) chartLineInstance.destroy();

  chartLineInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gastos Totais (R$)',
        data: valores,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#38bdf8',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Total: ${fmt(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// ===================================================
// TABELA DE EXTRATO COM EDIÇÃO E ENSINO DO ROBÔ
// ===================================================
function preencherTabelaExtrato(lista, filtroBusca = '') {
  const tbody = document.getElementById('tbody-transacoes');
  tbody.innerHTML = '';

  let filtradas = lista;
  if (filtroBusca) {
    const t = filtroBusca.toLowerCase();
    filtradas = lista.filter(r =>
      r.descricao.toLowerCase().includes(t) ||
      (r.categoria && r.categoria.nome.toLowerCase().includes(t)) ||
      r.pago_por.toLowerCase().includes(t)
    );
  }

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum gasto encontrado.</td></tr>';
    return;
  }

  [...filtradas].sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(t => {
    const cat = t.categoria ? t.categoria.nome : '9.0 Outros';
    const quem = t.pago_por === 'Ele' ? '👨 Leo' : '👩 Giu';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-'}</td>
      <td><span class="tag">${cat}</span></td>
      <td><strong>${t.descricao}</strong></td>
      <td>${quem}</td>
      <td style="color:var(--red);font-weight:700">${fmt(t.valor)}</td>
      <td style="text-align:center;">
        <button onclick="abrirEdicao('${t.id}')" style="background:none;border:none;cursor:pointer;" title="Editar e Reordenar">✏️</button>
        <button onclick="excluirTransacao('${t.id}')" style="background:none;border:none;cursor:pointer;" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.excluirTransacao = async function(id) {
  if (!confirm('Excluir este lançamento?')) return;
  if (supabaseClient) {
    await supabaseClient.from('transacoes').delete().eq('id', id);
    carregarDados();
  }
};

window.abrirEdicao = function(id) {
  const t = estado.transacoes.find(r => r.id == id);
  if (!t) return;
  document.getElementById('edit-id').value = t.id;
  document.getElementById('edit-descricao').value = t.descricao;
  document.getElementById('edit-valor').value = t.valor;
  document.getElementById('edit-pago-por').value = t.pago_por;

  if (t.categoria && t.categoria.nome) {
    const sel = document.getElementById('edit-categoria-macro');
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value.includes(t.categoria.nome)) {
        sel.selectedIndex = i;
        break;
      }
    }
  }

  document.getElementById('modal-editar').classList.remove('hidden');
};

// ===================================================
// MÓDULO 2: GASTOS RECORRENTES COM RESPONSÁVEL
// ===================================================
function atualizarRecorrentes() {
  const tbody = document.getElementById('tbody-recorrentes');
  if (!tbody) return;
  tbody.innerHTML = '';

  const total = estado.recorrentes.reduce((s, r) => s + Number(r.valor), 0);
  document.getElementById('val-total-recorrente').textContent = fmt(total);

  const pctRenda = ((total / estado.rendaCasal) * 100).toFixed(0);
  document.getElementById('val-pct-comprometido').textContent = `${pctRenda}% da renda comprometida`;

  if (estado.recorrentes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhuma conta fixa cadastrada.</td></tr>';
    return;
  }

  const hoje = new Date().getDate();

  estado.recorrentes.forEach(r => {
    const tr = document.createElement('tr');
    const dias = r.dia_vencimento - hoje;
    let statusText = dias === 0 ? '🚨 Vence Hoje' : (dias > 0 && dias <= 3 ? `⏰ Em ${dias} dia(s)` : '✅ Ok');

    const respTag = r.responsavel === 'Ele' ? '👨 Leo' : (r.responsavel === 'Ela' ? '👩 Giu' : '💑 Casal');

    tr.innerHTML = `
      <td>Dia ${r.dia_vencimento}</td>
      <td><strong>${r.nome}</strong></td>
      <td>${respTag}</td>
      <td>${r.categoria_macro || '3.0 Moradia'}</td>
      <td style="color:var(--red); font-weight:600">${fmt(r.valor)}</td>
      <td><span class="tag">${statusText}</span></td>
      <td><button onclick="excluirRecorrente('${r.id}')" style="background:none;border:none;cursor:pointer;">🗑️</button></td>
    `;
    tbody.appendChild(tr);
  });
}

window.excluirRecorrente = async function(id) {
  if (supabaseClient) {
    await supabaseClient.from('gastos_recorrentes').delete().eq('id', id);
    carregarDados();
  }
};

// ===================================================
// MÓDULO 3: SIMULADOR DE INVESTIMENTOS & CORRELAÇÃO COM FINANCIAMENTO
// ===================================================
function atualizarInvestimentos() {
  const sobra = parseFloat(document.getElementById('inv-input-sobra').value) || estado.sobraReal;
  const taxaAnualInput = parseFloat(document.getElementById('inv-input-taxa').value) || 13.65;
  const prazoMesesInput = parseInt(document.getElementById('inv-input-prazo').value) || 24;

  const taxaAnualDecimal = taxaAnualInput / 100;

  function calcFuturo(taxa, meses) {
    const i = Math.pow(1 + taxa, 1 / 12) - 1;
    let acum = 0;
    for (let m = 0; m < meses; m++) {
      acum = (acum + sobra) * (1 + i);
    }
    return acum;
  }

  const saldoResgate = calcFuturo(taxaAnualDecimal, prazoMesesInput);
  document.getElementById('inv-resgate-calculado').textContent = fmt(saldoResgate);
  document.getElementById('inv-resgate-sub').textContent = `Em ${prazoMesesInput} meses a ${taxaAnualInput}% a.a.`;

  // CORRELAÇÃO COM FINANCIAMENTO: QUITAÇÃO OU AMORTIZAÇÃO ANTECIPADA
  const finValorTotal = parseFloat(document.getElementById('fin-valor-total').value) || 0;
  const finEntrada = parseFloat(document.getElementById('fin-entrada').value) || 0;
  const saldoDevedor = finValorTotal - finEntrada;

  const elCorrelacao = document.getElementById('inv-correlacao-financiamento');

  if (saldoDevedor > 0) {
    const pctQuitacao = ((saldoResgate / saldoDevedor) * 100).toFixed(0);

    if (saldoResgate >= saldoDevedor) {
      elCorrelacao.innerHTML = `🎉 <strong>QUITAÇÃO TOTAL POSSÍVEL!</strong> Em <strong>${prazoMesesInput} meses</strong>, o saldo acumulado de <strong>${fmt(saldoResgate)}</strong> será suficiente para <strong>quitar 100% do saldo devedor</strong> do financiamento (${fmt(saldoDevedor)})!`;
    } else {
      elCorrelacao.innerHTML = `💡 <strong>AMORTIZAÇÃO ANTECIPADA:</strong> Em <strong>${prazoMesesInput} meses</strong>, vocês terão <strong>${fmt(saldoResgate)}</strong>, cobrindo <strong>${pctQuitacao}%</strong> do saldo devedor de ${fmt(saldoDevedor)}. Isso reduzirá drasticamente os juros futuros!`;
    }
  } else {
    elCorrelacao.innerHTML = `💡 Configure uma simulação na aba <strong>Financiamento</strong> para ver o plano de amortização antecipada aqui!`;
  }
}

// ===================================================
// EVENTOS & NAVEGAÇÃO POR ABAS
// ===================================================
function configurarEventos() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.getElementById(target).classList.add('active');
    });
  });

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      estado.filtroPeriodo = btn.getAttribute('data-period');
      atualizarUI();
    });
  });

  document.getElementById('btn-aplicar-datas').addEventListener('click', () => {
    const dIni = document.getElementById('filtro-data-inicio').value;
    const dFim = document.getElementById('filtro-data-fim').value;

    if (!dIni || !dFim) return alert('Selecione a data de início e fim!');

    estado.filtroPeriodo = 'custom';
    estado.dataInicio = dIni;
    estado.dataFim = dFim;

    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    atualizarUI();
  });

  const btnPendentes = document.getElementById('btn-filtrar-pendentes');
  if (btnPendentes) {
    btnPendentes.addEventListener('click', () => {
      estado.filtroMacro = '9.0 Outros';
      document.getElementById('filtro-categoria-macro').value = '9.0 Outros';
      atualizarUI();
    });
  }

  document.getElementById('filtro-categoria-macro').addEventListener('change', (e) => {
    estado.filtroMacro = e.target.value;
    atualizarUI();
  });

  document.getElementById('inv-input-sobra').addEventListener('input', atualizarInvestimentos);
  document.getElementById('inv-input-taxa').addEventListener('input', atualizarInvestimentos);
  document.getElementById('inv-input-prazo').addEventListener('input', atualizarInvestimentos);

  document.getElementById('btn-salvar-edicao').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    const descricao = document.getElementById('edit-descricao').value.trim();
    const novaMacro = document.getElementById('edit-categoria-macro').value;
    const valor = parseFloat(document.getElementById('edit-valor').value);
    const pago_por = document.getElementById('edit-pago-por').value;

    if (!descricao || !valor) return alert('Preencha os campos!');

    if (supabaseClient) {
      let catId = null;
      const { data: ex } = await supabaseClient.from('categorias').select('id').ilike('nome', novaMacro).maybeSingle();
      if (ex) {
        catId = ex.id;
      } else {
        const { data: nv } = await supabaseClient.from('categorias').insert([{ nome: novaMacro, icone: '📌' }]).select('id').single();
        if (nv) catId = nv.id;
      }

      await supabaseClient.from('transacoes').update({ descricao, valor, pago_por, categoria_id: catId }).eq('id', id);

      const primeiraPalavra = descricao.split(/\s+/)[0].toLowerCase();
      if (primeiraPalavra && primeiraPalavra.length > 2) {
        const { data: regraEx } = await supabaseClient
          .from('regras_mapeamento')
          .select('id')
          .ilike('palavra_chave', primeiraPalavra)
          .maybeSingle();

        if (regraEx) {
          await supabaseClient.from('regras_mapeamento').update({
            categoria_macro: novaMacro,
            subcategoria_micro: novaMacro
          }).eq('id', regraEx.id);
        } else {
          await supabaseClient.from('regras_mapeamento').insert([{
            palavra_chave: primeiraPalavra,
            categoria_macro: novaMacro,
            subcategoria_micro: novaMacro
          }]);
        }
      }

      document.getElementById('modal-editar').classList.add('hidden');
      carregarDados();
    }
  });

  document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
    document.getElementById('modal-editar').classList.add('hidden');
  });

  document.getElementById('form-novo-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const catTexto = document.getElementById('gasto-categoria-texto').value.trim();
    const descricao = document.getElementById('gasto-descricao').value.trim();
    const valor = parseFloat(document.getElementById('gasto-valor').value);
    const pago_por = document.getElementById('gasto-pago-por').value;

    if (supabaseClient) {
      let catId = null;
      if (catTexto) {
        const nome = catTexto.charAt(0).toUpperCase() + catTexto.slice(1).toLowerCase();
        const { data: ex } = await supabaseClient.from('categorias').select('id').ilike('nome', nome).maybeSingle();
        if (ex) { catId = ex.id; }
        else {
          const { data: nv } = await supabaseClient.from('categorias').insert([{ nome, icone: '📌' }]).select('id').single();
          if (nv) catId = nv.id;
        }
      }

      await supabaseClient.from('transacoes').insert([{
        descricao, valor, pago_por, categoria_id: catId, data: new Date().toISOString().split('T')[0]
      }]);

      carregarDados();
    }
    document.getElementById('form-novo-gasto').reset();
  });

  document.getElementById('form-nova-recorrente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('rec-nome').value.trim();
    const valor = parseFloat(document.getElementById('rec-valor').value);
    const dia_vencimento = parseInt(document.getElementById('rec-dia').value);
    const responsavel = document.getElementById('rec-responsavel').value;
    const categoria_macro = document.getElementById('rec-macro').value;

    if (supabaseClient) {
      await supabaseClient.from('gastos_recorrentes').insert([{
        nome, valor, dia_vencimento, responsavel, categoria_macro, ativo: true
      }]);
      carregarDados();
    }
    document.getElementById('form-nova-recorrente').reset();
  });

  document.getElementById('btn-calcular-financiamento').addEventListener('click', () => {
    const total = parseFloat(document.getElementById('fin-valor-total').value) || 0;
    const entrada = parseFloat(document.getElementById('fin-entrada').value) || 0;
    const taxaAnual = parseFloat(document.getElementById('fin-juros').value) || 0;
    const prazo = parseInt(document.getElementById('fin-prazo').value) || 1;

    const financiado = total - entrada;
    const i = (taxaAnual / 100) / 12;

    const parcela = i > 0 ? (financiado * (i * Math.pow(1 + i, prazo))) / (Math.pow(1 + i, prazo) - 1) : financiado / prazo;
    const totalPago = parcela * prazo;
    const jurosPagos = totalPago - financiado;

    document.getElementById('fin-res-parcela').textContent = fmt(parcela);
    document.getElementById('fin-res-juros').textContent = fmt(jurosPagos);

    const sobraAtual = estado.sobraReal;
    const novaSobra = sobraAtual - parcela;

    if (novaSobra >= 0) {
      document.getElementById('fin-res-impacto').innerHTML = `✅ Com essa parcela de <strong>${fmt(parcela)}</strong>, ainda sobram <strong>${fmt(novaSobra)}/mês</strong> do orçamento do casal para poupar!`;
    } else {
      document.getElementById('fin-res-impacto').innerHTML = `⚠️ <strong>ALERTA DE ORÇAMENTO!</strong> Essa parcela de <strong>${fmt(parcela)}</strong> ultrapassa a sobra atual do casal em <strong>${fmt(Math.abs(novaSobra))}</strong>. É necessário reduzir custos antes.`;
    }

    atualizarInvestimentos();
  });

  document.getElementById('btn-config').addEventListener('click', () => {
    document.getElementById('cfg-url').value = localStorage.getItem('SUPABASE_URL') || '';
    document.getElementById('cfg-key').value = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    document.getElementById('modal-config').classList.remove('hidden');
  });

  document.getElementById('btn-fechar-config').addEventListener('click', () => {
    document.getElementById('modal-config').classList.add('hidden');
  });

  document.getElementById('btn-salvar-config').addEventListener('click', () => {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();
    if (url && key) { conectarSupabase(url, key); document.getElementById('modal-config').classList.add('hidden'); }
  });

  document.getElementById('btn-atualizar').addEventListener('click', carregarDados);
}
