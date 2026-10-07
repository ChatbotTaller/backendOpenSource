const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { verificarToken } = require('../middlewares/authMiddleware');
const oauthStates = new Map();

const {
  getAuthUrl,
  guardarToken
} = require('../services/googleCalendarService');

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Iniciar autorización administrativa de Google Calendar
 *     tags: [Integraciones]
 *     security:
 *       - AdminBearer: []
 *     responses:
 *       302:
 *         description: Redirección segura a Google OAuth
 *       401:
 *         description: No autenticado
 */
router.get('/auth/google', verificarToken, (req, res) => {
  const state = crypto.randomBytes(24).toString('base64url');
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  const url = getAuthUrl(state);
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Código de autorización inválido');
    }

    const expiration = oauthStates.get(state);
    oauthStates.delete(state);

    if (!expiration || expiration < Date.now()) {
      return res.status(403).send('Estado de autorización inválido o expirado');
    }

    await guardarToken(code);

    res.send('Google Calendar conectado correctamente. Ya puedes cerrar esta pestaña.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error conectando Google Calendar');
  }
});

module.exports = router;
