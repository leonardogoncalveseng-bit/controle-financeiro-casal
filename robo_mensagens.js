// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - SUPORTE A LANÇAMENTO RETROATIVO
// Suporta datas: DD/MM, DD/MM/YYYY, YYYY-MM-DD no final da mensagem!
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
 * Tabela de Centros de Custo Hierárquicos (Padrão)
 */
const CENTROS_CUSTO_PADRAO = {
  // 1.0 ALIMENTAÇÃO
  'padaria': { macro: '1.0 Alimentação', micro: '1.2 Padaria' },
  'mercado': { macro: '1.0 Alimentação', micro: '1.1 Supermercado' },
  'supermercado': { macro: '1.0 Alimentação', micro: '1.1 Supermercado' },
  'açougue': { macro: '1.0 Alimentação', micro: '1.1 Açougue' },
  'acougue': { macro: '1.0 Alimentação', micro: '1.1 Açougue' },
  'restaurante': { macro: '1.0 Alimentação', micro: '1.3 Restaurante / Açaí' },
  'açai': { macro: '1.0 Alimentação', micro: '1.3 Restaurante / Açaí' },
  'acai': { macro: '1.0 Alimentação', micro: '1.3 Restaurante / Açaí' },
  'delivery': { macro: '1.0 Alimentação', micro: '1.4 Delivery / iFood' },
  'ifood': { macro: '1.0 Alimentação', micro: '1.4 Delivery / iFood' },

  // 2.0 TRANSPORTE
  'posto': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'gasolina': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'oficina': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'mecanico': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'uber': { macro: '2.0 Transporte', micro: '2.3 Aplicativo de Transporte' },
  '99': { macro: '2.0 Transporte', micro: '2.3 Aplicativo de Transporte' },

  // 3.0 MORADIA
  'aluguel': { macro: '3.0 Moradia', micro: '3.1 Aluguel' },
  'condominio': { macro: '3.0 Moradia', micro: '3.2 Condomínio' },
  'luz': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz' },
  'energia': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz' },
  'agua': { macro: '3.0 Moradia', micro: '3.3 Água' },
  'internet': { macro: '3.0 Moradia', micro: '3.4 Internet / Telefone' },

  // 4.0 SAÚDE
  'farmacia': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'drogaria': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },

  // 5.0 LAZER
  'cinema': { macro: '5.0 Lazer', micro: '5.2 Cinema / Shows' },
  'viagem': { macro: '5.0 Lazer', micro: '5.3 Viagens' },
  'netflix': { macro: '5.0 Lazer', micro: '5.1 Streaming' }
};

/**
 * Processador de Mensagens com Data Retroativa
 */
async function processarTextoMensagemComAprendizado(texto, remetentePadrao = 'Ele') {
  if (!texto || typeof texto !== 'string') return null;

  const textoLimpo = texto.trim();
  if (/https?:\/\//i.test(textoLimpo)) return null;

  const palavrasIgnorar = ['salmos', 'bom dia', 'boa tarde', 'boa noite', 'amém', 'oração', 'versículo'];
  if (palavrasIgnorar.some(p => textoLimpo.toLowerCase().includes(p))) return null;

  let palavras = textoLimpo.split(/\s+/);
  if (palavras.length < 2) return null;

  // 1. Verificar QUEM PAGOU (ele/ela) no final
  let pagoPor = remetentePadrao;
  const ultimaPalavra = palavras[palavras.length - 1].toLowerCase();
  if (['ela', 'esposa', 'giu'].includes(ultimaPalavra)) {
    pagoPor = 'Ela';
    palavras.pop();
  } else if (['ele', 'marido', 'leo'].includes(ultimaPalavra)) {
    pagoPor = 'Ele';
    palavras.pop();
  }

  // 2. Extrair DATA RETROATIVA se informada no final (ex: 25/07, 25/07/2026, 2026-07-25)
  let dataGasto = new Date().toISOString().split('T')[0]; // Padrão: hoje
  const tokenData = palavras[palavras.length - 1];

  // Regex para formato DD/MM ou DD/MM/YYYY ou YYYY-MM-DD
  const matchData = tokenData.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (matchData) {
    const dia = matchData[1].padStart(2, '0');
    const mes = matchData[2].padStart(2, '0');
    let ano = matchData[3] || new Date().getFullYear().toString();
    if (ano.length === 2) ano = '20' + ano;

    dataGasto = `${ano}-${mes}-${dia}`;
    palavras.pop(); // Remove o token da data
  }

  if (palavras.length < 2) return null;

  // 3. Extrair VALOR da última palavra restante
  const tokenValor = palavras.pop();
  const matchValor = tokenValor.match(/(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (!matchValor) return null;

  const valor = parseFloat(matchValor[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) return null;

  // 4. Categoria e Subcategoria
  const palavraChave = palavras[0].toLowerCase();
  let macro = null;
  let micro = null;

  if (supabase) {
    try {
      const { data: regra } = await supabase
        .from('regras_mapeamento')
        .select('*')
        .ilike('palavra_chave', palavraChave)
        .maybeSingle();

      if (regra) {
        macro = regra.categoria_macro;
        micro = regra.subcategoria_micro;
      }
    } catch (e) {
      console.warn('Busca de regras falhou:', e.message);
    }
  }

  if (!macro && CENTROS_CUSTO_PADRAO[palavraChave]) {
    macro = CENTROS_CUSTO_PADRAO[palavraChave].macro;
    micro = CENTROS_CUSTO_PADRAO[palavraChave].micro;
  }

  if (!macro) {
    macro = '9.0 Outros';
    micro = '9.1 Diversos';
  }

  let estabelecimento = palavras.slice(1).join(' ');
  if (!estabelecimento) {
    estabelecimento = palavras[0].charAt(0).toUpperCase() + palavras[0].slice(1);
  } else {
    estabelecimento = estabelecimento.charAt(0).toUpperCase() + estabelecimento.slice(1);
  }

  return {
    palavra_chave: palavraChave,
    macro,
    micro,
    descricao: estabelecimento,
    valor,
    pago_por: pagoPor,
    data: dataGasto
  };
}

/**
 * Registra o gasto retroativo no Supabase
 */
async function registrarGastoNoSupabase(gasto) {
  if (!supabase) return { success: true, mode: 'demo' };

  try {
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

// Testes locais do leitor retroativo
if (require.main === module) {
  console.log('🤖 Testando Leitor Retroativo:');
  console.log('"Oficina sóbreque 250 25/07" ->', processarTextoMensagemComAprendizado("Oficina sóbreque 250 25/07"));
  console.log('"Mercado Savenago 150 18/07 ela" ->', processarTextoMensagemComAprendizado("Mercado Savenago 150 18/07 ela"));
}

module.exports = {
  processarTextoMensagem: processarTextoMensagemComAprendizado,
  registrarGastoNoSupabase
};
