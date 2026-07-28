// ===================================================
// APLICATIVO FINANCEIRO DO CASAL (LÓGICA PRINCIPAL)
// ===================================================

let supabaseClient = null;
let chartCategoriasInstance = null;

// Estado local da aplicação
let estado = {
  sobraReal: 3000,
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
    const { data: categorias, error: errCat } = await supabaseClient
      .from('categorias')
      .select('*');

    if (errCat) throw errCat;
    estado.categorias = categorias || [];

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
  preencherTabelaTransacoes();

  // 1. Gastos Familiares Totais
  const totalGastos = estado.transacoes.reduce((acc, t) => acc + Number(t.valor), 0);
  document.getElementById('val-gastos-totais').textContent = formatarMoeda(totalGastos);
  document.getElementById('subtext-qtd-compras').textContent = `${estado.transacoes.length} compra(s) registrada(s) este mês`;

  // 2. Sobra Real e Projeções de Vida
  const sobraReal = parseFloat(document.getElementById('input-sobra-real').value) || 0;
  estado.sobraReal = sobraReal;

  const proj3 = sobraReal > 0 ? sobraReal * 3 : 0;
  const proj6 = sobraReal > 0 ? sobraReal * 6 : 0;
  const proj12 = sobraReal > 0 ? sobraReal * 12 : 0;

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
      <td><span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${nomeCategoria}</span></td>
      <td><strong>${t.descricao}</strong></td>
      <td>${tagPessoa}</td>
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
  document.getElementById('input-sobra-real').addEventListener('input', atualizarInterface);

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

    const catTexto = document.getElementById('gasto-categoria-texto').value.trim();
    const descricao = document.getElementById('gasto-descricao').value.trim();
    const valor = parseFloat(document.getElementById('gasto-valor').value);
    const pago_por = document.getElementById('gasto-pago-por').value;

    if (supabaseClient) {
      // 1. Procurar ou criar categoria
      let catId = null;
      if (catTexto) {
        const catFormatada = catTexto.charAt(0).toUpperCase() + catTexto.slice(1).toLowerCase();
        const { data: catExistente } = await supabaseClient
          .from('categorias')
          .select('id')
          .ilike('nome', catFormatada)
          .maybeSingle();

        if (catExistente) {
          catId = catExistente.id;
        } else {
          const { data: novaCat } = await supabaseClient
            .from('categorias')
            .insert([{ nome: catFormatada, icone: '📌' }])
            .select('id')
            .single();

          if (novaCat) catId = novaCat.id;
        }
      }

      // 2. Inserir Transação
      const { error } = await supabaseClient.from('transacoes').insert([{
        descricao,
        valor,
        pago_por,
        categoria_id: catId,
        data: new Date().toISOString().split('T')[0]
      }]);

      if (error) {
        alert('Erro ao salvar no Supabase: ' + error.message);
        return;
      }

      carregarDadosDoSupabase();
    }

    document.getElementById('form-novo-gasto').reset();
  });

  // Simulador de Planejamento Futuro
  document.getElementById('btn-simular').addEventListener('click', () => {
    const nome = document.getElementById('sim-nome').value || 'Seu objetivo';
    const valorAlvo = parseFloat(document.getElementById('sim-valor').value);
    const sobraReal = parseFloat(document.getElementById('input-sobra-real').value) || 0;

    const resBox = document.getElementById('sim-resultado');

    if (!valorAlvo || valorAlvo <= 0) {
      alert('Informe um valor de objetivo válido!');
      return;
    }

    if (sobraReal <= 0) {
      resBox.innerHTML = `⚠️ No momento não há sobra informada. Digitem o valor da sobra real guardada no mês para calcular o plano de <strong>${nome}</strong>!`;
      resBox.classList.remove('hidden');
      return;
    }

    const mesesNecessarios = Math.ceil(valorAlvo / sobraReal);
    resBox.innerHTML = `🎯 Guardando a sobra real de <strong>${formatarMoeda(sobraReal)}/mês</strong>, vocês conquistarão <strong>${nome}</strong> em aproximadamente <strong>${mesesNecessarios} mês(es)</strong>!`;
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
