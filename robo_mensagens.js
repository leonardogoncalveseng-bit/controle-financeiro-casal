// ===================================================
// ROBÔ DE MENSAGENS (TEXTO -> SUPABASE)
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
 * Inteligência do Robô: Interpreta mensagens de texto e extrai os dados do gasto
 * Exemplos aceitos:
 * - "Mercado Carrefour 150"
 * - "Posto Shell 85.50 ela"
 * - "200 Aluguel ele"
 */
function processarTextoMensagem(texto, remetentePadrao = 'Ele') {
  if (!texto || typeof texto !== 'string') return null;

  const textoLimpo = texto.trim();

  // 1. Identificar quem pagou (Ele vs Ela)
  let pagoPor = remetentePadrao;
  if (/\b(ela|esposa|mulher)\b/i.test(textoLimpo)) {
    pagoPor = 'Ela';
  } else if (/\b(ele|marido|eu)\b/i.test(textoLimpo)) {
    pagoPor = 'Ele';
  }

  // 2. Extrair o valor numérico (suporta R$ 150, 150.50 ou 150,50)
  const regexValor = /(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)/i;
  const matchValor = textoLimpo.match(regexValor);

  if (!matchValor) {
    return null; // Não encontrou valor válido
  }

  const valorString = matchValor[1].replace(',', '.');
  const valor = parseFloat(valorString);

  // 3. Extrair a Descrição (remove a palavra de valor e quem pagou)
  let descricao = textoLimpo
    .replace(matchValor[0], '')
    .replace(/\b(ela|ele|esposa|marido|mulher|eu)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!descricao) {
    descricao = 'Gasto Registrado via Mensagem';
  }

  return {
    descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1),
    valor: valor,
    pago_por: pagoPor,
    data: new Date().toISOString().split('T')[0]
  };
}

/**
 * Registra o gasto processado no Supabase
 */
async function registrarGastoNoSupabase(gasto) {
  if (!supabase) {
    console.log('💡 [Simulação Robô] Gasto identificado:', gasto);
    return { success: true, mode: 'demo' };
  }

  // Buscar categoria padrão "Outros"
  const { data: categoriaOutros } = await supabase
    .from('categorias')
    .select('id')
    .eq('nome', 'Outros')
    .maybeSingle();

  const gastoFinal = {
    ...gasto,
    categoria_id: categoriaOutros ? categoriaOutros.id : null
  };

  const { data, error } = await supabase
    .from('transacoes')
    .insert([gastoFinal]);

  if (error) {
    console.error('❌ Erro ao salvar no Supabase:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`✅ [ROBÔ] Gasto de R$ ${gasto.valor} registrado com sucesso (${gasto.pago_por})!`);
  return { success: true, data };
}

// Teste local do interpretador
if (require.main === module) {
  console.log('🤖 Testando inteligência de leitura do Robô:');
  console.log('Mensagem: "Mercado Carrefour 185.50 ela" ->', processarTextoMensagem("Mercado Carrefour 185.50 ela"));
  console.log('Mensagem: "Posto Shell 90" ->', processarTextoMensagem("Posto Shell 90"));
  console.log('Mensagem: "120 Jantar com amigos" ->', processarTextoMensagem("120 Jantar com amigos"));
}

module.exports = {
  processarTextoMensagem,
  registrarGastoNoSupabase
};
