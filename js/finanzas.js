import supabase from './supabase.js';
import { getUsuario } from './auth.js';
import { mostrarToast } from './toast.js';
import { formatearPrecio, limpiarPrecio, aplicarFormatoMoneda } from './utils.js';

const CATEGORIAS = ['Arriendo', 'Servicios', 'Mantenimiento', 'Fachada', 'Patio', 'General', 'Otro'];

let registroSeleccionadoId = null;
let filtroTipo = 'todos';
let mesFiltro = '';
let habitaciones = [];
let _inicializado = false;

// ─── Utilidades ──────────────────────────────────────────────────────────────

function getMesActual() {
  const hoy = new Date();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${hoy.getFullYear()}-${mm}`;
}

function getPrimerDia(yearMonth) {
  return `${yearMonth}-01`;
}

function getUltimoDia(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).toISOString().split('T')[0];
}

function formatearFecha(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function etiquetaHabitacion(hab) {
  if (!hab) return '';
  const tipo = hab.tipo === 'apartamento' ? 'Apto' : 'Hab';
  return `${tipo}. ${hab.numero}`;
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

async function cargarHabitaciones() {
  const { data } = await supabase.from('habitaciones').select('id, numero, tipo').order('numero');
  habitaciones = data || [];
}

async function cargarYRenderFinanzas() {
  const lista = document.getElementById('finanzas-lista');
  if (!lista) return;
  lista.innerHTML = '<p class="loading-text">Cargando...</p>';

  const { data, error } = await supabase
    .from('finanzas')
    .select('*, habitaciones(numero, tipo)')
    .gte('fecha', getPrimerDia(mesFiltro))
    .lte('fecha', getUltimoDia(mesFiltro))
    .order('fecha', { ascending: false });

  if (error) {
    lista.innerHTML = '<p class="mensaje-error">Error al cargar registros.</p>';
    console.error(error);
    return;
  }

  renderResumen(data || []);
  renderLista(data || []);
  await cargarPagosPendientes();
}

async function cargarPagosPendientes() {
  const cont = document.getElementById('finanzas-pagos-pendientes-lista');
  if (!cont) return;

  const { data, error } = await supabase
    .from('arrendatarios')
    .select('nombre, valor_arriendo, abono_recibido, saldo_pendiente, habitaciones(numero)')
    .eq('activo', true)
    .gt('saldo_pendiente', 0)
    .order('saldo_pendiente', { ascending: false });

  if (error) {
    console.error('Error al cargar pagos pendientes:', error);
    cont.innerHTML = '<p class="mensaje-error">Error al cargar pagos pendientes.</p>';
    return;
  }

  const lista = data || [];
  const totalPendiente = lista.reduce((s, a) => s + (a.saldo_pendiente || 0), 0);

  const elPendiente = document.getElementById('resumen-pendiente-cobrar');
  if (elPendiente) elPendiente.textContent = '$ ' + formatearPrecio(totalPendiente);

  if (lista.length === 0) {
    cont.innerHTML = '<p class="mensaje-vacio">No hay pagos pendientes 🎉</p>';
    return;
  }

  cont.innerHTML = lista.map(a => {
    const habLabel = a.habitaciones ? `Hab. ${a.habitaciones.numero}` : '';
    return `<div class="card pendiente-card">
      <div class="pendiente-header">
        <span class="pendiente-nombre">${a.nombre}</span>
        ${habLabel ? `<span class="registro-hab">${habLabel}</span>` : ''}
      </div>
      <div class="pendiente-montos">Abono recibido: $ ${formatearPrecio(a.abono_recibido || 0)} / Total: $ ${formatearPrecio(a.valor_arriendo || 0)}</div>
      <div class="pendiente-saldo">Pendiente: $ ${formatearPrecio(a.saldo_pendiente)}</div>
    </div>`;
  }).join('');
}

function renderResumen(data) {
  const totalIngresos = data.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.valor, 0);
  const totalGastos   = data.filter(r => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  const balance       = totalIngresos - totalGastos;

  document.getElementById('resumen-ingresos').textContent = '$ ' + formatearPrecio(totalIngresos);
  document.getElementById('resumen-gastos').textContent   = '$ ' + formatearPrecio(totalGastos);

  const elBalance = document.getElementById('resumen-balance');
  elBalance.textContent = '$ ' + formatearPrecio(balance);
  elBalance.className   = 'resumen-valor ' + (balance >= 0 ? 'ingreso' : 'gasto');
}

function renderLista(data) {
  const lista = document.getElementById('finanzas-lista');
  if (!lista) return;

  const filtrados = filtroTipo === 'todos' ? data : data.filter(r => r.tipo === filtroTipo);

  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="mensaje-vacio">No hay registros para este mes.</p>';
    return;
  }

  lista.innerHTML = filtrados.map(r => {
    const esIngreso = r.tipo === 'ingreso';
    const badge  = esIngreso
      ? '<span class="badge-ingreso">📈 Ingreso</span>'
      : '<span class="badge-gasto">📉 Gasto</span>';
    const habLabel = r.habitaciones ? `<span class="registro-hab">${etiquetaHabitacion(r.habitaciones)}</span>` : '';
    const metodo   = esIngreso && r.metodo_pago ? `<span class="registro-fecha">${r.metodo_pago}</span>` : '';
    const porLabel = r.registrado_por ? `<p class="registro-por">Por: ${r.registrado_por}</p>` : '';
    return `<div class="card registro-card" data-id="${r.id}">
      <div class="registro-header">
        <span class="registro-concepto">${r.concepto}</span>
        <span class="registro-valor ${r.tipo}">$ ${formatearPrecio(r.valor)}</span>
      </div>
      <div class="registro-meta">
        ${badge}
        <span class="registro-fecha">${formatearFecha(r.fecha)}</span>
        <span class="categoria-chip">${r.categoria || ''}</span>
        ${habLabel}
        ${metodo}
      </div>
      ${porLabel}
    </div>`;
  }).join('');
}

// ─── Formulario ───────────────────────────────────────────────────────────────

function buildFormHTML(registro = null) {
  const hoy = new Date().toISOString().split('T')[0];
  const opcionesHab = habitaciones.map(h =>
    `<option value="${h.id}"${registro?.habitacion_id === h.id ? ' selected' : ''}>${etiquetaHabitacion(h)}</option>`
  ).join('');
  const opcionesCat = CATEGORIAS.map(c => {
    const val = c.toLowerCase();
    if (val === 'arriendo') {
      return `<option value="arriendo" disabled>Arriendo (automático)</option>`;
    }
    return `<option value="${val}"${registro?.categoria === val ? ' selected' : ''}>${c}</option>`;
  }).join('');

  const tieneHab    = !!registro?.habitacion_id;
  const tipoIngreso = !registro || registro.tipo === 'ingreso';
  const tipoGasto   = registro?.tipo === 'gasto';

  return `
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <div class="radio-group" id="radio-group-tipo-finanza">
        <label class="radio-option${tipoIngreso ? ' selected' : ''}" data-valor="ingreso">
          <input type="radio" name="tipo-finanza" value="ingreso" id="radio-finanza-ingreso"${tipoIngreso ? ' checked' : ''} />
          📈 Ingreso
        </label>
        <label class="radio-option${tipoGasto ? ' selected' : ''}" data-valor="gasto">
          <input type="radio" name="tipo-finanza" value="gasto" id="radio-finanza-gasto"${tipoGasto ? ' checked' : ''} />
          📉 Gasto
        </label>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="campo-finanza-concepto">Concepto</label>
      <input class="input-field" type="text" id="campo-finanza-concepto" value="${registro?.concepto || ''}" placeholder="Ej: Arriendo enero, Plomería..." />
    </div>
    <div class="form-group">
      <label class="form-label" for="campo-finanza-valor">Valor</label>
      <input class="input-field" type="text" inputmode="numeric" id="campo-finanza-valor" value="${registro?.valor ? formatearPrecio(registro.valor) : ''}" placeholder="0" />
    </div>
    <div class="form-group">
      <label class="form-label" for="campo-finanza-fecha">Fecha</label>
      <input class="input-field" type="date" id="campo-finanza-fecha" value="${registro?.fecha || hoy}" />
    </div>
    <div class="form-group">
      <label class="form-label" for="campo-finanza-categoria">Categoría</label>
      <select class="input-field" id="campo-finanza-categoria">
        <option value="">Selecciona...</option>
        ${opcionesCat}
      </select>
    </div>
    <div class="form-group">
      <div class="toggle-container">
        <label class="toggle-switch">
          <input type="checkbox" id="campo-finanza-tiene-hab"${tieneHab ? ' checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <label class="form-label" for="campo-finanza-tiene-hab">¿Corresponde a una habitación?</label>
      </div>
    </div>
    <div class="form-group${tieneHab ? ' campo-visible' : ' campo-oculto'}" id="grupo-finanza-habitacion">
      <label class="form-label" for="campo-finanza-habitacion">Habitación</label>
      <select class="input-field" id="campo-finanza-habitacion">
        <option value="">Selecciona...</option>
        ${opcionesHab}
      </select>
    </div>
    <div class="form-group${tipoGasto ? ' campo-oculto' : ' campo-visible'}" id="grupo-finanza-metodo">
      <label class="form-label" for="campo-finanza-metodo">Método de pago</label>
      <select class="input-field" id="campo-finanza-metodo">
        <option value="na"${registro?.metodo_pago === 'na' ? ' selected' : ''}>N/A</option>
        <option value="efectivo"${registro?.metodo_pago === 'efectivo' ? ' selected' : ''}>Efectivo</option>
        <option value="transferencia"${registro?.metodo_pago === 'transferencia' ? ' selected' : ''}>Transferencia</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="campo-finanza-observaciones">Observaciones</label>
      <textarea class="input-field" id="campo-finanza-observaciones" rows="2">${registro?.observaciones || ''}</textarea>
    </div>
    <div class="modal-acciones">
      <button type="submit" class="btn-primary" id="btn-guardar-finanza">Guardar registro</button>
      <button type="button" class="btn-secondary" id="btn-cancelar-finanza-form">Cancelar</button>
    </div>`;
}

function abrirFormNuevo() {
  document.getElementById('modal-finanza-titulo').textContent = 'Nuevo registro';
  document.getElementById('form-finanza').innerHTML = buildFormHTML();
  aplicarFormatoMoneda(document.getElementById('campo-finanza-valor'));
  document.getElementById('modal-finanza-form').style.display = 'flex';
  registroSeleccionadoId = null;
}

async function abrirFormEditar(id) {
  const { data, error } = await supabase.from('finanzas').select('*').eq('id', id).single();
  if (error) { mostrarToast('Error al cargar registro', true); return; }
  document.getElementById('modal-finanza-titulo').textContent = 'Editar registro';
  document.getElementById('form-finanza').innerHTML = buildFormHTML(data);
  aplicarFormatoMoneda(document.getElementById('campo-finanza-valor'));
  document.getElementById('modal-finanza-form').style.display = 'flex';
  registroSeleccionadoId = id;
}

async function guardarFinanza(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-guardar-finanza');
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  const tipo      = document.querySelector('input[name="tipo-finanza"]:checked')?.value;
  const concepto  = document.getElementById('campo-finanza-concepto')?.value.trim();
  const valor     = limpiarPrecio(document.getElementById('campo-finanza-valor')?.value);
  const fecha     = document.getElementById('campo-finanza-fecha')?.value;
  const categoria = document.getElementById('campo-finanza-categoria')?.value;
  const tieneHab  = document.getElementById('campo-finanza-tiene-hab')?.checked;
  const habId     = tieneHab ? (document.getElementById('campo-finanza-habitacion')?.value || null) : null;
  const metodo    = tipo === 'ingreso' ? (document.getElementById('campo-finanza-metodo')?.value || 'na') : null;
  const obs       = document.getElementById('campo-finanza-observaciones')?.value.trim();

  if (!tipo)              { mostrarToast('Selecciona el tipo (Ingreso/Gasto)', true); return; }
  if (!concepto)          { mostrarToast('El concepto es obligatorio', true); return; }
  if (!valor || valor <= 0) { mostrarToast('Ingresa un valor válido', true); return; }
  if (!fecha)             { mostrarToast('La fecha es obligatoria', true); return; }

  const usuario = getUsuario();
  const payload = {
    tipo,
    concepto,
    valor,
    fecha,
    categoria: categoria || null,
    habitacion_id: habId || null,
    metodo_pago: metodo,
    observaciones: obs || null,
    registrado_por: usuario?.nombre || null,
  };

  try {
    if (registroSeleccionadoId) {
      const { error } = await supabase.from('finanzas').update(payload).eq('id', registroSeleccionadoId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('finanzas').insert(payload);
      if (error) throw error;
    }
    mostrarToast('Registro guardado ✅');
    document.getElementById('modal-finanza-form').style.display = 'none';
    registroSeleccionadoId = null;
    await cargarYRenderFinanzas();
  } catch (err) {
    mostrarToast(`Error al guardar: ${err.message}`, true);
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────

async function eliminarFinanza() {
  if (!registroSeleccionadoId) return;
  try {
    const { error } = await supabase.from('finanzas').delete().eq('id', registroSeleccionadoId);
    if (error) throw error;
    mostrarToast('Registro eliminado.');
    document.getElementById('modal-finanza-confirmar').style.display = 'none';
    document.getElementById('modal-finanza-opciones').style.display  = 'none';
    registroSeleccionadoId = null;
    await cargarYRenderFinanzas();
  } catch (err) {
    mostrarToast(`Error al eliminar: ${err.message}`, true);
    console.error(err);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export { cargarYRenderFinanzas as recargarFinanzas };

function actualizarMesLabel() {
  const [y, m] = mesFiltro.split('-');
  const label = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const el = document.getElementById('finanzas-mes-label');
  if (el) el.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

export async function initFinanzas() {
  if (_inicializado) return;
  _inicializado = true;
  mesFiltro = getMesActual();

  await cargarHabitaciones();

  actualizarMesLabel();

  // ── Delegación de clicks ──────────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    // FAB nuevo registro
    if (e.target.id === 'btn-nuevo-registro') {
      abrirFormNuevo();
      return;
    }

    // Cancelar formulario
    if (e.target.id === 'btn-cancelar-finanza-form') {
      document.getElementById('modal-finanza-form').style.display = 'none';
      return;
    }

    // Navegación de mes
    if (e.target.id === 'btn-mes-anterior') {
      const [y, m] = mesFiltro.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      mesFiltro = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      actualizarMesLabel();
      await cargarYRenderFinanzas();
      return;
    }
    if (e.target.id === 'btn-mes-siguiente') {
      const [y, m] = mesFiltro.split('-').map(Number);
      const d = new Date(y, m, 1);
      mesFiltro = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      actualizarMesLabel();
      await cargarYRenderFinanzas();
      return;
    }

    // Filtros de tipo
    const filtroBtnTipo = e.target.closest('#filtros-tipo .filtro-btn');
    if (filtroBtnTipo) {
      document.querySelectorAll('#filtros-tipo .filtro-btn').forEach(b => b.classList.remove('active'));
      filtroBtnTipo.classList.add('active');
      filtroTipo = filtroBtnTipo.dataset.tipo;
      await cargarYRenderFinanzas();
      return;
    }

    // Toque en tarjeta de registro → modal opciones
    const card = e.target.closest('.registro-card');
    if (card) {
      registroSeleccionadoId = card.dataset.id;
      const concepto = card.querySelector('.registro-concepto')?.textContent || '';
      document.getElementById('modal-finanza-opciones-titulo').textContent = concepto;
      document.getElementById('modal-finanza-opciones').style.display = 'flex';
      return;
    }

    // Modal opciones: editar
    if (e.target.id === 'btn-editar-finanza') {
      document.getElementById('modal-finanza-opciones').style.display = 'none';
      if (registroSeleccionadoId) await abrirFormEditar(registroSeleccionadoId);
      return;
    }

    // Modal opciones: eliminar → ir a confirmar
    if (e.target.id === 'btn-eliminar-finanza') {
      document.getElementById('modal-finanza-opciones').style.display = 'none';
      document.getElementById('modal-finanza-confirmar').style.display = 'flex';
      return;
    }

    // Modal opciones: cerrar
    if (e.target.id === 'btn-cerrar-finanza-opciones') {
      document.getElementById('modal-finanza-opciones').style.display = 'none';
      registroSeleccionadoId = null;
      return;
    }

    // Confirmar eliminar
    if (e.target.id === 'btn-confirmar-eliminar-finanza') {
      await eliminarFinanza();
      return;
    }

    // Cancelar eliminar
    if (e.target.id === 'btn-cancelar-eliminar-finanza') {
      document.getElementById('modal-finanza-confirmar').style.display = 'none';
      return;
    }

    // Toggle habitación dentro del form (mostrar/ocultar select)
    if (e.target.id === 'campo-finanza-tiene-hab') {
      const grupo = document.getElementById('grupo-finanza-habitacion');
      if (grupo) {
        grupo.className = e.target.checked ? 'form-group campo-visible' : 'form-group campo-oculto';
      }
      return;
    }

    // Radio tipo ingreso/gasto → mostrar/ocultar método de pago
    if (e.target.name === 'tipo-finanza') {
      // Actualizar estilos de radio-option
      document.querySelectorAll('#radio-group-tipo-finanza .radio-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.valor === e.target.value);
      });
      const grupoMetodo = document.getElementById('grupo-finanza-metodo');
      if (grupoMetodo) {
        grupoMetodo.className = e.target.value === 'gasto'
          ? 'form-group campo-oculto'
          : 'form-group campo-visible';
      }
      return;
    }
  });

  // ── Submit del formulario ─────────────────────────────────────────────────
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'form-finanza') await guardarFinanza(e);
  });

  await cargarYRenderFinanzas();
}
