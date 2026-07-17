describe('Pruebas unitarias - Estado de cita', () => {

  function validarEstadoCita(estado) {
    const estadosPermitidos = [
      'pendiente',
      'confirmada',
      'completada',
      'cancelada'
    ];

    return estadosPermitidos.includes(String(estado || '').trim().toLowerCase());
  }

  test('Debe aceptar el estado pendiente', () => {
    expect(validarEstadoCita('pendiente')).toBe(true);
  });

  test('Debe aceptar el estado confirmada', () => {
    expect(validarEstadoCita('confirmada')).toBe(true);
  });

  test('Debe aceptar el estado completada', () => {
    expect(validarEstadoCita('completada')).toBe(true);
  });

  test('Debe aceptar el estado cancelada', () => {
    expect(validarEstadoCita('cancelada')).toBe(true);
  });

  test('Debe rechazar un estado no permitido', () => {
    expect(validarEstadoCita('en proceso')).toBe(false);
  });

  test('Debe rechazar un estado vacío', () => {
    expect(validarEstadoCita('')).toBe(false);
  });

});