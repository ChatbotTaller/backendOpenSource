const express = require('express');
const router = express.Router();
// Importamos todo el objeto del controlador
const webhookController = require('../controllers/webhookController');

/**
 * @swagger
 * /webhook:
 *   post:
 *     summary: Procesar mensajes del chatbot
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Hola"
 *               session_id:
 *                 type: string
 *                 example: "usuario123"
 *     responses:
 *       200:
 *         description: Respuesta correcta
 */

// Usamos el punto para acceder a la función
router.post('/webhook', webhookController.procesarMensaje);

module.exports = router;