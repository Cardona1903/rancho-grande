// Formatea número con puntos: 450000 → "450.000"
export function formatearPrecio(valor) {
  const num = parseInt(String(valor).replace(/\./g, ''), 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO'); // usa punto como separador de miles
}

// Limpia el formato para obtener el número: "450.000" → 450000
export function limpiarPrecio(valor) {
  return parseInt(String(valor).replace(/\./g, ''), 10) || 0;
}

// Formatea en vivo mientras el usuario escribe en un input de precio/monto
export function aplicarFormatoMoneda(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    const soloNumeros = inputEl.value.replace(/\./g, '').replace(/\D/g, '');
    inputEl.value = soloNumeros ? parseInt(soloNumeros, 10).toLocaleString('es-CO') : '';
  });
}
