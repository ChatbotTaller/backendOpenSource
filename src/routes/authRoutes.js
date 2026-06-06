const express = require('express');
const router = express.Router();

const { loginAdmin } = require('../controllers/authController');

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login administrador
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Login correcto
 */

router.post('/auth/login', loginAdmin);

module.exports = router;