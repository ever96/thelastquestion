// ============================================================
// REGLAS DEL JUEGO
// La IA actúa y propone; el servidor decide qué está permitido.
// Así nadie gana escribiendo "confiesa todo" en el primer turno.
// ============================================================

export const NIVELES = ['DESCONOCIDO', 'CONFIRMADO', 'CONFESADO'];
export const DISPOSICIONES = ['CALMADO', 'NERVIOSO', 'IRRITADO', 'HOSTIL', 'CERRADO', 'QUEBRADO'];
export const GESTOS = ['NEUTRO', 'EVITA_MIRADA', 'SE_INCLINA', 'GOLPE_MESA', 'NIEGA', 'RIE', 'SE_DERRUMBA'];
export const IDS_EVIDENCIA = ['foto_bar', 'recibo_taxi', 'mensaje_laura'];

// Qué hace falta para avanzar cada secreto
export const REQUISITOS = {
  A: {
    // Obsesión: hay que ubicarlo en casa de Laura o mostrar que ella lo acusaba
    CONFIRMADO: { algunaDe: ['recibo_taxi', 'mensaje_laura'], estres: 0 },
    CONFESADO: { todas: ['recibo_taxi', 'mensaje_laura'], estres: 60 },
  },
  B: {
    // Tráfico: la foto del callejón o el mensaje sobre el depósito
    CONFIRMADO: { algunaDe: ['foto_bar', 'mensaje_laura'], estres: 0 },
    CONFESADO: { todas: ['foto_bar', 'mensaje_laura'], estres: 65 },
  },
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const nivel = (v) => Math.max(0, NIVELES.indexOf(v));

// Normaliza el estado que manda el cliente (nunca confiar en él a ciegas)
export function sanearEstado(raw = {}) {
  const evidencias = Array.isArray(raw.evidencias)
    ? [...new Set(raw.evidencias.filter((e) => IDS_EVIDENCIA.includes(e)))]
    : [];
  return {
    estres: clamp(Number(raw.estres) || 0, 0, 100),
    secretoA: NIVELES.includes(raw.secretoA) ? raw.secretoA : 'DESCONOCIDO',
    secretoB: NIVELES.includes(raw.secretoB) ? raw.secretoB : 'DESCONOCIDO',
    evidencias,
  };
}

function cumple(req, evidencias, estres) {
  if (!req) return false;
  if (estres < req.estres) return false;
  if (req.todas && !req.todas.every((e) => evidencias.includes(e))) return false;
  if (req.algunaDe && !req.algunaDe.some((e) => evidencias.includes(e))) return false;
  return true;
}

// Nivel máximo que un secreto puede alcanzar EN ESTE TURNO (sube de a un paso)
export function maximoPermitido(clave, actual, evidencias, estres) {
  const idx = nivel(actual);
  const siguiente = NIVELES[idx + 1];
  if (!siguiente) return actual;
  return cumple(REQUISITOS[clave][siguiente], evidencias, estres) ? siguiente : actual;
}

// Qué pruebas tocan cada secreto (mostrarlas lo acorrala sobre ese secreto)
const PRUEBAS_DE = { A: ['recibo_taxi', 'mensaje_laura'], B: ['foto_bar', 'mensaje_laura'] };
// Palabras que indican de qué secreto habla la pregunta
const TEMAS = {
  A: /laura|lau\b|casa|depart|7b|mirador|llave|bufanda|segu[ií]|foto|obses|martes|amor|gust|ella/i,
  B: /dep[oó]sito|mochila|ben[ií]tez|gorra|droga|pastill|oxicod|caja|mercader|auto gris|callej|vend|tr[aá]fico/i,
};
// Con este estrés y el secreto confesable, Carter se quiebra sí o sí
const ESTRES_QUIEBRE = 90;

const NOMBRES = {
  A: 'A (obsesión con Laura: la seguía, copió sus llaves, entró a su casa, la bufanda)',
  B: 'B (tráfico de oxicodona en el depósito, Benítez, la mochila)',
};
const QUE_ADMITIR = {
  A: 'que Laura le gustaba más de lo que dijo y que la conocía bien (NO menciones seguirla, las llaves, la bufanda ni haber entrado a su casa)',
  B: 'que salió por atrás del bar y le dio una mochila a un conocido (NO digas qué había dentro ni el nombre de Benítez)',
};
const QUE_CONFESAR = {
  A: 'que estaba obsesionado con Laura, que la seguía, que copió sus llaves y entró a su casa el martes',
  B: 'que guarda oxicodona robada en el depósito, que se la pasa Benítez, y que esa noche le dio la mochila con la mercadería',
};

// Estrés con el que se evalúan los umbrales en este turno (el mismo que ve la IA)
export function estresParaUmbral(estado, evidenciaNueva) {
  const esNueva = evidenciaNueva && !estado.evidencias.includes(evidenciaNueva);
  return clamp(estado.estres + (esNueva ? 12 : 4), 0, 100);
}

// Calcula, ANTES de llamar a la IA, qué debe pasar con cada secreto en este turno:
//   forzado: el nivel al que pasa sí o sí (por pruebas o por quiebre)
//   maximo:  el nivel máximo que la IA puede elegir
export function objetivosDelTurno(estado, evidenciaNueva, pregunta = '') {
  const evidencias = evidenciaNueva && !estado.evidencias.includes(evidenciaNueva)
    ? [...estado.evidencias, evidenciaNueva]
    : estado.evidencias;
  const estres = estresParaUmbral(estado, evidenciaNueva);
  const res = {};
  for (const clave of ['A', 'B']) {
    const actual = clave === 'A' ? estado.secretoA : estado.secretoB;
    const maximo = maximoPermitido(clave, actual, evidencias, estres);
    let forzado = null;
    const pruebaRelevante = evidenciaNueva && PRUEBAS_DE[clave].includes(evidenciaNueva);
    // Una prueba que lo acorrala confirma el secreto automáticamente
    if (actual === 'DESCONOCIDO' && maximo === 'CONFIRMADO' && pruebaRelevante) forzado = 'CONFIRMADO';
    // Con el secreto confesable y el estrés al límite, se quiebra
    if (maximo === 'CONFESADO' && estres >= ESTRES_QUIEBRE) forzado = 'CONFESADO';
    res[clave] = { actual, maximo, forzado };
  }
  // Una sola confesión por turno: la del secreto al que apunta la prueba o la pregunta
  const confesables = ['A', 'B'].filter((c) => res[c].maximo === 'CONFESADO' && res[c].actual !== 'CONFESADO');
  if (confesables.length === 2) {
    const tema = (c) => (evidenciaNueva && PRUEBAS_DE[c].includes(evidenciaNueva) && evidenciaNueva !== 'mensaje_laura' ? 2 : 0)
      + (TEMAS[c].test(pregunta) ? 1 : 0);
    const elegido = tema('B') > tema('A') ? 'B' : 'A';
    const otro = elegido === 'A' ? 'B' : 'A';
    res[otro].maximo = res[otro].actual; // el otro espera al próximo turno
    if (res[otro].forzado === 'CONFESADO') res[otro].forzado = null;
  }
  return res;
}

// Aplica la propuesta de la IA respetando las reglas
export function aplicarTurno(estado, propuesta, evidenciaNueva, pregunta = '') {
  const obj = objetivosDelTurno(estado, evidenciaNueva, pregunta);
  const evidencias = [...estado.evidencias];
  const esNueva = evidenciaNueva && !evidencias.includes(evidenciaNueva);
  if (esNueva) evidencias.push(evidenciaNueva);

  // Estrés: la IA puntúa la presión de la pregunta; mostrar pruebas nuevas pesa más
  let delta = clamp(Math.round(Number(propuesta.presion) || 0), -8, 12);
  if (esNueva) delta += 12;
  else if (evidenciaNueva) delta += 2;
  let estres = clamp(estado.estres + delta, 0, 100);

  const decidir = (clave, propuestaIA) => {
    const { actual, maximo, forzado } = obj[clave];
    if (forzado) return forzado;
    const propuesto = NIVELES.includes(propuestaIA) ? propuestaIA : actual;
    return NIVELES[clamp(nivel(propuesto), nivel(actual), nivel(maximo))];
  };
  const secretoA = decidir('A', propuesta.estado_secreto_A);
  const secretoB = decidir('B', propuesta.estado_secreto_B);

  let disposicion = DISPOSICIONES.includes(propuesta.disposicion) ? propuesta.disposicion : 'CALMADO';
  let gesto = GESTOS.includes(propuesta.gesto) ? propuesta.gesto : 'NEUTRO';
  const confesoAlgo = (secretoA === 'CONFESADO' && estado.secretoA !== 'CONFESADO')
    || (secretoB === 'CONFESADO' && estado.secretoB !== 'CONFESADO');
  // Después de confesar, se descarga un poco la tensión (deja margen para el otro secreto)
  if (confesoAlgo) estres = clamp(estres - 15, 0, 100);
  const resuelto = secretoA === 'CONFESADO' && secretoB === 'CONFESADO';
  if (resuelto) {
    disposicion = 'QUEBRADO';
    gesto = 'SE_DERRUMBA';
  } else if (confesoAlgo) {
    disposicion = 'QUEBRADO';
    gesto = 'EVITA_MIRADA';
  }

  return {
    estado: { estres, secretoA, secretoB, evidencias },
    disposicion,
    gesto,
    resuelto,
    cambios: {
      A: secretoA !== estado.secretoA ? secretoA : null,
      B: secretoB !== estado.secretoB ? secretoB : null,
    },
  };
}

// Instrucciones dinámicas para la IA en este turno (coinciden con lo que aplicará el servidor)
export function limitesParaIA(estado, evidenciaNueva, pregunta = '') {
  const obj = objetivosDelTurno(estado, evidenciaNueva, pregunta);
  const describe = (clave) => {
    const { actual, maximo, forzado } = obj[clave];
    const n = `Secreto ${NOMBRES[clave]}`;
    if (actual === 'CONFESADO') return `${n}: YA LO CONFESASTE. Si te preguntan, hablas de ello con resignación y detalles.`;
    if (forzado === 'CONFESADO') return `${n}: ESTÁS QUEBRADO. En ESTA respuesta CONFIESAS ${QUE_CONFESAR[clave]}. Habla entrecortado. Marca estado CONFESADO.`;
    if (forzado === 'CONFIRMADO') return `${n}: esta prueba te acorrala. ADMITE a medias ${QUE_ADMITIR[clave]}, con una excusa (sin confesar lo grave). Marca estado CONFIRMADO.`;
    if (maximo === 'CONFESADO') return `${n}: estás al borde. Si la pregunta apunta a este secreto y te presiona bien, CONFIÉSALO (${QUE_CONFESAR[clave]}) y marca CONFESADO. Si es floja, resiste con excusas temblorosas.`;
    if (actual === 'CONFIRMADO') return `${n}: el detective ya sabe parte. Sostén tu excusa, admite solo lo innegable, NO confieses lo grave en esta respuesta.`;
    return `${n}: el detective NO tiene pruebas. NO lo admitas ni lo insinúes; si preguntan, responde con tu versión falsa.`;
  };
  return [describe('A'), describe('B')].join('\n');
}
