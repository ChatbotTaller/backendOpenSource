const express = require('express');
const router = express.Router();

const { loginAdmin } = require('../controllers/authController');

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login administrador
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [usuario, password]
 *             properties:
 *               usuario:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login correcto
 *       400:
 *         description: Credenciales con formato inválido
 *       401:
 *         description: Credenciales incorrectas
 *       500:
 *         description: Error interno o configuración ausente
 */

router.post('/auth/login', loginAdmin);

module.exports = router;
