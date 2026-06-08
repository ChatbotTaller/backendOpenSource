const express = require('express');
const router = express.Router();

router.post('/retell/chat', async (req, res) => {
  console.log('📞 Retell llegó al backend:', req.body);

  return res.json({
    response: 'Claro que sí, soy Mara de Taller Reyes Polo. Ya estoy conectada con el backend.'
  });
});

module.exports = router;