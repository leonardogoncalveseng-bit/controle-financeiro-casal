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

// Servidor de saúde para manter online
app.get('/', (req, res) => {
  res.send('✅ Robô Financeiro do Casal está Online e Funcionando no Render!');
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor de saúde rodando na porta ${PORT}`);
});

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN não configurado!');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('🚀 Robô Financeiro do Casal (Telegram) iniciado!');
console.log('📩 Aguardando mensagens no grupo...');

bot.on('message', async (msg) => {
  try {
    const texto = msg.text || '';
    if (!texto || texto.startsWith('/')) return; // Ignora comandos /start

    // Processar mensagem estrita:
    // 1ª Palavra = Categoria | Meio = Estabelecimento | Fim = Valor
    const gasto = processarTextoMensagem(texto);
    if (!gasto) return; // Se não for gasto, ignora silenciosamente

    // Identificar automaticamente Ele vs Ela pelo nome do Telegram se não especificado
    const nomeUsuario = (msg.from?.first_name || '').toLowerCase();
    if (!/\b(ela|ele)\b/i.test(texto)) {
      if (nomeUsuario.includes('giu') || nomeUsuario.includes('esposa') || nomeUsuario.includes('giulissima')) {
        gasto.pago_por = 'Ela';
      } else {
        gasto.pago_por = 'Ele';
      }
    }

    console.log(`\n💰 ${msg.from?.first_name}: "${texto}" → Categoria: ${gasto.categoria_nome} | Lugar: ${gasto.descricao} | R$ ${gasto.valor} (${gasto.pago_por})`);

    const resultado = await registrarGastoNoSupabase(gasto);

    if (resultado.success) {
      bot.sendMessage(
        msg.chat.id,
        `✅ *Gasto Registrado!*\n\n` +
        `🗂️ *Categoria:* ${gasto.categoria_nome}\n` +
        `🏪 *Lugar:* ${gasto.descricao}\n` +
        `💰 *Valor:* R$ ${gasto.valor.toFixed(2)}\n` +
        `👤 *Pago por:* ${gasto.pago_por === 'Ele' ? 'Leo 👨' : 'Giu 👩'}\n\n` +
        `_Já atualizado no painel do casal!_ 📊`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error.message);
  }
});

bot.onText(/\/start|\/inicio/i, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 *Olá! Sou o Robô Financeiro do Casal!*\n\n` +
    `Para lançar um gasto no grupo, mande no formato:\n\n` +
    `\`[Categoria] [Estabelecimento] [Valor]\`\n\n` +
    `📝 *Exemplos:*\n` +
    `• \`Oficina sóbreque 250\`\n` +
    `• \`Mercado Savenago 150,00\`\n` +
    `• \`Farmacia Drogasil 45 ela\`\n`,
    { parse_mode: 'Markdown' }
  );
});
