describe('Pruebas unitarias - Session ID del chatbot', () => {

  function validarSessionId(sessionId) {
    return /^dni_\d{8}$/.test(String(sessionId || '').trim());
  }

  test('Debe aceptar un session_id válido con DNI', () => {
    expect(validarSessionId('dni_19331864')).toBe(true);
  });

  test('Debe rechazar un session_id sin prefijo dni_', () => {
    expect(validarSessionId('19331864')).toBe(false);
  });

  test('Debe rechazar un session_id con DNI incompleto', () => {
    expect(validarSessionId('dni_1234567')).toBe(false);
  });

  test('Debe rechazar un session_id vacío', () => {
    expect(validarSessionId('')).toBe(false);
  });

});