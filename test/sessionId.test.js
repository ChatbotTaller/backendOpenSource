describe('Pruebas unitarias - Sesión segura del chatbot', () => {

  function validarSessionId(sessionId) {
    return /^cs_[A-Za-z0-9_-]{40,}$/.test(String(sessionId || '').trim());
  }

  test('Debe aceptar una sesión opaca válida', () => {
    expect(validarSessionId(`cs_${'A'.repeat(43)}`)).toBe(true);
  });

  test('Debe rechazar una sesión basada en DNI', () => {
    expect(validarSessionId('dni_19331864')).toBe(false);
  });

  test('Debe rechazar una sesión opaca demasiado corta', () => {
    expect(validarSessionId('cs_abc123')).toBe(false);
  });

  test('Debe rechazar un session_id vacío', () => {
    expect(validarSessionId('')).toBe(false);
  });

});
