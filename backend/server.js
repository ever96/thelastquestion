import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import { BIBLIA_DEL_CASO, EVIDENCIAS, FINAL_VICTORIA } from './caso.js';
import { sanearEstado, aplicarTurno, limitesParaIA, IDS_EVIDENCIA, DISPOSICIONES, GESTOS } from './reglas.js';

// Variables de entorno (en local lee .env; en Railway, el panel)
dotenv.config();

const requiredEnv = ['GROQ_API_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Faltan variables de entorno: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const MODELO = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const port = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

const app = express();
app.set('trust proxy', 1); // Railway está detrás de un proxy: necesario para leer la IP real

// ---------- CORS ----------
// En Railway define ALLOWED_ORIGINS, por ejemplo:
//   ALLOWED_ORIGINS=https://tu-juego.vercel.app,http://localhost:5173
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (allowed.length === 0) {
  console.warn('⚠ ALLOWED_ORIGINS no está definido: se aceptan peticiones de cualquier origen.');
}
app.use(cors({
  origin: allowed.length ? allowed : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '50kb' }));

// ---------- Límite de peticiones (en memoria, por IP) ----------
function limitador({ ventanaMs, maximo }) {
  const hits = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [ip, h] of hits) if (ahora - h.inicio > ventanaMs) hits.delete(ip);
  }, ventanaMs).unref();
  return (req, res, next) => {
    const ip = req.ip || 'desconocida';
    const ahora = Date.now();
    const h = hits.get(ip);
    if (!h || ahora - h.inicio > ventanaMs) {
      hits.set(ip, { inicio: ahora, n: 1 });
      return next();
    }
    if (++h.n > maximo) {
      return res.status(429).json({ error: 'Demasiadas preguntas seguidas. Espera un momento.' });
    }
    next();
  };
}

app.get('/', (req, res) => res.send('Backend OK'));
app.get('/api/salud', (req, res) => res.json({ ok: true, modelo: MODELO }));

// ==========================================
// INTERROGATORIO
// ==========================================
const MAX_PREGUNTA = 400;
const MAX_HISTORIAL = 16;

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

async function preguntarAlModelo(messages) {
  const base = {
    model: MODELO,
    messages,
    temperature: 0.8,
    max_completion_tokens: 1500,
    reasoning_effort: 'low', // gpt-oss: razonamiento corto = respuestas rápidas
  };
  let intento = 0;
  let ultimoError;
  while (intento < 2) {
    intento++;
    try {
      const completion = await groq.chat.completions.create({
        ...base,
        response_format: { type: 'json_object' },
      });
      const json = extraerJSON(completion.choices?.[0]?.message?.content);
      if (json && typeof json.dialogo === 'string' && json.dialogo.trim()) return json;
      ultimoError = new Error('La IA devolvió un JSON inválido');
    } catch (err) {
      ultimoError = err;
      // Si el modelo rechaza el modo JSON, se reintenta sin él
      if (err?.status === 400 && intento === 1) {
        try {
          const completion = await groq.chat.completions.create(base);
          const json = extraerJSON(completion.choices?.[0]?.message?.content);
          if (json && typeof json.dialogo === 'string') return json;
        } catch (err2) {
          ultimoError = err2;
        }
      }
    }
  }
  throw ultimoError;
}

app.post('/api/interact', limitador({ ventanaMs: 60_000, maximo: 20 }), async (req, res) => {
  const pregunta = typeof req.body?.pregunta === 'string' ? req.body.pregunta.trim().slice(0, MAX_PREGUNTA) : '';
  const evidencia = IDS_EVIDENCIA.includes(req.body?.evidencia) ? req.body.evidencia : null;
  const estado = sanearEstado(req.body?.estado);

  if (!pregunta && !evidencia) {
    return res.status(400).json({ error: 'Falta la pregunta.' });
  }

  const textoDetective = evidencia
    ? `*Pone sobre la mesa: ${EVIDENCIAS[evidencia].nombre}* ${pregunta || '¿Me lo explicas?'}`
    : pregunta;

  const messages = [
    { role: 'system', content: construirPromptSistema(estado, evidencia) },
    ...sanearHistorial(req.body?.historial),
    { role: 'user', content: textoDetective },
  ];

  try {
    const propuesta = await preguntarAlModelo(messages);
    const turno = aplicarTurno(estado, propuesta, evidencia);
    res.json({
      dialogo: String(propuesta.dialogo).slice(0, 700),
      disposicion: turno.disposicion,
      gesto: turno.gesto,
      estado: turno.estado,
      cambios: turno.cambios,
      resuelto: turno.resuelto,
      final: turno.resuelto ? FINAL_VICTORIA : null,
    });
  } catch (error) {
    console.error('Error en Groq:', error?.message || error);
    res.status(502).json({ error: 'El sospechoso no responde (error con la IA).' });
  }
});

// ==========================================
// NOTAS (Supabase, opcional)
// ==========================================
app.post('/api/notes', limitador({ ventanaMs: 60_000, maximo: 15 }), async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 300) : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.slice(0, 40) : 'Observación';
  if (!text) return res.status(400).json({ error: 'Nota vacía.' });

  const local = { id: Date.now(), text, category };
  if (!supabase) return res.json(local);
  try {
    const { data, error } = await supabase.from('notes').insert([{ text, category }]).select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.warn('No se pudo guardar en Supabase:', error.message);
    res.json(local);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor backend en el puerto ${port} · modelo ${MODELO}`);
});
