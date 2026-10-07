const express = require('express');
const router = express.Router();
// Importamos todo el objeto del controlador
const webhookController = require('../controllers/webhookController');
const {
  verificarSesionCliente,
  verificarServicioVoz
} = require('../middlewares/clientAuthMiddleware');

/**
 * @swagger
 * /webhook:
 *   post:
 *     summary: Procesar mensajes del chatbot
 *     tags: [Chatbot]
 *     security:
 *       - ClientBearer: []
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
 *             required: [message]
 *     responses:
 *       200:
 *         description: Respuesta correcta
 *       400:
 *         description: Mensaje inválido
 *       401:
 *         description: Sesión de cliente ausente o inválida
 *       409:
 *         description: Conflicto de disponibilidad
 *       500:
 *         description: Error interno
 */

// Usamos el punto para acceder a la función
router.post('/webhook', verificarSesionCliente, webhookController.procesarMensaje);
router.post('/webhook/voice', verificarServicioVoz, webhookController.procesarMensaje);

/**
 * @swagger
 * /cliente/sesion:
 *   get:
 *     summary: Validar la sesión vigente del cliente
 *     tags: [Clientes]
 *     security:
 *       - ClientBearer: []
 *     responses:
 *       200:
 *         description: Sesión válida
 *       401:
 *         description: Sesión ausente o inválida
 */
router.get('/cliente/sesion', verificarSesionCliente, (req, res) => {
  res.json({
    valid: true,
    usuario: {
      id: req.cliente.id,
      nombre: req.cliente.nombre
    }
  });
});

module.exports = router;
