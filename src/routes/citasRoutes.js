const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/authMiddleware');

const {
  obtenerCitas,
  actualizarEstado
} = require('../controllers/citasController');

/**
 * @swagger
 * /citas:
 *   get:
 *     summary: Obtener citas
 *     tags: [Citas]
 *     security:
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Lista de citas
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin privilegios administrativos
 */

router.get('/citas', verificarToken, obtenerCitas);

/**
 * @swagger
 * /citas/{id}:
 *   put:
 *     summary: Actualizar el estado de una cita
 *     tags: [Citas]
 *     security:
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [pendiente, confirmada, completada, cancelada]
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin privilegios administrativos
 *       404:
 *         description: Cita no encontrada
 */
router.put(
  '/citas/:id',
  verificarToken,
  actualizarEstado
);

module.exports = router;
