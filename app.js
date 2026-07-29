// ===================================================
// APLICATIVO FINANCEIRO DO CASAL 3D (LÓGICA PRINCIPAL)
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
// INICIALIZAÇÃO DA APLICAÇÃO & THREE.JS
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  // Inicializar o fundo 3D com Three.js
  inicializarFundo3D();

  // Credenciais reais do Supabase do usuário
  const defaultUrl = 'https://bsrcbtgdayqsggcijxfu.supabase.co';
  const defaultKey = 'sb_publishable_PEVDs7pauyzHqBRiZNMuLg_tXFhfw0v';

  const savedUrl = localStorage.getItem('SUPABASE_URL') || defaultUrl;
  const savedKey = localStorage.getItem('SUPABASE_ANON_KEY') || defaultKey;

  conectarSupabase(savedUrl, savedKey);
  configurarEventos();
});

// ===================================================
// THREE.JS: CANVAS 3D INTERATIVO EM SEGUNDO PLANO
// ===================================================
function inicializarFundo3D() {
  const canvas = document.getElementById('canvas-3d-bg');
  if (!canvas || !window.THREE) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Criar 120 partículas geométricas 3D flutuantes
  const geometry = new THREE.IcosahedronGeometry(0.8, 0);
  const material = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.25
  });

  const particles = [];
  const count = 100;

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (Math.random() - 0.5) * 80;
    mesh.position.y = (Math.random() - 0.5) * 80;
    mesh.position.z = (Math.random() - 0.5) * 40;

    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI;

    mesh.userData = {
      rotX: (Math.random() - 0.5) * 0.01,
      rotY: (Math.random() - 0.5) * 0.01
    };

    scene.add(mesh);
    particles.push(mesh);
  }

  // Interatividade com o mouse
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Loop de animação contínua 3D
  function animate() {
    requestAnimationFrame(animate);

    particles.forEach(p => {
      p.rotation.x += p.userData.rotX;
      p.rotation.y += p.userData.rotY;
    });

    camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 5 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();
}

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

  // 2. Maior Categoria de Gasto
  const mapaCategorias = {};
  estado.transacoes.forEach(t => {
    const nomeCat = t.categoria ? t.categoria.nome : 'Outros';
    mapaCategorias[nomeCat] = (mapaCategorias[nomeCat] || 0) + Number(t.valor);
  });

  let maiorCatNome = 'Nenhuma';
  let maiorCatValor = 0;

  Object.entries(mapaCategorias).forEach(([nome, val]) => {
    if (val > maiorCatValor) {
      maiorCatValor = val;
      maiorCatNome = nome;
    }
  });

  const elMaiorCat = document.getElementById('val-maior-categoria');
  if (elMaiorCat) {
    elMaiorCat.textContent = maiorCatValor > 0 ? `${maiorCatNome} (${formatarMoeda(maiorCatValor)})` : 'Nenhum';
  }

  // 3. Sobra Real e Projeções de Vida
  const sobraReal = parseFloat(document.getElementById('input-sobra-real').value) || 0;
  estado.sobraReal = sobraReal;

  const proj3 = sobraReal > 0 ? sobraReal * 3 : 0;
  const proj6 = sobraReal > 0 ? sobraReal * 6 : 0;
  const proj12 = sobraReal > 0 ? sobraReal * 12 : 0;

  document.getElementById('proj-3-meses').textContent = formatarMoeda(proj3);
  document.getElementById('proj-6-meses').textContent = formatarMoeda(proj6);
  document.getElementById('proj-12-meses').textContent = formatarMoeda(proj12);

  // 4. Renderizar Gráfico de Centros de Custo com %
  renderizarGraficoCategorias(mapaCategorias, totalGastos);

  // 5. Sugestão Inteligente de Economia
  gerarDicaEconomia(maiorCatNome, maiorCatValor, totalGastos);
}

function gerarDicaEconomia(maiorCat, maiorVal, totalGastos) {
  const elDica = document.getElementById('texto-dica-economia');
  if (!elDica) return;

  if (totalGastos === 0) {
    elDica.textContent = 'Lancem gastos pelo Telegram para ver análises e sugestões de corte de custos!';
    return;
  }

  const pct = ((maiorVal / totalGastos) * 100).toFixed(0);
  elDica.innerHTML = `<strong>Dica de Economia:</strong> A categoria <strong>${maiorCat}</strong> representa <strong>${pct}%</strong> dos gastos da família este mês (${formatarMoeda(maiorVal)}). Reduzir 15% aqui libera <strong>${formatarMoeda(maiorVal * 0.15)}</strong> adicionais para investimentos!`;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

// ===================================================
// PREENCHIMENTO DA TABELA COM BOTÕES EDITAR E EXCLUIR
// ===================================================
function preencherTabelaTransacoes(filtroBusca = '') {
  const tbody = document.getElementById('tbody-transacoes');
  tbody.innerHTML = '';

  let filtradas = estado.transacoes;
  if (filtroBusca) {
    const termo = filtroBusca.toLowerCase();
    filtradas = estado.transacoes.filter(t => 
      t.descricao.toLowerCase().includes(termo) ||
      (t.categoria && t.categoria.nome.toLowerCase().includes(termo)) ||
      t.pago_por.toLowerCase().includes(termo)
    );
  }

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum gasto encontrado.</td></tr>';
    return;
  }

  const ordenadas = [...filtradas].sort((a, b) => new Date(b.data) - new Date(a.data));

  ordenadas.forEach(t => {
    const tr = document.createElement('tr');
    const nomeCategoria = t.categoria ? t.categoria.nome : 'Outros';
    const tagPessoa = t.pago_por === 'Ele' ? '👨 Leo' : '👩 Giu';

    tr.innerHTML = `
      <td>${t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-'}</td>
      <td><span class="badge-tag">${nomeCategoria}</span></td>
      <td><strong>${t.descricao}</strong></td>
      <td>${tagPessoa}</td>
      <td style="color: var(--accent-expense); font-weight: 600;">${formatarMoeda(t.valor)}</td>
      <td style="text-align: center;">
        <div class="action-buttons">
          <button class="btn-action-edit" onclick="abrirModalEdicao('${t.id}')" title="Editar Gasto">✏️</button>
          <button class="btn-action-delete" onclick="excluirGasto('${t.id}')" title="Excluir Gasto">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===================================================
// LÓGICA DE EXCLUSÃO E EDIÇÃO
// ===================================================
async function excluirGasto(id) {
  if (!confirm('Deseja realmente excluir este gasto?')) return;

  if (supabaseClient) {
    const { error } = await supabaseClient.from('transacoes').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir do Supabase: ' + error.message);
      return;
    }
    carregarDadosDoSupabase();
  } else {
    estado.transacoes = estado.transacoes.filter(t => t.id !== id);
    atualizarInterface();
  }
}

function abrirModalEdicao(id) {
  const transacao = estado.transacoes.find(t => t.id === id);
  if (!transacao) return;

  document.getElementById('edit-id').value = transacao.id;
  document.getElementById('edit-descricao').value = transacao.descricao;
  document.getElementById('edit-valor').value = transacao.valor;
  document.getElementById('edit-pago-por').value = transacao.pago_por;

  document.getElementById('modal-editar').classList.remove('hidden');
}

// ===================================================
// GRÁFICO DE CENTROS DE CUSTO (CHART.JS)
// ===================================================
function renderizarGraficoCategorias(mapaCategorias, totalGastos) {
  const ctx = document.getElementById('chart-categorias').getContext('2d');

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
      labels: labels.length > 0 ? labels : ['Nenhum gasto'],
      datasets: [{
        data: valores.length > 0 ? valores : [1],
        backgroundColor: valores.length > 0 ? cores.slice(0, labels.length) : ['#334155'],
        borderWidth: 0,
        hoverOffset: 8
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
              const val = context.raw;
              const pct = totalGastos > 0 ? ((val / totalGastos) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${formatarMoeda(val)} (${pct}%)`;
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

  // Busca em tempo real no extrato
  document.getElementById('input-busca-extrato').addEventListener('input', (e) => {
    preencherTabelaTransacoes(e.target.value);
  });

  // Salvar Edição
  document.getElementById('btn-salvar-edicao').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    const descricao = document.getElementById('edit-descricao').value.trim();
    const valor = parseFloat(document.getElementById('edit-valor').value);
    const pago_por = document.getElementById('edit-pago-por').value;

    if (!descricao || !valor) {
      alert('Preencha a descrição e o valor!');
      return;
    }

    if (supabaseClient) {
      const { error } = await supabaseClient
        .from('transacoes')
        .update({ descricao, valor, pago_por })
        .eq('id', id);

      if (error) {
        alert('Erro ao atualizar no Supabase: ' + error.message);
        return;
      }
      document.getElementById('modal-editar').classList.add('hidden');
      carregarDadosDoSupabase();
    }
  });

  document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
    document.getElementById('modal-editar').classList.add('hidden');
  });

  // Configuração Supabase
  const modalConfig = document.getElementById('modal-config');
  document.getElementById('btn-config').addEventListener('click', () => {
    document.getElementById('cfg-url').value = localStorage.getItem('SUPABASE_URL') || '';
    document.getElementById('cfg-key').value = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    modalConfig.classList.remove('hidden');
  });

  document.getElementById('btn-fechar-config').addEventListener('click', () => {
    modalConfig.classList.add('hidden');
  });

  document.getElementById('btn-salvar-config').addEventListener('click', () => {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();

    if (url && key) {
      conectarSupabase(url, key);
      modalConfig.classList.add('hidden');
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
      resBox.innerHTML = `⚠️ No momento não há sobra informada. Digitem o valor da sobra real para calcular o plano de <strong>${nome}</strong>!`;
      resBox.classList.remove('hidden');
      return;
    }

    const mesesNecessarios = Math.ceil(valorAlvo / sobraReal);
    resBox.innerHTML = `🎯 Guardando a sobra real de <strong>${formatarMoeda(sobraReal)}/mês</strong>, vocês conquistarão <strong>${nome}</strong> em aproximadamente <strong>${mesesNecessarios} mês(es)</strong>!`;
    resBox.classList.remove('hidden');
  });

  // Botão Atualizar
  document.getElementById('btn-atualizar').addEventListener('click', () => {
    if (supabaseClient) {
      carregarDadosDoSupabase();
    } else {
      atualizarInterface();
    }
  });
}
