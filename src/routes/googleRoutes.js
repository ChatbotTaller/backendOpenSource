const express = require('express');
const router = express.Router();

const {
  getAuthUrl,
  guardarToken
} = require('../services/googleCalendarService');

router.get('/auth/google', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    await guardarToken(code);

    res.send('Google Calendar conectado correctamente. Ya puedes cerrar esta pestaña.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error conectando Google Calendar');
  }
});

module.exports = router;