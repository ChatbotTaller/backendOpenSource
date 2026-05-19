const axios = require('axios');

const { procesarMensaje } = require('./webhookController');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

function verifyWebhook(req, res) {

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    token === VERIFY_TOKEN
  ) {

    console.log('✅ Webhook verificado');

    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

async function receiveMessage(req, res) {

  try {

    const body = req.body;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body;

    console.log('Mensaje WhatsApp:', text);

    if (from === '16315551181') {
    console.log('✅ Webhook de prueba recibido correctamente desde Meta');
    return res.sendStatus(200);
    }

    const fakeReq = {
      body: {
        message: text,
        session_id: from
      }
    };

    let respuestaBot = '';

    const fakeRes = {
      json(data) {
        respuestaBot = data.reply;
      }
    };

    await procesarMensaje(fakeReq, fakeRes);

    await enviarMensajeWhatsApp(from, respuestaBot);

    return res.sendStatus(200);

  } catch (error) {
    console.error('Error WhatsApp:', error.response?.data || error.message);

    return res.sendStatus(200);
  }
}

async function enviarMensajeWhatsApp(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ Error enviando WhatsApp:', error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  receiveMessage
};