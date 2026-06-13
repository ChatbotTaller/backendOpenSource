const express = require('express');
const { AccessToken, RoomConfiguration, RoomAgentDispatch } = require('livekit-server-sdk');

const router = express.Router();

router.post('/token', async (req, res) => {
  try {
    const roomName = req.body.roomName || `mara-room-${Date.now()}`;
    const participantName = req.body.participantName || `cliente-${Date.now()}`;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
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
      url: process.env.LIVEKIT_URL,
      roomName,
      participantName
    });

  } catch (error) {
    console.error('Error generando token LiveKit:', error);
    return res.status(500).json({ error: 'Error generando token LiveKit' });
  }
});

module.exports = router;