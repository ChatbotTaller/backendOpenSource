require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webhookRoutes = require('./routes/webhookRoutes');
const citasRoutes = require('./routes/citasRoutes');
const metricasRoutes = require('./routes/metricasRoutes');
const authRoutes = require('./routes/authRoutes');
const googleRoutes = require('./routes/googleRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/', webhookRoutes);
app.use('/', citasRoutes);
app.use('/', metricasRoutes);
app.use('/', authRoutes);
app.use('/', googleRoutes);
app.use('/', whatsappRoutes);

const PORT = process.env.PORT || 3000;

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

app.listen(PORT, () => {
  console.log(`🚀 Servidor Reyes Polo corriendo en el puerto ${PORT}`);
});

app.get('/politica-privacidad', (req, res) => {
  res.send(`
    <h1>Política de Privacidad - Taller Reyes Polo</h1>
    <p>Esta aplicación usa WhatsApp Cloud API para responder consultas de clientes.</p>
    <p>Los datos recibidos como nombre, teléfono, vehículo y mensajes solo se usan para gestionar consultas y citas del taller.</p>
    <p>No compartimos datos personales con terceros.</p>
    <p>Contacto: m4eg24@gmail.com</p>
  `);
});

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Taller Reyes Polo',
      version: '1.0.0',
      description: 'Documentación API del chatbot'
    },
    servers: [
      {
        url: 'http://localhost:3000'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));