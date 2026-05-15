const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/authMiddleware');

const {
  obtenerCitas,
  actualizarEstado
} = require('../controllers/citasController');

router.get('/citas', verificarToken, obtenerCitas);

router.put(
  '/citas/:id',
  verificarToken,
  actualizarEstado
);

module.exports = router;