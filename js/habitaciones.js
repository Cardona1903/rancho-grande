import supabase from './supabase.js';
import { mostrarNotificacionLocal } from './notificaciones.js';
import { mostrarToast } from './toast.js';

console.log('habitaciones.js cargado');

let habitacionEditandoId = null;
let habitacionSeleccionada = null;

export function initHabitaciones() {
  console.log('initHabitaciones ejecutado');
  console.log('Botón nueva hab:', document.getElementById('btn-nueva-habitacion'));
  console.log('Botón guardar hab:', document.getElementById('btn-guardar-habitacion'));
  console.log('Form habitación:', document.getElementById('form-habitacion'));

  // Delegación de eventos: los botones de los modales de habitaciones se
  // resuelven por id en el momento del click, no al registrar el listener.
  // Así funcionan aunque el modal se vuelva a pintar o se reordene en el DOM.
  document.addEventListener('click', (evento) => {
    const id = evento.target.id;

    if (id === 'btn-nueva-habitacion') {
      abrirFormNueva();
    } else if (id === 'btn-cancelar-habitacion-form') {
      cerrarModales();
    } else if (id === 'btn-cerrar-opciones-habitacion') {
      cerrarModales();
    } else if (id === 'btn-editar-habitacion') {
      if (habitacionSeleccionada) abrirFormEditar(habitacionSeleccionada);
    } else if (id === 'btn-eliminar-habitacion') {
      mostrarModal('modal-habitacion-confirmar');
    } else if (id === 'btn-cancelar-eliminar-habitacion') {
      cerrarModales();
    } else if (id === 'btn-confirmar-eliminar-habitacion') {
      if (habitacionSeleccionada) eliminarHabitacion(habitacionSeleccionada.id);
    } else if (evento.target.classList.contains('modal-overlay')) {
      cerrarModales();
    }
  });

  // El botón "Guardar habitación" es type="submit" dentro de #form-habitacion,
  // así que su disparo real es el evento "submit" del formulario, no un click
  // suelto. Delegamos también ese evento para mantener el mismo patrón.
  document.addEventListener('submit', (evento) => {
    if (evento.target.id === 'form-habitacion') {
      manejarSubmitFormulario(evento);
    }
  });

  cargarHabitaciones();
}

async function cargarHabitaciones() {
  const contenedor = document.getElementById('habitaciones-lista');
  contenedor.innerHTML = '<p class="loading-text">Cargando habitaciones...</p>';

  try {
    const { data, error } = await supabase
      .from('habitaciones')
      .select('*')
      .order('numero', { ascending: true });

    if (error) throw error;

    renderHabitaciones(data || []);
  } catch (error) {
    console.error('Error al cargar habitaciones:', error);
    contenedor.innerHTML = '<p class="mensaje-error">Error al cargar habitaciones. Verifica tu conexión.</p>';
  }
}

function crearCardHabitacion(habitacion) {
  const card = document.createElement('div');
  card.className = 'card habitacion-card';

  const tipoTexto  = habitacion.tipo === 'apartamento' ? 'Apartamento' : 'Habitación';
  const banoTexto  = habitacion.tiene_bano ? '🚿 Baño privado' : '🚻 Baño compartido';
  const estadoBadge = habitacion.estado === 'ocupada'
    ? '<span class="badge badge-warning">Ocupada</span>'
    : '<span class="badge badge-success">Disponible</span>';

  card.innerHTML = `
    <div class="habitacion-numero">${habitacion.numero}</div>
    <div class="habitacion-info">
      <span class="badge badge-success">${tipoTexto}</span>
      ${estadoBadge}
    </div>
    <div class="habitacion-precio">${formatearPrecio(habitacion.precio)} / mes</div>
    <div class="habitacion-info">${banoTexto}</div>
    ${habitacion.descripcion ? `<div>${habitacion.descripcion}</div>` : ''}
  `;

  card.addEventListener('click', () => abrirOpciones(habitacion));
  return card;
}

function renderHabitaciones(lista) {
  const contenedor = document.getElementById('habitaciones-lista');
  contenedor.innerHTML = '';

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="mensaje-vacio">Aún no hay habitaciones registradas. Toca + para agregar la primera.</p>';
    return;
  }

  const disponibles = lista.filter(h => h.estado === 'disponible');
  const ocupadas    = lista.filter(h => h.estado === 'ocupada');

  [
    { titulo: 'Disponibles', items: disponibles, gridId: 'grid-disponibles', tituloClass: '' },
    { titulo: 'Ocupadas',    items: ocupadas,    gridId: 'grid-ocupadas',    tituloClass: ' ocupadas' },
  ].forEach(({ titulo, items, gridId, tituloClass }) => {
    const seccion = document.createElement('div');
    seccion.className = 'hab-seccion';
    seccion.innerHTML = `
      <div class="hab-seccion-header">
        <span class="hab-seccion-titulo${tituloClass}">${titulo}</span>
        <span class="hab-seccion-count">(${items.length})</span>
      </div>
      <div class="hab-seccion-grid" id="${gridId}"></div>
    `;

    const grid = seccion.querySelector(`#${gridId}`);
    if (items.length === 0) {
      grid.innerHTML = `<p class="hab-seccion-vacio">No hay habitaciones ${titulo.toLowerCase()}</p>`;
    } else {
      items.forEach(h => grid.appendChild(crearCardHabitacion(h)));
    }

    contenedor.appendChild(seccion);
  });
}

function formatearPrecio(valor) {
  return `$${Number(valor).toLocaleString('es-CO')}`;
}

function abrirFormNueva() {
  habitacionEditandoId = null;
  document.getElementById('modal-habitacion-titulo').textContent = 'Nueva habitación';
  document.getElementById('form-habitacion').reset();
  mostrarModal('modal-habitacion-form');
}

function abrirFormEditar(habitacion) {
  habitacionEditandoId = habitacion.id;
  document.getElementById('modal-habitacion-titulo').textContent = 'Editar habitación';
  document.getElementById('campo-numero').value = habitacion.numero;
  document.getElementById('campo-tipo').value = habitacion.tipo;
  document.getElementById('campo-tiene-bano').checked = habitacion.tiene_bano;
  document.getElementById('campo-precio').value = habitacion.precio;
  document.getElementById('campo-descripcion').value = habitacion.descripcion || '';
  mostrarModal('modal-habitacion-form');
}

function abrirOpciones(habitacion) {
  habitacionSeleccionada = habitacion;
  document.getElementById('modal-habitacion-opciones-titulo').textContent = habitacion.numero;
  mostrarModal('modal-habitacion-opciones');
}

async function manejarSubmitFormulario(evento) {
  evento.preventDefault();

  const datos = {
    numero: document.getElementById('campo-numero').value.trim(),
    tipo: document.getElementById('campo-tipo').value,
    tiene_bano: document.getElementById('campo-tiene-bano').checked,
    precio: Number(document.getElementById('campo-precio').value),
    descripcion: document.getElementById('campo-descripcion').value.trim() || null,
  };

  await guardarHabitacion(datos);
}

async function guardarHabitacion(datos) {
  const btnGuardar = document.getElementById('btn-guardar-habitacion');
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    if (habitacionEditandoId) {
      const { error } = await supabase
        .from('habitaciones')
        .update(datos)
        .eq('id', habitacionEditandoId);
      if (error) throw error;
      mostrarToast('Habitación actualizada correctamente.');
      mostrarNotificacionLocal('Habitación actualizada', `${datos.numero} se actualizó correctamente.`);
    } else {
      console.log('INSERT habitaciones → datos enviados:', datos);
      const respuesta = await supabase.from('habitaciones').insert(datos);
      console.log('INSERT habitaciones → respuesta de Supabase:', respuesta);
      const { error } = respuesta;
      if (error) throw error;
      mostrarToast('Habitación agregada correctamente.');
      mostrarNotificacionLocal('Nueva habitación', `${datos.numero} fue agregada.`);
    }

    cerrarModales();
    await cargarHabitaciones();
  } catch (error) {
    console.error('Error al guardar habitación:', error);
    mostrarToast(`Error al guardar: ${error.message || 'ocurrió un problema inesperado.'}`, true);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar habitación';
  }
}

async function eliminarHabitacion(id) {
  try {
    const { error } = await supabase.from('habitaciones').delete().eq('id', id);
    if (error) throw error;
    mostrarToast('Habitación eliminada.');
    cerrarModales();
    await cargarHabitaciones();
  } catch (error) {
    console.error('Error al eliminar habitación:', error);
    mostrarToast(`Error al eliminar: ${error.message}`, true);
  }
}

function mostrarModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  modal.scrollTop = 0;
  const contenido = modal.querySelector('.modal');
  if (contenido) contenido.scrollTop = 0;
}

function cerrarModales() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.style.display = 'none';
  });
  habitacionEditandoId = null;
  habitacionSeleccionada = null;
}

export { cargarHabitaciones as recargarHabitaciones };
