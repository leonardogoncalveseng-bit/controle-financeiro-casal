// ===================================================
// APLICATIVO FINANCEIRO DO CASAL v2.0
// ===================================================

let supabaseClient = null;
let chartPieInstance = null;
let chartLineInstance = null;

// ===================================================
// HIERARQUIA DE CENTROS DE CUSTO (10 MACROS + SUBCATEGORIAS)
// ===================================================
const SUBCATEGORIAS_MAP = {
  '1.0 Alimentação': [
    '1.1 Supermercado',
    '1.2 Padaria',
    '1.3 Restaurante',
    '1.4 Delivery / iFood',
    '1.5 Açaí',
    '1.6 Açougue / Hortifruti'
  ],
  '2.0 Transporte': [
    '2.1 Combustível',
    '2.2 Manutenção Veicular',
    '2.3 Uber / App de Transporte',
    '2.4 Pedágio / Estacionamento',
    '2.5 Seguro Veicular'
  ],
  '3.0 Moradia': [
    '3.1 Aluguel',
    '3.2 Condomínio',
    '3.3 Energia / Luz (CPFL)',
    '3.4 Água (SAAE)',
    '3.5 Internet / Telefone',
    '3.6 Gás',
    '3.7 Manutenção / Reforma',
    '3.8 Casa / Utensílios Domésticos'
  ],
  '4.0 Saúde': [
    '4.1 Farmácia / Remédios',
    '4.2 Consultas Médicas',
    '4.3 Exames / Laboratório',
    '4.4 Plano de Saúde',
    '4.5 Academia / Esportes',
    '4.6 Dentista'
  ],
  '5.0 Lazer': [
    '5.1 Streaming (Netflix, Spotify...)',
    '5.2 Cinema / Shows / Teatro',
    '5.3 Viagens / Hotel',
    '5.4 Assinatura de Apps',
    '5.5 Passeios / Lazer Geral'
  ],
  '6.0 Educação': [
    '6.1 Mensalidade Escolar / Faculdade',
    '6.2 Cursos / Treinamentos',
    '6.3 Material Escolar / Livros'
  ],
  '7.0 Roupas & Cuidados Pessoais': [
    '7.1 Vestuário / Calçados',
    '7.2 Salão / Barbeiro',
    '7.3 Estética / Cosméticos',
    '7.4 Eletrônicos / Presentes pessoais'
  ],
  '8.0 Empresa / Negócios': [
    '8.1 Contabilidade / Contador',
    '8.2 Sistemas / Software / Hospedagem',
    '8.3 Impostos / DAS / Taxas CNPJ',
    '8.4 Marketing / Anúncios',
    '8.5 Equipamentos / Suprimentos',
    '8.6 Serviços Profissionais Terceiros'
  ],
  '9.0 Doações & Presentes': [
    '9.1 Presentes / Aniversários',
    '9.2 Casamentos / Confraternizações',
    '9.3 Caridade / Doações'
  ],
  '10.0 Outros': [
    '10.1 Diversos',
    '10.2 Transferências',
    '10.3 A Classificar'
  ]
};

// Estado global
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
  financiamentos: [],
  investimentos: [],
  regras: [],
  subcategoriasCustom: {}
};

// ===================================================
// INICIALIZAÇÃO
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  carregarSubcategoriasPersonalizadas();

  const defaultUrl = 'https://bsrcbtgdayqsggcijxfu.supabase.co';
  const defaultKey = 'sb_publishable_PEVDs7pauyzHqBRiZNMuLg_tXFhfw0v';

  const savedUrl = localStorage.getItem('SUPABASE_URL') || defaultUrl;
  const savedKey = localStorage.getItem('SUPABASE_ANON_KEY') || defaultKey;

  conectarSupabase(savedUrl, savedKey);
  configurarEventos();
});

// ===================================================
// SUPABASE
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
  } catch(e) { console.warn('categorias:', e.message); }

  try {
    const { data: trans } = await supabaseClient.from('transacoes').select('*, categoria:categorias(nome)');
    estado.transacoes = trans || [];
  } catch(e) { console.warn('transacoes:', e.message); }

  try {
    const { data: rec, error: errRec } = await supabaseClient.from('gastos_recorrentes').select('*');
    if (errRec) {
      mostrarErroRecorrentes(`Erro ao carregar Contas Fixas: ${errRec.message}. Verifique se a tabela existe no Supabase.`);
    } else {
      estado.recorrentes = rec || [];
      esconderErroRecorrentes();
    }
  } catch(e) {
    mostrarErroRecorrentes('Tabela gastos_recorrentes não encontrada. Execute o SQL fornecido no Supabase.');
  }

  try {
    const { data: fin } = await supabaseClient.from('financiamentos').select('*');
    estado.financiamentos = fin || [];
  } catch(e) { console.warn('financiamentos:', e.message); }

  try {
    const { data: inv } = await supabaseClient.from('investimentos').select('*');
    estado.investimentos = inv || [];
  } catch(e) { console.warn('investimentos:', e.message); }

  try {
    const { data: reg } = await supabaseClient.from('regras_mapeamento').select('*');
    estado.regras = reg || [];
  } catch(e) { console.warn('regras:', e.message); }

  atualizarUI();
}

function mostrarErroRecorrentes(msg) {
  const el = document.getElementById('err-recorrentes');
  const txt = document.getElementById('err-recorrentes-texto');
  if (el) { el.classList.remove('hidden'); txt.textContent = msg; }
}

function esconderErroRecorrentes() {
  const el = document.getElementById('err-recorrentes');
  if (el) el.classList.add('hidden');
}

// ===================================================
// RESOLVER CHAVE DO MAPA DE CATEGORIAS
// ===================================================
function resolverChaveMacro(str) {
  if (!str) return '10.0 Outros';
  const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes('1.0') || s.includes('aliment')) return '1.0 Alimentação';
  if (s.includes('2.0') || s.includes('transp')) return '2.0 Transporte';
  if (s.includes('3.0') || s.includes('morad')) return '3.0 Moradia';
  if (s.includes('4.0') || s.includes('saud')) return '4.0 Saúde';
  if (s.includes('5.0') || s.includes('lazer')) return '5.0 Lazer';
  if (s.includes('6.0') || s.includes('educ')) return '6.0 Educação';
  if (s.includes('7.0') || s.includes('roupa') || s.includes('cuidado') || s.includes('barbeiro') || s.includes('salao')) return '7.0 Roupas & Cuidados Pessoais';
  if (s.includes('8.0') || s.includes('empresa') || s.includes('negoc') || s.includes('contador') || s.includes('theos') || s.includes('das') || s.includes('cnpj')) return '8.0 Empresa / Negócios';
  if (s.includes('9.0') || s.includes('doac') || s.includes('doação') || s.includes('presente')) return '9.0 Doações & Presentes';
  // Legado / compatibilidade com antigas categorias
  if (s.includes('9.0 outro') || s.includes('15.0') || s.includes('outro') || s.includes('divers')) return '10.0 Outros';
  return '10.0 Outros';
}

function atualizarOptionsMicro(macroVal, microSelecionado = '') {
  const selectMicro = document.getElementById('edit-categoria-micro');
  if (!selectMicro) return;
  selectMicro.innerHTML = '';

  const chaveFinal = resolverChaveMacro(macroVal);
  const listaMicros = SUBCATEGORIAS_MAP[chaveFinal] || ['10.1 Diversos'];

  listaMicros.forEach(micro => {
    const opt = document.createElement('option');
    opt.value = micro;
    opt.textContent = micro;
    if (microSelecionado) {
      const mn = micro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const sn = microSelecionado.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (mn.includes(sn) || sn.includes(mn)) opt.selected = true;
    }
    selectMicro.appendChild(opt);
  });
}

// ===================================================
// ATUALIZAÇÃO DA INTERFACE PRINCIPAL
// ===================================================
function atualizarUI() {
  const filtradas = obterTransacoesFiltradas();

  // 0. Badge pendentes (Outros)
  const pendentes = estado.transacoes.filter(t =>
    t.categoria && (t.categoria.nome.includes('Outros') || t.categoria.nome.includes('15.0') || t.categoria.nome.includes('Divers'))
  );
  const alertBox = document.getElementById('alert-pendentes-box');
  if (alertBox) {
    if (pendentes.length > 0) {
      document.getElementById('alert-pendentes-texto').textContent = `Existem ${pendentes.length} lançamento(s) pendentes de classificação em "Outros"!`;
      alertBox.classList.remove('hidden');
    } else {
      alertBox.classList.add('hidden');
    }
  }

  // 1. KPIs
  const total = filtradas.reduce((s, t) => s + Number(t.valor), 0);
  document.getElementById('val-gastos-totais').textContent = fmt(total);
  const diasNoMes = new Date().getDate();
  document.getElementById('val-media-diaria').textContent = `Média: ${fmt(total / Math.max(diasNoMes, 1))}/dia (${filtradas.length} compras)`;

  // 2. Maior gasto
  let maiorGasto = null;
  filtradas.forEach(t => { if (!maiorGasto || Number(t.valor) > Number(maiorGasto.valor)) maiorGasto = t; });
  if (maiorGasto) {
    document.getElementById('val-maior-gasto-item').textContent = fmt(maiorGasto.valor);
    document.getElementById('val-maior-gasto-detalhe').textContent = `${maiorGasto.descricao} (${maiorGasto.pago_por})`;
  } else {
    document.getElementById('val-maior-gasto-item').textContent = '—';
    document.getElementById('val-maior-gasto-detalhe').textContent = 'Nenhum lançamento no período';
  }

  // 3. Dia da semana que mais gasta
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const somaPorDia = [0, 0, 0, 0, 0, 0, 0];
  filtradas.forEach(t => { if (t.data) somaPorDia[new Date(t.data + 'T12:00:00').getDay()] += Number(t.valor); });
  const maxIdx = somaPorDia.indexOf(Math.max(...somaPorDia));
  const pctDia = total > 0 ? ((somaPorDia[maxIdx] / total) * 100).toFixed(0) : 0;
  document.getElementById('val-dia-mais-gasta').textContent = somaPorDia[maxIdx] > 0 ? diasSemana[maxIdx] : '—';
  document.getElementById('val-dia-mais-gasta-sub').textContent = somaPorDia[maxIdx] > 0 ? `${pctDia}% dos gastos (${fmt(somaPorDia[maxIdx])})` : 'Sem dados';

  // 4. Maior/Menor macro
  const mapaMacro = {};
  filtradas.forEach(t => {
    const nom = t.categoria ? t.categoria.nome : '10.0 Outros';
    mapaMacro[nom] = (mapaMacro[nom] || 0) + Number(t.valor);
  });
  let maiorMacro = '—', maiorVal = 0, menorMacro = '—', menorVal = Infinity;
  Object.entries(mapaMacro).forEach(([nom, val]) => {
    if (val > maiorVal) { maiorVal = val; maiorMacro = nom; }
    if (val < menorVal) { menorVal = val; menorMacro = nom; }
  });
  document.getElementById('val-maior-macro').textContent = maiorVal > 0 ? `${maiorMacro.split(' ').slice(1).join(' ')} (${fmt(maiorVal)})` : '—';
  document.getElementById('val-menor-macro').textContent = menorVal < Infinity ? `${menorMacro.split(' ').slice(1).join(' ')} (${fmt(menorVal)})` : '—';

  // 4b. Novos KPIs Extras
  let sumFixos = 0;
  let sumVariaveis = 0;
  let sumSemana = 0;
  let sumFds = 0;
  let sumAlimentacao = 0;

  // Nível Zero (Custo de Sobrevivência)
  let nivelZero = 0;
  if (estado.recorrentes && estado.recorrentes.length) {
    nivelZero = estado.recorrentes.filter(r => r.ativo).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }
  const elNivelZero = document.getElementById('val-nivel-zero');
  if (elNivelZero) elNivelZero.textContent = fmt(nivelZero);

  filtradas.forEach(t => {
    const val = Number(t.valor) || 0;
    
    // Fixos vs Variáveis
    if (t.descricao.includes('[Conta Fixa]')) {
      sumFixos += val;
    } else {
      sumVariaveis += val;
    }

    // Curva do FDS
    const dia = t.data ? new Date(t.data + 'T12:00:00').getDay() : -1;
    if (dia === 0 || dia === 6) {
      sumFds += val;
    } else if (dia >= 1 && dia <= 5) {
      sumSemana += val;
    }

    // Alimentação
    if (t.categoria && t.categoria.nome.includes('1.0 Alimentação')) {
      sumAlimentacao += val;
    }
  });

  // Atualiza DOM - Fixos vs Dia a dia
  if (document.getElementById('val-fixos-vs-var-fixo')) {
    const pctFixo = total > 0 ? ((sumFixos / total) * 100).toFixed(0) : 0;
    const pctVar = total > 0 ? ((sumVariaveis / total) * 100).toFixed(0) : 0;
    document.getElementById('val-fixos-vs-var-fixo').textContent = `${pctFixo}%`;
    document.getElementById('val-fixos-vs-var-var').textContent = `${pctVar}%`;
    document.getElementById('bar-fixos').style.width = `${pctFixo}%`;
    document.getElementById('bar-opcionais').style.width = `${pctVar}%`;
  }

  // Atualiza DOM - FDS
  if (document.getElementById('val-curva-semana')) {
    const totalSemanaFds = sumSemana + sumFds;
    const pctSemana = totalSemanaFds > 0 ? ((sumSemana / totalSemanaFds) * 100).toFixed(0) : 0;
    const pctFds = totalSemanaFds > 0 ? ((sumFds / totalSemanaFds) * 100).toFixed(0) : 0;
    document.getElementById('val-curva-semana').textContent = `${pctSemana}%`;
    document.getElementById('val-curva-fds').textContent = `${pctFds}%`;
    document.getElementById('bar-semana').style.width = `${pctSemana}%`;
    document.getElementById('bar-fds').style.width = `${pctFds}%`;
  }

  // Atualiza DOM - Alimentação
  if (document.getElementById('val-term-alim')) {
    const pctAlim = total > 0 ? ((sumAlimentacao / total) * 100).toFixed(0) : 0;
    document.getElementById('val-term-alim').textContent = `${pctAlim}%`;
  }

  // Atualiza DOM - Alerta Variáveis
  if (document.getElementById('val-alerta-var')) {
    let contasVar = [];
    if (estado.recorrentes) contasVar = estado.recorrentes.filter(r => r.ativo && r.tipo_valor === 'variavel');
    if (contasVar.length > 0) {
      document.getElementById('val-alerta-var').textContent = `Fique de olho: ${contasVar.map(r => r.nome).join(', ')}`;
    } else {
      document.getElementById('val-alerta-var').textContent = 'Nenhuma conta variável cadastrada.';
    }
  }


  // 5. Dica
  gerarDica(maiorMacro, maiorVal, total);

  // 6. Atualizar Título do Extrato
  const tituloExtrato = document.getElementById('titulo-extrato');
  if (tituloExtrato) {
    const mapaTitulos = {
      'mes-atual': 'Este Mês',
      'mes-passado': 'Mês Passado',
      '3-meses': 'Últimos 3 Meses',
      'custom': 'Período Personalizado'
    };
    tituloExtrato.textContent = `Extrato de Gastos da Família (${mapaTitulos[estado.filtroPeriodo] || ''})`;
  }

  // 7. Tabela, gráficos e módulos
  preencherTabelaExtrato(filtradas);
  renderizarGraficoPie(mapaMacro, total);
  renderizarGraficoLinhaEvolucao();
  atualizarRecorrentes();
  atualizarFinanciamentos();
  atualizarInvestimentos();
}

function obterTransacoesFiltradas() {
  let res = estado.transacoes;
  const hoje = new Date();

  if (estado.filtroPeriodo === 'custom' && estado.dataInicio && estado.dataFim) {
    const dIni = new Date(estado.dataInicio + 'T00:00:00');
    const dFim = new Date(estado.dataFim + 'T23:59:59');
    res = res.filter(t => { const d = new Date(t.data + 'T12:00:00'); return d >= dIni && d <= dFim; });
  } else if (estado.filtroPeriodo === 'mes-atual') {
    res = res.filter(t => {
      const d = new Date(t.data + 'T12:00:00');
      return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
    });
  } else if (estado.filtroPeriodo === 'mes-passado') {
    const mp = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    res = res.filter(t => {
      const d = new Date(t.data + 'T12:00:00');
      return d.getFullYear() === mp.getFullYear() && d.getMonth() === mp.getMonth();
    });
  } else if (estado.filtroPeriodo === '3-meses') {
    const lim = new Date(); lim.setMonth(lim.getMonth() - 3);
    res = res.filter(t => new Date(t.data + 'T12:00:00') >= lim);
  }

  if (estado.filtroMacro !== 'todas') {
    res = res.filter(t => t.categoria && t.categoria.nome.toLowerCase().includes(estado.filtroMacro.toLowerCase().split(' ').slice(1).join(' ')));
  }

  return res;
}

function gerarDica(cat, val, total) {
  const el = document.getElementById('texto-dica-economia');
  if (!el) return;
  if (total === 0) { el.textContent = 'Mande lançamentos no Telegram para ver análises aqui.'; return; }
  const pct = ((val / total) * 100).toFixed(0);
  const catNome = cat.split(' ').slice(1).join(' ');
  el.innerHTML = `💡 <strong>Dica:</strong> <strong>${catNome}</strong> representa <strong>${pct}%</strong> dos gastos (${fmt(val)}). Reduzir 15% = economizar <strong>${fmt(val * 0.15)}/mês</strong>!`;
}

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtData(str) {
  if (!str) return '-';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

// ===================================================
// CÁLCULO DE JUROS COMPOSTOS
// ===================================================
function calcularJurosCompostos(valorInicial, taxaAnualPct, dataInicio, dataFim) {
  const taxaAnual = taxaAnualPct / 100;
  const dIni = new Date(dataInicio + 'T00:00:00');
  const dFim = dataFim ? new Date(dataFim + 'T00:00:00') : new Date();
  const diffMs = dFim - dIni;
  if (diffMs <= 0) return valorInicial;
  const anosDecorridos = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return valorInicial * Math.pow(1 + taxaAnual, anosDecorridos);
}

// ===================================================
// GRÁFICO CIRCULAR (PIZZA/DONUT)
// ===================================================
function renderizarGraficoPie(mapaMacro, total) {
  const canvas = document.getElementById('chart-pie-categorias');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(mapaMacro).map(k => k.split(' ').slice(1).join(' '));
  const valores = Object.values(mapaMacro);
  const cores = ['#38bdf8', '#f43f5e', '#10b981', '#a855f7', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#eab308', '#8b5cf6'];

  if (chartPieInstance) chartPieInstance.destroy();
  chartPieInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['Nenhum gasto'],
      datasets: [{
        data: valores.length > 0 ? valores : [0],
        backgroundColor: valores.length > 0 ? cores.slice(0, labels.length) : ['#1e293b'],
        borderRadius: 4,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => { const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0; return ` ${fmt(ctx.raw)} (${pct}%)`; } }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
      }
    }
  });
}

// ===================================================
// GRÁFICO DE LINHA: EVOLUÇÃO MENSAL
// ===================================================
function renderizarGraficoLinhaEvolucao() {
  const canvas = document.getElementById('chart-line-evolucao');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mapaMeses = {};
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    mapaMeses[`${mesesNomes[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`] = 0;
  }
  estado.transacoes.forEach(t => {
    if (t.data) {
      const d = new Date(t.data + 'T12:00:00');
      const chave = `${mesesNomes[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
      if (mapaMeses[chave] !== undefined) mapaMeses[chave] += Number(t.valor);
    }
  });

  if (chartLineInstance) chartLineInstance.destroy();
  chartLineInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(mapaMeses),
      datasets: [{
        label: 'Gastos Totais (R$)',
        data: Object.values(mapaMeses),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.1)',
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
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` Total: ${fmt(ctx.raw)}` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// ===================================================
// TABELA DE EXTRATO
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
  [...filtradas].sort((a, b) => new Date(b.data + 'T12:00:00') - new Date(a.data + 'T12:00:00')).forEach(t => {
    const cat = t.categoria ? t.categoria.nome : '10.0 Outros';
    const quem = t.pago_por === 'Ele' ? '👨 Leo' : '👩 Giu';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtData(t.data)}</td>
      <td><span class="tag">${cat}</span></td>
      <td><strong>${t.descricao}</strong></td>
      <td>${quem}</td>
      <td style="color:var(--red);font-weight:700">${fmt(t.valor)}</td>
      <td style="text-align:center;">
        <button onclick="abrirEdicao('${t.id}')" style="background:none;border:none;cursor:pointer;" title="Editar">✏️</button>
        <button onclick="excluirTransacao('${t.id}')" style="background:none;border:none;cursor:pointer;" title="Excluir">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.excluirTransacao = async function(id) {
  if (!confirm('Excluir este lançamento?')) return;
  if (supabaseClient) { await supabaseClient.from('transacoes').delete().eq('id', id); carregarDados(); }
};

window.abrirEdicao = function(id) {
  const t = estado.transacoes.find(r => r.id == id);
  if (!t) return;
  document.getElementById('edit-id').value = t.id;
  document.getElementById('edit-descricao').value = t.descricao.replace(/^\[.*?\]\s*/, '');
  document.getElementById('edit-valor').value = t.valor;
  document.getElementById('edit-pago-por').value = t.pago_por;
  document.getElementById('edit-data').value = t.data ? t.data.split('T')[0] : '';
  const nomeCat = t.categoria ? t.categoria.nome : '10.0 Outros';
  const chaveMacro = resolverChaveMacro(nomeCat);
  const macroSel = document.getElementById('edit-categoria-macro');
  for (let i = 0; i < macroSel.options.length; i++) {
    if (resolverChaveMacro(macroSel.options[i].value) === chaveMacro) { macroSel.selectedIndex = i; break; }
  }
  let microAtual = '';
  const mm = t.descricao.match(/^\[(.*?)\]/);
  if (mm) microAtual = mm[1];
  atualizarOptionsMicro(chaveMacro, microAtual);
  document.getElementById('modal-editar').classList.remove('hidden');
};

// ===================================================
// MÓDULO 2: CONTAS FIXAS (RECORRENTES)
// ===================================================
function atualizarRecorrentes() {
  const tbody = document.getElementById('tbody-recorrentes');
  if (!tbody) return;
  tbody.innerHTML = '';

  const totalFixo = estado.recorrentes.filter(r => (r.tipo_valor || 'fixo') === 'fixo').reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalVar  = estado.recorrentes.filter(r => (r.tipo_valor || 'fixo') === 'variavel').reduce((s, r) => s + Number(r.valor || 0), 0);
  const total     = totalFixo + totalVar;

  const elTotal = document.getElementById('val-total-recorrente');
  const elVar   = document.getElementById('val-total-variavel');
  const elTag   = document.getElementById('rec-count-tag');
  if (elTotal) elTotal.textContent = fmt(total);
  if (elVar)   elVar.textContent   = totalVar > 0 ? `${fmt(totalVar)} est.` : 'R$ 0,00';
  if (elTag)   elTag.textContent   = `${estado.recorrentes.length} conta(s)`;

  if (estado.recorrentes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Nenhuma conta fixa cadastrada. Use o formulário acima.</td></tr>';
    return;
  }

  const hoje = new Date().getDate();
  [...estado.recorrentes].sort((a, b) => a.dia_vencimento - b.dia_vencimento).forEach(r => {
    const tr = document.createElement('tr');
    const dias = r.dia_vencimento - hoje;
    let statusText = '✅ Ok';
    if (dias === 0) statusText = '🚨 Vence Hoje';
    else if (dias > 0 && dias <= (r.dias_alerta || 3)) statusText = `⏰ Em ${dias}d`;
    else if (dias < 0) statusText = `📌 Dia ${r.dia_vencimento}`;

    const respTag = r.responsavel === 'Ele' ? '👨 Leo' : (r.responsavel === 'Ela' ? '👩 Giu' : '💑 Casal');
    const empresaStr = r.empresa ? `<br><small style="color:var(--text-muted)">🏢 ${r.empresa}</small>` : '';
    const tipoTag = (r.tipo_valor || 'fixo') === 'variavel'
      ? `<span class="tag" style="background:rgba(245,158,11,0.15);color:var(--yellow)">📊 Variável</span>`
      : `<span class="tag" style="background:rgba(16,185,129,0.12);color:var(--green)">💰 Fixo</span>`;
    const valorStr = (r.tipo_valor || 'fixo') === 'variavel'
      ? `<span style="color:var(--yellow)">${r.valor ? fmt(r.valor) + ' est.' : '—'}</span>`
      : `<span style="color:var(--red);font-weight:600">${fmt(r.valor)}</span>`;

    tr.innerHTML = `
      <td>Dia ${r.dia_vencimento}</td>
      <td><strong>${r.nome}</strong>${empresaStr}</td>
      <td>${tipoTag}</td>
      <td>${respTag}</td>
      <td style="font-size:11px">${(r.categoria_macro || '10.0 Outros').split(' ').slice(1).join(' ')}</td>
      <td><small>${r.dias_alerta || 3}d antes</small><br>${statusText}</td>
      <td>${valorStr}</td>
      <td style="text-align:center;white-space:nowrap;">
        <button onclick="abrirPagamentoRecorrente('${r.id}')" class="btn-primary-sm" style="padding:4px 8px;font-size:11px;margin-right:4px;" title="Registrar Pagamento do Mês">💳 Pagar</button>
        <button onclick="abrirEdicaoRecorrente('${r.id}')" style="background:none;border:none;cursor:pointer;" title="Editar">✏️</button>
        <button onclick="excluirRecorrente('${r.id}')" style="background:none;border:none;cursor:pointer;" title="Excluir">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ===================================================
// SELETOR CASCATA: MICRO PARA LANÇAMENTO MANUAL E EDIÇÃO
// ===================================================
window.atualizarMicroGasto = function(macroVal) {
  const sel = document.getElementById('gasto-micro');
  if (!sel) return;
  const chave = resolverChaveMacro(macroVal);
  const lista = SUBCATEGORIAS_MAP[chave] || ['10.1 Diversos'];
  sel.innerHTML = lista.map(m => `<option value="${m}">${m}</option>`).join('');
};

// inicializa micro do form de novo gasto ao carregar
window.addEventListener('DOMContentLoaded', () => {
  const macroEl = document.getElementById('gasto-macro');
  if (macroEl) atualizarMicroGasto(macroEl.value);
});

window.abrirEdicaoRecorrente = function(id) {
  const r = estado.recorrentes.find(rec => rec.id == id);
  if (!r) return;
  document.getElementById('edit-rec-id').value = r.id;
  document.getElementById('edit-rec-nome').value = r.nome;
  document.getElementById('edit-rec-empresa').value = r.empresa || '';
  document.getElementById('edit-rec-tipo-valor').value = r.tipo_valor || 'fixo';
  document.getElementById('edit-rec-valor').value = r.valor;
  document.getElementById('edit-rec-dia').value = r.dia_vencimento;
  document.getElementById('edit-rec-dias-alerta').value = r.dias_alerta || 3;
  document.getElementById('edit-rec-responsavel').value = r.responsavel || 'Casal';
  document.getElementById('edit-rec-macro').value = r.categoria_macro || '8.0 Empresa / Negócios';
  document.getElementById('modal-editar-recorrente').classList.remove('hidden');
};

// Baixar/Pagar Conta Recorrente
window.abrirPagamentoRecorrente = function(id) {
  const r = estado.recorrentes.find(rec => rec.id == id);
  if (!r) return;
  document.getElementById('pagar-rec-id').value = r.id;
  document.getElementById('pagar-rec-macro').value = r.categoria_macro || '3.0 Moradia';
  document.getElementById('pagar-rec-nome').value = r.empresa ? `${r.nome} (${r.empresa})` : r.nome;
  document.getElementById('pagar-rec-valor').value = r.valor || '';
  document.getElementById('pagar-rec-responsavel').value = (r.responsavel === 'Ela') ? 'Ela' : 'Ele';
  document.getElementById('modal-pagar-recorrente').classList.remove('hidden');
};

window.excluirRecorrente = async function(id) {
  if (!confirm('Excluir esta conta fixa?')) return;
  if (supabaseClient) { await supabaseClient.from('gastos_recorrentes').delete().eq('id', id); carregarDados(); }
};

// ===================================================
// MÓDULO 3: FINANCIAMENTOS
// ===================================================
function atualizarFinanciamentos() {
  const tbody = document.getElementById('tbody-financiamentos');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (estado.financiamentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Nenhum financiamento salvo.</td></tr>';
    return;
  }
  estado.financiamentos.forEach(f => {
    const saldo = Number(f.valor_total) - Number(f.entrada);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${f.nome}</strong></td>
      <td>${fmt(f.valor_total)}</td>
      <td>${fmt(f.entrada)}</td>
      <td><strong style="color:var(--yellow)">${fmt(saldo)}</strong></td>
      <td>${f.taxa_juros}%</td>
      <td>${f.prazo_meses} meses</td>
      <td style="color:var(--accent);font-weight:700">${fmt(f.parcela_mensal)}</td>
      <td style="text-align:center;"><button onclick="excluirFinanciamento('${f.id}')" style="background:none;border:none;cursor:pointer;">🗑️</button></td>`;
    tbody.appendChild(tr);
  });
}

window.excluirFinanciamento = async function(id) {
  if (!confirm('Remover esta simulação?')) return;
  if (supabaseClient) { await supabaseClient.from('financiamentos').delete().eq('id', id); carregarDados(); }
};

// ===================================================
// MÓDULO 4: INVESTIMENTOS REAIS + SIMULADOR
// ===================================================
function atualizarInvestimentos() {
  const tbody = document.getElementById('tbody-investimentos');
  const hoje = new Date().toISOString().split('T')[0];

  let totalAplicado = 0;
  let totalSaldoAtual = 0;
  let totalSaldoResgate = 0;

  if (!tbody) return;
  tbody.innerHTML = '';

  if (estado.investimentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">Nenhum investimento cadastrado ainda. Use o formulário ao lado!</td></tr>';
  } else {
    estado.investimentos.forEach(inv => {
      const saldoAtual = calcularJurosCompostos(Number(inv.valor_inicial), Number(inv.taxa_anual), inv.data_inicio, hoje);
      const saldoResgate = inv.data_resgate
        ? calcularJurosCompostos(Number(inv.valor_inicial), Number(inv.taxa_anual), inv.data_inicio, inv.data_resgate)
        : saldoAtual;

      totalAplicado += Number(inv.valor_inicial);
      totalSaldoAtual += saldoAtual;
      totalSaldoResgate += saldoResgate;

      const rendimento = saldoAtual - Number(inv.valor_inicial);
      const pctRendimento = ((rendimento / Number(inv.valor_inicial)) * 100).toFixed(1);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${inv.nome}</strong>
          ${inv.observacoes ? `<br><small style="color:var(--text-muted)">${inv.observacoes}</small>` : ''}
        </td>
        <td><span class="tag">${inv.tipo}</span></td>
        <td>${fmt(inv.valor_inicial)}</td>
        <td>${inv.taxa_anual}% a.a.</td>
        <td>${fmtData(inv.data_inicio)}</td>
        <td>${inv.data_resgate ? fmtData(inv.data_resgate) : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>
          <strong style="color:#10b981">${fmt(saldoAtual)}</strong>
          <br><small style="color:#10b981">+${pctRendimento}% (${fmt(rendimento)})</small>
        </td>
        <td>
          <strong style="color:#f59e0b">${fmt(saldoResgate)}</strong>
          ${inv.data_resgate ? `<br><small style="color:var(--text-muted)">${fmtData(inv.data_resgate)}</small>` : ''}
        </td>
        <td style="text-align:center;"><button onclick="excluirInvestimento('${inv.id}')" style="background:none;border:none;cursor:pointer;">🗑️</button></td>`;
      tbody.appendChild(tr);
    });
  }

  // KPIs do topo da aba Investimentos
  const elAplicado = document.getElementById('inv-total-aplicado');
  const elAtual = document.getElementById('inv-saldo-atual');
  const elResgate = document.getElementById('inv-saldo-resgate');
  const elSub = document.getElementById('inv-total-sub');
  const elBadge = document.getElementById('inv-qtd-badge');

  if (elAplicado) elAplicado.textContent = fmt(totalAplicado);
  if (elAtual) elAtual.textContent = fmt(totalSaldoAtual);
  if (elResgate) elResgate.textContent = fmt(totalSaldoResgate);
  if (elSub) {
    const rendTotal = totalSaldoAtual - totalAplicado;
    elSub.textContent = totalAplicado > 0 ? `+${fmt(rendTotal)} de rendimento acumulado` : 'Cadastre investimentos para ver o patrimônio';
  }
  if (elBadge) elBadge.textContent = `${estado.investimentos.length} investimento(s)`;

  // Correlação com Financiamento
  const finValorTotal = parseFloat(document.getElementById('fin-valor-total')?.value) || 0;
  const finEntrada = parseFloat(document.getElementById('fin-entrada')?.value) || 0;
  const saldoDevedor = finValorTotal - finEntrada;
  const elCorrelacaoMini = document.getElementById('inv-correlacao-mini');
  const elCorrelacao = document.getElementById('inv-correlacao-financiamento');

  if (saldoDevedor > 0 && totalSaldoResgate > 0) {
    const pct = ((totalSaldoResgate / saldoDevedor) * 100).toFixed(0);
    const msg = totalSaldoResgate >= saldoDevedor
      ? `🎉 <strong>QUITAÇÃO TOTAL!</strong> Com os investimentos no resgate (${fmt(totalSaldoResgate)}), vocês podem quitar o financiamento (${fmt(saldoDevedor)})!`
      : `💡 Os investimentos no resgate (${fmt(totalSaldoResgate)}) cobrem <strong>${pct}%</strong> do saldo devedor (${fmt(saldoDevedor)}). Ótima amortização antecipada!`;
    if (elCorrelacaoMini) elCorrelacaoMini.innerHTML = msg;
    if (elCorrelacao) elCorrelacao.innerHTML = msg;
  } else {
    if (elCorrelacaoMini) elCorrelacaoMini.textContent = 'Configure um financiamento na aba Financiamento para ver a correlação.';
  }

  // Simulador de aportes futuros
  atualizarSimuladorAportes();
}

function atualizarSimuladorAportes() {
  const sobra = parseFloat(document.getElementById('inv-input-sobra')?.value) || 3000;
  const taxaAnual = parseFloat(document.getElementById('inv-input-taxa')?.value) || 13.65;
  const prazoMeses = parseInt(document.getElementById('inv-input-prazo')?.value) || 24;
  const i = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  let acum = 0;
  for (let m = 0; m < prazoMeses; m++) acum = (acum + sobra) * (1 + i);
  const elRes = document.getElementById('inv-resgate-calculado');
  const elSub = document.getElementById('inv-sim-sub');
  if (elRes) elRes.textContent = fmt(acum);
  if (elSub) elSub.textContent = `Em ${prazoMeses} meses aportando ${fmt(sobra)}/mês a ${taxaAnual}% a.a.`;
}

window.excluirInvestimento = async function(id) {
  if (!confirm('Remover este investimento?')) return;
  if (supabaseClient) { await supabaseClient.from('investimentos').delete().eq('id', id); carregarDados(); }
};

// ===================================================
// EVENTOS E NAVEGAÇÃO
// ===================================================
function configurarEventos() {
  // Abas
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    });
  });

  // Filtros de período
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

  document.getElementById('btn-filtrar-pendentes')?.addEventListener('click', () => {
    estado.filtroMacro = '10.0 Outros';
    document.getElementById('filtro-categoria-macro').value = '10.0 Outros';
    atualizarUI();
  });

  document.getElementById('filtro-categoria-macro').addEventListener('change', (e) => {
    estado.filtroMacro = e.target.value;
    atualizarUI();
  });

  document.getElementById('edit-categoria-macro').addEventListener('change', (e) => {
    atualizarOptionsMicro(e.target.value);
  });

  // Simulador de aportes
  ['inv-input-sobra', 'inv-input-taxa', 'inv-input-prazo'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', atualizarSimuladorAportes);
  });

  // Salvar edição de transação
  document.getElementById('btn-salvar-edicao').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    let descricao = document.getElementById('edit-descricao').value.trim().replace(/^\[.*?\]\s*/, '');
    const novaMacro = document.getElementById('edit-categoria-macro').value;
    const novaMicro = document.getElementById('edit-categoria-micro').value;
    const valor = parseFloat(document.getElementById('edit-valor').value);
    const pago_por = document.getElementById('edit-pago-por').value;
    const novaData = document.getElementById('edit-data').value;
    if (!descricao || !valor || !novaData) return alert('Preencha os campos!');
    const descFinal = novaMicro ? `[${novaMicro}] ${descricao}` : descricao;
    if (supabaseClient) {
      let catId = null;
      const { data: ex } = await supabaseClient.from('categorias').select('id').ilike('nome', novaMacro).maybeSingle();
      if (ex) { catId = ex.id; }
      else { const { data: nv } = await supabaseClient.from('categorias').insert([{ nome: novaMacro, icone: '📌' }]).select('id').single(); if (nv) catId = nv.id; }
      await supabaseClient.from('transacoes').update({ descricao: descFinal, valor, pago_por, categoria_id: catId, data: novaData }).eq('id', id);
      // Ensinar o robô
      const pChave = descricao.split(/\s+/)[0].toLowerCase();
      if (pChave && pChave.length > 2) {
        const { data: rEx } = await supabaseClient.from('regras_mapeamento').select('id').ilike('palavra_chave', pChave).maybeSingle();
        if (rEx) await supabaseClient.from('regras_mapeamento').update({ categoria_macro: novaMacro, subcategoria_micro: novaMicro }).eq('id', rEx.id);
        else await supabaseClient.from('regras_mapeamento').insert([{ palavra_chave: pChave, categoria_macro: novaMacro, subcategoria_micro: novaMicro }]);
      }
      document.getElementById('modal-editar').classList.add('hidden');
      carregarDados();
    }
  });

  document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
    document.getElementById('modal-editar').classList.add('hidden');
  });

  // Salvar edição conta fixa
  document.getElementById('btn-salvar-rec-edicao').addEventListener('click', async () => {
    const id = document.getElementById('edit-rec-id').value;
    const nome = document.getElementById('edit-rec-nome').value.trim();
    const empresa = document.getElementById('edit-rec-empresa').value.trim();
    const tipo_valor = document.getElementById('edit-rec-tipo-valor').value;
    const valor = parseFloat(document.getElementById('edit-rec-valor').value);
    const dia_vencimento = parseInt(document.getElementById('edit-rec-dia').value);
    const dias_alerta = parseInt(document.getElementById('edit-rec-dias-alerta').value) || 3;
    const responsavel = document.getElementById('edit-rec-responsavel').value;
    const categoria_macro = document.getElementById('edit-rec-macro').value;
    if (!nome || !dia_vencimento) return alert('Preencha os campos!');
    if (supabaseClient) {
      await supabaseClient.from('gastos_recorrentes').update({ nome, empresa, tipo_valor, valor, dia_vencimento, dias_alerta, responsavel, categoria_macro }).eq('id', id);
      document.getElementById('modal-editar-recorrente').classList.add('hidden');
      carregarDados();
    }
  });

  document.getElementById('btn-cancelar-rec-edicao').addEventListener('click', () => {
    document.getElementById('modal-editar-recorrente').classList.add('hidden');
  });

  // Confirmar pagamento de conta fixa
  document.getElementById('btn-confirmar-pagamento-rec')?.addEventListener('click', async () => {
    const nomeConta = document.getElementById('pagar-rec-nome').value;
    const macro     = document.getElementById('pagar-rec-macro').value;
    const valor     = parseFloat(document.getElementById('pagar-rec-valor').value);
    const pago_por  = document.getElementById('pagar-rec-responsavel').value;
    if (!valor || valor <= 0) return alert('Informe o valor pago!');

    if (supabaseClient) {
      let catId = null;
      const { data: ex } = await supabaseClient.from('categorias').select('id').ilike('nome', macro).maybeSingle();
      if (ex) { catId = ex.id; }
      else { const { data: nv } = await supabaseClient.from('categorias').insert([{ nome: macro, icone: '📌' }]).select('id').single(); if (nv) catId = nv.id; }

      const descFinal = `[Conta Fixa] ${nomeConta}`;
      await supabaseClient.from('transacoes').insert([{
        descricao: descFinal,
        valor: valor,
        pago_por: pago_por,
        categoria_id: catId,
        data: new Date().toISOString().split('T')[0]
      }]);

      document.getElementById('modal-pagar-recorrente').classList.add('hidden');
      alert(`✅ Pagamento de ${fmt(valor)} registrado com sucesso no Extrato!`);
      carregarDados();
    }
  });

  document.getElementById('btn-cancelar-pagamento-rec')?.addEventListener('click', () => {
    document.getElementById('modal-pagar-recorrente').classList.add('hidden');
  });

  // Formulário: Novo Gasto Manual (usa macro + micro)
  document.getElementById('form-novo-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const macro    = document.getElementById('gasto-macro').value;
    const micro    = document.getElementById('gasto-micro').value;
    const descricao = document.getElementById('gasto-descricao').value.trim();
    const valor    = parseFloat(document.getElementById('gasto-valor').value);
    const pago_por = document.getElementById('gasto-pago-por').value;
    const dataStr  = document.getElementById('gasto-data').value;
    if (!descricao || !valor) return alert('Preencha Estabelecimento e Valor!');
    if (supabaseClient) {
      let catId = null;
      const { data: ex } = await supabaseClient.from('categorias').select('id').ilike('nome', macro).maybeSingle();
      if (ex) { catId = ex.id; }
      else { const { data: nv } = await supabaseClient.from('categorias').insert([{ nome: macro, icone: '📌' }]).select('id').single(); if (nv) catId = nv.id; }
      const descFinal = `[${micro}] ${descricao}`;
      const dataFinal = dataStr || new Date().toISOString().split('T')[0];
      await supabaseClient.from('transacoes').insert([{ descricao: descFinal, valor, pago_por, categoria_id: catId, data: dataFinal }]);
      carregarDados();
    }
    e.target.reset();
    document.getElementById('gasto-data').value = new Date().toISOString().split('T')[0];
    // Re-inicializar micro após reset
    const macroEl = document.getElementById('gasto-macro');
    if (macroEl) atualizarMicroGasto(macroEl.value);
  });

  // Formulário: Nova Conta Fixa
  document.getElementById('form-nova-recorrente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome         = document.getElementById('rec-nome').value.trim();
    const empresa      = document.getElementById('rec-empresa').value.trim();
    const tipo_valor   = document.getElementById('rec-tipo-valor').value;
    const valorRaw     = document.getElementById('rec-valor').value;
    const valor        = valorRaw ? parseFloat(valorRaw) : 0;
    const dia_vencimento = parseInt(document.getElementById('rec-dia').value);
    const dias_alerta  = parseInt(document.getElementById('rec-dias-alerta').value) || 3;
    const responsavel  = document.getElementById('rec-responsavel').value;
    const categoria_macro = document.getElementById('rec-macro').value;
    if (!nome || !dia_vencimento) return alert('Preencha pelo menos o nome e o dia de vencimento!');
    if (supabaseClient) {
      const { error } = await supabaseClient.from('gastos_recorrentes').insert([{
        nome, empresa, tipo_valor, valor, dia_vencimento, dias_alerta, responsavel, categoria_macro, ativo: true
      }]);
      if (error) {
        mostrarErroRecorrentes(`Erro ao salvar: ${error.message}. Execute o SQL fornecido no Supabase e tente novamente.`);
        return;
      }
      carregarDados();
    }
    e.target.reset();
  });

  // Formulário: Novo Investimento
  document.getElementById('form-novo-investimento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('inv-nome').value.trim();
    const tipo = document.getElementById('inv-tipo').value;
    const valor_inicial = parseFloat(document.getElementById('inv-valor-inicial').value);
    const taxa_anual = parseFloat(document.getElementById('inv-taxa-anual').value);
    const data_inicio = document.getElementById('inv-data-inicio').value;
    const data_resgate = document.getElementById('inv-data-resgate').value || null;
    const observacoes = document.getElementById('inv-obs').value.trim();
    if (!nome || !valor_inicial || !taxa_anual || !data_inicio) return alert('Preencha: Nome, Valor, Taxa e Data de Início!');
    if (supabaseClient) {
      const { error } = await supabaseClient.from('investimentos').insert([{ nome, tipo, valor_inicial, taxa_anual, data_inicio, data_resgate, observacoes }]);
      if (error) {
        alert(`Erro ao salvar investimento: ${error.message}\n\nVerifique se a tabela 'investimentos' foi criada no Supabase com o SQL fornecido!`);
        return;
      }
      carregarDados();
    }
    e.target.reset();
  });

  // Calcular Financiamento
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
    const novaSobra = estado.sobraReal - parcela;
    if (novaSobra >= 0) {
      document.getElementById('fin-res-impacto').innerHTML = `✅ Com essa parcela de <strong>${fmt(parcela)}</strong>, ainda sobram <strong>${fmt(novaSobra)}/mês</strong> do orçamento!`;
    } else {
      document.getElementById('fin-res-impacto').innerHTML = `⚠️ <strong>ALERTA!</strong> Parcela de <strong>${fmt(parcela)}</strong> ultrapassa a sobra atual em <strong>${fmt(Math.abs(novaSobra))}</strong>.`;
    }
    atualizarInvestimentos();
  });

  // Salvar Financiamento
  document.getElementById('btn-salvar-financiamento').addEventListener('click', async () => {
    const nome = document.getElementById('fin-nome').value.trim() || 'Financiamento';
    const valor_total = parseFloat(document.getElementById('fin-valor-total').value) || 0;
    const entrada = parseFloat(document.getElementById('fin-entrada').value) || 0;
    const taxa_juros = parseFloat(document.getElementById('fin-juros').value) || 0;
    const prazo_meses = parseInt(document.getElementById('fin-prazo').value) || 1;
    if (!valor_total) return alert('Informe o valor total do bem!');
    const financiado = valor_total - entrada;
    const i = (taxa_juros / 100) / 12;
    const parcela_mensal = i > 0 ? (financiado * (i * Math.pow(1 + i, prazo_meses))) / (Math.pow(1 + i, prazo_meses) - 1) : financiado / prazo_meses;
    if (supabaseClient) {
      await supabaseClient.from('financiamentos').insert([{ nome, valor_total, entrada, taxa_juros, prazo_meses, parcela_mensal }]);
      carregarDados();
    }
  });

  // Config Supabase
  document.getElementById('btn-config').addEventListener('click', () => {
    document.getElementById('cfg-url').value = localStorage.getItem('SUPABASE_URL') || '';
    document.getElementById('cfg-key').value = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    document.getElementById('modal-config').classList.remove('hidden');
  });
  document.getElementById('btn-fechar-config').addEventListener('click', () => document.getElementById('modal-config').classList.add('hidden'));
  document.getElementById('btn-salvar-config').addEventListener('click', () => {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();
    if (url && key) { conectarSupabase(url, key); document.getElementById('modal-config').classList.add('hidden'); }
  });

  document.getElementById('btn-atualizar').addEventListener('click', carregarDados);

  // Busca no extrato
  document.getElementById('input-busca-extrato')?.addEventListener('input', (e) => {
    preencherTabelaExtrato(obterTransacoesFiltradas(), e.target.value);
  });
}

// ===================================================
// GERENCIADOR DE SUBCATEGORIAS PERSONALIZADAS
// ===================================================
function carregarSubcategoriasPersonalizadas() {
  try {
    const salvas = JSON.parse(localStorage.getItem('CUSTOM_SUBCATEGORIAS') || '{}');
    Object.entries(salvas).forEach(([chave, lista]) => {
      if (SUBCATEGORIAS_MAP[chave] && Array.isArray(lista)) {
        lista.forEach(sub => {
          if (!SUBCATEGORIAS_MAP[chave].includes(sub)) {
            SUBCATEGORIAS_MAP[chave].push(sub);
          }
        });
      }
    });
  } catch(e) {
    console.warn('Erro ao carregar subcategorias customizadas:', e);
  }
}

window.adicionarSubcategoriaCustomizada = function(macroVal) {
  const chave = resolverChaveMacro(macroVal);
  const nomeNova = prompt(`➕ Criar nova subcategoria em "${chave}":\n\nExemplo: 3.8 Utensílios de Cozinha / Xícaras`);
  if (!nomeNova || !nomeNova.trim()) return;
  const limpo = nomeNova.trim();

  // Salvar localmente
  const salvas = JSON.parse(localStorage.getItem('CUSTOM_SUBCATEGORIAS') || '{}');
  if (!salvas[chave]) salvas[chave] = [];
  if (!salvas[chave].includes(limpo)) {
    salvas[chave].push(limpo);
    localStorage.setItem('CUSTOM_SUBCATEGORIAS', JSON.stringify(salvas));
  }

  // Adicionar na memória atual
  if (!SUBCATEGORIAS_MAP[chave].includes(limpo)) {
    SUBCATEGORIAS_MAP[chave].push(limpo);
  }

  // Atualiza a visualização no modal e nos selects
  renderizarGuiaCategorias();
  const gastoMacroEl = document.getElementById('gasto-macro');
  if (gastoMacroEl) atualizarMicroGasto(gastoMacroEl.value);

  alert(`✅ Subcategoria "${limpo}" adicionada em ${chave}!`);
};

window.removerSubcategoriaCustomizada = function(macroVal, subNome) {
  if (!confirm(`Remover a subcategoria "${subNome}" de ${macroVal}?`)) return;
  const chave = resolverChaveMacro(macroVal);

  // Remove da memória
  if (SUBCATEGORIAS_MAP[chave]) {
    SUBCATEGORIAS_MAP[chave] = SUBCATEGORIAS_MAP[chave].filter(s => s !== subNome);
  }

  // Remove do storage
  const salvas = JSON.parse(localStorage.getItem('CUSTOM_SUBCATEGORIAS') || '{}');
  if (salvas[chave]) {
    salvas[chave] = salvas[chave].filter(s => s !== subNome);
    localStorage.setItem('CUSTOM_SUBCATEGORIAS', JSON.stringify(salvas));
  }

  renderizarGuiaCategorias();
  const gastoMacroEl = document.getElementById('gasto-macro');
  if (gastoMacroEl) atualizarMicroGasto(gastoMacroEl.value);
};

// ===================================================
// GUIA DE CENTROS DE CUSTO MODAL (i)
// ===================================================
window.abrirGuiaCategorias = function() {
  renderizarGuiaCategorias();
  document.getElementById('modal-guia-categorias')?.classList.remove('hidden');
  const buscaInput = document.getElementById('busca-guia-categorias');
  if (buscaInput) {
    buscaInput.value = '';
    setTimeout(() => buscaInput.focus(), 150);
  }
};

window.fecharGuiaCategorias = function() {
  document.getElementById('modal-guia-categorias')?.classList.add('hidden');
};

window.renderizarGuiaCategorias = function(filtro = '') {
  const container = document.getElementById('lista-guia-categorias');
  if (!container) return;
  container.innerHTML = '';

  const termoNorm = filtro.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const salvas = JSON.parse(localStorage.getItem('CUSTOM_SUBCATEGORIAS') || '{}');

  const iconesMacro = {
    '1.0 Alimentação': '🍔',
    '2.0 Transporte': '🚗',
    '3.0 Moradia': '🏠',
    '4.0 Saúde': '🏥',
    '5.0 Lazer': '🎉',
    '6.0 Educação': '🎓',
    '7.0 Roupas & Cuidados Pessoais': '👕',
    '8.0 Empresa / Negócios': '💼',
    '9.0 Doações & Presentes': '🎁',
    '10.0 Outros': '📌'
  };

  Object.entries(SUBCATEGORIAS_MAP).forEach(([macro, micros]) => {
    const icon = iconesMacro[macro] || '📌';
    const macroNorm = macro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const customDaMacro = salvas[macro] || [];

    // Filtra subcategorias
    const microsFiltrados = micros.filter(m => {
      if (!termoNorm) return true;
      const mNorm = m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return mNorm.includes(termoNorm) || macroNorm.includes(termoNorm);
    });

    if (termoNorm && microsFiltrados.length === 0 && !macroNorm.includes(termoNorm)) {
      return; // Oculta a macro se a busca não bater
    }

    const card = document.createElement('div');
    card.className = 'guia-macro-card';

    const pillsHtml = (termoNorm ? microsFiltrados : micros).map(m => {
      const mNorm = m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isMatch = termoNorm && mNorm.includes(termoNorm);
      const isCustom = customDaMacro.includes(m);
      const removeBtn = isCustom ? `<button onclick="event.stopPropagation();removerSubcategoriaCustomizada('${macro}','${m}')" style="background:none;border:none;color:#ef4444;margin-left:4px;cursor:pointer;font-weight:700;" title="Remover subcategoria customizada">✕</button>` : '';
      return `<span class="guia-micro-pill ${isMatch ? 'highlight' : ''}">${m}${removeBtn}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="guia-macro-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span style="display:flex;align-items:center;gap:6px;"><span>${icon}</span> <span>${macro}</span></span>
        <button type="button" onclick="adicionarSubcategoriaCustomizada('${macro}')" class="btn-primary-sm" style="padding:2px 8px;font-size:10.5px;border-radius:6px;white-space:nowrap;" title="Criar nova subcategoria neste centro de custo">+ Sub</button>
      </div>
      <div class="guia-micro-list" style="margin-top:8px;">
        ${pillsHtml}
      </div>
    `;

    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:24px;">Nenhum centro de custo ou subcategoria encontrado para "${filtro}".</div>`;
  }
};

window.filtrarGuiaCategorias = function(val) {
  renderizarGuiaCategorias(val);
};


