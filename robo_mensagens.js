// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - HIERARQUIA COMPLETA & FUZZY MATCH
// Suporta datas retroativas, aproximação de digitação e ~40 categorias!
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
 * Tabela de Centros de Custo Hierárquicos Expandida
 */
const CENTROS_CUSTO_PADRAO = {
  // 1.0 ALIMENTAÇÃO
  'padaria': { macro: '1.0 Alimentação', micro: '1.2 Padaria' },
  'mercado': { macro: '1.0 Alimentação', micro: '1.1 Supermercado' },
  'supermercado': { macro: '1.0 Alimentação', micro: '1.1 Supermercado' },
  'açougue': { macro: '1.0 Alimentação', micro: '1.1 Açougue' },
  'acougue': { macro: '1.0 Alimentação', micro: '1.1 Açougue' },
  'restaurante': { macro: '1.0 Alimentação', micro: '1.3 Restaurante' },
  'lanchonete': { macro: '1.0 Alimentação', micro: '1.3 Restaurante' },
  'açai': { macro: '1.0 Alimentação', micro: '1.5 Açaí' },
  'acai': { macro: '1.0 Alimentação', micro: '1.5 Açaí' },
  'delivery': { macro: '1.0 Alimentação', micro: '1.4 Delivery / iFood' },
  'ifood': { macro: '1.0 Alimentação', micro: '1.4 Delivery / iFood' },

  // 2.0 TRANSPORTE
  'combustivel': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'combustível': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'gasolina': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'alcool': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'álcool': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'diesel': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'posto': { macro: '2.0 Transporte', micro: '2.1 Combustível' },
  'oficina': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'mecanico': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'uber': { macro: '2.0 Transporte', micro: '2.3 Aplicativo de Transporte' },
  '99': { macro: '2.0 Transporte', micro: '2.3 Aplicativo de Transporte' },
  'pedagio': { macro: '2.0 Transporte', micro: '2.4 Pedágio / Estacionamento' },
  'estacionamento': { macro: '2.0 Transporte', micro: '2.4 Pedágio / Estacionamento' },

  // 3.0 MORADIA
  'aluguel': { macro: '3.0 Moradia', micro: '3.1 Aluguel' },
  'condominio': { macro: '3.0 Moradia', micro: '3.2 Condomínio' },
  'luz': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz' },
  'energia': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz' },
  'agua': { macro: '3.0 Moradia', micro: '3.4 Água' },
  'internet': { macro: '3.0 Moradia', micro: '3.5 Internet / Telefone' },
  'telefone': { macro: '3.0 Moradia', micro: '3.5 Internet / Telefone' },
  'gas': { macro: '3.0 Moradia', micro: '3.6 Gás' },

  // 4.0 SAÚDE
  'farmacia': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'drogaria': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'medico': { macro: '4.0 Saúde', micro: '4.2 Consultas / Exames' },
  'exame': { macro: '4.0 Saúde', micro: '4.2 Consultas / Exames' },
  'plano': { macro: '4.0 Saúde', micro: '4.3 Plano de Saúde' },
  'academia': { macro: '4.0 Saúde', micro: '4.4 Academia / Esportes' },

  // 5.0 LAZER
  'cinema': { macro: '5.0 Lazer', micro: '5.2 Cinema / Shows' },
  'teatro': { macro: '5.0 Lazer', micro: '5.2 Cinema / Shows' },
  'show': { macro: '5.0 Lazer', micro: '5.2 Cinema / Shows' },
  'viagem': { macro: '5.0 Lazer', micro: '5.3 Viagens / Hotel' },
  'hotel': { macro: '5.0 Lazer', micro: '5.3 Viagens / Hotel' },
  'netflix': { macro: '5.0 Lazer', micro: '5.1 Streaming' },
  'spotify': { macro: '5.0 Lazer', micro: '5.1 Streaming' },
  'amazon': { macro: '5.0 Lazer', micro: '5.1 Streaming' },

  // 6.0 EDUCAÇÃO
  'escola': { macro: '6.0 Educação', micro: '6.1 Mensalidade Escolar' },
  'curso': { macro: '6.0 Educação', micro: '6.2 Cursos / Treinamentos' },
  'livro': { macro: '6.0 Educação', micro: '6.3 Material / Livros' },

  // 7.0 ROUPAS & COMPRAS
  'roupa': { macro: '7.0 Roupas & Compras', micro: '7.1 Vestuário' },
  'sapato': { macro: '7.0 Roupas & Compras', micro: '7.1 Vestuário' },
  'shopping': { macro: '7.0 Roupas & Compras', micro: '7.2 Eletrônicos / Presentes' }
};

/**
 * Calculador de distância de Levenshtein para erro de digitação
 */
function calcularLevenshtein(str1, str2) {
  const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  return track[str2.length][str1.length];
}

/**
 * Busca por palavra similar caso haja erro de digitação (ex: gasoina -> gasolina)
 */
function buscarPalavraSimilar(palavraDigitada) {
  if (palavraDigitada.length < 3) return null;

  let melhorChave = null;
  let menorDistancia = Infinity;

  for (const chave of Object.keys(CENTROS_CUSTO_PADRAO)) {
    const dist = calcularLevenshtein(palavraDigitada, chave);
    const limiteTolerancia = chave.length > 5 ? 2 : 1;

    if (dist <= limiteTolerancia && dist < menorDistancia) {
      menorDistancia = dist;
      melhorChave = chave;
    }
  }

  return melhorChave ? { chave: melhorChave, distancia: menorDistancia } : null;
}

/**
 * Processador de Mensagens com Suporte a Erros de Digitação e Data Retroativa
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

  // 2. Extrair DATA RETROATIVA se informada no final (ex: 25/07)
  let dataGasto = new Date().toISOString().split('T')[0];
  const tokenData = palavras[palavras.length - 1];

  const matchData = tokenData.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (matchData) {
    const dia = matchData[1].padStart(2, '0');
    const mes = matchData[2].padStart(2, '0');
    let ano = matchData[3] || new Date().getFullYear().toString();
    if (ano.length === 2) ano = '20' + ano;

    dataGasto = `${ano}-${mes}-${dia}`;
    palavras.pop();
  }

  if (palavras.length < 2) return null;

  // 3. Extrair VALOR da última palavra restante
  const tokenValor = palavras.pop();
  const matchValor = tokenValor.match(/(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (!matchValor) return null;

  const valor = parseFloat(matchValor[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) return null;

  // 4. Categoria e Subcategoria (Com aprendizado + Fuzzy Match para erro de digitação)
  const palavraChaveOrig = palavras[0].toLowerCase();
  let palavraChaveUsada = palavraChaveOrig;
  let erroDigitacaoCorrigido = null;
  let macro = null;
  let micro = null;

  // 4a. Consultar regras no Supabase primeiro
  if (supabase) {
    try {
      const { data: regra } = await supabase
        .from('regras_mapeamento')
        .select('*')
        .ilike('palavra_chave', palavraChaveOrig)
        .maybeSingle();

      if (regra) {
        macro = regra.categoria_macro;
        micro = regra.subcategoria_micro;
      }
    } catch (e) {
      console.warn('Busca de regras falhou:', e.message);
    }
  }

  // 4b. Consultar Tabela Padrão se não achou regra personalizada
  if (!macro && CENTROS_CUSTO_PADRAO[palavraChaveOrig]) {
    macro = CENTROS_CUSTO_PADRAO[palavraChaveOrig].macro;
    micro = CENTROS_CUSTO_PADRAO[palavraChaveOrig].micro;
  }

  // 4c. Tentar Fuzzy Match (tolerância a erros de digitação como "gasoina")
  if (!macro) {
    const similar = buscarPalavraSimilar(palavraChaveOrig);
    if (similar) {
      palavraChaveUsada = similar.chave;
      macro = CENTROS_CUSTO_PADRAO[similar.chave].macro;
      micro = CENTROS_CUSTO_PADRAO[similar.chave].micro;
      erroDigitacaoCorrigido = `Palavra "${palavraChaveOrig}" entendida como "${similar.chave}".`;
    }
  }

  // 4d. Fallback para 9.0 Outros caso não encontre nenhuma categoria
  if (!macro) {
    macro = '9.0 Outros';
    micro = '9.1 Diversos';
  }

  let estabelecimento = palavras.slice(1).join(' ');
  if (!estabelecimento) {
    estabelecimento = palavraChaveOrig.charAt(0).toUpperCase() + palavraChaveOrig.slice(1);
  } else {
    estabelecimento = estabelecimento.charAt(0).toUpperCase() + estabelecimento.slice(1);
  }

  return {
    palavra_chave: palavraChaveOrig,
    palavra_chave_usada: palavraChaveUsada,
    aviso_correcao: erroDigitacaoCorrigido,
    macro,
    micro,
    descricao: estabelecimento,
    valor,
    pago_por: pagoPor,
    data: dataGasto
  };
}

/**
 * Registra no Supabase
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

module.exports = {
  processarTextoMensagem: processarTextoMensagemComAprendizado,
  registrarGastoNoSupabase,
  CENTROS_CUSTO_PADRAO
};
