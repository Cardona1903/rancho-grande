import supabase from './supabase.js';
import { mostrarToast } from './toast.js';

// ── Estado del modal ───────────────────────────────────────────────────────────

let mesExportar = new Date().toISOString().slice(0, 7);

function actualizarLabelExportar() {
  const [y, m] = mesExportar.split('-');
  const label = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const el = document.getElementById('exportar-mes-label');
  if (el) el.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

export function abrirModalExportar() {
  mesExportar = new Date().toISOString().slice(0, 7);
  actualizarLabelExportar();
  document.getElementById('modal-exportar-mes').style.display = 'flex';
}

export function initExportar() {
  document.getElementById('btn-export-mes-anterior')?.addEventListener('click', () => {
    const [y, m] = mesExportar.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    mesExportar = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    actualizarLabelExportar();
  });

  document.getElementById('btn-export-mes-siguiente')?.addEventListener('click', () => {
    const [y, m] = mesExportar.split('-').map(Number);
    const d = new Date(y, m, 1);
    mesExportar = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    actualizarLabelExportar();
  });

  document.getElementById('btn-cancelar-exportar')?.addEventListener('click', () => {
    document.getElementById('modal-exportar-mes').style.display = 'none';
  });

  document.getElementById('btn-confirmar-exportar')?.addEventListener('click', () => {
    document.getElementById('modal-exportar-mes').style.display = 'none';
    exportarExcel(mesExportar);
  });
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatearFecha(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr + (isoStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function habLabel(hab) {
  if (!hab) return '';
  return `${hab.tipo === 'apartamento' ? 'Apto' : 'Hab'} ${hab.numero}`;
}

async function obtenerDatos(mesFiltro) {
  const [anio, mes] = mesFiltro.split('-').map(Number);
  const fechaInicio  = `${mesFiltro}-01`;
  const mesSiguiente = mes === 12
    ? `${anio + 1}-01-01`
    : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDiaMes = new Date(anio, mes, 0).toISOString().split('T')[0];

  const [arrRes, habRes, finRes, pagRes] = await Promise.all([
    supabase.from('arrendatarios')
      .select('*, habitaciones(numero, tipo)')
      .lte('fecha_ingreso', ultimoDiaMes)
      .gte('fecha_vencimiento', fechaInicio)
      .order('created_at'),
    supabase.from('habitaciones')
      .select('*')
      .order('numero'),
    supabase.from('finanzas')
      .select('*, habitaciones(numero, tipo)')
      .gte('fecha', fechaInicio)
      .lt('fecha', mesSiguiente)
      .order('fecha', { ascending: false }),
    supabase.from('pagos')
      .select('*, arrendatarios(nombre, habitaciones(numero, tipo))')
      .gte('fecha_pago', fechaInicio)
      .lt('fecha_pago', mesSiguiente)
      .order('fecha_pago', { ascending: false }),
  ]);

  const arrendatarios = arrRes.data || [];
  const habsOcupadasEnMes = new Set(
    arrendatarios.map(a => a.habitacion_id).filter(Boolean)
  );
  const habitaciones = (habRes.data || []).map(h => ({
    ...h,
    estado: habsOcupadasEnMes.has(h.id) ? 'ocupada' : 'disponible',
  }));

  return {
    arrendatarios,
    habitaciones,
    finanzas: finRes.data || [],
    pagos:    pagRes.data || [],
    mes:      mesFiltro,
  };
}

// ── Paleta de colores ─────────────────────────────────────────────────────────

const COLOR = {
  VERDE_OSCURO: '1B5E20',
  VERDE_MEDIO:  '2E7D32',
  VERDE_CLARO:  'E8F5E9',
  AMBAR:        'F57F17',
  AMBAR_CLARO:  'FFF8E1',
  ROJO:         'C62828',
  AZUL_CLARO:   'E3F2FD',
  ROJO_CLARO:   'FFEBEE',
  GRIS:         'F5F5F5',
  BLANCO:       'FFFFFF',
  NEGRO:        '000000',
};

// ── Helpers de celda ──────────────────────────────────────────────────────────

function celda(valor, estilos = {}) {
  return {
    v: valor,
    t: typeof valor === 'number' ? 'n' : 's',
    s: {
      font: {
        bold:  estilos.bold  ?? false,
        color: { rgb: estilos.colorTexto ?? COLOR.NEGRO },
        sz:    estilos.sz    ?? 11,
        name:  'Calibri',
      },
      fill: estilos.fondo
        ? { fgColor: { rgb: estilos.fondo }, patternType: 'solid' }
        : { patternType: 'none' },
      alignment: {
        horizontal: estilos.align ?? 'left',
        vertical:   'center',
        wrapText:   estilos.wrap  ?? false,
      },
      border: {
        top:    { style: 'thin', color: { rgb: 'BDBDBD' } },
        bottom: { style: 'thin', color: { rgb: 'BDBDBD' } },
        left:   { style: 'thin', color: { rgb: 'BDBDBD' } },
        right:  { style: 'thin', color: { rgb: 'BDBDBD' } },
      },
    },
  };
}

const celdaEncH   = v => celda(v, { bold: true, fondo: COLOR.VERDE_OSCURO, colorTexto: COLOR.BLANCO, sz: 14, align: 'center' });
const celdaSubH   = v => celda(v, { bold: true, fondo: COLOR.VERDE_MEDIO,  colorTexto: COLOR.BLANCO, sz: 11 });
const celdaTitulo = v => celda(v, { bold: true, fondo: COLOR.VERDE_CLARO,  sz: 11 });
const celdaNormal = v => celda(v);
const celdaNum    = v => celda(typeof v === 'number' ? v : Number(v) || 0, { align: 'right' });
const celdaNumR   = v => celda(typeof v === 'number' ? v : Number(v) || 0, { align: 'right', colorTexto: COLOR.ROJO,        bold: true });
const celdaNumG   = v => celda(typeof v === 'number' ? v : Number(v) || 0, { align: 'right', colorTexto: COLOR.VERDE_MEDIO, bold: true });
const celdaGris   = v => celda(v, { fondo: COLOR.GRIS });

function buildWS(filas, anchos) {
  const ws = {};
  let maxC = 0;
  filas.forEach((fila, r) => {
    fila.forEach((cel, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = cel;
      if (c > maxC) maxC = c;
    });
  });
  ws['!ref']  = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: filas.length - 1, c: maxC });
  ws['!cols'] = anchos.map(w => ({ wch: w }));
  return ws;
}

function labelMes(mesFiltro) {
  const [y, m] = mesFiltro.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Hoja 1: Arrendatarios ─────────────────────────────────────────────────────

function construirHojaArrendatarios(datos, mesFiltro) {
  const NCOLS = 13;
  const fechaGen = formatearFecha(new Date().toISOString().split('T')[0]);
  const ESTADO_TEXTO = { al_dia: 'Al día', pendiente: 'Pendiente', atrasado: 'Atrasado' };
  const ESTADO_FONDO = { al_dia: COLOR.VERDE_CLARO, pendiente: COLOR.AMBAR_CLARO, atrasado: COLOR.ROJO_CLARO };

  const vaciosEnc  = Array(NCOLS - 1).fill(null).map(() => celdaEncH(''));
  const vaciosTit  = Array(NCOLS - 1).fill(null).map(() => celdaTitulo(''));

  const filas = [
    [celdaEncH(`RANCHO GRANDE — Arrendatarios Activos · ${labelMes(mesFiltro)}`), ...vaciosEnc],
    [celdaTitulo(`Generado el ${fechaGen}`), ...vaciosTit],
    Array(NCOLS).fill(null).map(() => celdaNormal('')),
    [
      celdaSubH('Nombre'),       celdaSubH('Cédula'),      celdaSubH('Teléfono'),
      celdaSubH('Habitación'),   celdaSubH('Tipo'),         celdaSubH('Arriendo ($)'),
      celdaSubH('Estado'),       celdaSubH('Saldo ($)'),    celdaSubH('Abono ($)'),
      celdaSubH('Ingreso'),      celdaSubH('Vencimiento'),  celdaSubH('Método'),
      celdaSubH('Observaciones'),
    ],
  ];

  datos.forEach((a, i) => {
    const hab    = a.habitaciones;
    const esGris = i % 2 === 1;
    const bg     = v => esGris ? celdaGris(v) : celdaNormal(v);
    const estado = ESTADO_TEXTO[a.estado_pago] || a.estado_pago || '';
    const fondoEst = ESTADO_FONDO[a.estado_pago];

    filas.push([
      bg(a.nombre || ''),
      bg(a.cedula || ''),
      bg(a.telefono || ''),
      bg(habLabel(hab) || 'Sin asignar'),
      bg(hab?.tipo === 'apartamento' ? 'Apartamento' : 'Habitación'),
      celdaNum(a.valor_arriendo || 0),
      celda(estado, { fondo: fondoEst, bold: a.estado_pago === 'atrasado' }),
      (a.saldo_pendiente || 0) > 0 ? celdaNumR(a.saldo_pendiente) : celdaNum(0),
      celdaNum(a.abono_recibido || 0),
      bg(formatearFecha(a.fecha_ingreso)),
      bg(formatearFecha(a.fecha_vencimiento)),
      bg(a.metodo_pago || 'Sin definir'),
      bg(a.observaciones || ''),
    ]);
  });

  const anchos = [20, 14, 13, 14, 14, 14, 13, 13, 13, 12, 12, 13, 25];
  const ws = buildWS(filas, anchos);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: NCOLS - 1 } },
  ];
  ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }];
  return ws;
}

// ── Hoja 2: Habitaciones ──────────────────────────────────────────────────────

function construirHojaHabitaciones(datos, mesFiltro) {
  const NCOLS = 6;
  const vaciosEnc = Array(NCOLS - 1).fill(null).map(() => celdaEncH(''));

  const filas = [
    [celdaEncH(`RANCHO GRANDE — Habitaciones y Apartamentos · ${labelMes(mesFiltro)}`), ...vaciosEnc],
    [
      celdaSubH('N°'), celdaSubH('Tipo'), celdaSubH('Baño'),
      celdaSubH('Precio ($)'), celdaSubH('Estado'), celdaSubH('Descripción'),
    ],
  ];

  datos.forEach((h, i) => {
    const esGris   = i % 2 === 1;
    const bg       = v => esGris ? celdaGris(v) : celdaNormal(v);
    const fondoEst = h.estado === 'ocupada' ? COLOR.ROJO_CLARO : COLOR.VERDE_CLARO;
    const fondoBano = h.tiene_bano ? (esGris ? COLOR.GRIS : null) : COLOR.AMBAR_CLARO;

    filas.push([
      bg(h.numero || ''),
      bg(h.tipo === 'apartamento' ? 'Apartamento' : 'Habitación'),
      fondoBano ? celda(h.tiene_bano ? 'Sí' : 'No', { fondo: fondoBano }) : celdaNormal('Sí'),
      celdaNum(h.precio || 0),
      celda(h.estado === 'ocupada' ? 'Ocupada' : 'Disponible', { fondo: fondoEst }),
      bg(h.descripcion || ''),
    ]);
  });

  const anchos = [6, 14, 8, 14, 12, 30];
  const ws = buildWS(filas, anchos);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } }];
  ws['!rows'] = [{ hpt: 28 }];
  return ws;
}

// ── Hoja 3: Ingresos y Gastos ─────────────────────────────────────────────────

function construirHojaFinanzas(datos, mesFiltro) {
  const NCOLS = 9;
  const vaciosEnc = Array(NCOLS - 1).fill(null).map(() => celdaEncH(''));

  const filas = [
    [celdaEncH(`RANCHO GRANDE — Ingresos y Gastos · ${labelMes(mesFiltro)}`), ...vaciosEnc],
    [
      celdaSubH('Fecha'),    celdaSubH('Tipo'),          celdaSubH('Concepto'),
      celdaSubH('Categoría'), celdaSubH('Valor ($)'),    celdaSubH('Habitación'),
      celdaSubH('Método'),   celdaSubH('Registrado por'), celdaSubH('Observaciones'),
    ],
  ];

  datos.forEach(f => {
    const esIngreso = f.tipo === 'ingreso';
    const fondo     = esIngreso ? COLOR.AZUL_CLARO : COLOR.ROJO_CLARO;
    const bg        = v => celda(v, { fondo });

    filas.push([
      bg(formatearFecha(f.fecha)),
      bg(esIngreso ? 'Ingreso' : 'Gasto'),
      bg(f.concepto       || ''),
      bg(f.categoria      || ''),
      esIngreso ? celdaNumG(f.valor || 0) : celdaNumR(f.valor || 0),
      bg(habLabel(f.habitaciones) || 'General'),
      bg(f.metodo_pago    || 'N/A'),
      bg(f.registrado_por || ''),
      bg(f.observaciones  || ''),
    ]);
  });

  const totalIngresos = datos.filter(f => f.tipo === 'ingreso').reduce((s, f) => s + (f.valor || 0), 0);
  const totalGastos   = datos.filter(f => f.tipo === 'gasto').reduce((s, f)  => s + (f.valor || 0), 0);
  const balance       = totalIngresos - totalGastos;

  filas.push(Array(NCOLS).fill(null).map(() => celdaNormal('')));

  filas.push([
    celdaTitulo('TOTAL INGRESOS'),
    ...Array(NCOLS - 2).fill(null).map(() => celdaTitulo('')),
    celdaNumG(totalIngresos),
  ]);
  filas.push([
    celda('TOTAL GASTOS', { bold: true, fondo: COLOR.ROJO_CLARO }),
    ...Array(NCOLS - 2).fill(null).map(() => celda('', { fondo: COLOR.ROJO_CLARO })),
    celdaNumR(totalGastos),
  ]);
  filas.push([
    celda('GANANCIAS', { bold: true, fondo: COLOR.VERDE_OSCURO, colorTexto: COLOR.BLANCO }),
    ...Array(NCOLS - 2).fill(null).map(() => celda('', { fondo: COLOR.VERDE_OSCURO })),
    celda(balance, { bold: true, fondo: COLOR.VERDE_OSCURO, colorTexto: balance >= 0 ? 'A5D6A7' : 'EF9A9A', align: 'right' }),
  ]);

  const anchos = [12, 10, 22, 16, 14, 12, 13, 16, 25];
  const ws = buildWS(filas, anchos);
  ws['!merges'] = [
    { s: { r: 0,                c: 0 }, e: { r: 0,                c: NCOLS - 1 } },
    { s: { r: filas.length - 3, c: 0 }, e: { r: filas.length - 3, c: NCOLS - 2 } },
    { s: { r: filas.length - 2, c: 0 }, e: { r: filas.length - 2, c: NCOLS - 2 } },
    { s: { r: filas.length - 1, c: 0 }, e: { r: filas.length - 1, c: NCOLS - 2 } },
  ];
  ws['!rows'] = [{ hpt: 28 }];
  return ws;
}

// ── Hoja 4: Historial de Pagos ────────────────────────────────────────────────

function construirHojaPagos(datos, mesFiltro) {
  const NCOLS = 9;
  const vaciosEnc = Array(NCOLS - 1).fill(null).map(() => celdaEncH(''));

  const filas = [
    [celdaEncH(`RANCHO GRANDE — Historial de Pagos · ${labelMes(mesFiltro)}`), ...vaciosEnc],
    [
      celdaSubH('Fecha'),        celdaSubH('Arrendatario'), celdaSubH('Habitación'),
      celdaSubH('Tipo Pago'),    celdaSubH('Valor ($)'),    celdaSubH('Mes'),
      celdaSubH('Método'),       celdaSubH('Registrado por'), celdaSubH('Observaciones'),
    ],
  ];

  datos.forEach((p, i) => {
    const arr        = p.arrendatarios;
    const esGris     = i % 2 === 1;
    const bg         = v => esGris ? celdaGris(v) : celdaNormal(v);
    const esCompleto = p.tipo_pago === 'pago_completo';

    filas.push([
      bg(formatearFecha(p.fecha_pago)),
      bg(arr?.nombre || ''),
      bg(habLabel(arr?.habitaciones)),
      celda(esCompleto ? 'Pago completo' : 'Abono', {
        fondo:      esGris ? COLOR.GRIS : COLOR.BLANCO,
        colorTexto: esCompleto ? COLOR.VERDE_MEDIO : COLOR.AMBAR,
        bold:       true,
      }),
      celdaNumG(p.valor || 0),
      bg(p.mes_correspondiente || ''),
      bg(p.metodo_pago         || ''),
      bg(p.registrado_por      || ''),
      bg(p.observaciones       || ''),
    ]);
  });

  const anchos = [12, 20, 13, 14, 14, 16, 13, 16, 25];
  const ws = buildWS(filas, anchos);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } }];
  ws['!rows'] = [{ hpt: 28 }];
  return ws;
}

// ── Exportar ──────────────────────────────────────────────────────────────────

export async function exportarExcel(mes = null) {
  const mesFiltro = mes || new Date().toISOString().slice(0, 7);
  try {
    mostrarToast('Generando Excel... ⏳');
    const datos = await obtenerDatos(mesFiltro);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, construirHojaArrendatarios(datos.arrendatarios, mesFiltro), 'Arrendatarios');
    XLSX.utils.book_append_sheet(wb, construirHojaHabitaciones(datos.habitaciones,   mesFiltro), 'Habitaciones');
    XLSX.utils.book_append_sheet(wb, construirHojaFinanzas(datos.finanzas,           mesFiltro), 'Ingresos y Gastos');
    XLSX.utils.book_append_sheet(wb, construirHojaPagos(datos.pagos,                 mesFiltro), 'Historial de Pagos');

    XLSX.writeFile(wb, `RanchoGrande_${mesFiltro}.xlsx`);
    mostrarToast('✅ Excel descargado correctamente', 'success');
  } catch (err) {
    console.error('Error al exportar:', err);
    mostrarToast('❌ Error al generar el Excel', 'error');
  }
}
