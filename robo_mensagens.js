// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - HIERARQUIA & MAPEAMENTO
// Estrutura 1.0 (Macro) -> 1.1 (Micro / Subcategoria)
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
 * Tabela de Centros de Custo Hierárquicos (Macro -> Micro)
 */
const CENTROS_CUSTO = {
  // 1.0 ALIMENTAÇÃO
  'padaria': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.2', micro: 'Padaria' },
  'mercado': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.1', micro: 'Supermercado' },
  'supermercado': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.1', micro: 'Supermercado' },
  'açougue': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.1', micro: 'Açougue' },
  'acougue': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.1', micro: 'Açougue' },
  'restaurante': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.3', micro: 'Restaurante / Açaí' },
  'açai': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.3', micro: 'Restaurante / Açaí' },
  'acai': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.3', micro: 'Restaurante / Açaí' },
  'delivery': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.4', micro: 'Delivery / iFood' },
  'ifood': { codigo_macro: '1.0', macro: 'Alimentação', codigo_micro: '1.4', micro: 'Delivery / iFood' },

  // 2.0 TRANSPORTE
  'posto': { codigo_macro: '2.0', macro: 'Transporte', codigo_micro: '2.1', micro: 'Combustível' },
  'gasolina': { codigo_macro: '2.0', macro: 'Transporte', codigo_micro: '2.1', micro: 'Combustível' },
  'oficina': { codigo_macro: '2.0', macro: 'Transporte', codigo_micro: '2.2', micro: 'Manutenção Veicular' },
  'mecanico': { codigo_macro: '2.0', macro: 'Transporte', codigo_micro: '2.2', micro: 'Manutenção Veicular' },
  'uber': { codigo_macro: '2.0', macro: 'Transporte', codigo_micro: '2.3', micro: 'Aplicativo de Transporte' },
  '99': { codigo_macro: '2.0', macro: 'Transporte', codigo_micro: '2.3', micro: 'Aplicativo de Transporte' },

  // 3.0 MORADIA
  'aluguel': { codigo_macro: '3.0', macro: 'Moradia', codigo_micro: '3.1', micro: 'Aluguel' },
  'condominio': { codigo_macro: '3.0', macro: 'Moradia', codigo_micro: '3.2', micro: 'Condomínio' },
  'luz': { codigo_macro: '3.0', macro: 'Moradia', codigo_micro: '3.3', micro: 'Energia / Luz' },
  'energia': { codigo_macro: '3.0', macro: 'Moradia', codigo_micro: '3.3', micro: 'Energia / Luz' },
  'agua': { codigo_macro: '3.0', macro: 'Moradia', codigo_micro: '3.3', micro: 'Água' },
  'internet': { codigo_macro: '3.0', macro: 'Moradia', codigo_micro: '3.4', micro: 'Internet / Telefone' },

  // 4.0 SAÚDE
  'farmacia': { codigo_macro: '4.0', macro: 'Saúde', codigo_micro: '4.1', micro: 'Farmácia / Remédios' },
  'drogaria': { codigo_macro: '4.0', macro: 'Saúde', codigo_micro: '4.1', micro: 'Farmácia / Remédios' },
  'consulta': { codigo_macro: '4.0', macro: 'Saúde', codigo_micro: '4.2', micro: 'Consultas / Exames' },

  // 5.0 LAZER
  'cinema': { codigo_macro: '5.0', macro: 'Lazer', codigo_micro: '5.2', micro: 'Cinema / Shows' },
  'viagem': { codigo_macro: '5.0', macro: 'Lazer', codigo_micro: '5.3', micro: 'Viagens' },
  'netflix': { codigo_macro: '5.0', macro: 'Lazer', codigo_micro: '5.1', micro: 'Streaming' }
};

/**
 * Leitor Inteligente de Mensagens com Hierarquia
 */
function processarTextoMensagem(texto, remetentePadrao = 'Ele') {
  if (!texto || typeof texto !== 'string') return null;

  const textoLimpo = texto.trim();
  if (/https?:\/\//i.test(textoLimpo)) return null;

  const palavrasIgnorar = ['salmos', 'bom dia', 'boa tarde', 'boa noite', 'amém', 'oração', 'versículo'];
  if (palavrasIgnorar.some(p => textoLimpo.toLowerCase().includes(p))) return null;

  const palavras = textoLimpo.split(/\s+/);
  if (palavras.length < 2) return null;

  let pagoPor = remetentePadrao;
  let palavrasFiltradas = [...palavras];

  const ultimaPalavra = palavrasFiltradas[palavrasFiltradas.length - 1].toLowerCase();
  if (['ela', 'esposa', 'giu'].includes(ultimaPalavra)) {
    pagoPor = 'Ela';
    palavrasFiltradas.pop();
  } else if (['ele', 'marido', 'leo'].includes(ultimaPalavra)) {
    pagoPor = 'Ele';
    palavrasFiltradas.pop();
  }

  if (palavrasFiltradas.length < 2) return null;

  // Extrair valor da última palavra
  const tokenValor = palavrasFiltradas.pop();
  const matchValor = tokenValor.match(/(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (!matchValor) return null;

  const valor = parseFloat(matchValor[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) return null;

  // Palavra-chave inicial
  const palavraChave = palavrasFiltradas[0].toLowerCase();
  const mapeado = CENTROS_CUSTO[palavraChave];

  let macro = '9.0 Outros';
  let micro = palavrasFiltradas[0].charAt(0).toUpperCase() + palavrasFiltradas[0].slice(1).toLowerCase();

  if (mapeado) {
    macro = `${mapeado.codigo_macro} ${mapeado.macro}`;
    micro = `${mapeado.codigo_micro} ${mapeado.micro}`;
  }

  let estabelecimento = palavrasFiltradas.slice(1).join(' ');
  if (!estabelecimento) {
    estabelecimento = micro;
  } else {
    estabelecimento = estabelecimento.charAt(0).toUpperCase() + estabelecimento.slice(1);
  }

  return {
    macro,
    micro,
    descricao: estabelecimento,
    valor,
    pago_por: pagoPor,
    data: new Date().toISOString().split('T')[0]
  };
}

/**
 * Registra o gasto no Supabase
 */
async function registrarGastoNoSupabase(gasto) {
  if (!supabase) return { success: true, mode: 'demo' };

  try {
    // 1. Categoria
    let catId = null;
    const { data: catExistente } = await supabase
      .from('categorias')
      .select('id')
      .ilike('nome', gasto.macro)
      .maybeSingle();

    if (catExistente) {
      catId = catExistente.id;
    } else {
      const { data: novaCat } = await supabase
        .from('categorias')
        .insert([{ nome: gasto.macro, icone: '📌' }])
        .select('id')
        .single();
      if (novaCat) catId = novaCat.id;
    }

    // 2. Transação
    const descFinal = `[${gasto.micro}] ${gasto.descricao}`;
    const { data, error } = await supabase.from('transacoes').insert([{
      descricao: descFinal,
      valor: gasto.valor,
      pago_por: gasto.pago_por,
      categoria_id: catId,
      data: gasto.data
    }]);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao salvar no Supabase:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { processarTextoMensagem, registrarGastoNoSupabase };
