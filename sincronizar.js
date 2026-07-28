const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

// ===================================================
// CONFIGURAÇÃO DOS SERVIÇOS (SUPABASE & PLUGGY)
// ===================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_KEY precisam estar configurados nas variáveis de ambiente!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_ITEM_ID_ELE = process.env.PLUGGY_ITEM_ID_ELE; // ID da conta bancária dele
const PLUGGY_ITEM_ID_ELA = process.env.PLUGGY_ITEM_ID_ELA; // ID da conta bancária dela

/**
 * Autentica na API do Pluggy e retorna a chave de acesso temporária
 */
async function obterTokenPluggy() {
  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return null;
  }
  try {
    const response = await axios.post('https://api.pluggy.ai/auth', {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET,
    });
    return response.data.apiKey;
  } catch (error) {
    console.log('⚠️ Não foi possível conectar com a API da Pluggy (chaves não configuradas ou inválidas).');
    return null;
  }
}

/**
 * Busca extratos de uma determinada conta bancária no Pluggy
 */
async function buscarTransacoesPluggy(apiKey, itemId) {
  if (!apiKey || !itemId) return [];
  try {
    const response = await axios.get(`https://api.pluggy.ai/transactions?itemId=${itemId}`, {
      headers: { 'X-API-KEY': apiKey }
    });
    return response.data.results || [];
  } catch (error) {
    console.error(`Erro ao buscar transações da conta ${itemId}:`, error.message);
    return [];
  }
}

/**
 * Função Principal de Sincronização
 */
async function sincronizar() {
  console.log('🚀 [ROBÔ NOTURNO] Iniciando leitura de extratos bancários...');

  // 1. Localizar categoria padrão "Outros" no Supabase
  const { data: categoriaOutros } = await supabase
    .from('categorias')
    .select('id')
    .eq('nome', 'Outros')
    .maybeSingle();

  const categoriaPadraoId = categoriaOutros ? categoriaOutros.id : null;

  // 2. Conectar na API do Pluggy
  const apiKey = await obterTokenPluggy();

  let transacoesParaInserir = [];

  if (apiKey && (PLUGGY_ITEM_ID_ELE || PLUGGY_ITEM_ID_ELA)) {
    console.log('📡 Buscando extratos reais via API do Pluggy...');
    const transacoesEle = await buscarTransacoesPluggy(apiKey, PLUGGY_ITEM_ID_ELE);
    const transacoesEla = await buscarTransacoesPluggy(apiKey, PLUGGY_ITEM_ID_ELA);

    transacoesParaInserir = [
      ...transacoesEle.map(t => ({
        descricao: t.description || 'Compra no cartão/PIX',
        valor: Math.abs(t.amount),
        data: t.date ? t.date.split('T')[0] : new Date().toISOString().split('T')[0],
        pago_por: 'Ele',
        categoria_id: categoriaPadraoId
      })),
      ...transacoesEla.map(t => ({
        descricao: t.description || 'Compra no cartão/PIX',
        valor: Math.abs(t.amount),
        data: t.date ? t.date.split('T')[0] : new Date().toISOString().split('T')[0],
        pago_por: 'Ela',
        categoria_id: categoriaPadraoId
      }))
    ];
  } else {
    console.log('💡 Modo de Teste/Demonstração: Inserindo transação de teste para validar a conexão...');
    transacoesParaInserir = [
      {
        descricao: 'Compra de Teste Automática (Pluggy -> Supabase)',
        valor: 89.90,
        data: new Date().toISOString().split('T')[0],
        pago_por: 'Ele',
        categoria_id: categoriaPadraoId
      }
    ];
  }

  if (transacoesParaInserir.length === 0) {
    console.log('ℹ️ Nenhuma nova transação encontrada nos extratos.');
    return;
  }

  // 3. Gravar no Supabase
  const { data, error } = await supabase
    .from('transacoes')
    .insert(transacoesParaInserir);

  if (error) {
    console.error('❌ Erro ao salvar transações no Supabase:', error.message);
  } else {
    console.log(`✅ Sincronização concluída com sucesso! ${transacoesParaInserir.length} nova(s) transação(ões) gravada(s) no Supabase.`);
  }
}

sincronizar();
