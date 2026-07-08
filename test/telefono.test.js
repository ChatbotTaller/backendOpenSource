describe('Pruebas unitarias - Validación de teléfono del cliente', () => {

  function validarTelefono(telefono) {
    return /^9\d{8}$/.test(String(telefono || '').trim());
  }

  test('Debe aceptar un teléfono válido de 9 dígitos que inicia con 9', () => {
    expect(validarTelefono('987654321')).toBe(true);
  });

  test('Debe rechazar un teléfono con menos de 9 dígitos', () => {
    expect(validarTelefono('98765432')).toBe(false);
  });

  test('Debe rechazar un teléfono que no inicia con 9', () => {
    expect(validarTelefono('812345678')).toBe(false);
  });

  test('Debe rechazar un teléfono con letras', () => {
    expect(validarTelefono('98765ABCD')).toBe(false);
  });

  test('Debe rechazar un teléfono vacío', () => {
    expect(validarTelefono('')).toBe(false);
  });

});