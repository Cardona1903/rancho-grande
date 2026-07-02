import supabase from './supabase.js';

let realtimeChannel = null;

export function initRealtime(onCambio) {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel('rancho-grande-cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'arrendatarios' },
      payload => onCambio('arrendatarios', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habitaciones' },
      payload => onCambio('habitaciones', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' },
      payload => onCambio('pagos', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'finanzas' },
      payload => onCambio('finanzas', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'aseo_turnos' },
      payload => onCambio('aseo_turnos', payload))
    .subscribe((status) => {
      console.log('Realtime status:', status);
    });
}

export function detenerRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

export function generarMensajeRealtime(tabla, payload) {
  const evento = payload.eventType;
  const datos  = payload.new || payload.old || {};

  switch (tabla) {
    case 'arrendatarios':
      if (evento === 'INSERT') return `👤 ${datos.nombre || 'Nuevo arrendatario'} fue registrado`;
      if (evento === 'UPDATE') return `👤 ${datos.nombre || 'Arrendatario'} fue actualizado`;
      if (evento === 'DELETE') return `👤 Un arrendatario fue dado de baja`;
      break;
    case 'habitaciones':
      if (evento === 'INSERT') return `🏠 Nueva habitación agregada`;
      if (evento === 'UPDATE') return `🏠 Habitación actualizada`;
      if (evento === 'DELETE') return `🏠 Habitación eliminada`;
      break;
    case 'pagos':
      if (evento === 'INSERT') {
        const val = datos.valor ? `$${Number(datos.valor).toLocaleString('es-CO')}` : '';
        return `💰 Se registró un pago ${val}`;
      }
      break;
    case 'finanzas':
      if (evento === 'INSERT') {
        const val = datos.valor ? `$${Number(datos.valor).toLocaleString('es-CO')}` : '';
        return datos.tipo === 'ingreso' ? `📈 Nuevo ingreso: ${val}` : `📉 Nuevo gasto: ${val}`;
      }
      if (evento === 'DELETE') return `🗑️ Registro de finanzas eliminado`;
      break;
    case 'aseo_turnos':
      return `🧹 Turnos de aseo actualizados`;
  }
  return null;
}

export async function solicitarPermisoNotificaciones() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function mostrarNotificacionLocal(titulo, cuerpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then(reg => reg.showNotification(titulo, { body: cuerpo, icon: 'icons/icon-192.png' }))
    .catch(() => {});
}

// ─── Web Push (background, app cerrada) ───────────────────────────────────────

const VAPID_PUBLIC_KEY = 'BC1gXNv3b4Rh0PGgBmtJexMIkTtt01KexywhYM1gVev5nmaDSj5EhbY4WPl_MSIC9tDwAq4_3uTIroTcFJxKaj8';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function suscribirPush() {
  if (!('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = sub.toJSON();
    const supabaseModule = await import('./supabase.js');
    await supabaseModule.default
      .from('push_subscriptions')
      .upsert({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        usuario_id: localStorage.getItem('ranchgrande_usuario')
      }, { onConflict: 'endpoint' });
  } catch (e) {
    console.warn('Push subscription failed:', e);
  }
}

export async function notificarCambio(titulo, cuerpo) {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, cuerpo })
    });
  } catch (e) { /* silencioso */ }
}
