// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - Leitor Inteligente
// Formato aceito: "Mercado Savenago 150,00"
//                 "Posto Shell ela 80"
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
 * Inteligência do Robô: Interpreta mensagens naturais
 * Exemplos ACEITOS (sem precisar de prefixo!):
 *   "Mercado Savenago 150,00"
 *   "Posto Shell 85.50 ela"
 *   "Farmácia 45 ele"
 *   "250 Aluguel"
 *
 * Exemplos IGNORADOS automaticamente:
 *   "Bom dia a todos!" (sem número claro de valor)
 *   Links, textos longos, etc.
 */
function processarTextoMensagem(texto, remetentePadrao = 'Ele') {
  if (!texto || typeof texto !== 'string') return null;

  const textoLimpo = texto.trim();

  // REGRA 1: Ignorar mensagens com mais de 8 palavras (provavelmente texto normal)
  const palavras = textoLimpo.split(/\s+/);
  if (palavras.length > 8) return null;

  // REGRA 2: Ignorar links (mensagens com http)
  if (/https?:\/\//i.test(textoLimpo)) return null;

  // REGRA 2b: Ignorar mensagens religiosas, cumprimentos e expressões comuns
  const palavrasIgnorar = ['salmos', 'bom dia', 'boa tarde', 'boa noite', 'amém', 'amen', 'senhor', 'deus', 'jesus', 'oração', 'versículo', ':8', 'corín', 'filipen', 'isaías', 'gênesis'];
  if (palavrasIgnorar.some(p => textoLimpo.toLowerCase().includes(p))) return null;

  // REGRA 3: Ignorar mensagens que são só texto sem número
  if (!/\d/.test(textoLimpo)) return null;

  // Identificar quem pagou
  let pagoPor = remetentePadrao;
  if (/\b(ela|esposa|mulher)\b/i.test(textoLimpo)) {
    pagoPor = 'Ela';
  } else if (/\b(ele|marido|eu)\b/i.test(textoLimpo)) {
    pagoPor = 'Ele';
  }

  // Extrair o valor (suporta 150, 150.50, 150,50, R$ 150)
  const regexValor = /(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/i;
  const matchValor = textoLimpo.match(regexValor);

  if (!matchValor) return null;

  const valorString = matchValor[1].replace(',', '.');
  const valor = parseFloat(valorString);

  // REGRA 4: Ignorar valores ridiculamente pequenos ou grandes (provavelmente não é gasto)
  if (valor < 1 || valor > 100000) return null;

  // Extrair a Descrição (remove o valor e indicação de pessoa)
  let descricao = textoLimpo
    .replace(matchValor[0], '')
    .replace(/\b(ela|ele|esposa|marido|mulher|eu|R\$)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!descricao) {
    descricao = 'Gasto Registrado';
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

  console.log(`✅ [ROBÔ] R$ ${gasto.valor} registrado (${gasto.pago_por})!`);
  return { success: true, data };
}

// Teste
if (require.main === module) {
  console.log('🤖 Testando leitor inteligente do Robô:');
  console.log('"Mercado Savenago 150,00" ->', processarTextoMensagem("Mercado Savenago 150,00"));
  console.log('"Posto Shell ela 80" ->', processarTextoMensagem("Posto Shell ela 80"));
  console.log('"Bom dia a todos amigos! 🙏" ->', processarTextoMensagem("Bom dia a todos amigos! 🙏"));
  console.log('"Salmos 32:8 Bom dia!" ->', processarTextoMensagem("Salmos 32:8 Bom dia!"));
}

module.exports = { processarTextoMensagem, registrarGastoNoSupabase };
