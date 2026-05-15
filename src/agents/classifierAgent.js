function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyIntent(message) {

  const msg = normalize(message);

  // =========================
  // CITAS
  // =========================
  if (
    msg.includes("cita") ||
    msg.includes("reserva") ||
    msg.includes("reservar") ||
    msg.includes("agendar") ||
    msg.includes("separar turno")
  ) {
    return "appointment";
  }

  // =========================
  // HORARIOS
  // =========================
  if (
    msg.includes("horario") ||
    msg.includes("hora") ||
    msg.includes("atienden") ||
    msg.includes("trabajan") ||
    msg.includes("abren") ||
    msg.includes("cierran") ||
    msg.includes("dias atienden") ||
    msg.includes("dias trabajan") ||
    msg.includes("que dias atienden") ||
    msg.includes("que dias trabajan") ||
    msg.includes("atienden los") ||
    msg.includes("abren los") ||
    msg.includes("horario de atencion") ||
    msg.includes("horario de atención")
  ) {
    return "schedule";
  }

  // =========================
  // SERVICIOS
  // =========================
  if (
    msg.includes("servicio") ||
    msg.includes("servicios") ||
    msg.includes("mantenimiento") ||
    msg.includes("reparacion") ||
    msg.includes("garantia") ||
    msg.includes("freno") ||
    msg.includes("pastilla") ||
    msg.includes("engrase") ||
    msg.includes("suspension") ||
    msg.includes("inyector") ||
    msg.includes("escaneo") ||
    msg.includes("scanner") ||
    msg.includes("embrague") ||
    msg.includes("transmision") ||
    msg.includes("motor") ||
    msg.includes("alineamiento") ||
    msg.includes("balanceo")
  ) {
    return "services";
  }

  // =========================
  // INVENTARIO
  // =========================
  if (
    msg.includes("filtro") ||
    msg.includes("aceite") ||
    msg.includes("repuesto") ||
    msg.includes("producto") ||
    msg.includes("stock") ||
    msg.includes("disponible") ||
    msg.includes("codigo") ||
    msg.includes("bateria") ||
    msg.includes("llanta")
  ) {
    return "inventory";
  }

  // =========================
  // FOLLOW UP
  // =========================
  if (
    msg.includes("eso") ||
    msg.includes("lo que te pedi") ||
    msg.includes("dame el precio") ||
    msg.includes("cuanto cuesta") ||
    msg.includes("cuanto vale") ||
    msg.includes("y eso") ||
    msg.includes("y cuanto") ||
    msg.includes("mas informacion")
  ) {
    return "follow_up";
  }

  // =========================
  // MENSAJES CORTOS
  // =========================
  if (msg.length < 20) {
    return "follow_up";
  }

  // =========================
  // GENERAL
  // =========================
  return "info";
}

module.exports = { classifyIntent };