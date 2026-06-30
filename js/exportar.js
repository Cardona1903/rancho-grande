import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
import supabase from './supabase.js';

function formatearFecha(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr + (isoStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function obtenerDatos() {
  const [arrendatariosRes, habitacionesRes, finanzasRes, pagosRes] = await Promise.all([
    supabase.from('arrendatarios')
      .select('*, habitaciones(numero, tipo)')
      .eq('activo', true)
      .order('created_at'),
    supabase.from('habitaciones')
      .select('*')
      .order('numero'),
    supabase.from('finanzas')
      .select('*, habitaciones(numero, tipo)')
      .order('fecha', { ascending: false }),
    supabase.from('pagos')
      .select('*, arrendatarios(nombre, habitaciones(numero, tipo))')
      .order('fecha_pago', { ascending: false }),
  ]);
  return {
    arrendatarios: arrendatariosRes.data || [],
    habitaciones:  habitacionesRes.data  || [],
    finanzas:      finanzasRes.data      || [],
    pagos:         pagosRes.data         || [],
  };
}

function habLabel(hab) {
  if (!hab) return '';
  return `${hab.tipo === 'apartamento' ? 'Apto' : 'Hab'} ${hab.numero}`;
}

function construirHojaArrendatarios(datos) {
  const filas = [[
    'Nombre', 'Cédula', 'Teléfono', 'Habitación', 'Tipo', 'Arriendo ($)',
    'Estado Pago', 'Saldo Pendiente ($)', 'Abono Recibido ($)',
    'Fecha Ingreso', 'Fecha Vencimiento', 'Método Pago', 'Observaciones',
  ]];
  const ESTADO = { al_dia: 'Al día', pendiente: 'Pendiente', atrasado: 'Atrasado' };
  datos.forEach(a => {
    const hab = a.habitaciones;
    filas.push([
      a.nombre              || '',
      a.cedula              || '',
      a.telefono            || '',
      habLabel(hab)         || 'Sin asignar',
      hab?.tipo === 'apartamento' ? 'Apartamento' : 'Habitación',
      a.valor_arriendo      || 0,
      ESTADO[a.estado_pago] || a.estado_pago || '',
      a.saldo_pendiente     || 0,
      a.abono_recibido      || 0,
      formatearFecha(a.fecha_ingreso),
      formatearFecha(a.fecha_vencimiento),
      a.metodo_pago         || 'Sin definir',
      a.observaciones       || '',
    ]);
  });
  return filas;
}

function construirHojaHabitaciones(datos) {
  const filas = [['Número', 'Tipo', 'Tiene Baño', 'Precio ($)', 'Estado', 'Descripción']];
  datos.forEach(h => {
    filas.push([
      h.numero || '',
      h.tipo === 'apartamento' ? 'Apartamento' : 'Habitación',
      h.tiene_bano ? 'Sí' : 'No',
      h.precio || 0,
      h.estado === 'ocupada' ? 'Ocupada' : 'Disponible',
      h.descripcion || '',
    ]);
  });
  return filas;
}

function construirHojaFinanzas(datos) {
  const filas = [[
    'Fecha', 'Tipo', 'Concepto', 'Categoría', 'Valor ($)',
    'Habitación', 'Método Pago', 'Registrado Por', 'Observaciones',
  ]];
  datos.forEach(f => {
    filas.push([
      formatearFecha(f.fecha),
      f.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      f.concepto       || '',
      f.categoria      || '',
      f.valor          || 0,
      habLabel(f.habitaciones) || 'General',
      f.metodo_pago    || 'N/A',
      f.registrado_por || '',
      f.observaciones  || '',
    ]);
  });

  const totalIngresos = datos.filter(f => f.tipo === 'ingreso').reduce((s, f) => s + (f.valor || 0), 0);
  const totalGastos   = datos.filter(f => f.tipo === 'gasto').reduce((s, f) => s + (f.valor || 0), 0);
  filas.push([]);
  filas.push(['TOTAL INGRESOS', '', '', '', totalIngresos, '', '', '', '']);
  filas.push(['TOTAL GASTOS',   '', '', '', totalGastos,   '', '', '', '']);
  filas.push(['BALANCE',        '', '', '', totalIngresos - totalGastos, '', '', '', '']);
  return filas;
}

function construirHojaPagos(datos) {
  const filas = [[
    'Fecha Pago', 'Arrendatario', 'Habitación', 'Tipo Pago', 'Valor ($)',
    'Mes Correspondiente', 'Método Pago', 'Registrado Por', 'Observaciones',
  ]];
  datos.forEach(p => {
    const arr = p.arrendatarios;
    filas.push([
      formatearFecha(p.fecha_pago),
      arr?.nombre || '',
      habLabel(arr?.habitaciones),
      p.tipo_pago === 'pago_completo' ? 'Pago completo' : 'Abono',
      p.valor               || 0,
      p.mes_correspondiente || '',
      p.metodo_pago         || '',
      p.registrado_por      || '',
      p.observaciones       || '',
    ]);
  });
  return filas;
}

function ajustarAnchos(ws, filas) {
  if (!filas.length) return;
  const anchos = filas[0].map((_, colIdx) => {
    let max = 10;
    filas.forEach(fila => {
      const val = fila[colIdx];
      const len = val != null ? String(val).length : 0;
      if (len > max) max = len;
    });
    return { wch: Math.min(max + 2, 45) };
  });
  ws['!cols'] = anchos;
}

export async function exportarExcel(mostrarToast) {
  try {
    mostrarToast('Generando Excel... ⏳');
    const datos = await obtenerDatos();

    const wb = XLSX.utils.book_new();

    const f1 = construirHojaArrendatarios(datos.arrendatarios);
    const ws1 = XLSX.utils.aoa_to_sheet(f1);
    ajustarAnchos(ws1, f1);
    XLSX.utils.book_append_sheet(wb, ws1, 'Arrendatarios');

    const f2 = construirHojaHabitaciones(datos.habitaciones);
    const ws2 = XLSX.utils.aoa_to_sheet(f2);
    ajustarAnchos(ws2, f2);
    XLSX.utils.book_append_sheet(wb, ws2, 'Habitaciones');

    const f3 = construirHojaFinanzas(datos.finanzas);
    const ws3 = XLSX.utils.aoa_to_sheet(f3);
    ajustarAnchos(ws3, f3);
    XLSX.utils.book_append_sheet(wb, ws3, 'Ingresos y Gastos');

    const f4 = construirHojaPagos(datos.pagos);
    const ws4 = XLSX.utils.aoa_to_sheet(f4);
    ajustarAnchos(ws4, f4);
    XLSX.utils.book_append_sheet(wb, ws4, 'Historial de Pagos');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `RanchoGrande_Informe_${fecha}.xlsx`);
    mostrarToast('✅ Excel descargado correctamente');
  } catch (err) {
    console.error('Error al exportar:', err);
    mostrarToast('❌ Error al generar el Excel');
  }
}
