// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - MAPEADOR INTELIGENTE
// Categorias Principais + Subcategorias + Estabelecimento
// ===================================================
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Mapeamento Inteligente de Palavras-Chave para:
 * 1. Categoria Principal
 * 2. Subcategoria
 */
const MAPEAMENTO_CENTROS_CUSTO = {
  // 🛒 ALIMENTAÇÃO
  'padaria': { categoria: 'Alimentação', subcategoria: 'Padaria' },
  'mercado': { categoria: 'Alimentação', subcategoria: 'Supermercado' },
  'supermercado': { categoria: 'Alimentação', subcategoria: 'Supermercado' },
  'açougue': { categoria: 'Alimentação', subcategoria: 'Açougue' },
  'acougue': { categoria: 'Alimentação', subcategoria: 'Açougue' },
  'restaurante': { categoria: 'Alimentação', subcategoria: 'Restaurante' },
  'lanchonete': { categoria: 'Alimentação', subcategoria: 'Restaurante' },
  'delivery': { categoria: 'Alimentação', subcategoria: 'Delivery / Ifood' },
  'ifood': { categoria: 'Alimentação', subcategoria: 'Delivery / Ifood' },
  'feira': { categoria: 'Alimentação', subcategoria: 'Hortifruti / Feira' },

  // 🚗 TRANSPORTE
  'posto': { categoria: 'Transporte', subcategoria: 'Combustível' },
  'gasolina': { categoria: 'Transporte', subcategoria: 'Combustível' },
  'combustivel': { categoria: 'Transporte', subcategoria: 'Combustível' },
  'oficina': { categoria: 'Transporte', subcategoria: 'Manutenção Veicular' },
  'mecanico': { categoria: 'Transporte', subcategoria: 'Manutenção Veicular' },
  'uber': { categoria: 'Transporte', subcategoria: 'Aplicativo de Transporte' },
  '99': { categoria: 'Transporte', subcategoria: 'Aplicativo de Transporte' },
  'estacionamento': { categoria: 'Transporte', subcategoria: 'Pedágio / Estacionamento' },
  'pedagio': { categoria: 'Transporte', subcategoria: 'Pedágio / Estacionamento' },

  // 🏠 MORADIA
  'aluguel': { categoria: 'Moradia', subcategoria: 'Aluguel' },
  'condominio': { categoria: 'Moradia', subcategoria: 'Condomínio' },
  'luz': { categoria: 'Moradia', subcategoria: 'Energia elétrico' },
  'energia': { categoria: 'Moradia', subcategoria: 'Energia elétrico' },
  'agua': { categoria: 'Moradia', subcategoria: 'Água / Saneamento' },
  'internet': { categoria: 'Moradia', subcategoria: 'Internet / Telefone' },
  'gas': { categoria: 'Moradia', subcategoria: 'Gás' },

  // 💊 SAÚDE
  'farmacia': { categoria: 'Saúde', subcategoria: 'Farmácia / Medicamentos' },
  'drogaria': { categoria: 'Saúde', subcategoria: 'Farmácia / Medicamentos' },
  'consulta': { categoria: 'Saúde', subcategoria: 'Consultas & Exames' },
  'exame': { categoria: 'Saúde', subcategoria: 'Consultas & Exames' },
  'dentista': { categoria: 'Saúde', subcategoria: 'Odontologia' },
  'plano': { categoria: 'Saúde', subcategoria: 'Plano de Saúde' },

  // 🎭 LAZER
  'cinema': { categoria: 'Lazer & Entretenimento', subcategoria: 'Cinema / Teatro' },
  'teatro': { categoria: 'Lazer & Entretenimento', subcategoria: 'Cinema / Teatro' },
  'viagem': { categoria: 'Lazer & Entretenimento', subcategoria: 'Viagens' },
  'hotel': { categoria: 'Lazer & Entretenimento', subcategoria: 'Viagens' },
  'show': { categoria: 'Lazer & Entretenimento', subcategoria: 'Eventos / Shows' },
  'netflix': { categoria: 'Lazer & Entretenimento', subcategoria: 'Assinaturas Streaming' },
  'spotify': { categoria: 'Lazer & Entretenimento', subcategoria: 'Assinaturas Streaming' },

  // 🎓 EDUCAÇÃO
  'escola': { categoria: 'Educação', subcategoria: 'Escola / Mensalidade' },
  'faculdade': { categoria: 'Educação', subcategoria: 'Faculdade / Cursos' },
  'curso': { categoria: 'Educação', subcategoria: 'Faculdade / Cursos' },
  'livro': { categoria: 'Educação', subcategoria: 'Material Escolar / Livros' },

  // 👕 ROUPAS
  'roupa': { categoria: 'Roupas & Compras', subcategoria: 'Vestuário' },
  'loja': { categoria: 'Roupas & Compras', subcategoria: 'Vestuário' },
  'calcado': { categoria: 'Roupas & Compras', subcategoria: 'Calçados' },
  'sapato': { categoria: 'Roupas & Compras', subcategoria: 'Calçados' },

  // 📈 INVESTIMENTOS
  'investimento': { categoria: 'Investimentos', subcategoria: 'Aportes' },
  'cdb': { categoria: 'Investimentos', subcategoria: 'Renda Fixa' },
  'acao': { categoria: 'Investimentos', subcategoria: 'Renda Variável' }
};

/**
 * Leitor Inteligente de Mensagens
 */
function processarTextoMensagem(texto, remetentePadrao = 'Ele') {
  if (!texto || typeof texto !== 'string') return null;

  const textoLimpo = texto.trim();
  if (/https?:\/\//i.test(textoLimpo)) return null;

  const palavrasIgnorar = ['salmos', 'bom dia', 'boa tarde', 'boa noite', 'amém', 'oração', 'versículo'];
  if (palavrasIgnorar.some(p => textoLimpo.toLowerCase().includes(p))) return null;

  const palavras = textoLimpo.split(/\s+/);
  if (palavras.length < 2) return null;

  // 1. Quem pagou
  let pagoPor = remetentePadrao;
  let palavrasFiltradas = [...palavras];

  const ultimaPalavra = palavrasFiltradas[palavrasFiltradas.length - 1].toLowerCase();
  if (ultimaPalavra === 'ela' || ultimaPalavra === 'esposa' || ultimaPalavra === 'giu') {
    pagoPor = 'Ela';
    palavrasFiltradas.pop();
  } else if (ultimaPalavra === 'ele' || ultimaPalavra === 'marido' || ultimaPalavra === 'leo') {
    pagoPor = 'Ele';
    palavrasFiltradas.pop();
  }

  if (palavrasFiltradas.length < 2) return null;

  // 2. Extrair o Valor da última palavra restante
  const tokenValor = palavrasFiltradas.pop();
  const regexValor = /(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/i;
  const matchValor = tokenValor.match(regexValor);

  if (!matchValor) return null;

  const valor = parseFloat(matchValor[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) return null;

  // 3. Primeira palavra como gatilho de Subcategoria/Categoria
  const palavraChave = palavrasFiltradas[0].toLowerCase();
  const mapeado = MAPEAMENTO_CENTROS_CUSTO[palavraChave];

  let categoriaNome = 'Outros';
  let subcategoriaNome = palavrasFiltradas[0].charAt(0).toUpperCase() + palavrasFiltradas[0].slice(1).toLowerCase();

  if (mapeado) {
    categoriaNome = mapeado.categoria;
    subcategoriaNome = mapeado.subcategoria;
  } else {
    // Se a primeira palavra não estiver no dicionário, usa a própria palavra como Categoria e Subcategoria
    categoriaNome = subcategoriaNome;
  }

  // 4. Estabelecimento (palavras do meio)
  let estabelecimento = palavrasFiltradas.slice(1).join(' ');
  if (!estabelecimento) {
    estabelecimento = subcategoriaNome;
  } else {
    estabelecimento = estabelecimento.charAt(0).toUpperCase() + estabelecimento.slice(1);
  }

  return {
    categoria_nome: categoriaNome,
    subcategoria_nome: subcategoriaNome,
    descricao: estabelecimento,
    valor: valor,
    pago_por: pagoPor,
    data: new Date().toISOString().split('T')[0]
  };
}

/**
 * Inserção no Supabase vinculando Categoria e Subcategoria
 */
async function registrarGastoNoSupabase(gasto) {
  if (!supabase) {
    console.log('💡 [Simulação Robô] Gasto identificado:', gasto);
    return { success: true, mode: 'demo' };
  }

  try {
    // 1. Procurar ou criar Categoria Principal
    let categoriaId = null;

    if (gasto.categoria_nome) {
      const { data: catExistente } = await supabase
        .from('categorias')
        .select('id')
        .ilike('nome', gasto.categoria_nome)
        .maybeSingle();

      if (catExistente) {
        categoriaId = catExistente.id;
      } else {
        const { data: novaCat } = await supabase
          .from('categorias')
          .insert([{ nome: gasto.categoria_nome, icone: '📌' }])
          .select('id')
          .single();

        if (novaCat) categoriaId = novaCat.id;
      }
    }

    // 2. Inserir Transação com Subcategoria na descrição ou coluna
    const descricaoFinal = gasto.subcategoria_nome && gasto.descricao !== gasto.subcategoria_nome
      ? `[${gasto.subcategoria_nome}] ${gasto.descricao}`
      : gasto.descricao;

    const transacaoObj = {
      descricao: descricaoFinal,
      valor: gasto.valor,
      pago_por: gasto.pago_por,
      data: gasto.data,
      categoria_id: categoriaId
    };

    const { data, error } = await supabase
      .from('transacoes')
      .insert([transacaoObj]);

    if (error) {
      console.error('❌ Erro ao salvar no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ [ROBÔ] ${gasto.categoria_nome} ➔ ${gasto.subcategoria_nome} | ${gasto.descricao} | R$ ${gasto.valor}`);
    return { success: true, data };
  } catch (err) {
    console.error('Erro na gravação:', err.message);
    return { success: false, error: err.message };
  }
}

// Testes do leitor com subcategorias
if (require.main === module) {
  console.log('🤖 Testando Mapeador de Subcategorias:');
  console.log('"Padaria Real 35" ->', processarTextoMensagem("Padaria Real 35"));
  console.log('"Mercado Savenago 150,00" ->', processarTextoMensagem("Mercado Savenago 150,00"));
  console.log('"Oficina sóbreque 250" ->', processarTextoMensagem("Oficina sóbreque 250"));
}

module.exports = { processarTextoMensagem, registrarGastoNoSupabase };
