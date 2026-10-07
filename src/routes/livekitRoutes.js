const express = require('express');
const crypto = require('crypto');
const { AccessToken, RoomConfiguration, RoomAgentDispatch } = require('livekit-server-sdk');
const { verificarSesionCliente } = require('../middlewares/clientAuthMiddleware');
const { getRequiredEnv } = require('../config/environment');

const router = express.Router();

/**
 * @swagger
 * /livekit/token:
 *   post:
 *     summary: Crear credenciales temporales para una llamada de voz
 *     tags: [Voz]
 *     security:
 *       - ClientBearer: []
 *     responses:
 *       200:
 *         description: Token y sala generados por el servidor
 *       401:
 *         description: Sesión de cliente ausente o inválida
 *       500:
 *         description: Integración de voz no configurada
 */
router.post('/token', verificarSesionCliente, async (req, res) => {
  try {
    const callId = crypto.randomUUID();
    const roomName = `mara-user-${req.cliente.id}--${callId}`;
    const participantName = `cliente-${crypto.randomUUID()}`;

    const at = new AccessToken(
      getRequiredEnv('LIVEKIT_API_KEY'),
      getRequiredEnv('LIVEKIT_API_SECRET'),
      {
        identity: participantName,
        name: participantName
      }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    at.roomConfig = new RoomConfiguration({
    agents: [
        new RoomAgentDispatch({
        agentName: 'mara'
        })
    ]
    });

    return res.json({
      token: await at.toJwt(),
      url: getRequiredEnv('LIVEKIT_URL'),
      roomName,
      participantName
    });

  } catch (error) {
    console.error('Error generando token LiveKit:', error);
    return res.status(500).json({ error: 'Error generando token LiveKit' });
  }
});

module.exports = router;
