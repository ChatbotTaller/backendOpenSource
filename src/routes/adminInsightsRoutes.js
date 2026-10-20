const express = require('express');
const { verificarToken } = require('../middlewares/authMiddleware');
const {
  obtenerClientesConCitas,
  obtenerDemandaServicios,
  obtenerCatalogoRepuestos
} = require('../controllers/adminInsightsController');

const router = express.Router();

router.get('/admin/insights/clientes-citas', verificarToken, obtenerClientesConCitas);
router.get('/admin/insights/demanda-servicios', verificarToken, obtenerDemandaServicios);
router.get('/admin/repuestos', verificarToken, obtenerCatalogoRepuestos);

module.exports = router;
