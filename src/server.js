require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webhookRoutes = require('./routes/webhookRoutes');
const citasRoutes = require('./routes/citasRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/', webhookRoutes);
app.use('/', citasRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Reyes Polo corriendo en el puerto ${PORT}`);
});