const DB_NAME = 'ranchgrande-offline';
const DB_VERSION = 1;
const STORE_PENDIENTES = 'acciones_pendientes';

export function estaOnline() {
  return navigator.onLine;
}

export function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PENDIENTES)) {
        db.createObjectStore(STORE_PENDIENTES, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function guardarPendiente(accion, tabla, datos) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORE_PENDIENTES);
    const registro = { accion, tabla, datos, timestamp: Date.now() };
    const request = store.add(registro);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function obtenerPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDIENTES, 'readonly');
    const store = tx.objectStore(STORE_PENDIENTES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function eliminarPendiente(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDIENTES, 'readwrite');
    const store = tx.objectStore(STORE_PENDIENTES);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function sincronizarPendientes(supabase) {
  if (!estaOnline()) return;

  const pendientes = await obtenerPendientes();

  for (const pendiente of pendientes) {
    const { id, accion, tabla, datos } = pendiente;
    try {
      if (accion === 'INSERT') {
        await supabase.from(tabla).insert(datos);
      } else if (accion === 'UPDATE') {
        await supabase.from(tabla).update(datos.cambios).eq('id', datos.id);
      } else if (accion === 'DELETE') {
        await supabase.from(tabla).delete().eq('id', datos.id);
      }
      await eliminarPendiente(id);
    } catch (error) {
      console.error('Error al sincronizar pendiente', pendiente, error);
    }
  }
}

export function actualizarBannerOffline() {
  const banner = document.getElementById('banner-offline');
  if (!banner) return;
  banner.style.display = estaOnline() ? 'none' : 'block';
}
