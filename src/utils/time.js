const moment = require('moment-timezone');

function obtenerFechaPeru() {
  return moment().tz('America/Lima');
}

function obtenerHoraPeru() {
  return obtenerFechaPeru().format('HH:mm');
}

function obtenerFechaActualPeru() {
  return obtenerFechaPeru().format('YYYY-MM-DD');
}

function obtenerDiaActualPeru() {
  return obtenerFechaPeru().format('dddd');
}

module.exports = {
  obtenerFechaPeru,
  obtenerHoraPeru,
  obtenerFechaActualPeru,
  obtenerDiaActualPeru
};