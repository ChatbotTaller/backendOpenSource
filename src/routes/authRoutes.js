const express = require('express');
const router = express.Router();

const { loginAdmin } = require('../controllers/authController');

router.post('/auth/login', loginAdmin);

module.exports = router;