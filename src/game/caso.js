// Datos PÚBLICOS del caso (lo que el detective sabe al empezar).
// La verdad completa está en backend/caso.js.

// Vacío = mismo dominio: Vercel (vercel.json) y Vite (vite.config.js) reenvían /api a Railway.
// Así el navegador nunca hace peticiones a otro dominio y no hay problemas de CORS.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Tiempo de juego: el abogado llega a las 02:40. Cada acción consume minutos.
export const TIEMPO = {
  inicioMin: 2 * 60 + 10, // 02:10
  limiteMin: 2 * 60 + 40, // 02:40
  costoPregunta: 2,
  costoEvidencia: 3,
};

// Para poner las fotos reales, guarda las imágenes en /public/evidencias/
// con estos mismos nombres. Si no existen, se dibuja una tarjeta provisional.
export const EVIDENCIAS = [
  {
    id: 'foto_bar',
    nombre: 'Foto Bar Central',
    icono: '📷',
    imagen: '/evidencias/foto_bar.jpg',
    hora: '22:08',
    descripcion: 'Cámara del callejón trasero del Bar Central. Un hombre sale por la puerta de servicio con una mochila negra y se la entrega a alguien junto a un auto gris.',
  },
  {
    id: 'recibo_taxi',
    nombre: 'Recibo de taxi',
    icono: '🧾',
    imagen: '/evidencias/recibo_taxi.jpg',
    hora: '22:34',
    descripcion: 'Radio Taxi Sur. Bar Central → Calle Ribera 1200 (Edificio Mirador). Llegada 22:51. Pagado con la tarjeta de débito de Elías Carter.',
  },
  {
    id: 'mensaje_laura',
    nombre: 'Mensaje de Laura',
    icono: '✉️',
    imagen: '/evidencias/mensaje_laura.jpg',
    hora: '21:42',
    descripcion: 'Registro de la compañía telefónica: SMS del celular de Laura Vega al número de Carter. "Vi lo que guardás en el depósito del bar. Y sé que fuiste vos el que entró a mi casa el martes..."',
  },
];

export const EXPEDIENTE = {
  numero: '409',
  victima: 'Laura Vega, 29 años, enfermera del Hospital San Rafael',
  lugar: 'Depto. 7B, Edificio Mirador — Calle Ribera 1200',
  hallazgo: '14 de octubre, 23:47 (vecina del 7A oyó un golpe)',
  causa: 'Traumatismo craneal contra mesa de vidrio. Signos de forcejeo. Cerradura sin forzar. Celular desaparecido.',
  sospechoso: 'Elías Carter, 41 años, encargado nocturno del Bar Central',
  antecedentes: 'Denuncia por acoso (2021), retirada por la denunciante.',
  coartada: '"Estuve en mi casa solo desde las 21:00, mirando el partido Cerro–Olimpia."',
  datos: [
    'El partido Cerro–Olimpia de esa noche se suspendió por tormenta a las 21:35.',
    'El teléfono de Carter no registra actividad entre las 21:45 y las 00:30.',
    'Ramiro (mozo del Bar Central) recibió la caja de manos de Carter a las 21:05.',
  ],
  objetivos: [
    'Rompe la coartada de Carter con las pruebas.',
    'Descubre su verdadera relación con Laura (Secreto A).',
    'Descubre qué esconde en el Bar Central (Secreto B).',
    'Consigue ambas confesiones antes de que llegue su abogado.',
  ],
};

export const NOTAS_INICIALES = [
  { id: 1, text: 'Afirma que estaba en su casa solo, pero no hay testigos.', category: 'Coartada' },
  { id: 2, text: 'Evita el contacto visual cuando se menciona el Bar Central.', category: 'Comportamiento' },
];

export const PRIMERA_LINEA = 'En mi casa, detective. Mirando el partido con una cerveza. ¿Eso es todo? Porque tengo un bar que abrir mañana.';

export const formatoHora = (min) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
