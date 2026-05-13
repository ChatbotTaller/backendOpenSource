function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyIntent(message) {
  const msg = normalize(message);

  if (
    msg.includes("cita") ||
    msg.includes("reserva") ||
    msg.includes("reservar") ||
    msg.includes("agendar") ||
    msg.includes("separar turno")
  ) {
    return "appointment";
  }

  if (
    msg.includes("horario") ||
    msg.includes("hora") ||
    msg.includes("atienden") ||
    msg.includes("trabajan") ||
    msg.includes("abren") ||
    msg.includes("cierran")
  ) {
    return "schedule";
  }

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
    msg.includes("transmision")
  ) {
    return "services";
  }

  if (
    msg.includes("filtro") ||
    msg.includes("aceite") ||
    msg.includes("repuesto") ||
    msg.includes("producto") ||
    msg.includes("stock") ||
    msg.includes("disponible") ||
    msg.includes("codigo")
  ) {
    return "inventory";
  }

  if (
    msg.includes("eso") ||
    msg.includes("lo que te pedi") ||
    msg.includes("dame el precio") ||
    msg.includes("cuanto cuesta") ||
    msg.includes("cuanto vale")
  ) {
    return "follow_up";
  }

  return "info";
}

module.exports = { classifyIntent };