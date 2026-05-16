const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/authMiddleware');

const {
  obtenerMetricas,
  evaluarMetrica,
  obtenerResumenMetricas,
  obtenerMetricasPorIntent
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

module.exports = router;