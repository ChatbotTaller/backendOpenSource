const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/authMiddleware');

const {
  obtenerMetricas,
  evaluarMetrica,
  obtenerResumenMetricas,
  obtenerMetricasPorIntent,
  obtenerMetricasVoz
} = require('../controllers/metricasController');

/**
 * @swagger
 * /metricas:
 *   get:
 *     summary: Listar métricas conversacionales
 *     tags: [Métricas]
 *     security:
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Métricas registradas
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin privilegios administrativos
 * /metricas/{id}:
 *   put:
 *     summary: Evaluar una métrica conversacional
 *     tags: [Métricas]
 *     security:
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Evaluación actualizada
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Métrica no encontrada
 * /metricas/resumen:
 *   get:
 *     summary: Obtener resumen administrativo de métricas
 *     tags: [Métricas]
 *     security:
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Resumen calculado
 *       401:
 *         description: No autenticado
 * /metricas/por-intent:
 *   get:
 *     summary: Obtener métricas agrupadas por intención
 *     tags: [Métricas]
 *     security:
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Métricas por intención
 *       401:
 *         description: No autenticado
 * /metricas/voz:
 *   get:
 *     summary: Obtener resultados STT/TTS medidos del canal de voz
 *     tags: [Métricas]
 *     security:
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Resumen de voz y cantidad de muestras medidas
 *       401:
 *         description: No autenticado
 */
router.get(
  '/metricas',
  verificarToken,
  obtenerMetricas
);

router.put(
  '/metricas/:id',
  verificarToken,
  evaluarMetrica
);

router.get(
  '/metricas/resumen',
  verificarToken,
  obtenerResumenMetricas
);

router.get(
  '/metricas/por-intent',
  verificarToken,
  obtenerMetricasPorIntent
);

router.get(
  '/metricas/voz',
  verificarToken,
  obtenerMetricasVoz
);

module.exports = router;
