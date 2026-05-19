const express = require('express');
const router = express.Router();

const {
  verifyWebhook,
  receiveMessage
} = require('../controllers/whatsappController');

router.get('/webhook-whatsapp', verifyWebhook);
router.post('/webhook-whatsapp', receiveMessage);

module.exports = router;