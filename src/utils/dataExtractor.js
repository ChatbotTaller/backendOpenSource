function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function limpiarTexto(texto) {
  return String(texto || '')
    .replace(/[.,!?¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function convertirNumerosHablados(texto) {
  const mapa = {
    cero: '0',
    uno: '1',
    una: '1',
    dos: '2',
    tres: '3',
    cuatro: '4',
    cinco: '5',
    seis: '6',
    siete: '7',
    ocho: '8',
    nueve: '9'
  };

  const palabras = normalizar(texto).split(/\s+/);
  const digitos = palabras
    .map(p => mapa[p])
    .filter(Boolean)
    .join('');

  return digitos.length >= 8 ? digitos : null;
}

function extraerTelefono(texto) {
  const original = String(texto || '');

  const directo = original.match(/\b9\d{8}\b/);
  if (directo) return directo[0];

  const soloDigitos = original.replace(/\D/g, '');
  if (/9\d{8}/.test(soloDigitos)) {
    return soloDigitos.match(/9\d{8}/)[0];
  }

  const hablado = convertirNumerosHablados(original);
  if (hablado && /^9\d{8}$/.test(hablado)) {
    return hablado;
  }

  return null;
}

function telefonoValido(telefono) {
  return /^9\d{8}$/.test(String(telefono || ''));
}

function extraerDni(texto) {
  const match = String(texto || '').match(/\b\d{8}\b/);
  return match ? match[0] : null;
}

function extraerNombre(texto) {
  const msg = limpiarTexto(texto);

  const patrones = [
    /mi nombre es\s+(.+)/i,
    /me llamo\s+(.+)/i,
    /soy\s+(.+)/i,
    /nombre\s+(.+)/i
  ];

  for (const patron of patrones) {
    const match = msg.match(patron);
    if (match && match[1]) {
      return limpiarNombre(match[1]);
    }
  }

  return limpiarNombre(msg);
}

function limpiarNombre(texto) {
  let nombre = limpiarTexto(texto)
    .replace(/\b(mi|nombre|es|me|llamo|soy)\b/gi, '')
    .trim();

  nombre = nombre
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');

  if (nombre.length < 2) return null;

  return nombre
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

  function extraerVehiculo(texto) {
    const msg = limpiarTexto(texto);
    const textoNormalizado = normalizar(msg);

    const palabrasServicio = [
      'revision', 'mantenimiento', 'suspension',
      'motor', 'freno', 'aceite', 'falla',
      'problema', 'reparar', 'arreglar',
      'cita', 'agendar', 'reservar', 'servicio',
      'agendamiento', 'agenda', 'agendada', 'agendado',
      'turno', 'reserva'
    ];

    const marcasVehiculo = [
      'toyota', 'nissan', 'hyundai', 'honda', 'kia',
      'mazda', 'ford', 'chevrolet', 'mitsubishi',
      'suzuki', 'volkswagen', 'renault', 'chery',
      'hilux', 'yaris', 'corolla', 'sentra', 'versa',
      'frontier', 'navara', 'central'
    ];

    const tieneMarcaVehiculo = marcasVehiculo.some(marca =>
      textoNormalizado.includes(marca)
    );

    const pareceServicio = palabrasServicio.some(p =>
      textoNormalizado.includes(p)
    );

    if (pareceServicio && !tieneMarcaVehiculo) {
      return null;
    }

    const patrones = [
      /mi vehiculo es\s+(.+)/i,
      /mi vehículo es\s+(.+)/i,
      /mi carro es\s+(.+)/i,
      /tengo un\s+(.+)/i,
      /tengo una\s+(.+)/i,
      /vehiculo\s+(.+)/i,
      /vehículo\s+(.+)/i,
      /carro\s+(.+)/i
    ];

    for (const patron of patrones) {
      const match = msg.match(patron);
      if (match && match[1]) {
        return limpiarVehiculo(match[1]);
      }
    }

    if (tieneMarcaVehiculo) {
      return limpiarVehiculo(msg);
    }

    return null;
  }

function limpiarVehiculo(texto) {
  let vehiculo = limpiarTexto(texto)
    .replace(/\b(mi|vehiculo|vehículo|carro|es|tengo|un|una)\b/gi, '')
    .trim();

  vehiculo = vehiculo
    .split(/\s+/)
    .slice(0, 5)
    .join(' ');

  if (vehiculo.length < 2) return null;

  return vehiculo
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

function extraerMotivo(texto) {
  const msg = limpiarTexto(texto);

  const patrones = [
    /quiero\s+(.+)/i,
    /necesito\s+(.+)/i,
    /problema con\s+(.+)/i,
    /falla en\s+(.+)/i,
    /servicio de\s+(.+)/i,
    /cambio de\s+(.+)/i,
    /reparar\s+(.+)/i,
    /revisión de\s+(.+)/i,
    /revision de\s+(.+)/i
  ];

  for (const patron of patrones) {
    const match = msg.match(patron);
    if (match && match[1]) {
      return limpiarMotivo(match[1]);
    }
  }

  return limpiarMotivo(msg);
}

function limpiarMotivo(texto) {
  let motivo = limpiarTexto(texto).trim();

  motivo = motivo
    .replace(/\b(quiero|necesito|hacer|realizar|un|una|el|la)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (motivo.length < 3) return null;

  return motivo.charAt(0).toUpperCase() + motivo.slice(1);
}

module.exports = {
  normalizar,
  extraerTelefono,
  telefonoValido,
  extraerDni,
  extraerNombre,
  extraerVehiculo,
  extraerMotivo
};