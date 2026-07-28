// ===================================================
// ROBÔ TELEGRAM - Leve, Gratuito e Sem Prefixo!
// Hospedado no Render.com (100% Grátis para Sempre)
// ===================================================
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { processarTextoMensagem, registrarGastoNoSupabase } = require('./robo_mensagens');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const app = express();
const PORT = process.env.PORT || 3000;

// ===================================================
// ENDPOINT DE SAÚDE (Para o UptimeRobot manter vivo)
// ===================================================
app.get('/', (req, res) => {
  res.send('✅ Robô Financeiro do Casal está Online e Funcionando!');
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor de saúde rodando na porta ${PORT}`);
});

// ===================================================
// INICIALIZAÇÃO DO BOT (Long Polling - Sem Chrome!)
// ===================================================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('🚀 Robô Financeiro do Casal (Telegram) iniciado!');
console.log('📩 Aguardando mensagens no grupo...');

// ===================================================
// LEITURA DE MENSAGENS (Formato Natural, Sem Prefixo!)
// ===================================================
bot.on('message', async (msg) => {
  try {
    const texto = msg.text || '';
    if (!texto || texto.startsWith('/')) return; // Ignora comandos /start etc.

    // Processar com leitor inteligente
    const gasto = processarTextoMensagem(texto);
    if (!gasto) return; // Mensagem não é um lançamento financeiro, ignora silenciosamente

    // Identificar automaticamente Ele vs Ela pelo usuário do Telegram
    const telegramIdEle = process.env.TELEGRAM_ID_ELE;
    const telegramIdEla = process.env.TELEGRAM_ID_ELA;
    const remetenteId = String(msg.from?.id);

    if (telegramIdEla && remetenteId === telegramIdEla) {
      gasto.pago_por = 'Ela';
    } else if (telegramIdEle && remetenteId === telegramIdEle) {
      gasto.pago_por = 'Ele';
    }
    // Se tiver "ela" ou "ele" na mensagem, isso já foi detectado pelo parser

    const nomeRemetente = msg.from?.first_name || 'Alguém';
    console.log(`\n💰 ${nomeRemetente}: "${texto}" → R$ ${gasto.valor} (${gasto.pago_por})`);

    const resultado = await registrarGastoNoSupabase(gasto);

    if (resultado.success) {
      bot.sendMessage(
        msg.chat.id,
        `✅ *Gasto Registrado!*\n\n` +
        `📌 *${gasto.descricao}*\n` +
        `💰 R$ ${gasto.valor.toFixed(2)}\n` +
        `👤 ${gasto.pago_por === 'Ele' ? 'Ele 👨' : 'Ela 👩'}\n\n` +
        `_Painel atualizado!_ 📊`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error.message);
  }
});

// ===================================================
// COMANDO /inicio - Mostra como usar o robô
// ===================================================
bot.onText(/\/start|\/inicio/i, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 *Olá! Sou o Robô Financeiro do Casal!*\n\n` +
    `Para registrar um gasto, basta mandar uma mensagem assim:\n\n` +
    `📝 *Exemplos:*\n` +
    `• \`Mercado Savenago 150,00\`\n` +
    `• \`Posto Shell 85 ela\`\n` +
    `• \`Farmácia 45 ele\`\n` +
    `• \`Almoço 38,50\`\n\n` +
    `_Formato: [Descrição] [Valor] [quem pagou - opcional]_`,
    { parse_mode: 'Markdown' }
  );
});
