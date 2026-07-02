const STORAGE_KEY = 'ranchgrande_usuario';

export const CODIGO_ACCESO = '071019910170';

export const USUARIOS = [
  { id: 'sandro', nombre: 'Sandro Cuellar' },
  { id: 'elvira', nombre: 'Elvira Silva' },
  { id: 'sandra', nombre: 'Sandra Acosta' },
];

export function getUsuario() {
  const id = localStorage.getItem(STORAGE_KEY);
  if (!id) return null;
  return USUARIOS.find((u) => u.id === id) || null;
}

export function setUsuario(id) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}
