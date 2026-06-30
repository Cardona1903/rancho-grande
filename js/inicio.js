import supabase from './supabase.js';
import { getUsuario } from './auth.js';

// ─── Utilidades de fecha ──────────────────────────────────────────────────────

function getLunesActual() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  hoy.setDate(hoy.getDate() + diff);
  return hoy.toISOString().split('T')[0];
}

function getDiaHoyStr() {
  const dias = [null, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return dias[new Date().getDay()] ?? null; // null = domingo
}

function getMesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function getPrimerDia(yearMonth) {
  return `${yearMonth}-01`;
}

function getUltimoDia(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).toISOString().split('T')[0];
}

function formatearPrecio(valor) {
  return Number(valor).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

function diasHastaVencer(fechaISO) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaISO + 'T00:00:00');
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}

// ─── Render de secciones ──────────────────────────────────────────────────────

function renderSaludo() {
  const usuario = getUsuario();
  const saludoEl = document.getElementById('inicio-saludo');
  const fechaEl  = document.getElementById('inicio-fecha');
  if (saludoEl) saludoEl.textContent = `¡Hola, ${usuario?.nombre || ''}! 👋`;
  if (fechaEl) {
    const str = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    fechaEl.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  }
}

function renderHabitaciones(data) {
  const ocupadas    = data.filter(h => h.estado === 'ocupada').length;
  const disponibles = data.filter(h => h.estado === 'disponible').length;
  document.getElementById('card-hab-total').textContent = data.length;
  document.getElementById('card-hab-sub').textContent   = `${ocupadas} ocupadas · ${disponibles} disponibles`;
}

function renderArrendatarios(data) {
  const alDia     = data.filter(a => a.estado_pago === 'al_dia').length;
  const pendientes = data.length - alDia;
  document.getElementById('card-arr-total').textContent = data.length;
  document.getElementById('card-arr-sub').textContent   = `${alDia} al día · ${pendientes} pendientes`;
}

const BADGE_ESTADO = {
  al_dia:   '<span class="badge badge-success">✅ Al día</span>',
  pendiente: '<span class="badge badge-warning">⏳ Pendiente</span>',
  atrasado:  '<span class="badge badge-error">🔴 Atrasado</span>',
};

function prioridadUrgente(a) {
  if (a.estado_pago === 'atrasado') return 0;
  if (a.estado_pago === 'pendiente' && a.saldo_pendiente > 0) return 1;
  return 2;
}

function renderUrgentes(arrendatarios) {
  const el = document.getElementById('inicio-urgentes');
  if (!el) return;

  const urgentes = arrendatarios
    .filter(a => {
      if (a.estado_pago === 'atrasado') return true;
      if (a.estado_pago === 'pendiente' && a.saldo_pendiente > 0) return true;
      if (a.fecha_vencimiento && diasHastaVencer(a.fecha_vencimiento) <= 5) return true;
      return false;
    })
    .sort((a, b) => {
      const pDiff = prioridadUrgente(a) - prioridadUrgente(b);
      if (pDiff !== 0) return pDiff;
      // Dentro de la misma prioridad: primero el que vence antes
      const dA = a.fecha_vencimiento ? diasHastaVencer(a.fecha_vencimiento) : 999;
      const dB = b.fecha_vencimiento ? diasHastaVencer(b.fecha_vencimiento) : 999;
      return dA - dB;
    });

  if (urgentes.length === 0) {
    el.innerHTML = '<div class="aseo-hoy-card" style="color:var(--primary)">✅ Todo al día</div>';
    return;
  }

  const mostrados = urgentes.slice(0, 5);
  el.innerHTML = mostrados.map(a => {
    const hab    = a.habitaciones;
    const habStr = hab ? `${hab.tipo === 'apartamento' ? 'Apto' : 'Hab.'} ${hab.numero}` : '';
    const dias   = a.fecha_vencimiento ? diasHastaVencer(a.fecha_vencimiento) : null;

    let vencimientoStr = '';
    if (dias !== null && dias < 0) {
      vencimientoStr = `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`;
    } else if (dias === 0) {
      vencimientoStr = 'Vence hoy';
    } else if (dias !== null && dias <= 5) {
      vencimientoStr = `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;
    }

    const deudaStr = a.saldo_pendiente > 0
      ? `<div class="urgente-estado">Debe: ${formatearPrecio(a.saldo_pendiente)}</div>`
      : '';
    const vencStr = vencimientoStr
      ? `<div class="urgente-info">${vencimientoStr}</div>`
      : '';

    return `<div class="urgente-item">
      <div>
        <div class="urgente-nombre">${a.nombre}</div>
        <div class="urgente-info">${habStr}</div>
        ${vencStr}
      </div>
      <div style="text-align:right">
        ${BADGE_ESTADO[a.estado_pago] || ''}
        ${deudaStr}
      </div>
    </div>`;
  }).join('');

  if (urgentes.length > 5) {
    el.innerHTML += `<p style="font-size:13px;color:var(--text-secondary);padding:8px 0">y ${urgentes.length - 5} más...</p>`;
  }
}

function renderAseoHoy(turnoData) {
  const el = document.getElementById('inicio-aseo-hoy');
  if (!el) return;

  if (new Date().getDay() === 0) {
    el.innerHTML = '<div class="aseo-hoy-card">Hoy es domingo — sin turno de aseo</div>';
    return;
  }
  if (turnoData && turnoData.arrendatarios) {
    const nombre = turnoData.arrendatarios.nombre;
    const estado = turnoData.completado ? '✅ completado' : '⏳ pendiente';
    el.innerHTML = `<div class="aseo-hoy-card">Le toca a <strong>${nombre}</strong> — ${estado}</div>`;
  } else {
    el.innerHTML = '<div class="aseo-hoy-card">No hay turno asignado para hoy</div>';
  }
}

// ─── Inicialización ───────────────────────────────────────────────────────────

export async function initInicio() {
  renderSaludo();

  // Poner "-" mientras carga
  ['card-hab-total', 'card-arr-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '-';
  });
  ['card-ingresos-val', 'card-gastos-val'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '$-';
  });

  const mes          = getMesActual();
  const lunesActual  = getLunesActual();
  const diaHoyStr    = getDiaHoyStr();

  const [resHabs, resArrs, resIngresos, resGastos, resTurno] = await Promise.allSettled([
    supabase.from('habitaciones').select('id, estado'),
    supabase.from('arrendatarios')
      .select('id, estado_pago, nombre, fecha_vencimiento, saldo_pendiente, habitaciones(numero, tipo)')
      .eq('activo', true),
    supabase.from('finanzas')
      .select('valor')
      .eq('tipo', 'ingreso')
      .gte('fecha', getPrimerDia(mes))
      .lte('fecha', getUltimoDia(mes)),
    supabase.from('finanzas')
      .select('valor')
      .eq('tipo', 'gasto')
      .gte('fecha', getPrimerDia(mes))
      .lte('fecha', getUltimoDia(mes)),
    diaHoyStr
      ? supabase.from('aseo_turnos')
          .select('*, arrendatarios(nombre)')
          .eq('semana_inicio', lunesActual)
          .eq('dia_semana', diaHoyStr)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Habitaciones
  if (resHabs.status === 'fulfilled' && !resHabs.value.error) {
    renderHabitaciones(resHabs.value.data || []);
  }

  // Arrendatarios
  const arrendatarios = (resArrs.status === 'fulfilled' && !resArrs.value.error)
    ? resArrs.value.data || []
    : [];
  if (resArrs.status === 'fulfilled' && !resArrs.value.error) {
    renderArrendatarios(arrendatarios);
  }

  // Ingresos del mes
  if (resIngresos.status === 'fulfilled' && !resIngresos.value.error) {
    const total = (resIngresos.value.data || []).reduce((s, r) => s + r.valor, 0);
    document.getElementById('card-ingresos-val').textContent = formatearPrecio(total);
  }

  // Gastos del mes
  if (resGastos.status === 'fulfilled' && !resGastos.value.error) {
    const total = (resGastos.value.data || []).reduce((s, r) => s + r.valor, 0);
    document.getElementById('card-gastos-val').textContent = formatearPrecio(total);
  }

  // Urgentes (usa los arrendatarios ya cargados)
  renderUrgentes(arrendatarios);

  // Aseo de hoy
  const turnoData = (resTurno.status === 'fulfilled') ? resTurno.value.data : null;
  renderAseoHoy(turnoData);
}
