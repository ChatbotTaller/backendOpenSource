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