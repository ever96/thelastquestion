# The Last Question

Thriller de interrogatorio en 3D. Elías Carter es el único sospechoso de la muerte de Laura Vega.
Tienes hasta las 02:40, cuando llega su abogado, para conseguir dos confesiones.

## Cómo se juega

- Escribe preguntas libres. Carter lo interpreta una IA (`openai/gpt-oss-20b` en Groq).
- Abre una evidencia y pulsa **PRESENTAR** para ponerla sobre la mesa junto con tu pregunta.
- Cada pregunta cuesta 2 minutos y cada evidencia 3.
- **Secreto A (Obsesión)** y **Secreto B (Tráfico)** pasan de DESCONOCIDO → CONFIRMADO → CONFESADO.
  Las reglas las aplica el servidor (`backend/reglas.js`): sin las pruebas correctas y suficiente
  estrés, Carter no puede confesar aunque se lo pidas.
- Ganas con ambas confesiones. Si el reloj llega a las 02:40, Carter queda libre.

## Estructura

```
src/
  App.jsx               flujo del juego y HUD
  scene/Escena.js       escena Three.js (cámara, luces, gestos, evidencias 3D)
  game/caso.js          datos públicos del caso, evidencias, tiempo
  game/sonido.js        sonido procedural (WebAudio)
  components/           menú, diálogo, expediente, evidencias, final
public/
  models/sentado.glb    modelo del sospechoso
  evidencias/           fotos de las evidencias (ver LEEME.txt)
backend/
  server.js             API (Groq + Supabase opcional)
  caso.js               la verdad del caso (solo en el servidor)
  reglas.js             reglas de progreso, estrés y confesiones
```

## Desarrollo local

```bash
npm install
npm run dev                # frontend en http://localhost:5173

cd backend
npm install
npm run dev                # API en http://localhost:3001
```

Para que el frontend use tu backend local, crea `.env.local` en la raíz:

```
VITE_API_URL=http://localhost:3001
```

Si no se define, usa el backend de Railway.

## Variables de entorno del backend (Railway)

| Variable          | Obligatoria | Ejemplo |
|-------------------|-------------|---------|
| `GROQ_API_KEY`    | sí          | `gsk_...` |
| `GROQ_MODEL`      | no          | `openai/gpt-oss-20b` (por defecto) |
| `ALLOWED_ORIGINS` | recomendada | `https://tu-juego.vercel.app,http://localhost:5173` |
| `SUPABASE_URL`    | no          | para guardar notas |
| `SUPABASE_KEY`    | no          | usar la clave *anon*, no la *service_role* |
