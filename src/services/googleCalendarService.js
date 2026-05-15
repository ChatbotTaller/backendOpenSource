const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const credentialsPath = path.join(__dirname, '../../google-credentials.json');
const tokenPath = path.join(__dirname, '../../google-token.json');

const credentials = JSON.parse(fs.readFileSync(credentialsPath));

const { client_id, client_secret, redirect_uris } = credentials.web;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events']
  });
}

async function guardarToken(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
}

function cargarToken() {
  if (!fs.existsSync(tokenPath)) {
    return false;
  }

  const tokens = JSON.parse(fs.readFileSync(tokenPath));
  oauth2Client.setCredentials(tokens);
  return true;
}

async function crearEventoCita(cita) {
  const tokenExiste = cargarToken();

  if (!tokenExiste) {
    console.log('Google Calendar no autorizado todavía.');
    return null;
  }

  const calendar = google.calendar({
    version: 'v3',
    auth: oauth2Client
  });

  const fecha = cita.fecha;
  const hora = cita.hora;

  const inicio = `${fecha}T${hora}:00-05:00`;

  const [hh, mm] = hora.split(':');
  const fechaFin = new Date(`${fecha}T${hora}:00-05:00`);
  fechaFin.setHours(fechaFin.getHours() + 2);

  const fin = fechaFin.toISOString();

  const event = {
    summary: `Cita - ${cita.cliente_nombre}`,
    description: `
Cliente: ${cita.cliente_nombre}
Teléfono: ${cita.cliente_telefono}
Vehículo: ${cita.vehiculo_texto}
Servicio: ${cita.motivo}
    `,
    start: {
      dateTime: inicio,
      timeZone: 'America/Lima'
    },
    end: {
      dateTime: fin,
      timeZone: 'America/Lima'
    }
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });

  return response.data;
}

async function eliminarEventoCita(eventId) {
    const tokenExiste = cargarToken();

    if (!tokenExiste || !eventId) {
        return null;
    }

    const calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client
    });

    await calendar.events.delete({
        calendarId: 'primary',
        eventId
    });

    return true;
    }

module.exports = {
  getAuthUrl,
  guardarToken,
  crearEventoCita,
  eliminarEventoCita
};