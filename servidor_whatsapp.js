// ===================================================
// SERVIDOR WEBHOOK DO WHATSAPP CLOUD API (META)
// ===================================================
const express = require('express');
const axios = require('axios');
const { processarTextoMensagem, registrarGastoNoSupabase } = require('./robo_mensagens');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'casal_financeiro_seguro_123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

/**
 * 1. VALIDAÇÃO DO WEBHOOK PELA META (GET)
 * A Meta envia um desafio ao configurar o Webhook para garantir a segurança.
 */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook do WhatsApp verificado com sucesso pela Meta!');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Falha na verificação do token do Webhook.');
    return res.sendStatus(403);
  }
});

/**
 * 2. RECEBIMENTO DE MENSAGENS DO WHATSAPP (POST)
 * Chamado automaticamente pela Meta sempre que você ou sua esposa mandarem mensagem.
 */
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message && message.type === 'text') {
        const textoMensagem = message.text.body;
        const numeroRemetente = message.from; // Número de quem enviou

        console.log(`📩 Nova mensagem recebida no WhatsApp (${numeroRemetente}): "${textoMensagem}"`);

        // Processar texto com o nosso leitor inteligente
        const gastoIdentificado = processarTextoMensagem(textoMensagem);

        if (gastoIdentificado) {
          // Registrar no Supabase
          const resultado = await registrarGastoNoSupabase(gastoIdentificado);

          if (resultado.success) {
            // Responder de volta no WhatsApp confirmando o registro!
            await enviarRespostaWhatsApp(
              numeroRemetente,
              `✅ *Gasto Registrado com Sucesso!*\n\n` +
              `📌 *Descrição:* ${gastoIdentificado.descricao}\n` +
              `💰 *Valor:* R$ ${gastoIdentificado.valor.toFixed(2)}\n` +
              `👤 *Pago por:* ${gastoIdentificado.pago_por === 'Ele' ? 'Ele 👨' : 'Ela 👩'}\n\n` +
              `_Já atualizado no painel do casal!_ 📊`
            );
          }
        } else {
          // Caso a mensagem não tenha um valor reconhecido
          await enviarRespostaWhatsApp(
            numeroRemetente,
            `💡 Não entendi o valor do gasto. Tente enviar assim:\n\n` +
            `• *Mercado 150*\n` +
            `• *Posto Shell 80 ela*\n` +
            `• *Restaurante 120 ele*`
          );
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    } else {
      return res.sendStatus(404);
    }
  } catch (error) {
    console.error('Erro no processamento do Webhook:', error.message);
    return res.status(500).send(error.message);
  }
});

/**
 * Função Auxiliar para responder no WhatsApp do casal
 */
async function enviarRespostaWhatsApp(to, mensagemTexto) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.log(`💡 [Simulação Resposta WhatsApp para ${to}]:\n${mensagemTexto}`);
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: mensagemTexto }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`📤 Resposta de confirmação enviada no WhatsApp para ${to}!`);
  } catch (error) {
    console.error('Erro ao enviar mensagem via WhatsApp API:', error.response?.data || error.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor do Robô de WhatsApp rodando com sucesso na porta ${PORT}!`);
});
