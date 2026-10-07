const express = require('express');
const router = express.Router();

const { verificarDni } = require('../controllers/dniController');

/**
 * @swagger
 * /dni/verificar:
 *   post:
 *     summary: Validar el DNI e iniciar o renovar una sesión de cliente
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dni]
 *             properties:
 *               dni:
 *                 type: string
 *                 pattern: '^\\d{8}$'
 *     responses:
 *       200:
 *         description: Identidad validada y sesión opaca emitida
 *       400:
 *         description: DNI con formato inválido
 *       404:
 *         description: DNI no encontrado
 *       502:
 *         description: Servicio externo de identidad no disponible
 */
router.post('/dni/verificar', verificarDni);

module.exports = router;
