const express = require('express');
const router = express.Router();

const { verificarDni } = require('../controllers/dniController');

router.post('/dni/verificar', verificarDni);

module.exports = router;