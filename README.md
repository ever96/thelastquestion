# The Last Question

Thriller de interrogatorio en 3D. Elías Carter es el único sospechoso de la muerte de Laura Vega.
Tienes hasta las 02:40, cuando llega su abogado, para conseguir dos confesiones.

## Cómo se juega

- Escribe preguntas libres. Carter lo interpreta una IA (`openai/gpt-oss-20b` en Groq).
- Abre una evidencia y pulsa **PRESENTAR** para ponerla sobre la mesa junto con tu pregunta.
- Cada pregunta cuesta 2 minutos y cada evidencia 3.
- **Secreto A (Obsesión)** y **Secreto B (Tráfico)** pasan de DESCONOCIDO → CONFIRMADO → CONFESADO.
  Las reglas las aplica el servidor (`server/reglas.js`): sin las pruebas correctas y suficiente
  estrés, Carter no puede confesar aunque se lo pidas.
- Ganas con ambas confesiones. Si el reloj llega a las 02:40, Carter queda libre.

## Estructura

```
api/                    funciones serverless de Vercel (backend)
  interact.js           POST /api/interact  → interrogatorio con Groq
  notes.js              POST /api/notes     → notas (Supabase opcional)
  salud.js              GET  /api/salud     → comprobar que todo funciona
server/                 lógica del backend (no son rutas)
  interrogatorio.js     prompt, llamada a Groq, notas
  caso.js               la verdad del caso (nunca llega al navegador)
  reglas.js             reglas de progreso, estrés y confesiones
src/
  App.jsx               flujo del juego y HUD
  scene/Escena.js       escena Three.js (cámara, luces, gestos, evidencias 3D)
  game/caso.js          datos públicos del caso, evidencias, tiempo
  game/sonido.js        sonido procedural (WebAudio)
  components/           menú, diálogo, expediente, evidencias, final
public/
  models/sentado.glb    modelo del sospechoso
  evidencias/           fotos de las evidencias (ver LEEME.txt)
```

Todo se despliega junto en Vercel: frontend y API en el mismo dominio (sin CORS).

## Desarrollo local

Crea `.env.local` en la raíz (no se sube a git):

```
GROQ_API_KEY=gsk_...
# opcionales
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=sb_publishable_...
```

Luego:

```bash
npm install
npm run dev        # juego + API en http://localhost:5173
```

`npm run dev` ejecuta también las funciones de `/api`, igual que Vercel.

## Variables de entorno en Vercel

Settings → Environment Variables:

| Variable        | Obligatoria | Ejemplo |
|-----------------|-------------|---------|
| `GROQ_API_KEY`  | sí          | `gsk_...` |
| `GROQ_MODEL`    | no          | `openai/gpt-oss-20b` (por defecto) |
| `SUPABASE_URL`  | no          | para guardar notas |
| `SUPABASE_KEY`  | no          | clave *publishable/anon*, nunca la *service_role* |

Después de cambiar variables hay que volver a desplegar (Deployments → ⋯ → Redeploy).
