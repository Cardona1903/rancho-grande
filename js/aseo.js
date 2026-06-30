import supabase from './supabase.js';

const DIAS_SEMANA = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_LABEL  = ['Lun','Mar','Mié','Jue','Vie','Sáb'];

let semanaActual = '';
let toastTimeoutId = null;
let arrendatariosSinBano = [];

function mostrarToast(mensaje, esError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.toggle('toast-error', esError);
  toast.style.display = 'block';
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function getLunesActual() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  hoy.setDate(hoy.getDate() + diff);
  return hoy.toISOString().split('T')[0];
}

function getSemanaLabel(lunesISO) {
  const lunes = new Date(lunesISO + 'T00:00:00');
  const sabado = new Date(lunes); sabado.setDate(sabado.getDate() + 5);
  return `Semana del ${lunes.toLocaleDateString('es-CO',{day:'numeric',month:'short'})} al ${sabado.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}`;
}

function getSemanaAnterior(lunesISO) {
  const d = new Date(lunesISO + 'T00:00:00'); d.setDate(d.getDate()-7);
  return d.toISOString().split('T')[0];
}

function getSemanaSiguiente(lunesISO) {
  const d = new Date(lunesISO + 'T00:00:00'); d.setDate(d.getDate()+7);
  return d.toISOString().split('T')[0];
}

function getFechaDelDia(lunesISO, indiceDia) {
  // Devuelve el número del mes para el día indicado (0=lun, 5=sab)
  const d = new Date(lunesISO + 'T00:00:00'); d.setDate(d.getDate() + indiceDia);
  return d.getDate(); // número del mes
}

function actualizarLabelSemana() {
  const el = document.getElementById('semana-label-texto');
  if (el) el.textContent = getSemanaLabel(semanaActual);
}

async function cargarArrendatariosSinBano() {
  try {
    const { data, error } = await supabase
      .from('arrendatarios')
      .select('id, nombre, habitaciones!inner(numero, tipo, tiene_bano)')
      .eq('activo', true)
      .eq('habitaciones.tiene_bano', false);
    if (error) throw error;

    const lista = document.getElementById('lista-sin-bano');
    if (!lista) return [];
    if (!data || data.length === 0) {
      lista.innerHTML = '<p style="color:var(--text-secondary);font-size:14px">No hay arrendatarios con baño compartido.</p>';
      return [];
    }
    lista.innerHTML = data.map(a => {
      const hab = a.habitaciones;
      const tipoLabel = hab.tipo === 'apartamento' ? 'Apto' : 'Hab';
      return `<div class="aseo-persona-item">
        <span>${a.nombre}</span>
        <span style="color:var(--text-secondary);font-size:13px">${tipoLabel}. ${hab.numero}</span>
      </div>`;
    }).join('');
    return data;
  } catch (err) {
    console.error('Error cargando arrendatarios sin baño:', err);
    return [];
  }
}

async function cargarYRenderGrid() {
  try {
    const { data: turnos, error } = await supabase
      .from('aseo_turnos')
      .select('*, arrendatarios(nombre)')
      .eq('semana_inicio', semanaActual);
    if (error) throw error;

    // Mapear turnos por dia_semana para acceso rápido
    const turnosPorDia = {};
    (turnos || []).forEach(t => { turnosPorDia[t.dia_semana] = t; });

    const grid = document.getElementById('aseo-grid');
    if (!grid) return;

    let html = '<div class="aseo-grid">';
    // Encabezados
    DIAS_LABEL.forEach((label, i) => {
      const numDia = getFechaDelDia(semanaActual, i);
      html += `<div class="aseo-dia-header">${label} ${numDia}</div>`;
    });
    // Celdas
    DIAS_SEMANA.forEach(dia => {
      const turno = turnosPorDia[dia];
      if (turno) {
        const clase = turno.completado ? 'completado' : 'pendiente';
        const icono = turno.completado ? '✅' : '⏳';
        const nombre = turno.arrendatarios?.nombre || '';
        const nombreCorto = nombre.split(' ')[0]; // solo primer nombre
        html += `<div class="aseo-celda ${clase}" data-turno-id="${turno.id}" data-completado="${turno.completado}">${icono} ${nombreCorto}</div>`;
      } else {
        html += `<div class="aseo-celda vacio">-</div>`;
      }
    });
    html += '</div>';
    grid.innerHTML = html;
  } catch (err) {
    console.error('Error cargando turnos:', err);
  }
}

async function abrirModalEditarTurnos() {
  // Cargar turnos actuales de la semana
  const { data: turnos } = await supabase
    .from('aseo_turnos')
    .select('*')
    .eq('semana_inicio', semanaActual);

  const turnosPorDia = {};
  (turnos || []).forEach(t => { turnosPorDia[t.dia_semana] = t; });

  // Actualizar label del modal
  const labelModal = document.getElementById('modal-aseo-semana-label');
  if (labelModal) labelModal.textContent = getSemanaLabel(semanaActual);

  // Construir filas del formulario
  const opciones = arrendatariosSinBano.map(a =>
    `<option value="${a.id}">${a.nombre}</option>`
  ).join('');

  const formTurnos = document.getElementById('aseo-form-turnos');
  if (!formTurnos) return;

  formTurnos.innerHTML = DIAS_SEMANA.map((dia, i) => {
    const numDia = getFechaDelDia(semanaActual, i);
    const turno = turnosPorDia[dia];
    return `<div class="turno-fila">
      <span class="turno-dia-label">${DIAS_LABEL[i]} ${numDia}</span>
      <select class="turno-select" data-dia="${dia}" data-turno-id="${turno?.id || ''}">
        <option value="">Sin asignar</option>
        ${opciones}
      </select>
    </div>`;
  }).join('');

  // Pre-seleccionar valores actuales
  DIAS_SEMANA.forEach(dia => {
    const turno = turnosPorDia[dia];
    if (turno) {
      const sel = formTurnos.querySelector(`select[data-dia="${dia}"]`);
      if (sel) sel.value = turno.arrendatario_id;
    }
  });

  document.getElementById('modal-aseo-editar').style.display = 'flex';
}

async function guardarTurnos() {
  const selects = document.querySelectorAll('#aseo-form-turnos .turno-select');

  // Leer estado actual de Supabase para comparar
  const { data: turnosActuales } = await supabase
    .from('aseo_turnos')
    .select('*')
    .eq('semana_inicio', semanaActual);
  const turnosPorDia = {};
  (turnosActuales || []).forEach(t => { turnosPorDia[t.dia_semana] = t; });

  try {
    for (const sel of selects) {
      const dia = sel.dataset.dia;
      const nuevoArrendatarioId = sel.value || null;
      const turnoActual = turnosPorDia[dia];

      if (!turnoActual && nuevoArrendatarioId) {
        // INSERT nuevo turno
        await supabase.from('aseo_turnos').insert({
          arrendatario_id: nuevoArrendatarioId,
          dia_semana: dia,
          semana_inicio: semanaActual,
          completado: false
        });
      } else if (turnoActual && nuevoArrendatarioId && turnoActual.arrendatario_id !== nuevoArrendatarioId) {
        // UPDATE cambió de arrendatario
        await supabase.from('aseo_turnos').update({ arrendatario_id: nuevoArrendatarioId }).eq('id', turnoActual.id);
      } else if (turnoActual && !nuevoArrendatarioId) {
        // DELETE se quitó el turno
        await supabase.from('aseo_turnos').delete().eq('id', turnoActual.id);
      }
      // Si no cambió: no hacer nada
    }
    mostrarToast('Turnos guardados ✅');
    document.getElementById('modal-aseo-editar').style.display = 'none';
    await cargarYRenderGrid();
  } catch (err) {
    mostrarToast('Error al guardar turnos', true);
    console.error(err);
  }
}

export { cargarYRenderGrid as recargarAseo };

export async function initAseo() {
  semanaActual = getLunesActual();
  actualizarLabelSemana();
  arrendatariosSinBano = await cargarArrendatariosSinBano();
  await cargarYRenderGrid();

  document.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-semana-anterior') {
      semanaActual = getSemanaAnterior(semanaActual);
      actualizarLabelSemana();
      await cargarYRenderGrid();
    }
    if (e.target.id === 'btn-semana-siguiente') {
      semanaActual = getSemanaSiguiente(semanaActual);
      actualizarLabelSemana();
      await cargarYRenderGrid();
    }

    if (e.target.id === 'btn-editar-turnos') abrirModalEditarTurnos();
    if (e.target.id === 'btn-guardar-turnos') guardarTurnos();
    if (e.target.id === 'btn-cancelar-turnos') {
      document.getElementById('modal-aseo-editar').style.display = 'none';
    }

    const celda = e.target.closest('.aseo-celda[data-turno-id]');
    if (celda) {
      const turnoId = celda.dataset.turnoId;
      const completadoActual = celda.dataset.completado === 'true';
      try {
        const { error } = await supabase
          .from('aseo_turnos')
          .update({ completado: !completadoActual })
          .eq('id', turnoId);
        if (error) throw error;
        mostrarToast(!completadoActual ? '✅ Marcado como completado' : '↩️ Desmarcado');
        await cargarYRenderGrid();
      } catch (err) {
        mostrarToast('Error al actualizar', true);
        console.error(err);
      }
    }
  });
}
