// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM - Leitor Estrito
// REGRA:
// 1ª Palavra: Categoria (ex: Oficina, Mercado, Farmacia)
// Palavras do Meio: Nome do Estabelecimento (ex: sóbreque, Savenago)
// Última Palavra: Valor (ex: 250, 150,00, 85.50)
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
 * Interpreta a mensagem segundo a regra estrita do usuário:
 * 1ª palavra = Categoria
 * Palavras do meio = Estabelecimento / Descrição
 * Última palavra = Valor
 */
function processarTextoMensagem(texto, remetentePadrao = 'Ele') {
  if (!texto || typeof texto !== 'string') return null;

  const textoLimpo = texto.trim();

  // Ignorar mensagens longas, links ou frases comuns
  if (/https?:\/\//i.test(textoLimpo)) return null;
  const palavrasIgnorar = ['salmos', 'bom dia', 'boa tarde', 'boa noite', 'amém', 'oração', 'versículo'];
  if (palavrasIgnorar.some(p => textoLimpo.toLowerCase().includes(p))) return null;

  const palavras = textoLimpo.split(/\s+/);
  if (palavras.length < 2) return null; // Precisa ter pelo menos 2 palavras (ex: Mercado 150)

  // 1. Verificar se quem pagou foi especificado no final (ex: ela/ele)
  let pagoPor = remetentePadrao;
  let palavrasFiltradas = [...palavras];

  const ultimaPalavra = palavrasFiltradas[palavrasFiltradas.length - 1].toLowerCase();
  if (ultimaPalavra === 'ela' || ultimaPalavra === 'esposa') {
    pagoPor = 'Ela';
    palavrasFiltradas.pop(); // Remove "ela" do final
  } else if (ultimaPalavra === 'ele' || ultimaPalavra === 'marido') {
    pagoPor = 'Ele';
    palavrasFiltradas.pop(); // Remove "ele" do final
  }

  if (palavrasFiltradas.length < 2) return null;

  // 2. A ÚLTIMA palavra do restante DEVE ser o valor numérico
  const tokenValor = palavrasFiltradas.pop();
  const regexValor = /(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/i;
  const matchValor = tokenValor.match(regexValor);

  if (!matchValor) return null; // Se a última palavra não for um valor, ignora

  const valor = parseFloat(matchValor[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) return null;

  // 3. A PRIMEIRA palavra é a Categoria
  const categoriaNome = palavrasFiltradas[0];
  const categoriaFormatada = categoriaNome.charAt(0).toUpperCase() + categoriaNome.slice(1).toLowerCase();

  // 4. As palavras do MEIO são o nome do estabelecimento / lugar
  let estabelecimento = palavrasFiltradas.slice(1).join(' ');
  if (!estabelecimento) {
    estabelecimento = categoriaFormatada; // Caso o usuário mande só "Mercado 150"
  } else {
    estabelecimento = estabelecimento.charAt(0).toUpperCase() + estabelecimento.slice(1);
  }

  return {
    categoria_nome: categoriaFormatada,
    descricao: estabelecimento,
    valor: valor,
    pago_por: pagoPor,
    data: new Date().toISOString().split('T')[0]
  };
}

/**
 * Registra o gasto no Supabase garantindo que a categoria seja vinculada/criada
 */
async function registrarGastoNoSupabase(gasto) {
  if (!supabase) {
    console.log('💡 [Simulação Robô] Gasto identificado:', gasto);
    return { success: true, mode: 'demo' };
  }

  try {
    // 1. Procurar ou criar a Categoria no Supabase
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
        // Criar nova categoria automaticamente se não existir
        const { data: novaCat, error: errNovaCat } = await supabase
          .from('categorias')
          .insert([{ nome: gasto.categoria_nome, icone: '📌' }])
          .select('id')
          .single();

        if (!errNovaCat && novaCat) {
          categoriaId = novaCat.id;
        }
      }
    }

    // 2. Inserir a Transação
    const transacaoObj = {
      descricao: gasto.descricao,
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

    console.log(`✅ [ROBÔ] Categoria: "${gasto.categoria_nome}" | Lugar: "${gasto.descricao}" | R$ ${gasto.valor} (${gasto.pago_por})!`);
    return { success: true, data };
  } catch (err) {
    console.error('Erro na gravação:', err.message);
    return { success: false, error: err.message };
  }
}

// Testes do leitor estrito
if (require.main === module) {
  console.log('🤖 Testando Leitor Estrito:');
  console.log('"Oficina sóbreque 250" ->', processarTextoMensagem("Oficina sóbreque 250"));
  console.log('"Mercado Savenago 150,00" ->', processarTextoMensagem("Mercado Savenago 150,00"));
  console.log('"Farmacia Drogasil 45,90 ela" ->', processarTextoMensagem("Farmacia Drogasil 45,90 ela"));
}

module.exports = { processarTextoMensagem, registrarGastoNoSupabase };
