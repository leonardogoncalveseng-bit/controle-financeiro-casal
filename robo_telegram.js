// ===================================================
// ROBÔ DE MENSAGENS TELEGRAM (100% GRÁTIS NA NUVEM)
// ===================================================
const TelegramBot = require('node-telegram-bot-api');
const { processarTextoMensagem, registrarGastoNoSupabase } = require('./robo_mensagens');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
  console.log('⚠️ TELEGRAM_TOKEN não configurado no arquivo .env!');
  console.log('💡 Adicione TELEGRAM_TOKEN=seu_token_do_botfather no .env');
}

// Inicializa o Bot via Long Polling (Leve e não precisa de Webhook/porta exposta!)
const bot = new TelegramBot(TELEGRAM_TOKEN || 'DUMMY_TOKEN', { polling: true });

console.log('🚀 Robô do Telegram iniciado com sucesso e aguardando lançamentos...');

bot.on('message', async (msg) => {
  try {
    const texto = msg.text || '';
    if (!texto) return;

    // PREFIXO OBRIGATÓRIO: $
    // Exemplos:
    // $Mercado 150
    // $Posto Shell 85 ela
    if (!texto.startsWith('$')) return;

    const textoSemPrefixo = texto.slice(1).trim();

    // Processar o texto com o leitor inteligente
    const gasto = processarTextoMensagem(textoSemPrefixo);

    if (!gasto || gasto.valor <= 0) {
      bot.sendMessage(
        msg.chat.id,
        `⚠️ Não entendi o valor. Tente usar assim:\n\n` +
        `*$Mercado 150*\n` +
        `*$Posto Shell 85 ela*\n` +
        `*$Aluguel 1500 ele*`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Identificar automaticamente quem enviou no Telegram
    const nomeUsuario = (msg.from?.first_name || '').toLowerCase();
    if (!/\b(ela|ele)\b/i.test(textoSemPrefixo)) {
      if (nomeUsuario.includes('giu') || nomeUsuario.includes('esposa') || nomeUsuario.includes('ela')) {
        gasto.pago_por = 'Ela';
      } else {
        gasto.pago_por = 'Ele';
      }
    }

    console.log(`\n💰 [TELEGRAM] Gasto recebido de ${msg.from?.first_name}: "${textoSemPrefixo}" -> R$ ${gasto.valor} (${gasto.pago_por})`);

    // Salvar no Supabase (o mesmo banco do aplicativo!)
    const resultado = await registrarGastoNoSupabase(gasto);

    if (resultado.success) {
      bot.sendMessage(
        msg.chat.id,
        `✅ *Gasto Registrado no Painel do Casal!*\n\n` +
        `📌 *Descrição:* ${gasto.descricao}\n` +
        `💰 *Valor:* R$ ${gasto.valor.toFixed(2)}\n` +
        `👤 *Pago por:* ${gasto.pago_por === 'Ele' ? 'Ele 👨' : 'Ela 👩'}\n\n` +
        `_Atualizado instantaneamente na tela do aplicativo!_ 📊`,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.sendMessage(msg.chat.id, '❌ Erro ao salvar no banco do Supabase.');
    }

  } catch (error) {
    console.error('Erro ao processar mensagem do Telegram:', error.message);
  }
});
