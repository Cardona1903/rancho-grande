import { USUARIOS, CODIGO_ACCESO, getUsuario, setUsuario, cerrarSesion } from './auth.js';
import { actualizarBannerOffline, sincronizarPendientes } from './offline.js';
import { initRealtime, detenerRealtime, generarMensajeRealtime, solicitarPermisoNotificaciones } from './notificaciones.js';
import supabase from './supabase.js';
import { initHabitaciones, recargarHabitaciones } from './habitaciones.js';
import { initArrendatarios, recargarArrendatarios } from './arrendatarios.js';
import { initAseo, recargarAseo } from './aseo.js';
import { initFinanzas, recargarFinanzas } from './finanzas.js';
import { initInicio } from './inicio.js';
import { abrirModalExportar, initExportar } from './exportar.js';
import { mostrarToast } from './toast.js';
export { mostrarToast };

let realtimeActivo = false;
let usuarioPendienteId = null;

// ─── Botón X en todos los modales ────────────────────────────────────────────

function inyectarBotonesClose() {
  document.querySelectorAll('.modal-overlay .modal').forEach(modal => {
    if (modal.querySelector('.modal-close-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'modal-close-btn';
    btn.setAttribute('aria-label', 'Cerrar');
    btn.innerHTML = '&times;';
    btn.addEventListener('click', () => {
      const overlay = modal.closest('.modal-overlay');
      if (overlay) overlay.style.display = 'none';
    });
    modal.prepend(btn);
  });
}

// ─── Navegación entre pantallas ───────────────────────────────────────────────

function mostrarScreen(nombre) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  const screen = document.getElementById(`screen-${nombre}`);
  if (screen) screen.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-screen="${nombre}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (nombre === 'inicio') initInicio();
}

function mostrarNavBar(mostrar) {
  const navBar = document.getElementById('nav-bar');
  if (navBar) navBar.style.display = mostrar ? 'flex' : 'none';
}

// ─── Toast para cambios Realtime ──────────────────────────────────────────────

function mostrarToastGlobal(mensaje) {
  mostrarToast(mensaje, 'realtime', 4000);
}

// ─── Recarga de la pantalla activa ────────────────────────────────────────────

function recargarPantallaActual(tabla) {
  const screenActiva = document.querySelector('.screen.active')?.id;
  if (!screenActiva) return;

  if (screenActiva === 'screen-inicio') {
    initInicio();
    return;
  }

  const MAPA = {
    habitaciones:  ['screen-habitaciones'],
    arrendatarios: ['screen-arrendatarios'],
    pagos:         ['screen-arrendatarios', 'screen-finanzas'],
    finanzas:      ['screen-finanzas'],
    aseo_turnos:   ['screen-aseo'],
  };

  if (!(MAPA[tabla] || []).includes(screenActiva)) return;

  const RECARGA = {
    'screen-habitaciones':  recargarHabitaciones,
    'screen-arrendatarios': recargarArrendatarios,
    'screen-aseo':          recargarAseo,
    'screen-finanzas':      recargarFinanzas,
  };

  const fn = RECARGA[screenActiva];
  if (fn) fn();
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

function iniciarRealtime() {
  if (realtimeActivo) return;
  realtimeActivo = true;

  initRealtime((tabla, payload) => {
    const usuario        = getUsuario();
    const registradoPor  = payload.new?.registrado_por ?? payload.old?.registrado_por;
    const esPropioCambio = registradoPor !== undefined && registradoPor === usuario?.id;

    if (!esPropioCambio) {
      const mensaje = generarMensajeRealtime(tabla, payload);
      if (mensaje) mostrarToastGlobal(mensaje);
    }

    recargarPantallaActual(tabla);
  });
}

function pararRealtime() {
  detenerRealtime();
  realtimeActivo = false;
}

// ─── Auth UI ──────────────────────────────────────────────────────────────────

function renderLogin() {
  const contenedor = document.getElementById('login-usuarios');
  contenedor.innerHTML = '';

  USUARIOS.forEach((usuario) => {
    const card = document.createElement('button');
    card.className = 'login-usuario-card';
    card.dataset.usuarioId = usuario.id;
    card.innerHTML = `<span class="login-usuario-avatar">👤</span><span>${usuario.nombre}</span>`;
    card.addEventListener('click', () => abrirModalCodigoAcceso(usuario.id));
    contenedor.appendChild(card);
  });
}

// ─── Código de acceso ─────────────────────────────────────────────────────────

function abrirModalCodigoAcceso(usuarioId) {
  usuarioPendienteId = usuarioId;
  const input = document.getElementById('input-codigo-acceso');
  const error = document.getElementById('codigo-error');
  if (input) input.value = '';
  if (error) error.style.display = 'none';
  const modal = document.getElementById('modal-codigo-acceso');
  if (modal) modal.style.display = 'flex';
  input?.focus();
}

function cerrarModalCodigoAcceso() {
  usuarioPendienteId = null;
  const modal = document.getElementById('modal-codigo-acceso');
  if (modal) modal.style.display = 'none';
}

function confirmarCodigoAcceso() {
  if (!usuarioPendienteId) return;
  const input = document.getElementById('input-codigo-acceso');
  const error = document.getElementById('codigo-error');
  if (!input) return;

  if (input.value === CODIGO_ACCESO) {
    setUsuario(usuarioPendienteId);
    cerrarModalCodigoAcceso();
    iniciarSesionUI();
  } else {
    if (error) error.style.display = 'block';
    input.value = '';
    input.focus();
  }
}

function renderConfiguracion() {
  const usuario = getUsuario();
  const contenedor = document.getElementById('configuracion-usuario');
  if (contenedor && usuario) {
    contenedor.innerHTML = `<p>Sesión activa: <strong>${usuario.nombre}</strong></p>`;
  }
}

function iniciarSesionUI() {
  const usuario = getUsuario();
  if (usuario) {
    iniciarRealtime();
    mostrarScreen('inicio');
    mostrarNavBar(true);
    renderConfiguracion();
  } else {
    pararRealtime();
    mostrarScreen('login');
    mostrarNavBar(false);
  }
}

// ─── Navegación y configuración global ───────────────────────────────────────

function inicializarNavegacion() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      mostrarScreen(btn.dataset.screen);
    });
  });
}

function inicializarConfiguracion() {
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-cerrar-sesion' || e.target.id === 'btn-salir-inicio') {
      cerrarSesion();
    }
    if (e.target.id === 'btn-ver-finanzas') {
      mostrarScreen('finanzas');
    }
    if (e.target.id === 'btn-exportar-excel') {
      abrirModalExportar();
    }
    if (e.target.id === 'btn-cancelar-codigo') {
      cerrarModalCodigoAcceso();
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'form-codigo-acceso') {
      e.preventDefault();
      confirmarCodigoAcceso();
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  actualizarBannerOffline();
  window.addEventListener('online', () => {
    actualizarBannerOffline();
    sincronizarPendientes(supabase);
  });
  window.addEventListener('offline', actualizarBannerOffline);

  inyectarBotonesClose();
  renderLogin();
  iniciarSesionUI();
  inicializarNavegacion();
  inicializarConfiguracion();

  solicitarPermisoNotificaciones();

  initHabitaciones();
  initArrendatarios();
  initExportar();
  initAseo();
  initFinanzas();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Error al registrar el service worker:', error);
    });
  }

  setTimeout(() => mostrarToast('Rancho Grande listo ✓', 'success'), 1500);
});
