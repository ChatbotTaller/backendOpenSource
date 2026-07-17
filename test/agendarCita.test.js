describe('Pruebas unitarias - Datos mínimos para agendar una cita', () => {

  function validarDatosCita(cita) {
    return (
      !!cita.nombre &&
      !!cita.telefono &&
      !!cita.vehiculo &&
      !!cita.fecha &&
      !!cita.hora
    );
  }

  test('Debe aceptar una cita con todos los datos', () => {
    expect(
      validarDatosCita({
        nombre: 'Juan Pérez',
        telefono: '987654321',
        vehiculo: 'Toyota Yaris',
        fecha: '2026-07-10',
        hora: '10:00'
      })
    ).toBe(true);
  });

  test('Debe rechazar una cita sin nombre', () => {
    expect(
      validarDatosCita({
        telefono: '987654321',
        vehiculo: 'Toyota',
        fecha: '2026-07-10',
        hora: '10:00'
      })
    ).toBe(false);
  });

  test('Debe rechazar una cita sin teléfono', () => {
    expect(
      validarDatosCita({
        nombre: 'Juan',
        vehiculo: 'Toyota',
        fecha: '2026-07-10',
        hora: '10:00'
      })
    ).toBe(false);
  });

  test('Debe rechazar una cita sin fecha', () => {
    expect(
      validarDatosCita({
        nombre: 'Juan',
        telefono: '987654321',
        vehiculo: 'Toyota',
        hora: '10:00'
      })
    ).toBe(false);
  });

});