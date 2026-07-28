// ===================================================
// ROBÔ DE WHATSAPP PARA O GRUPO "Pagamentos mensais"
// COM FILTRO DE GRUPO E COMANDO ESPECIAL ($)
// ===================================================
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { processarTextoMensagem, registrarGastoNoSupabase } = require('./robo_mensagens');

// ===================================================
// CONFIGURAÇÃO: Nome exato do grupo do casal
// (exatamente como aparece no WhatsApp)
// ===================================================
const NOME_DO_GRUPO = 'Pagamentos mensais';

// PREFIXO OBRIGATÓRIO: Toda mensagem de gasto
// deve COMEÇAR com $ para o robô reagir
// Exemplos corretos:
//   $Mercado 150
//   $Posto Shell 85 ela
//   $Farmácia 45 ele
const PREFIXO_GASTO = '$';

console.log('🚀 Iniciando Robô Financeiro do Grupo:', NOME_DO_GRUPO);
console.log('💡 O robô só vai reagir a mensagens que começam com $');
console.log('   Exemplo: $Mercado 150 | $Farmácia 45 ela');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp_sessao' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Exibe o QR Code no terminal para conectar
client.on('qr', (qr) => {
  console.log('\n📲 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n✅ ROBÔ CONECTADO COM SUCESSO!');
  console.log('👂 Monitorando mensagens com $ no grupo:', NOME_DO_GRUPO);
});

client.on('message', async (msg) => {
  try {
    const texto = msg.body || '';

    // ====================================================
    // FILTRO 1: Ignorar mensagens privadas, só aceitar grupos
    // ====================================================
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    // ====================================================
    // FILTRO 2: Só aceitar o grupo correto pelo nome
    // ====================================================
    const nomeGrupo = chat.name || '';
    if (!nomeGrupo.toLowerCase().includes(NOME_DO_GRUPO.toLowerCase())) return;

    // ====================================================
    // FILTRO 3: Só aceitar mensagens que começam com $
    // Isso evita interpretar qualquer texto como gasto!
    // ====================================================
    if (!texto.startsWith(PREFIXO_GASTO)) return;

    // Remove o $ do início para processar o texto
    const textoSemPrefixo = texto.slice(1).trim();

    console.log(`\n💰 Lançamento recebido no grupo "${nomeGrupo}": "${textoSemPrefixo}"`);

    // Processar o gasto com o leitor inteligente
    const gasto = processarTextoMensagem(textoSemPrefixo);

    if (!gasto || gasto.valor <= 0) {
      msg.reply(
        `⚠️ Não entendi o valor. Use este formato:\n\n` +
        `*$Mercado 150*\n` +
        `*$Posto Shell 85 ela*\n` +
        `*$Aluguel 1500 ele*`
      );
      return;
    }

    // Registrar no Supabase
    const resultado = await registrarGastoNoSupabase(gasto);

    if (resultado.success) {
      msg.reply(
        `✅ *Gasto Registrado!*\n\n` +
        `📌 *Descrição:* ${gasto.descricao}\n` +
        `💰 *Valor:* R$ ${gasto.valor.toFixed(2)}\n` +
        `👤 *Pago por:* ${gasto.pago_por === 'Ele' ? 'Ele 👨' : 'Ela 👩'}\n\n` +
        `_Painel atualizado!_ 📊`
      );
    } else {
      msg.reply(`❌ Erro ao salvar no banco. Tente novamente!`);
    }

  } catch (err) {
    console.error('Erro ao processar mensagem:', err.message);
  }
});

client.initialize();
