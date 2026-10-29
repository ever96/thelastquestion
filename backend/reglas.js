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

// Estrés con el que se evalúan los umbrales de confesión en este turno
export function estresParaUmbral(estado, evidenciaNueva) {
  const esNueva = evidenciaNueva && !estado.evidencias.includes(evidenciaNueva);
  return clamp(estado.estres + (esNueva ? 15 : 5), 0, 100);
}

// Aplica la propuesta de la IA respetando las reglas
export function aplicarTurno(estado, propuesta, evidenciaNueva) {
  const evidencias = [...estado.evidencias];
  const esNueva = evidenciaNueva && !evidencias.includes(evidenciaNueva);
  if (esNueva) evidencias.push(evidenciaNueva);

  // Estrés: la IA puntúa la presión de la pregunta; mostrar pruebas nuevas pesa más
  let delta = clamp(Math.round(Number(propuesta.presion) || 0), -10, 20);
  if (esNueva) delta += 15;
  else if (evidenciaNueva) delta += 3; // volver a mostrar algo ya visto
  const estres = clamp(estado.estres + delta, 0, 100);

  // Los umbrales se evalúan con el mismo estrés estimado que se le comunicó a la IA,
  // así lo que Carter dice y lo que marca el juego siempre coinciden.
  const umbral = estresParaUmbral(estado, evidenciaNueva);
  const maxA = maximoPermitido('A', estado.secretoA, evidencias, umbral);
  const maxB = maximoPermitido('B', estado.secretoB, evidencias, umbral);
  const proponeA = NIVELES.includes(propuesta.estado_secreto_A) ? propuesta.estado_secreto_A : estado.secretoA;
  const proponeB = NIVELES.includes(propuesta.estado_secreto_B) ? propuesta.estado_secreto_B : estado.secretoB;

  // Nunca retrocede y nunca supera lo permitido
  const secretoA = NIVELES[clamp(nivel(proponeA), nivel(estado.secretoA), nivel(maxA))];
  const secretoB = NIVELES[clamp(nivel(proponeB), nivel(estado.secretoB), nivel(maxB))];

  let disposicion = DISPOSICIONES.includes(propuesta.disposicion) ? propuesta.disposicion : 'CALMADO';
  let gesto = GESTOS.includes(propuesta.gesto) ? propuesta.gesto : 'NEUTRO';
  const resuelto = secretoA === 'CONFESADO' && secretoB === 'CONFESADO';
  if (resuelto) {
    disposicion = 'QUEBRADO';
    gesto = 'SE_DERRUMBA';
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

// Instrucciones dinámicas para la IA en este turno
export function limitesParaIA(estado, evidenciaNueva) {
  const evid = evidenciaNueva && !estado.evidencias.includes(evidenciaNueva)
    ? [...estado.evidencias, evidenciaNueva]
    : estado.evidencias;
  const estresEst = estresParaUmbral(estado, evidenciaNueva);
  const maxA = maximoPermitido('A', estado.secretoA, evid, estresEst);
  const maxB = maximoPermitido('B', estado.secretoB, evid, estresEst);

  const describe = (clave, actual, max) => {
    const nombre = clave === 'A' ? 'A (obsesión con Laura, la llave, la bufanda)' : 'B (tráfico de oxicodona, Benítez, el depósito)';
    if (actual === 'CONFESADO') return `Secreto ${nombre}: YA LO CONFESASTE. Puedes hablar de ello con resignación.`;
    if (max === actual) {
      return actual === 'CONFIRMADO'
        ? `Secreto ${nombre}: el detective ya lo sospecha con fundamento, pero AÚN NO puedes confesarlo. Admite solo lo innegable, niega el resto.`
        : `Secreto ${nombre}: el detective no tiene pruebas. NIÉGALO por completo.`;
    }
    return max === 'CONFESADO'
      ? `Secreto ${nombre}: si la pregunta es certera y te presiona, PUEDES quebrarte y confesarlo (estado CONFESADO). Si es floja, resiste.`
      : `Secreto ${nombre}: si el detective lo plantea con la prueba, puedes admitir a medias que es cierto (estado CONFIRMADO), con excusas.`;
  };

  return [describe('A', estado.secretoA, maxA), describe('B', estado.secretoB, maxB)].join('\n');
}
