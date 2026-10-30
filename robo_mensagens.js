// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - HIERARQUIA COMPLETA & FUZZY MATCH
// Suporta datas retroativas, aproximação de digitação e ~50 categorias!
// ===================================================
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

function obterDataHojeBrasil(dataBase = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(dataBase);
    const ano = partes.find(p => p.type === 'year').value;
    const mes = partes.find(p => p.type === 'month').value;
    const dia = partes.find(p => p.type === 'day').value;
    return `${ano}-${mes}-${dia}`;
  } catch (e) {
    const d = new Date(dataBase.getTime() - 3 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Tabela de Centros de Custo Hierárquicos Expandida
 */
const CENTROS_CUSTO_PADRAO = {
  // 1.0 ALIMENTAÇÃO
  'padaria': { macro: '1.0 Alimentação', micro: '1.2 Padaria' },
  'mercado': { macro: '1.0 Alimentação', micro: '1.1 Supermercado' },
  'supermercado': { macro: '1.0 Alimentação', micro: '1.1 Supermercado' },
  'açougue': { macro: '1.0 Alimentação', micro: '1.6 Açougue' },
  'acougue': { macro: '1.0 Alimentação', micro: '1.6 Açougue' },
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
  'mecânico': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'carro': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'moto': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'bateria': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'bateria carro': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'bateria moto': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'peca': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'peça': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'sensor': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'sensor carro': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'borracharia': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'pneu': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'pneus': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'oleo': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'óleo': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'revisao': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'revisão': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'lavagem': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'alinhamento': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'balanceamento': { macro: '2.0 Transporte', micro: '2.2 Manutenção Veicular' },
  'uber': { macro: '2.0 Transporte', micro: '2.3 Aplicativo de Transporte' },
  '99': { macro: '2.0 Transporte', micro: '2.3 Aplicativo de Transporte' },
  'pedagio': { macro: '2.0 Transporte', micro: '2.4 Pedágio / Estacionamento' },
  'pedágio': { macro: '2.0 Transporte', micro: '2.4 Pedágio / Estacionamento' },
  'estacionamento': { macro: '2.0 Transporte', micro: '2.4 Pedágio / Estacionamento' },
  'seguro auto': { macro: '2.0 Transporte', micro: '2.5 Seguro Veicular' },
  'seguro carro': { macro: '2.0 Transporte', micro: '2.5 Seguro Veicular' },

  // 3.0 MORADIA
  'aluguel': { macro: '3.0 Moradia', micro: '3.1 Aluguel' },
  'aluguel apto': { macro: '3.0 Moradia', micro: '3.1 Aluguel' },
  'aluguel apartamento': { macro: '3.0 Moradia', micro: '3.1 Aluguel' },
  'aluguel casa': { macro: '3.0 Moradia', micro: '3.1 Aluguel' },
  'condominio': { macro: '3.0 Moradia', micro: '3.2 Condomínio' },
  'condomínio': { macro: '3.0 Moradia', micro: '3.2 Condomínio' },
  'luz': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz (CPFL)' },
  'energia': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz (CPFL)' },
  'cpfl': { macro: '3.0 Moradia', micro: '3.3 Energia / Luz (CPFL)' },
  'agua': { macro: '3.0 Moradia', micro: '3.4 Água (SAAE)' },
  'água': { macro: '3.0 Moradia', micro: '3.4 Água (SAAE)' },
  'saae': { macro: '3.0 Moradia', micro: '3.4 Água (SAAE)' },
  'internet': { macro: '3.0 Moradia', micro: '3.5 Internet / Telefone' },
  'telefone': { macro: '3.0 Moradia', micro: '3.5 Internet / Telefone' },
  'claro': { macro: '3.0 Moradia', micro: '3.5 Internet / Telefone' },
  'vivo': { macro: '3.0 Moradia', micro: '3.5 Internet / Telefone' },
  'gas': { macro: '3.0 Moradia', micro: '3.6 Gás' },
  'gás': { macro: '3.0 Moradia', micro: '3.6 Gás' },
  'reforma': { macro: '3.0 Moradia', micro: '3.7 Manutenção / Reforma' },
  'chuveiro': { macro: '3.0 Moradia', micro: '3.7 Manutenção / Reforma' },
  'casa': { macro: '3.0 Moradia', micro: '3.8 Casa / Utensílios Domésticos' },
  'utensilios': { macro: '3.0 Moradia', micro: '3.8 Casa / Utensílios Domésticos' },
  'utensílios': { macro: '3.0 Moradia', micro: '3.8 Casa / Utensílios Domésticos' },
  'gelo': { macro: '3.0 Moradia', micro: '3.8 Casa / Utensílios Domésticos' },
  'forma de gelo': { macro: '3.0 Moradia', micro: '3.8 Casa / Utensílios Domésticos' },
  'forma gelo': { macro: '3.0 Moradia', micro: '3.8 Casa / Utensílios Domésticos' },

  // 4.0 SAÚDE
  'farmacia': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'drogaria': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'remedio': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'remédio': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'escova dente': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'pasta dente': { macro: '4.0 Saúde', micro: '4.1 Farmácia / Remédios' },
  'medico': { macro: '4.0 Saúde', micro: '4.2 Consultas Médicas' },
  'médico': { macro: '4.0 Saúde', micro: '4.2 Consultas Médicas' },
  'consulta': { macro: '4.0 Saúde', micro: '4.2 Consultas Médicas' },
  'psicologa': { macro: '4.0 Saúde', micro: '4.2 Consultas Médicas' },
  'psicóloga': { macro: '4.0 Saúde', micro: '4.2 Consultas Médicas' },
  'terapia': { macro: '4.0 Saúde', micro: '4.2 Consultas Médicas' },
  'exame': { macro: '4.0 Saúde', micro: '4.3 Exames / Laboratório' },
  'laboratorio': { macro: '4.0 Saúde', micro: '4.3 Exames / Laboratório' },
  'laboratório': { macro: '4.0 Saúde', micro: '4.3 Exames / Laboratório' },
  'plano': { macro: '4.0 Saúde', micro: '4.4 Plano de Saúde' },
  'unimed': { macro: '4.0 Saúde', micro: '4.4 Plano de Saúde' },
  'academia': { macro: '4.0 Saúde', micro: '4.5 Academia / Esportes' },
  'total pass': { macro: '4.0 Saúde', micro: '4.5 Academia / Esportes' },
  'gympass': { macro: '4.0 Saúde', micro: '4.5 Academia / Esportes' },
  'dentista': { macro: '4.0 Saúde', micro: '4.6 Dentista' },
  'dente': { macro: '4.0 Saúde', micro: '4.6 Dentista' },

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

  // 7.0 ROUPAS & CUIDADOS PESSOAIS
  'roupa': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.1 Vestuário / Calçados' },
  'sapato': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.1 Vestuário / Calçados' },
  'chuteira': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.1 Vestuário / Calçados' },
  'manguito': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.1 Vestuário / Calçados' },
  'shopping': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.4 Eletrônicos / Presentes pessoais' },
  'barbeiro': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.2 Salão / Barbeiro' },
  'salao': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.2 Salão / Barbeiro' },
  'salão': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.2 Salão / Barbeiro' },
  'cabeleireiro': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.2 Salão / Barbeiro' },
  'cabelo': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.2 Salão / Barbeiro' },
  'manicure': { macro: '7.0 Roupas & Cuidados Pessoais', micro: '7.3 Estética / Cosméticos' },

  // 8.0 EMPRESA / NEGÓCIOS
  'aluguel clinica': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'aluguel clínica': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'aluguel consultorio': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'aluguel consultório': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'aluguel sala': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'clinica': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'clínica': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'consultorio': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'consultório': { macro: '8.0 Empresa / Negócios', micro: '8.6 Serviços Profissionais Terceiros' },
  'empresa': { macro: '8.0 Empresa / Negócios', micro: '8.1 Contabilidade / Contador' },
  'contador': { macro: '8.0 Empresa / Negócios', micro: '8.1 Contabilidade / Contador' },
  'contadora': { macro: '8.0 Empresa / Negócios', micro: '8.1 Contabilidade / Contador' },
  'contabilidade': { macro: '8.0 Empresa / Negócios', micro: '8.1 Contabilidade / Contador' },
  'theos': { macro: '8.0 Empresa / Negócios', micro: '8.1 Contabilidade / Contador' },
  'sistema': { macro: '8.0 Empresa / Negócios', micro: '8.2 Sistemas / Software / Hospedagem' },
  'software': { macro: '8.0 Empresa / Negócios', micro: '8.2 Sistemas / Software / Hospedagem' },
  'hospedagem': { macro: '8.0 Empresa / Negócios', micro: '8.2 Sistemas / Software / Hospedagem' },
  'das': { macro: '8.0 Empresa / Negócios', micro: '8.3 Impostos / DAS / Taxas CNPJ' },
  'cnpj': { macro: '8.0 Empresa / Negócios', micro: '8.3 Impostos / DAS / Taxas CNPJ' },
  'marketing': { macro: '8.0 Empresa / Negócios', micro: '8.4 Marketing / Anúncios' },
  'anuncio': { macro: '8.0 Empresa / Negócios', micro: '8.4 Marketing / Anúncios' },
  'anúncio': { macro: '8.0 Empresa / Negócios', micro: '8.4 Marketing / Anúncios' },
  'equipamento': { macro: '8.0 Empresa / Negócios', micro: '8.5 Equipamentos / Suprimentos' },

  // 9.0 DOAÇÕES & PRESENTES
  'presente': { macro: '9.0 Doações & Presentes', micro: '9.1 Presentes / Aniversários' },
  'doacao': { macro: '9.0 Doações & Presentes', micro: '9.3 Caridade / Doações' },
  'doação': { macro: '9.0 Doações & Presentes', micro: '9.3 Caridade / Doações' },

  // 10.0 OUTROS
  'pet': { macro: '10.0 Outros', micro: '10.1 Diversos' },
  'racao': { macro: '10.0 Outros', micro: '10.1 Diversos' },
  'ração': { macro: '10.0 Outros', micro: '10.1 Diversos' },
  'veterinario': { macro: '10.0 Outros', micro: '10.1 Diversos' }
};

const STOP_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'para', 'pra', 'pro', 'com', 'e', 'a', 'o']);

function normalizarTextoBusca(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

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
 * Busca por palavra similar caso haja erro de digitação
 */
function buscarPalavraSimilar(palavraDigitada) {
  if (!palavraDigitada || palavraDigitada.length < 3) return null;

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
  let dataGasto = obterDataHojeBrasil();
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

  // 4. Descrição Exata Digitada pelo Usuário (Preserva 100% das palavras!)
  const textoDescricaoOriginal = palavras.join(' ').trim();
  const descricaoFinal = textoDescricaoOriginal.charAt(0).toUpperCase() + textoDescricaoOriginal.slice(1);

  // 5. Normalização para Classificação Inteligente em Toda a Frase
  const palavrasNorm = palavras.map(normalizarTextoBusca);
  const fraseCompleta = palavrasNorm.join(' ');
  const palavrasSemStop = palavrasNorm.filter(p => !STOP_WORDS.has(p));
  const fraseSemStop = palavrasSemStop.join(' ');

  let palavraChaveOrig = palavrasNorm[0];
  let palavraChaveUsada = palavraChaveOrig;
  let erroDigitacaoCorrigido = null;
  let macro = null;
  let micro = null;

  // 5a. Consultar regras no Supabase (Ordem: Frase Completa -> Frase Sem Stopwords -> Palavras)
  if (supabase) {
    try {
      const candidatosRegra = [fraseCompleta, fraseSemStop, ...palavrasSemStop];
      for (const cand of candidatosRegra) {
        if (!cand || cand.length < 3) continue;
        const { data: regra } = await supabase
          .from('regras_mapeamento')
          .select('*')
          .ilike('palavra_chave', cand)
          .maybeSingle();

        if (regra) {
          macro = regra.categoria_macro;
          micro = regra.subcategoria_micro;
          palavraChaveUsada = cand;
          break;
        }
      }
    } catch (e) {
      console.warn('Busca de regras falhou:', e.message);
    }
  }

  // 5b. Consultar Tabela Padrão (CENTROS_CUSTO_PADRAO)
  if (!macro) {
    // 1. Frase completa exata (ex: 'aluguel clinica', 'bateria carro')
    if (CENTROS_CUSTO_PADRAO[fraseCompleta]) {
      macro = CENTROS_CUSTO_PADRAO[fraseCompleta].macro;
      micro = CENTROS_CUSTO_PADRAO[fraseCompleta].micro;
      palavraChaveUsada = fraseCompleta;
    }
    // 2. Frase sem stop words (ex: 'bateria de carro' -> 'bateria carro')
    else if (CENTROS_CUSTO_PADRAO[fraseSemStop]) {
      macro = CENTROS_CUSTO_PADRAO[fraseSemStop].macro;
      micro = CENTROS_CUSTO_PADRAO[fraseSemStop].micro;
      palavraChaveUsada = fraseSemStop;
    }
    // 3. Pares de palavras adjacentes
    else {
      for (let i = 0; i < palavrasSemStop.length - 1; i++) {
        const par = palavrasSemStop[i] + ' ' + palavrasSemStop[i + 1];
        if (CENTROS_CUSTO_PADRAO[par]) {
          macro = CENTROS_CUSTO_PADRAO[par].macro;
          micro = CENTROS_CUSTO_PADRAO[par].micro;
          palavraChaveUsada = par;
          break;
        }
      }
    }

    // 4. Palavras individuais da frase
    if (!macro) {
      for (const p of palavrasSemStop) {
        if (CENTROS_CUSTO_PADRAO[p]) {
          macro = CENTROS_CUSTO_PADRAO[p].macro;
          micro = CENTROS_CUSTO_PADRAO[p].micro;
          palavraChaveUsada = p;
          break;
        }
      }
    }
  }

  // 5c. Tentar Fuzzy Match (Tolerância a erro de digitação com Levenshtein)
  if (!macro) {
    for (const p of palavrasSemStop) {
      const similar = buscarPalavraSimilar(p);
      if (similar) {
        palavraChaveUsada = similar.chave;
        macro = CENTROS_CUSTO_PADRAO[similar.chave].macro;
        micro = CENTROS_CUSTO_PADRAO[similar.chave].micro;
        erroDigitacaoCorrigido = `Palavra "${p}" entendida como "${similar.chave}".`;
        break;
      }
    }
  }

  // 5d. Fallback para 10.0 Outros
  if (!macro) {
    macro = '10.0 Outros';
    micro = '10.1 Diversos';
  }

  return {
    palavra_chave: palavraChaveOrig,
    palavra_chave_usada: palavraChaveUsada,
    aviso_correcao: erroDigitacaoCorrigido,
    macro,
    micro,
    descricao: descricaoFinal,
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
