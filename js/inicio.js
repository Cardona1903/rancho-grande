import supabase from './supabase.js';
import { getUsuario } from './auth.js';
import { formatearPrecio } from './utils.js';

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

function renderUrgentes(arrendatarios) {
  const el = document.getElementById('inicio-urgentes');
  if (!el) return;

  const enMora = arrendatarios
    .filter(a => {
      if (a.estado_pago === 'atrasado') return true;
      if (a.estado_pago === 'pendiente' && a.saldo_pendiente > 0) return true;
      if (a.fecha_vencimiento && diasHastaVencer(a.fecha_vencimiento) < 0) return true;
      return false;
    })
    .map(a => {
      const base = a.saldo_pendiente > 0 ? a.saldo_pendiente : (a.valor_arriendo || 0);
      return { ...a, _debe: base - (a.abono_recibido || 0) };
    })
    .filter(a => a._debe > 0)
    .sort((a, b) => {
      const orden = { atrasado: 0, pendiente: 1, al_dia: 2 };
      const pDiff = (orden[a.estado_pago] ?? 2) - (orden[b.estado_pago] ?? 2);
      if (pDiff !== 0) return pDiff;
      const dA = a.fecha_vencimiento ? diasHastaVencer(a.fecha_vencimiento) : 0;
      const dB = b.fecha_vencimiento ? diasHastaVencer(b.fecha_vencimiento) : 0;
      return dA - dB;
    });

  if (enMora.length === 0) {
    el.innerHTML = '<p class="mora-vacio">✅ Todos los arrendatarios están al día</p>';
    return;
  }

  el.innerHTML = enMora.map(a => {
    const hab = a.habitaciones;
    const habStr = hab ? `${hab.tipo === 'apartamento' ? 'Apto' : 'Hab.'} ${hab.numero}` : '';
    const dias = a.fecha_vencimiento ? diasHastaVencer(a.fecha_vencimiento) : null;

    let diasStr = '';
    if (dias !== null) {
      if (dias < 0) diasStr = `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`;
      else if (dias === 0) diasStr = 'Vence hoy';
      else diasStr = `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;
    }

    let badgeClass, badgeLabel;
    if (a.estado_pago === 'atrasado') { badgeClass = 'mora-badge--atrasado'; badgeLabel = 'Atrasado'; }
    else if (a.estado_pago === 'pendiente') { badgeClass = 'mora-badge--pendiente'; badgeLabel = 'Pendiente'; }
    else { badgeClass = 'mora-badge--vencido'; badgeLabel = 'Vencido'; }

    return `<div class="mora-card">
      <div class="mora-card-header">
        <span class="mora-nombre">${a.nombre}</span>
        <span class="mora-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="mora-card-body">
        ${habStr ? `<span class="mora-hab">${habStr}</span>` : ''}
        ${diasStr ? `<span class="mora-dias">${diasStr}</span>` : ''}
      </div>
      <div class="mora-card-footer">
        <span class="mora-debe-label">Debe</span>
        <span class="mora-debe-valor">$ ${formatearPrecio(a._debe)}</span>
      </div>
    </div>`;
  }).join('');
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

// ─── Navegación desde los cards de resumen ────────────────────────────────────

const CARD_DESTINO_SCREEN = {
  'card-habitaciones': 'habitaciones',
  'card-arrendatarios': 'arrendatarios',
  'card-ingresos': 'finanzas',
  'card-gastos': 'finanzas',
};

let _clicksCardsInicializados = false;

function inicializarClicksCards() {
  if (_clicksCardsInicializados) return;
  _clicksCardsInicializados = true;

  document.addEventListener('click', (evento) => {
    const card = evento.target.closest('.resumen-card');
    if (!card) return;
    const screen = CARD_DESTINO_SCREEN[card.id];
    if (!screen) return;
    document.querySelector(`.nav-btn[data-screen="${screen}"]`)?.click();
  });
}

// ─── Inicialización ───────────────────────────────────────────────────────────

export async function initInicio() {
  inicializarClicksCards();
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
      .select('id, nombre, habitacion_id, estado_pago, saldo_pendiente, abono_recibido, valor_arriendo, fecha_vencimiento, habitaciones(numero, tipo)')
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
    document.getElementById('card-ingresos-val').textContent = '$ ' + formatearPrecio(total);
  }

  // Gastos del mes
  if (resGastos.status === 'fulfilled' && !resGastos.value.error) {
    const total = (resGastos.value.data || []).reduce((s, r) => s + r.valor, 0);
    document.getElementById('card-gastos-val').textContent = '$ ' + formatearPrecio(total);
  }

  // Urgentes (usa los arrendatarios ya cargados)
  renderUrgentes(arrendatarios);

  // Aseo de hoy
  const turnoData = (resTurno.status === 'fulfilled') ? resTurno.value.data : null;
  renderAseoHoy(turnoData);
}
