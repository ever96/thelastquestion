// Lógica del interrogatorio: arma el prompt, llama a Groq y aplica las reglas.
// Se usa desde las funciones de Vercel (carpeta /api) y desde `npm run dev`.
import { BIBLIA_DEL_CASO, EVIDENCIAS, FINAL_VICTORIA } from './caso.js';
import { sanearEstado, aplicarTurno, limitesParaIA, IDS_EVIDENCIA, DISPOSICIONES, GESTOS } from './reglas.js';

const MAX_PREGUNTA = 400;
const MAX_HISTORIAL = 16;

const modelo = () => process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const groqURL = () => (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1') + '/chat/completions';

function construirPromptSistema(estado, evidenciaNueva) {
  const vistas = estado.evidencias.map((id) => `- ${EVIDENCIAS[id].nombre}`).join('\n') || '- (ninguna todavía)';
  const nueva = evidenciaNueva
    ? `\n>>> EN ESTE TURNO EL DETECTIVE TE PONE DELANTE: ${EVIDENCIAS[evidenciaNueva].nombre}.\n${EVIDENCIAS[evidenciaNueva].contenido}\nReacciona a esta prueba concreta.\n`
    : '';

  return `${BIBLIA_DEL_CASO}

=== ESTADO ACTUAL DEL INTERROGATORIO ===
Tu nivel de estrés: ${estado.estres}/100.
Pruebas que el detective ya te mostró:
${vistas}
${nueva}
=== LÍMITES DE ESTE TURNO (obligatorios) ===
${limitesParaIA(estado, evidenciaNueva)}

=== FORMATO DE RESPUESTA ===
Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después:
{
  "dialogo": "lo que Carter dice en voz alta (máx. 3 oraciones, puede incluir una acción breve entre asteriscos)",
  "disposicion": uno de ${JSON.stringify(DISPOSICIONES.filter((d) => d !== 'QUEBRADO'))},
  "gesto": uno de ${JSON.stringify(GESTOS)},
  "presion": entero de -10 a 20 (cuánto te afectó la pregunta: -10 si fue amable/inútil, 0 neutra, 10 certera, 20 devastadora),
  "estado_secreto_A": "DESCONOCIDO" | "CONFIRMADO" | "CONFESADO",
  "estado_secreto_B": "DESCONOCIDO" | "CONFIRMADO" | "CONFESADO"
}
Elige el gesto que acompaña físicamente tu respuesta (GOLPE_MESA solo si estás furioso, SE_DERRUMBA solo si confiesas).`;
}

function sanearHistorial(historial) {
  if (!Array.isArray(historial)) return [];
  return historial
    .slice(-MAX_HISTORIAL)
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
}

function extraerJSON(texto) {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    const ini = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (ini === -1 || fin <= ini) return null;
    try {
      return JSON.parse(texto.slice(ini, fin + 1));
    } catch {
      return null;
    }
  }
}

// Llamada directa a la API de Groq (compatible con OpenAI), sin dependencias
async function llamarGroq(messages, modoJSON) {
  const r = await fetch(groqURL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelo(),
      messages,
      temperature: 0.8,
      max_completion_tokens: 1500,
      reasoning_effort: 'low', // gpt-oss: razonamiento corto = respuestas rápidas
      ...(modoJSON ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(datos?.error?.message || `Groq respondió ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return extraerJSON(datos.choices?.[0]?.message?.content);
}

async function preguntarAlModelo(messages) {
  let ultimoError;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const json = await llamarGroq(messages, true);
      if (json && typeof json.dialogo === 'string' && json.dialogo.trim()) return json;
      ultimoError = new Error('La IA devolvió un JSON inválido');
    } catch (err) {
      ultimoError = err;
      if (err.status === 401) break; // clave inválida: no tiene sentido reintentar
      // Si el modelo rechaza el modo JSON, se reintenta sin él
      if (err.status === 400) {
        try {
          const json = await llamarGroq(messages, false);
          if (json && typeof json.dialogo === 'string') return json;
        } catch (err2) {
          ultimoError = err2;
        }
      }
    }
  }
  throw ultimoError;
}

// Devuelve { status, json } para que cada entorno lo envíe como quiera
export async function procesarInteraccion(body = {}) {
  if (!process.env.GROQ_API_KEY) {
    return { status: 500, json: { error: 'Falta GROQ_API_KEY en las variables de entorno.' } };
  }
  const pregunta = typeof body.pregunta === 'string' ? body.pregunta.trim().slice(0, MAX_PREGUNTA) : '';
  const evidencia = IDS_EVIDENCIA.includes(body.evidencia) ? body.evidencia : null;
  const estado = sanearEstado(body.estado);

  if (!pregunta && !evidencia) return { status: 400, json: { error: 'Falta la pregunta.' } };

  const textoDetective = evidencia
    ? `*Pone sobre la mesa: ${EVIDENCIAS[evidencia].nombre}* ${pregunta || '¿Me lo explicas?'}`
    : pregunta;

  const messages = [
    { role: 'system', content: construirPromptSistema(estado, evidencia) },
    ...sanearHistorial(body.historial),
    { role: 'user', content: textoDetective },
  ];

  try {
    const propuesta = await preguntarAlModelo(messages);
    const turno = aplicarTurno(estado, propuesta, evidencia);
    return {
      status: 200,
      json: {
        dialogo: String(propuesta.dialogo).slice(0, 700),
        disposicion: turno.disposicion,
        gesto: turno.gesto,
        estado: turno.estado,
        cambios: turno.cambios,
        resuelto: turno.resuelto,
        final: turno.resuelto ? FINAL_VICTORIA : null,
      },
    };
  } catch (error) {
    console.error('Error con Groq:', error?.status, error?.message);
    const msg = error?.status === 401
      ? 'La clave de Groq no es válida (revisa GROQ_API_KEY).'
      : error?.status === 429
        ? 'Groq está saturado o se alcanzó el límite. Prueba en unos segundos.'
        : 'El sospechoso no responde (error con la IA).';
    return { status: 502, json: { error: msg } };
  }
}

// Notas: se guardan en Supabase si está configurado (REST, sin dependencias)
export async function guardarNota(body = {}) {
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 300) : '';
  const category = typeof body.category === 'string' ? body.category.slice(0, 40) : 'Observación';
  if (!text) return { status: 400, json: { error: 'Nota vacía.' } };

  const local = { id: Date.now(), text, category };
  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) return { status: 200, json: local };
  try {
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/notes`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([{ text, category }]),
    });
    if (!r.ok) throw new Error(`Supabase respondió ${r.status}`);
    const datos = await r.json();
    return { status: 200, json: datos[0] || local };
  } catch (error) {
    console.warn('No se pudo guardar en Supabase:', error.message);
    return { status: 200, json: local };
  }
}

export function salud() {
  return { status: 200, json: { ok: true, modelo: modelo(), groq: Boolean(process.env.GROQ_API_KEY) } };
}

// Límite simple de peticiones por IP (por instancia; suficiente para frenar abusos)
const hits = new Map();
export function limitar(ip, maximo = 20, ventanaMs = 60_000) {
  const ahora = Date.now();
  const h = hits.get(ip);
  if (!h || ahora - h.inicio > ventanaMs) {
    hits.set(ip, { inicio: ahora, n: 1 });
    if (hits.size > 5000) hits.clear();
    return true;
  }
  return ++h.n <= maximo;
}
