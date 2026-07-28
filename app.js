// ===================================================
// APLICATIVO FINANCEIRO DO CASAL (LÓGICA PRINCIPAL)
// ===================================================

let supabaseClient = null;
let chartCategoriasInstance = null;

// Estado local da aplicação
let estado = {
  sobraEle: 1500,
  sobraEla: 1500,
  transacoes: [],
  categorias: []
};

// ===================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  // Credenciais reais do Supabase do usuário
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
    carregarDadosDoSupabase();
  } catch (err) {
    console.error('Erro ao conectar ao Supabase:', err.message);
  }
}

async function carregarDadosDoSupabase() {
  if (!supabaseClient) return;

  try {
    // 1. Carregar Categorias
    const { data: categorias, error: errCat } = await supabaseClient
      .from('categorias')
      .select('*');

    if (errCat) throw errCat;
    estado.categorias = categorias || [];

    // 2. Carregar Transações vinculadas com categorias
    const { data: transacoes, error: errTrans } = await supabaseClient
      .from('transacoes')
      .select('*, categoria:categorias(nome)');

    if (errTrans) throw errTrans;
    estado.transacoes = transacoes || [];

    atualizarInterface();
  } catch (error) {
    console.warn('Erro ao carregar dados do Supabase:', error.message);
    atualizarInterface();
  }
}

// ===================================================
// ATUALIZAÇÃO DA INTERFACE & CÁLCULOS
// ===================================================
function atualizarInterface() {
  preencherSelectCategorias();
  preencherTabelaTransacoes();

  // 1. Gastos Familiares Totais
  const totalGastos = estado.transacoes.reduce((acc, t) => acc + Number(t.valor), 0);
  document.getElementById('val-gastos-totais').textContent = formatarMoeda(totalGastos);

  // 2. Sobras Individuais e Capacidade de Aporte Conjunta
  const sobraEle = parseFloat(document.getElementById('input-sobra-ele').value) || 0;
  const sobraEla = parseFloat(document.getElementById('input-sobra-ela').value) || 0;
  
  estado.sobraEle = sobraEle;
  estado.sobraEla = sobraEla;

  const aporteConjunto = sobraEle + sobraEla;

  document.getElementById('val-sobra-conjunta').textContent = formatarMoeda(aporteConjunto);

  // 3. Projeção de Investimentos do Casal
  const proj3 = aporteConjunto > 0 ? aporteConjunto * 3 : 0;
  const proj6 = aporteConjunto > 0 ? aporteConjunto * 6 : 0;
  const proj12 = aporteConjunto > 0 ? aporteConjunto * 12 : 0;

  document.getElementById('proj-3-meses').textContent = formatarMoeda(proj3);
  document.getElementById('proj-6-meses').textContent = formatarMoeda(proj6);
  document.getElementById('proj-12-meses').textContent = formatarMoeda(proj12);

  // Renderizar Gráfico de Centros de Custo
  renderizarGraficoCategorias();
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

// ===================================================
// PREENCHIMENTO DE ELEMENTOS
// ===================================================
function preencherSelectCategorias() {
  const select = document.getElementById('gasto-categoria');
  select.innerHTML = '<option value="">Selecione um Centro de Custo...</option>';

  estado.categorias.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icone || '📌'} ${cat.nome}`;
    select.appendChild(opt);
  });
}

function preencherTabelaTransacoes() {
  const tbody = document.getElementById('tbody-transacoes');
  tbody.innerHTML = '';

  if (estado.transacoes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum gasto familiar registrado este mês ainda.</td></tr>';
    return;
  }

  const ordenadas = [...estado.transacoes].sort((a, b) => new Date(b.data) - new Date(a.data));

  ordenadas.forEach(t => {
    const tr = document.createElement('tr');
    const nomeCategoria = t.categoria ? t.categoria.nome : 'Outros';
    const tagPessoa = t.pago_por === 'Ele' ? '👨 Leo' : '👩 Giu';

    tr.innerHTML = `
      <td>${t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-'}</td>
      <td><strong>${t.descricao}</strong></td>
      <td><span class="badge">${tagPessoa}</span></td>
      <td>${nomeCategoria}</td>
      <td style="color: var(--accent-expense); font-weight: 600;">${formatarMoeda(t.valor)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===================================================
// GRÁFICO DE CENTROS DE CUSTO (CHART.JS)
// ===================================================
function renderizarGraficoCategorias() {
  const ctx = document.getElementById('chart-categorias').getContext('2d');

  const mapaCategorias = {};
  estado.transacoes.forEach(t => {
    const nomeCat = t.categoria ? t.categoria.nome : 'Outros';
    mapaCategorias[nomeCat] = (mapaCategorias[nomeCat] || 0) + Number(t.valor);
  });

  const labels = Object.keys(mapaCategorias);
  const valores = Object.values(mapaCategorias);

  const cores = [
    '#38bdf8', '#f43f5e', '#10b981', '#a855f7',
    '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'
  ];

  if (chartCategoriasInstance) {
    chartCategoriasInstance.destroy();
  }

  chartCategoriasInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['Nenhum gasto registrado'],
      datasets: [{
        data: valores.length > 0 ? valores : [1],
        backgroundColor: valores.length > 0 ? cores.slice(0, labels.length) : ['#334155'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${formatarMoeda(context.raw)}`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// ===================================================
// EVENTOS & INTERAÇÕES
// ===================================================
function configurarEventos() {
  // Alterar Sobra do Leo ou da Giu atualiza a capacidade de aporte conjunta
  document.getElementById('input-sobra-ele').addEventListener('input', atualizarInterface);
  document.getElementById('input-sobra-ela').addEventListener('input', atualizarInterface);

  const modal = document.getElementById('modal-config');
  document.getElementById('btn-config').addEventListener('click', () => {
    document.getElementById('cfg-url').value = localStorage.getItem('SUPABASE_URL') || '';
    document.getElementById('cfg-key').value = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    modal.classList.remove('hidden');
  });

  document.getElementById('btn-fechar-config').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('btn-salvar-config').addEventListener('click', () => {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();

    if (url && key) {
      conectarSupabase(url, key);
      modal.classList.add('hidden');
    } else {
      alert('Por favor, informe a URL e a Anon Key!');
    }
  });

  // Cadastrar Novo Gasto Manual
  document.getElementById('form-novo-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();

    const descricao = document.getElementById('gasto-descricao').value;
    const valor = parseFloat(document.getElementById('gasto-valor').value);
    const pago_por = document.getElementById('gasto-pago-por').value;
    const categoria_id = document.getElementById('gasto-categoria').value;

    const novaTransacao = {
      descricao,
      valor,
      pago_por,
      categoria_id: categoria_id || null,
      data: new Date().toISOString().split('T')[0]
    };

    if (supabaseClient) {
      const { error } = await supabaseClient.from('transacoes').insert([novaTransacao]);
      if (error) {
        alert('Erro ao salvar no Supabase: ' + error.message);
        return;
      }
      carregarDadosDoSupabase();
    } else {
      const catObj = estado.categorias.find(c => c.id === categoria_id);
      estado.transacoes.push({
        id: 't' + Date.now(),
        ...novaTransacao,
        categoria: catObj || { nome: 'Outros' }
      });
      atualizarInterface();
    }

    document.getElementById('form-novo-gasto').reset();
  });

  // Simulador de Planejamento Futuro
  document.getElementById('btn-simular').addEventListener('click', () => {
    const nome = document.getElementById('sim-nome').value || 'Seu objetivo';
    const valorAlvo = parseFloat(document.getElementById('sim-valor').value);
    
    const sobraEle = parseFloat(document.getElementById('input-sobra-ele').value) || 0;
    const sobraEla = parseFloat(document.getElementById('input-sobra-ela').value) || 0;
    const aporteConjunto = sobraEle + sobraEla;

    const resBox = document.getElementById('sim-resultado');

    if (!valorAlvo || valorAlvo <= 0) {
      alert('Informe um valor de objetivo válido!');
      return;
    }

    if (aporteConjunto <= 0) {
      resBox.innerHTML = `⚠️ No momento não há sobras informadas. Digitem os valores de sobra do Leo e da Giu para calcular o plano de <strong>${nome}</strong>!`;
      resBox.classList.remove('hidden');
      return;
    }

    const mesesNecessarios = Math.ceil(valorAlvo / aporteConjunto);
    resBox.innerHTML = `🎯 Com o aporte conjunto de <strong>${formatarMoeda(aporteConjunto)}/mês</strong> (Leo + Giu), vocês conquistarão <strong>${nome}</strong> em aproximadamente <strong>${mesesNecessarios} mês(es)</strong>!`;
    resBox.classList.remove('hidden');
  });

  // Atualizar dados
  document.getElementById('btn-atualizar').addEventListener('click', () => {
    if (supabaseClient) {
      carregarDadosDoSupabase();
    } else {
      atualizarInterface();
    }
  });
}
