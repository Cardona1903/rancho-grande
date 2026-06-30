import { USUARIOS, getUsuario, setUsuario, cerrarSesion } from './auth.js';
import { actualizarBannerOffline, sincronizarPendientes } from './offline.js';
import { initRealtime, detenerRealtime, generarMensajeRealtime, solicitarPermisoNotificaciones } from './notificaciones.js';
import supabase from './supabase.js';
import { initHabitaciones, recargarHabitaciones } from './habitaciones.js';
import { initArrendatarios, recargarArrendatarios } from './arrendatarios.js';
import { initAseo, recargarAseo } from './aseo.js';
import { initFinanzas, recargarFinanzas } from './finanzas.js';
import { initInicio } from './inicio.js';
import { exportarExcel } from './exportar.js';

let realtimeActivo = false;

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

// ─── Toast global para cambios Realtime ──────────────────────────────────────

function mostrarToastGlobal(mensaje) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  if (toast.style.display === 'block') {
    setTimeout(() => mostrarToastGlobal(mensaje), 500);
    return;
  }

  toast.textContent = mensaje;
  toast.className = 'toast toast-realtime';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
    toast.className = 'toast';
  }, 3000);
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
    card.addEventListener('click', () => {
      setUsuario(usuario.id);
      iniciarSesionUI();
    });
    contenedor.appendChild(card);
  });
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
      exportarExcel(mostrarToastGlobal);
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

  renderLogin();
  iniciarSesionUI();
  inicializarNavegacion();
  inicializarConfiguracion();

  solicitarPermisoNotificaciones();

  initHabitaciones();
  initArrendatarios();
  initAseo();
  initFinanzas();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Error al registrar el service worker:', error);
    });
  }
});
