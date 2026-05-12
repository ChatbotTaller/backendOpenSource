const express = require('express');
const router = express.Router();
// Importamos todo el objeto del controlador
const webhookController = require('../controllers/webhookController');

// Usamos el punto para acceder a la función
router.post('/webhook', webhookController.procesarMensaje);

module.exports = router;