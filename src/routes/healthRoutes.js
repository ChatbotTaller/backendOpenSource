const express = require('express');
const db = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Confirma que el proceso del backend está activo
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Proceso activo
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @swagger
 * /ready:
 *   get:
 *     summary: Comprueba disponibilidad de MySQL
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Backend listo
 *       503:
 *         description: Dependencia no disponible
 */
router.get('/ready', (req, res) => {
  db.query('SELECT 1 AS ready', (error) => {
    if (error) {
      return res.status(503).json({
        status: 'not_ready',
        dependency: 'database'
      });
    }

    return res.json({
      status: 'ready',
      dependency: 'database'
    });
  });
});

module.exports = router;
