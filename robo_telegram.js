// ===================================================
// ROBÔ TELEGRAM - Casal v2.0 (Identificação Automática + Cron)
// ===================================================
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cron = require('node-cron');
const { processarTextoMensagem, registrarGastoNoSupabase } = require('./robo_mensagens');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

app.get('/', (req, res) => {
  res.send('✅ Robô Financeiro do Casal v2.0 Online no Render!');
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor de saúde rodando na porta ${PORT}`);
});

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN não configurado!');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('🚀 Robô Financeiro do Casal v2.0 (Telegram) iniciado!');

let grupoChatId = null;

bot.on('message', async (msg) => {
  try {
    grupoChatId = msg.chat.id;
    const texto = msg.text || '';
    if (!texto || texto.startsWith('/')) return;

    // Processar texto
    const gasto = await processarTextoMensagem(texto);
    if (!gasto) return;

    // IDENTIFICAÇÃO AUTOMÁTICA DO REMETENTE
    const nomeUsuario = (msg.from?.first_name || '').toLowerCase();
    const sobrenome = (msg.from?.last_name || '').toLowerCase();
    const username = (msg.from?.username || '').toLowerCase();

    // Se o usuário não escreveu "ela" ou "ele" explicitamente no final
    if (!/\b(ela|ele)\b/i.test(texto)) {
      if (
        nomeUsuario.includes('giu') ||
        nomeUsuario.includes('giulissima') ||
        sobrenome.includes('giu') ||
        username.includes('giu')
      ) {
        gasto.pago_por = 'Ela';
      } else {
        gasto.pago_por = 'Ele';
      }
    }

    console.log(`💰 Lançamento por ${msg.from?.first_name} (ID ${msg.from?.id}) → ${gasto.pago_por}`);

    const resultado = await registrarGastoNoSupabase(gasto);

    if (resultado.success) {
      const dataFormatada = gasto.data ? gasto.data.split('-').reverse().join('/') : 'Hoje';

      bot.sendMessage(
        msg.chat.id,
        `✅ *Gasto Registrado!*\n\n` +
        `📅 *Data:* ${dataFormatada}\n` +
        `📁 *Centro de Custo:* ${gasto.macro}\n` +
        `  └ 🏷️ *Subcategoria:* ${gasto.micro}\n` +
        `🏪 *Lugar:* ${gasto.descricao}\n` +
        `💰 *Valor:* R$ ${gasto.valor.toFixed(2)}\n` +
        `👤 *Pago por:* ${gasto.pago_por === 'Ele' ? 'Leo 👨' : 'Giu 👩'}\n\n` +
        `_Disponível no aplicativo!_ 📊`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error.message);
  }
});

// Verificação diária de contas recorrentes
async function verificarContasAVencer() {
  if (!supabase || !grupoChatId) return;

  try {
    const { data: contas } = await supabase.from('gastos_recorrentes').select('*').eq('ativo', true);
    if (!contas || contas.length === 0) return;

    const hoje = new Date().getDate();

    contas.forEach(c => {
      const diasRestantes = c.dia_vencimento - hoje;

      if (diasRestantes >= 0 && diasRestantes <= 3) {
        let msgDias = diasRestantes === 0 ? 'VENCE HOJE! 🚨' : `vence em ${diasRestantes} dia(s) ⏰`;

        bot.sendMessage(
          grupoChatId,
          `⚠️ *ALERTA DE CONTA FIXA A VENCER!*\n\n` +
          `📌 *Conta:* ${c.nome}\n` +
          `💰 *Valor:* R$ ${Number(c.valor).toFixed(2)}\n` +
          `👤 *Responsável:* ${c.responsavel || 'Casal 💑'}\n` +
          `📅 *Vencimento:* Dia ${c.dia_vencimento} (${msgDias})\n\n` +
          `_Lembrete automático para o casal!_ 💑`,
          { parse_mode: 'Markdown' }
        );
      }
    });
  } catch (err) {
    console.warn('Aviso ao verificar contas a vencer:', err.message);
  }
}

cron.schedule('0 9 * * *', () => {
  verificarContasAVencer();
});

bot.onText(/\/start|\/inicio/i, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 *Olá! Sou o Robô Financeiro do Casal v2.0!*\n\n` +
    `Mande gastos no formato:\n` +
    `• \`Açai do Parque 25\` (Registra para Hoje)\n` +
    `• \`Oficina sóbreque 250 25/07\` (Lançamento Retroativo)\n` +
    `• \`Mercado Savenago 150 18/07 ela\` (Retroativo da Giu)\n`,
    { parse_mode: 'Markdown' }
  );
});
