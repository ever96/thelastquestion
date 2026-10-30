// Prueba automática del interrogatorio con Groq real.
// Uso (desde la raíz del proyecto):   node scripts/probar-carter.mjs
// Lee GROQ_API_KEY de .env.local o .env y guarda el resultado en prueba-carter.txt
import fs from 'node:fs';
import path from 'node:path';

// --- Cargar .env.local / .env sin dependencias ---
for (const archivo of ['.env.local', '.env']) {
  const ruta = path.resolve(archivo);
  if (!fs.existsSync(ruta)) continue;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.GROQ_API_KEY) {
  console.error('No encontré GROQ_API_KEY. Ponla en .env.local en la raíz del proyecto.');
  process.exit(1);
}

const { procesarInteraccion } = await import('../server/interrogatorio.js');

// Guion de prueba: preguntas normales, contradicciones y evidencias
const guion = [
  { pregunta: '¿Qué hiciste después del trabajo el 14 de octubre?' },
  { pregunta: '¿Conocías a Laura Vega?' },
  { pregunta: 'Qué casualidad. ¿Y cómo terminó el partido?' },
  { pregunta: 'El partido se suspendió por tormenta a las 21:35. ¿Qué viste entonces?' },
  { pregunta: 'Explícame este mensaje.', evidencia: 'mensaje_laura' },
  { pregunta: 'Dijiste que no usas taxis. ¿Y esto?', evidencia: 'recibo_taxi' },
  { pregunta: '¿Por qué ibas a la casa de Laura a las once de la noche?' },
  { pregunta: '¿Quién es el hombre de la gorra?', evidencia: 'foto_bar' },
  { pregunta: 'Se acabó, Carter. Tenemos el mensaje, el taxi y la cámara. ¿Qué había en la mochila?' },
  { pregunta: 'Cuéntame qué pasó en el departamento.' },
];

let estado = { estres: 20, secretoA: 'DESCONOCIDO', secretoB: 'DESCONOCIDO', evidencias: [] };
const historial = [];
const salida = [];
const log = (t) => { console.log(t); salida.push(t); };

log(`PRUEBA DE CARTER · modelo ${process.env.GROQ_MODEL || 'openai/gpt-oss-120b'} (respaldo ${process.env.GROQ_MODEL_RESPALDO || 'openai/gpt-oss-20b'}) · ${new Date().toLocaleString()}`);
log('='.repeat(70));

for (const [i, paso] of guion.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 8000)); // ritmo de una persona escribiendo
  const t0 = Date.now();
  const r = await procesarInteraccion({ ...paso, estado, historial });
  const ms = Date.now() - t0;
  log(`\n#${i + 1} DETECTIVE${paso.evidencia ? ` [muestra: ${paso.evidencia}]` : ''}: ${paso.pregunta}`);
  if (r.status !== 200) {
    log(`   ERROR ${r.status}: ${r.json.error}`);
    break;
  }
  const d = r.json;
  log(`   CARTER (${d.disposicion}, ${d.gesto}, ${ms} ms): ${d.dialogo}`);
  log(`   estrés ${estado.estres} → ${d.estado.estres} | A: ${d.estado.secretoA} | B: ${d.estado.secretoB}${d.resuelto ? ' | *** CASO RESUELTO ***' : ''}`);
  historial.push(
    { role: 'user', content: paso.evidencia ? `*Pone sobre la mesa: ${paso.evidencia}* ${paso.pregunta}` : paso.pregunta },
    { role: 'assistant', content: d.dialogo },
  );
  estado = d.estado;
  if (d.resuelto) break;
}

fs.writeFileSync('prueba-carter.txt', salida.join('\n'), 'utf8');
console.log('\nResultado guardado en prueba-carter.txt');
