const express = require('express');
const router = express.Router();

const { procesarMensaje } = require('../controllers/webhookController');
const logger = require('../utils/logger');

const callSessions = new Map();

function limpiarParaVoz(texto) {
  if (!texto) return '';

  let limpio = texto
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  if (limpio.length > 450) {
    limpio = limpio.substring(0, 450);
    const ultimoPunto = limpio.lastIndexOf('.');

    if (ultimoPunto > 180) {
      limpio = limpio.substring(0, ultimoPunto + 1);
    }

    limpio += ' Si deseas, puedo darte más detalles.';
  }

  return limpio;
}

router.post('/retell/chat', async (req, res) => {
  try {
    const body = req.body || {};
    logger.info('retell_request_received', {
      hasCallId: Boolean(body.call_id || body.call?.call_id || body.conversation_id)
    });

    const userMessage =
      body.message ||
      body.user_message ||
      body.text ||
      body.transcript ||
      body.args?.message ||
      'Hola';

    const callId =
      body.call_id ||
      body.call?.call_id ||
      body.conversation_id ||
      body.args?.call_id ||
      null;

    const sessionId =
      body.session_id ||
      body.args?.session_id ||
      (callId ? callSessions.get(callId) : null) ||
      'retell_demo';

      logger.info('retell_message_received', {
        characters: String(userMessage || '').length
      });

    let respuestaBot = null;

    const fakeReq = {
      body: {
        message: userMessage,
        session_id: sessionId,
        canal: 'voz-retell',
        stt_exitoso: 1,
        tts_exitoso: 1
      },
      ip: req.ip
    };

    const fakeRes = {
      json(data) {
        respuestaBot = data;
      }
    };

    await procesarMensaje(fakeReq, fakeRes);

    return res.json({
      response: limpiarParaVoz(respuestaBot?.reply) || 'Lo siento, no pude generar una respuesta.',
      reply: limpiarParaVoz(respuestaBot?.reply) || 'Lo siento, no pude generar una respuesta.',
      intent: respuestaBot?.intent || 'retell',
      response_time_ms: respuestaBot?.response_time_ms || null
    });

  } catch (error) {
    console.error('❌ Error en retellRoutes:', error);

    return res.json({
      response: 'Lo siento, ocurrió un problema conectando con el sistema del taller.',
      reply: 'Lo siento, ocurrió un problema conectando con el sistema del taller.'
    });
  }
});

router.post('/retell/create-web-call', async (req, res) => {
  try {
    const sessionId = req.body.session_id || 'retell_demo';
    console.time('CREATE_WEB_CALL');
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: process.env.RETELL_AGENT_ID,
        retell_llm_dynamic_variables: {
          session_id: sessionId
        }
      })
    });

    const data = await response.json();
    console.timeEnd('CREATE_WEB_CALL');

    if (!response.ok) {
      logger.warn('retell_create_call_failed', { status: response.status });
      return res.status(response.status).json(data);
    }

    if (data.call_id) {
      callSessions.set(data.call_id, sessionId);
    }

    return res.json(data);

  } catch (error) {
    console.error('❌ Error creando web call:', error);
    return res.status(500).json({
      error: 'Error creando llamada web'
    });
  }
});

module.exports = router;
