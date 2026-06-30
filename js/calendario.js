const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const FESTIVOS_2026 = new Set([
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-29', '2026-07-20',
  '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
  '2026-12-08', '2026-12-25',
]);

export function getTodayString() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function formatearFecha(isoString) {
  const [anio, mes, dia] = isoString.split('-').map(Number);
  const nombreMes = MESES[mes - 1];
  return `${dia} de ${nombreMes} de ${anio}`;
}

export function diasHastaVencimiento(fechaISO) {
  const [a1, m1, d1] = getTodayString().split('-').map(Number);
  const [a2, m2, d2] = fechaISO.split('-').map(Number);
  const hoy = new Date(a1, m1 - 1, d1);
  const objetivo = new Date(a2, m2 - 1, d2);
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((objetivo - hoy) / msPorDia);
}
