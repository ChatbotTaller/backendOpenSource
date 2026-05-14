const express = require('express');
const router = express.Router();

const {
  obtenerCitas,
  actualizarEstado
} = require('../controllers/citasController');

router.get('/citas', obtenerCitas);
router.put('/citas/:id', actualizarEstado);

module.exports = router;