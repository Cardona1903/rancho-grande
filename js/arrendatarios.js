import supabase from './supabase.js';
import { getUsuario } from './auth.js';
import { mostrarToast } from './toast.js';

let listaArrendatarios = [];
let filtroActual = 'todos';
let arrendatarioEditandoId = null;
let arrendatarioSeleccionado = null;
let habitacionAnteriorEditando = null;
let _inicializado = false;

export function initArrendatarios() {
  if (_inicializado) return;
  _inicializado = true;
  document.addEventListener('click', (evento) => {
    const id = evento.target.id;
    const filtroBtn = evento.target.closest('.filtro-btn');
    const radioOption = evento.target.closest('.radio-option');

    if (id === 'btn-nuevo-arrendatario') {
      abrirFormDatosNuevo();
    } else if (id === 'btn-cancelar-datos-arrendatario') {
      cerrarModales();
    } else if (id === 'btn-cancelar-habitacion-pago') {
      cerrarModales();
    } else if (id === 'btn-cancelar-arrendatario-form') {
      cerrarModales();
    } else if (id === 'btn-cerrar-opciones-arrendatario') {
      cerrarModales();
    } else if (id === 'btn-registrar-pago') {
      if (arrendatarioSeleccionado) abrirModalPago(arrendatarioSeleccionado);
    } else if (id === 'btn-asignar-habitacion') {
      document.getElementById('modal-arrendatario-opciones').style.display = 'none';
      if (arrendatarioSeleccionado) abrirHabitacionPago(arrendatarioSeleccionado);
    } else if (id === 'btn-editar-arrendatario') {
      if (arrendatarioSeleccionado) abrirFormEditar(arrendatarioSeleccionado);
    } else if (id === 'btn-dar-baja-arrendatario') {
      document.getElementById('modal-arrendatario-opciones').style.display = 'none';
      if (arrendatarioSeleccionado) {
        const arr = arrendatarioSeleccionado;
        const hab = arr.habitaciones;
        document.getElementById('baja-modal-titulo').textContent = `¿Dar de baja a ${arr.nombre}?`;
        if (hab) {
          const tipoStr = hab.tipo === 'apartamento' ? 'el Apartamento' : 'la Habitación';
          document.getElementById('baja-modal-texto').textContent =
            `Esto marcará al arrendatario como inactivo y liberará ${tipoStr} ${hab.numero} para nuevos arrendatarios.`;
        } else {
          document.getElementById('baja-modal-texto').textContent =
            'Esto marcará al arrendatario como inactivo y dejará de aparecer en la lista activa.';
        }
      }
      mostrarModal('modal-arrendatario-confirmar-baja');
    } else if (id === 'btn-cancelar-baja-arrendatario') {
      cerrarModales();
    } else if (id === 'btn-confirmar-baja-arrendatario') {
      if (arrendatarioSeleccionado) darBaja(arrendatarioSeleccionado.id);
    } else if (id === 'btn-cancelar-pago-form') {
      cerrarModales();
    } else if (filtroBtn) {
      filtroActual = filtroBtn.dataset.filtro;
      document.querySelectorAll('.filtro-btn').forEach((btn) => btn.classList.remove('active'));
      filtroBtn.classList.add('active');
      renderArrendatarios();
    } else if (radioOption && radioOption.closest('#radio-group-pago')) {
      seleccionarTipoPago(radioOption);
    } else if (radioOption && radioOption.closest('#radio-group-pago-inicial')) {
      seleccionarPagoInicial(radioOption);
    } else if (evento.target.classList.contains('modal-overlay')) {
      cerrarModales();
    }
  });

  document.addEventListener('submit', (evento) => {
    if (evento.target.id === 'form-arrendatario-datos') {
      manejarSubmitDatosArrendatario(evento);
    } else if (evento.target.id === 'form-habitacion-pago') {
      manejarSubmitHabitacionPago(evento);
    } else if (evento.target.id === 'form-arrendatario') {
      manejarSubmitArrendatario(evento);
    } else if (evento.target.id === 'form-pago') {
      manejarSubmitPago(evento);
    }
  });

  document.addEventListener('change', (evento) => {
    if (evento.target.id === 'campo-arr-habitacion' || evento.target.id === 'campo-hp-habitacion') {
      autocompletarPrecioHabitacion(evento.target);
    } else if (evento.target.id === 'campo-arr-estado-pago') {
      actualizarVisibilidadAbono();
    }
  });

  document.addEventListener('input', (evento) => {
    if (evento.target.id === 'campo-arr-abono') {
      actualizarVisibilidadFechaPagoCompleto();
    } else if (evento.target.id === 'campo-hp-abono' || evento.target.id === 'campo-hp-valor-arriendo') {
      actualizarSaldoReferenciaInicial();
    }
  });

  cargarArrendatarios();
}

function diasHastaVencer(fechaISO) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaISO + 'T00:00:00');
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}

function sumarUnMes(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function formatearFechaCorta(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getHoyString() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMesActualString() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatearPrecio(valor) {
  return `$${Number(valor || 0).toLocaleString('es-CO')}`;
}

async function cargarArrendatarios() {
  const contenedor = document.getElementById('arrendatarios-lista');
  contenedor.innerHTML = '<p class="loading-text">Cargando arrendatarios...</p>';

  try {
    const { data, error } = await supabase
      .from('arrendatarios')
      .select('*, habitaciones(numero, tipo, tiene_bano)')
      .eq('activo', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    listaArrendatarios = data || [];
    renderArrendatarios();
  } catch (error) {
    console.error('Error al cargar arrendatarios:', error);
    contenedor.innerHTML = '<p class="mensaje-error">Error al cargar arrendatarios. Verifica tu conexión.</p>';
  }
}

function renderArrendatarios() {
  const contenedor = document.getElementById('arrendatarios-lista');
  contenedor.innerHTML = '';

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const estaVencido = (a) => a.fecha_vencimiento
    ? new Date(a.fecha_vencimiento + 'T00:00:00') < hoy
    : false;

  const lista = filtroActual === 'todos'
    ? listaArrendatarios
    : filtroActual === 'al_dia'
      ? listaArrendatarios.filter(a => a.estado_pago === 'al_dia' && !estaVencido(a))
      : filtroActual === 'pendiente'
        ? listaArrendatarios.filter(a => a.estado_pago === 'pendiente' || (a.estado_pago === 'al_dia' && estaVencido(a)))
        : listaArrendatarios.filter(a => a.estado_pago === filtroActual);

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="mensaje-vacio">Aún no hay arrendatarios registrados. Toca + para agregar el primero.</p>';
    return;
  }

  lista.forEach((arrendatario) => {
    const card = document.createElement('div');
    card.className = 'card arrendatario-card';

    const habitacion = arrendatario.habitaciones;

    if (!arrendatario.habitacion_id || !habitacion) {
      card.innerHTML = `
        <div class="arrendatario-nombre">${arrendatario.nombre}</div>
        <div class="arrendatario-habitacion">🏠 Sin habitación asignada — toca para completar</div>
      `;
      card.addEventListener('click', () => abrirOpciones(arrendatario));
      contenedor.appendChild(card);
      return;
    }

    const habitacionTexto = `${habitacion.tipo === 'apartamento' ? 'Apto' : 'Hab.'} ${habitacion.numero}`;

    const dias = diasHastaVencer(arrendatario.fecha_vencimiento);
    let vencimientoHtml;
    if (dias < 0) {
      vencimientoHtml = `<div class="vencimiento-urgente">🔴 Venció hace ${Math.abs(dias)} días</div>`;
    } else if (dias <= 5) {
      vencimientoHtml = `<div class="vencimiento-urgente">⚠️ Vence en ${dias} días</div>`;
    } else {
      vencimientoHtml = `<div class="vencimiento-normal">Vence: ${formatearFechaCorta(arrendatario.fecha_vencimiento)}</div>`;
    }

    const badges = {
      al_dia: '<span class="badge badge-success">✅ Al día</span>',
      pendiente: '<span class="badge badge-warning">⏳ Pendiente</span>',
      atrasado: '<span class="badge badge-error">🔴 Atrasado</span>',
    };

    card.innerHTML = `
      <div class="arrendatario-nombre">${arrendatario.nombre}</div>
      <div class="arrendatario-habitacion">${habitacionTexto}</div>
      <div class="habitacion-info">${badges[arrendatario.estado_pago] || ''}</div>
      ${vencimientoHtml}
      ${arrendatario.saldo_pendiente > 0 ? `<div class="arrendatario-debe">Debe: ${formatearPrecio(arrendatario.saldo_pendiente)}</div>` : ''}
      ${arrendatario.abono_recibido > 0 ? `<div class="arrendatario-abono">Abono: ${formatearPrecio(arrendatario.abono_recibido)}</div>` : ''}
    `;

    card.addEventListener('click', () => abrirOpciones(arrendatario));
    contenedor.appendChild(card);
  });
}

async function llenarSelectHabitaciones(select, habitacionActualId) {
  select.innerHTML = '<option value="">Cargando...</option>';

  try {
    let query = supabase.from('habitaciones').select('id, numero, tipo, precio, estado');

    if (habitacionActualId) {
      query = query.or(`estado.eq.disponible,id.eq.${habitacionActualId}`);
    } else {
      query = query.eq('estado', 'disponible');
    }

    const { data, error } = await query.order('numero', { ascending: true });
    if (error) throw error;

    select.innerHTML = '';

    if (!data || data.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No hay habitaciones disponibles</option>';
      return;
    }

    if (!habitacionActualId) {
      const opcionVacia = document.createElement('option');
      opcionVacia.value = '';
      opcionVacia.textContent = 'Selecciona una habitación...';
      select.appendChild(opcionVacia);
    }

    data.forEach((habitacion) => {
      const opcion = document.createElement('option');
      opcion.value = habitacion.id;
      opcion.dataset.precio = habitacion.precio;
      const prefijo = habitacion.tipo === 'apartamento' ? 'Apto' : 'Hab.';
      opcion.textContent = `${prefijo} ${habitacion.numero} — ${formatearPrecio(habitacion.precio)}`;
      if (habitacion.id === habitacionActualId) opcion.selected = true;
      select.appendChild(opcion);
    });
  } catch (error) {
    console.error('Error al cargar habitaciones:', error);
    select.innerHTML = '<option value="" disabled selected>Error al cargar habitaciones</option>';
  }
}

function autocompletarPrecioHabitacion(select) {
  const opcionSeleccionada = select.options[select.selectedIndex];
  const precio = opcionSeleccionada ? opcionSeleccionada.dataset.precio : null;
  if (!precio) return;

  const targetId = select.id === 'campo-hp-habitacion' ? 'campo-hp-valor-arriendo' : 'campo-arr-valor-arriendo';
  document.getElementById(targetId).value = precio;

  if (select.id === 'campo-hp-habitacion') actualizarSaldoReferenciaInicial();
}

function actualizarVisibilidadAbono() {
  const estado = document.getElementById('campo-arr-estado-pago').value;
  const grupoAbono = document.getElementById('grupo-arr-abono');
  if (estado === 'al_dia') {
    grupoAbono.classList.add('campo-oculto');
    grupoAbono.classList.remove('campo-visible');
  } else {
    grupoAbono.classList.remove('campo-oculto');
    grupoAbono.classList.add('campo-visible');
  }
  actualizarVisibilidadFechaPagoCompleto();
}

function actualizarVisibilidadFechaPagoCompleto() {
  const abono = Number(document.getElementById('campo-arr-abono').value || 0);
  const grupoFecha = document.getElementById('grupo-arr-fecha-pago-completo');
  if (abono > 0) {
    grupoFecha.classList.remove('campo-oculto');
    grupoFecha.classList.add('campo-visible');
  } else {
    grupoFecha.classList.add('campo-oculto');
    grupoFecha.classList.remove('campo-visible');
  }
}

// ---------- Paso 1: datos personales (creación) ----------

function abrirFormDatosNuevo() {
  document.getElementById('form-arrendatario-datos').reset();
  document.getElementById('campo-datos-fecha-ingreso').value = getHoyString();
  mostrarModal('modal-arrendatario-datos');
}

async function manejarSubmitDatosArrendatario(evento) {
  evento.preventDefault();

  const nombre = document.getElementById('campo-datos-nombre').value.trim();
  const fechaIngreso = document.getElementById('campo-datos-fecha-ingreso').value;

  if (!nombre || !fechaIngreso) {
    mostrarToast('Completa el nombre y la fecha de ingreso.', true);
    return;
  }

  const datos = {
    nombre,
    cedula: document.getElementById('campo-datos-cedula').value.trim() || null,
    telefono: document.getElementById('campo-datos-telefono').value.trim() || null,
    fecha_ingreso: fechaIngreso,
    fecha_vencimiento: sumarUnMes(fechaIngreso),
    habitacion_id: null,
    valor_arriendo: 0,
    estado_pago: 'pendiente',
    saldo_pendiente: 0,
    abono_recibido: 0,
  };

  await crearArrendatarioBase(datos);
}

async function crearArrendatarioBase(datos) {
  const btnGuardar = document.getElementById('btn-guardar-datos-arrendatario');
  if (btnGuardar.disabled) return;
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    const usuario = getUsuario();
    datos.registrado_por = usuario ? usuario.id : null;

    const { data, error } = await supabase.from('arrendatarios').insert(datos).select().single();
    if (error) throw error;

    cerrarModales();
    mostrarToast('Datos guardados. Ahora asigna su habitación.');
    await abrirHabitacionPago(data);
  } catch (error) {
    console.error('Error al crear arrendatario:', error);
    mostrarToast(`Error al guardar: ${error.message || 'ocurrió un problema inesperado.'}`, true);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Continuar → Asignar habitación';
  }
}

// ---------- Paso 2: asignar habitación y pago inicial ----------

async function abrirHabitacionPago(arrendatario) {
  arrendatarioSeleccionado = arrendatario;
  document.getElementById('modal-hp-titulo').textContent = `Asignar habitación — ${arrendatario.nombre}`;
  document.getElementById('form-habitacion-pago').reset();

  await llenarSelectHabitaciones(document.getElementById('campo-hp-habitacion'), null);

  document.getElementById('campo-hp-valor-arriendo').value = '';
  document.getElementById('radio-pago-inicial-si').checked = true;
  document.querySelectorAll('#radio-group-pago-inicial .radio-option').forEach((opcion) => {
    opcion.classList.toggle('selected', opcion.dataset.valor === 'si');
  });
  aplicarVisibilidadPagoInicial('si');

  mostrarModal('modal-arrendatario-habitacion-pago');
}

function aplicarVisibilidadPagoInicial(valor) {
  const metodoCompleto = document.getElementById('grupo-hp-metodo-completo');
  const abono = document.getElementById('grupo-hp-abono');
  const metodoAbono = document.getElementById('grupo-hp-metodo-abono');
  const saldoReferencia = document.getElementById('grupo-hp-saldo-referencia');
  const fechaPagoCompleto = document.getElementById('grupo-hp-fecha-pago-completo');

  if (valor === 'si') {
    metodoCompleto.classList.remove('campo-oculto');
    metodoCompleto.classList.add('campo-visible');
    abono.classList.add('campo-oculto');
    abono.classList.remove('campo-visible');
    metodoAbono.classList.add('campo-oculto');
    metodoAbono.classList.remove('campo-visible');
    saldoReferencia.classList.add('campo-oculto');
    fechaPagoCompleto.classList.add('campo-oculto');
    fechaPagoCompleto.classList.remove('campo-visible');
  } else {
    metodoCompleto.classList.add('campo-oculto');
    metodoCompleto.classList.remove('campo-visible');
    abono.classList.remove('campo-oculto');
    abono.classList.add('campo-visible');
    metodoAbono.classList.remove('campo-oculto');
    metodoAbono.classList.add('campo-visible');
    saldoReferencia.classList.remove('campo-oculto');
    fechaPagoCompleto.classList.remove('campo-oculto');
    fechaPagoCompleto.classList.add('campo-visible');
    actualizarSaldoReferenciaInicial();
  }
}

function seleccionarPagoInicial(radioOption) {
  document.querySelectorAll('#radio-group-pago-inicial .radio-option').forEach((opcion) => {
    opcion.classList.remove('selected');
  });
  radioOption.classList.add('selected');

  const input = radioOption.querySelector('input[type="radio"]');
  input.checked = true;
  aplicarVisibilidadPagoInicial(input.value);
}

function actualizarSaldoReferenciaInicial() {
  const valorArriendo = Number(document.getElementById('campo-hp-valor-arriendo').value || 0);
  const abono = Number(document.getElementById('campo-hp-abono').value || 0);
  const saldo = Math.max(valorArriendo - abono, 0);
  document.getElementById('hp-saldo-texto').textContent = formatearPrecio(saldo);
}

async function manejarSubmitHabitacionPago(evento) {
  evento.preventDefault();

  const arrendatario = arrendatarioSeleccionado;
  if (!arrendatario) return;

  const habitacionId = document.getElementById('campo-hp-habitacion').value;
  if (!habitacionId) {
    mostrarToast('Selecciona una habitación.', true);
    return;
  }

  const valorArriendo = Number(document.getElementById('campo-hp-valor-arriendo').value);
  if (!valorArriendo || valorArriendo <= 0) {
    mostrarToast('Ingresa un valor de arriendo válido.', true);
    return;
  }

  const yaPagoTodo = document.querySelector('input[name="pago-inicial"]:checked').value === 'si';

  if (yaPagoTodo) {
    const metodoPago = document.getElementById('campo-hp-metodo-completo').value;
    if (!metodoPago) {
      mostrarToast('Selecciona un método de pago.', true);
      return;
    }

    await guardarHabitacionPago(arrendatario, {
      habitacionId,
      valorArriendo,
      pagoCompleto: true,
      metodoPago,
    });
  } else {
    const abono = Number(document.getElementById('campo-hp-abono').value || 0);
    if (abono > valorArriendo) {
      mostrarToast('El abono no puede superar el valor del arriendo.', true);
      return;
    }

    const fechaPagoCompleto = document.getElementById('campo-hp-fecha-pago-completo').value;
    if (!fechaPagoCompleto) {
      mostrarToast('Indica la fecha en que pagará el resto.', true);
      return;
    }

    const metodoPago = document.getElementById('campo-hp-metodo-abono').value;
    if (abono > 0 && !metodoPago) {
      mostrarToast('Selecciona el método de pago del abono.', true);
      return;
    }

    await guardarHabitacionPago(arrendatario, {
      habitacionId,
      valorArriendo,
      pagoCompleto: false,
      abono,
      fechaPagoCompleto,
      metodoPago: metodoPago || null,
    });
  }
}

async function guardarHabitacionPago(arrendatario, datos) {
  const btnGuardar = document.getElementById('btn-guardar-habitacion-pago');
  if (btnGuardar.disabled) return;
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    const usuario = getUsuario();
    const registradoPor = usuario ? usuario.id : null;

    if (datos.pagoCompleto) {
      const { error: errorUpdate } = await supabase
        .from('arrendatarios')
        .update({
          habitacion_id: datos.habitacionId,
          valor_arriendo: datos.valorArriendo,
          estado_pago: 'al_dia',
          saldo_pendiente: 0,
          abono_recibido: 0,
          metodo_pago: datos.metodoPago,
        })
        .eq('id', arrendatario.id);
      if (errorUpdate) throw errorUpdate;

      const { error: errorPago } = await supabase.from('pagos').insert({
        arrendatario_id: arrendatario.id,
        habitacion_id: datos.habitacionId,
        valor: datos.valorArriendo,
        tipo_pago: 'pago_completo',
        metodo_pago: datos.metodoPago,
        fecha_pago: getHoyString(),
        mes_correspondiente: getMesActualString(),
        registrado_por: registradoPor,
      });
      if (errorPago) throw errorPago;

      // Sincronizar ingreso en finanzas (no cancela el guardado si falla)
      try {
        await supabase.from('finanzas').insert({
          tipo: 'ingreso',
          concepto: `Arriendo ${getMesActualString()} — ${arrendatario.nombre}`,
          valor: datos.valorArriendo,
          fecha: getHoyString(),
          categoria: 'arriendo',
          habitacion_id: datos.habitacionId,
          arrendatario_id: arrendatario.id,
          metodo_pago: datos.metodoPago,
          registrado_por: usuario ? usuario.nombre : null,
          observaciones: 'Pago completo inicial',
        });
      } catch (errFinanza) {
        console.error('Error al sincronizar pago inicial en finanzas:', errFinanza);
      }

      mostrarToast('Habitación asignada. ¡Al día! ✅');
    } else {
      const saldo = Math.max(datos.valorArriendo - datos.abono, 0);

      const { error: errorUpdate } = await supabase
        .from('arrendatarios')
        .update({
          habitacion_id: datos.habitacionId,
          valor_arriendo: datos.valorArriendo,
          estado_pago: 'pendiente',
          saldo_pendiente: saldo,
          abono_recibido: datos.abono,
          fecha_pago_completo: datos.fechaPagoCompleto,
          metodo_pago: datos.metodoPago,
        })
        .eq('id', arrendatario.id);
      if (errorUpdate) throw errorUpdate;

      if (datos.abono > 0) {
        const { error: errorPago } = await supabase.from('pagos').insert({
          arrendatario_id: arrendatario.id,
          habitacion_id: datos.habitacionId,
          valor: datos.abono,
          tipo_pago: 'abono',
          metodo_pago: datos.metodoPago,
          fecha_pago: getHoyString(),
          mes_correspondiente: getMesActualString(),
          registrado_por: registradoPor,
        });
        if (errorPago) throw errorPago;

        // Sincronizar abono inicial en finanzas (no cancela el guardado si falla)
        try {
          await supabase.from('finanzas').insert({
            tipo: 'ingreso',
            concepto: `Arriendo ${getMesActualString()} — ${arrendatario.nombre}`,
            valor: datos.abono,
            fecha: getHoyString(),
            categoria: 'arriendo',
            habitacion_id: datos.habitacionId,
            arrendatario_id: arrendatario.id,
            metodo_pago: datos.metodoPago,
            registrado_por: usuario ? usuario.nombre : null,
            observaciones: 'Abono inicial',
          });
        } catch (errFinanza) {
          console.error('Error al sincronizar abono inicial en finanzas:', errFinanza);
        }
      }

      mostrarToast(`Habitación asignada. Saldo pendiente: ${formatearPrecio(saldo)} ⏳`);
    }

    await supabase.from('habitaciones').update({ estado: 'ocupada' }).eq('id', datos.habitacionId);

    cerrarModales();
    await cargarArrendatarios();
  } catch (error) {
    console.error('Error al asignar habitación:', error);
    mostrarToast(`Error al guardar: ${error.message || 'ocurrió un problema inesperado.'}`, true);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar';
  }
}

// ---------- Editar arrendatario existente ----------

async function abrirFormEditar(arrendatario) {
  arrendatarioEditandoId = arrendatario.id;
  habitacionAnteriorEditando = arrendatario.habitacion_id;
  document.getElementById('modal-arrendatario-titulo').textContent = 'Editar arrendatario';

  document.getElementById('campo-arr-nombre').value = arrendatario.nombre;
  document.getElementById('campo-arr-cedula').value = arrendatario.cedula || '';
  document.getElementById('campo-arr-telefono').value = arrendatario.telefono || '';
  document.getElementById('campo-arr-fecha-ingreso').value = arrendatario.fecha_ingreso;
  document.getElementById('campo-arr-fecha-vencimiento').value = arrendatario.fecha_vencimiento;
  document.getElementById('campo-arr-valor-arriendo').value = arrendatario.valor_arriendo;
  document.getElementById('campo-arr-estado-pago').value = arrendatario.estado_pago;
  document.getElementById('campo-arr-abono').value = arrendatario.abono_recibido || 0;
  document.getElementById('campo-arr-fecha-pago-completo').value = arrendatario.fecha_pago_completo || '';
  document.getElementById('campo-arr-metodo-pago').value = arrendatario.metodo_pago || '';
  document.getElementById('campo-arr-observaciones').value = arrendatario.observaciones || '';

  await llenarSelectHabitaciones(document.getElementById('campo-arr-habitacion'), arrendatario.habitacion_id);
  actualizarVisibilidadAbono();
  mostrarModal('modal-arrendatario-form');
}

function abrirOpciones(arrendatario) {
  arrendatarioSeleccionado = arrendatario;
  document.getElementById('modal-arrendatario-opciones-titulo').textContent = arrendatario.nombre;

  const tieneHabitacion = Boolean(arrendatario.habitacion_id);
  document.getElementById('btn-registrar-pago').style.display = tieneHabitacion ? 'block' : 'none';
  document.getElementById('btn-asignar-habitacion').style.display = tieneHabitacion ? 'none' : 'block';

  mostrarModal('modal-arrendatario-opciones');
}

async function manejarSubmitArrendatario(evento) {
  evento.preventDefault();

  const fechaIngreso = document.getElementById('campo-arr-fecha-ingreso').value;
  const fechaVencimiento = document.getElementById('campo-arr-fecha-vencimiento').value;

  if (fechaVencimiento <= fechaIngreso) {
    mostrarToast('La fecha de vencimiento debe ser posterior a la fecha de ingreso.', true);
    return;
  }

  const estadoPago = document.getElementById('campo-arr-estado-pago').value;
  const valorArriendo = Number(document.getElementById('campo-arr-valor-arriendo').value);
  let abonoRecibido = estadoPago === 'al_dia' ? 0 : Number(document.getElementById('campo-arr-abono').value || 0);

  if (abonoRecibido > valorArriendo) {
    mostrarToast('El abono no puede superar el valor del arriendo.', true);
    return;
  }

  const saldoPendiente = estadoPago === 'al_dia' ? 0 : Math.max(valorArriendo - abonoRecibido, 0);
  const habitacionId = document.getElementById('campo-arr-habitacion').value || null;

  const datos = {
    nombre: document.getElementById('campo-arr-nombre').value.trim(),
    cedula: document.getElementById('campo-arr-cedula').value.trim() || null,
    telefono: document.getElementById('campo-arr-telefono').value.trim() || null,
    habitacion_id: habitacionId,
    fecha_ingreso: fechaIngreso,
    fecha_vencimiento: fechaVencimiento,
    valor_arriendo: valorArriendo,
    estado_pago: estadoPago,
    saldo_pendiente: saldoPendiente,
    abono_recibido: abonoRecibido,
    fecha_pago_completo: document.getElementById('campo-arr-fecha-pago-completo').value || null,
    metodo_pago: document.getElementById('campo-arr-metodo-pago').value || null,
    observaciones: document.getElementById('campo-arr-observaciones').value.trim() || null,
  };

  await actualizarArrendatario(datos);
}

async function actualizarArrendatario(datos) {
  const btnGuardar = document.getElementById('btn-guardar-arrendatario');
  if (btnGuardar.disabled) return;
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    const { error } = await supabase
      .from('arrendatarios')
      .update(datos)
      .eq('id', arrendatarioEditandoId);
    if (error) throw error;

    if (habitacionAnteriorEditando !== datos.habitacion_id) {
      if (habitacionAnteriorEditando) {
        await supabase.from('habitaciones').update({ estado: 'disponible' }).eq('id', habitacionAnteriorEditando);
      }
      if (datos.habitacion_id) {
        await supabase.from('habitaciones').update({ estado: 'ocupada' }).eq('id', datos.habitacion_id);
      }
    }

    mostrarToast('Datos actualizados ✅');
    cerrarModales();
    await cargarArrendatarios();
  } catch (error) {
    console.error('Error al actualizar arrendatario:', error);
    mostrarToast(`Error al guardar: ${error.message || 'ocurrió un problema inesperado.'}`, true);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar arrendatario';
  }
}

// ---------- Registrar pago (ciclos posteriores) ----------

function seleccionarTipoPago(radioOption) {
  document.querySelectorAll('#radio-group-pago .radio-option').forEach((opcion) => {
    opcion.classList.remove('selected');
  });
  radioOption.classList.add('selected');

  const input = radioOption.querySelector('input[type="radio"]');
  input.checked = true;

  const campoValor = document.getElementById('campo-pago-valor');
  if (!arrendatarioSeleccionado) return;

  if (input.value === 'pago_completo') {
    const sugerido = arrendatarioSeleccionado.saldo_pendiente > 0
      ? arrendatarioSeleccionado.saldo_pendiente
      : arrendatarioSeleccionado.valor_arriendo;
    campoValor.value = sugerido;
  } else {
    campoValor.value = '';
  }
}

function abrirModalPago(arrendatario) {
  document.getElementById('modal-pago-titulo').textContent = `Registrar pago — ${arrendatario.nombre}`;
  document.getElementById('pago-referencia').innerHTML = `
    <p>Valor arriendo: <strong>${formatearPrecio(arrendatario.valor_arriendo)}</strong></p>
    <p>Saldo actual: <strong>${formatearPrecio(arrendatario.saldo_pendiente)}</strong></p>
  `;

  document.getElementById('form-pago').reset();
  document.getElementById('radio-pago-completo').checked = true;
  document.querySelectorAll('#radio-group-pago .radio-option').forEach((opcion) => {
    opcion.classList.toggle('selected', opcion.dataset.valor === 'pago_completo');
  });

  const sugerido = arrendatario.saldo_pendiente > 0 ? arrendatario.saldo_pendiente : arrendatario.valor_arriendo;
  document.getElementById('campo-pago-valor').value = sugerido;
  document.getElementById('campo-pago-fecha').value = getHoyString();
  document.getElementById('campo-pago-mes').value = getMesActualString();

  mostrarModal('modal-arrendatario-pago');
}

async function manejarSubmitPago(evento) {
  evento.preventDefault();

  const arrendatario = arrendatarioSeleccionado;
  if (!arrendatario) return;

  const tipoPago = document.querySelector('input[name="tipo-pago"]:checked').value;
  const valor = Number(document.getElementById('campo-pago-valor').value);

  if (!valor || valor <= 0) {
    mostrarToast('Ingresa un valor de pago válido.', true);
    return;
  }

  const metodoPago = document.getElementById('campo-pago-metodo').value;
  if (!metodoPago) {
    mostrarToast('Selecciona un método de pago.', true);
    return;
  }

  if (tipoPago === 'abono') {
    const nuevoAbono = (arrendatario.abono_recibido || 0) + valor;
    if (nuevoAbono > arrendatario.valor_arriendo) {
      mostrarToast('El abono no puede superar el valor del arriendo.', true);
      return;
    }
  }

  const datosPago = {
    tipoPago,
    valor,
    metodoPago,
    fecha: document.getElementById('campo-pago-fecha').value,
    mesCorrespondiente: document.getElementById('campo-pago-mes').value,
    observaciones: document.getElementById('campo-pago-observaciones').value.trim() || null,
  };

  await registrarPago(arrendatario, datosPago);
}

async function registrarPago(arrendatario, datosPago) {
  const btnGuardar = document.getElementById('btn-guardar-pago');
  if (btnGuardar.disabled) return;
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Registrando...';

  try {
    const usuario = getUsuario();

    const registroPago = {
      arrendatario_id: arrendatario.id,
      habitacion_id: arrendatario.habitacion_id,
      valor: datosPago.valor,
      tipo_pago: datosPago.tipoPago,
      metodo_pago: datosPago.metodoPago,
      fecha_pago: datosPago.fecha,
      mes_correspondiente: datosPago.mesCorrespondiente,
      registrado_por: usuario ? usuario.id : null,
      observaciones: datosPago.observaciones,
    };

    const { error: errorPago } = await supabase.from('pagos').insert(registroPago);
    if (errorPago) throw errorPago;

    // Sincronizar ingreso en finanzas (no cancela el pago si falla)
    try {
      const tipoLabel = datosPago.tipoPago === 'pago_completo' ? 'Pago completo' : 'Abono';
      const obsFinanza = [tipoLabel, datosPago.observaciones].filter(Boolean).join(' — ');
      await supabase.from('finanzas').insert({
        tipo: 'ingreso',
        concepto: `Arriendo ${datosPago.mesCorrespondiente} — ${arrendatario.nombre}`,
        valor: datosPago.valor,
        fecha: datosPago.fecha,
        categoria: 'arriendo',
        habitacion_id: arrendatario.habitacion_id || null,
        arrendatario_id: arrendatario.id,
        metodo_pago: datosPago.metodoPago,
        registrado_por: usuario ? usuario.nombre : null,
        observaciones: obsFinanza || null,
      });
    } catch (errFinanza) {
      console.error('Error al sincronizar pago en finanzas:', errFinanza);
    }

    if (datosPago.tipoPago === 'pago_completo') {
      const nuevaFechaVencimiento = sumarUnMes(arrendatario.fecha_vencimiento);

      const { error: errorUpdate } = await supabase
        .from('arrendatarios')
        .update({
          estado_pago: 'al_dia',
          saldo_pendiente: 0,
          abono_recibido: 0,
          metodo_pago: datosPago.metodoPago,
          fecha_vencimiento: nuevaFechaVencimiento,
        })
        .eq('id', arrendatario.id);
      if (errorUpdate) throw errorUpdate;

      mostrarToast(`¡Pago registrado! Próximo vencimiento: ${formatearFechaCorta(nuevaFechaVencimiento)} ✅`);
    } else {
      const nuevoAbono = (arrendatario.abono_recibido || 0) + datosPago.valor;
      const nuevoSaldo = Math.max(arrendatario.valor_arriendo - nuevoAbono, 0);

      const { error: errorUpdate } = await supabase
        .from('arrendatarios')
        .update({
          abono_recibido: nuevoAbono,
          saldo_pendiente: nuevoSaldo,
          estado_pago: 'pendiente',
        })
        .eq('id', arrendatario.id);
      if (errorUpdate) throw errorUpdate;

      mostrarToast(`Abono registrado. Resta: ${formatearPrecio(nuevoSaldo)} ⏳`);
    }

    cerrarModales();
    await cargarArrendatarios();
  } catch (error) {
    console.error('Error al registrar pago:', error);
    mostrarToast(`Error al registrar pago: ${error.message || 'ocurrió un problema inesperado.'}`, true);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Registrar pago';
  }
}

async function darBaja(id) {
  const arrendatario = arrendatarioSeleccionado;

  try {
    const { error } = await supabase
      .from('arrendatarios')
      .update({ activo: false, habitacion_id: null })
      .eq('id', id);
    if (error) throw error;

    if (arrendatario && arrendatario.habitacion_id) {
      await supabase.from('habitaciones').update({ estado: 'disponible' }).eq('id', arrendatario.habitacion_id);
      const hab = arrendatario.habitaciones;
      const habStr = hab
        ? `${hab.tipo === 'apartamento' ? 'Apartamento' : 'Habitación'} ${hab.numero} disponible.`
        : 'Habitación liberada.';
      mostrarToast(`✅ ${arrendatario.nombre} dado de baja. ${habStr}`);
    } else {
      mostrarToast(`✅ ${arrendatario.nombre} dado de baja.`);
    }
    cerrarModales();
    await cargarArrendatarios();
  } catch (error) {
    console.error('Error al dar de baja:', error);
    mostrarToast(`Error al dar de baja: ${error.message || 'ocurrió un problema inesperado.'}`, true);
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
  arrendatarioEditandoId = null;
  arrendatarioSeleccionado = null;
  habitacionAnteriorEditando = null;
}

export { cargarArrendatarios as recargarArrendatarios };
