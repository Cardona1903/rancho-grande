// js/toast.js — estilos 100% inline, sin dependencia de CSS
export function mostrarToast(mensaje, tipo = 'info', duracion = 3000) {
  if (tipo === true)  tipo = 'error';
  if (tipo === false) tipo = 'info';

  const COLORES = {
    info:     '#323232',
    success:  '#2E7D32',
    error:    '#C62828',
    warning:  '#F57F17',
    realtime: '#1565C0',
  };
  const bg = COLORES[tipo] || COLORES.info;

  let contenedor = document.getElementById('toast-container');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toast-container';
    Object.assign(contenedor.style, {
      position:      'fixed',
      bottom:        '90px',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        '2147483647',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '8px',
      width:         '90%',
      maxWidth:      '360px',
      pointerEvents: 'none',
    });
    document.body.appendChild(contenedor);
  }

  const toast = document.createElement('div');
  toast.textContent = mensaje;
  Object.assign(toast.style, {
    background:   bg,
    color:        '#FFFFFF',
    padding:      '12px 20px',
    borderRadius: '24px',
    fontSize:     '0.95rem',
    fontWeight:   '600',
    textAlign:    'center',
    boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
    width:        '100%',
    opacity:      '0',
    transform:    'translateY(20px)',
    transition:   'opacity 0.3s ease, transform 0.3s ease',
    display:      'block',
    boxSizing:    'border-box',
  });

  contenedor.appendChild(toast);

  // Forzar reflow para que la transición parta desde opacity:0
  void toast.offsetHeight;

  toast.style.opacity   = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 350);
  }, duracion);
}

console.log('[toast.js] módulo cargado ✓');
