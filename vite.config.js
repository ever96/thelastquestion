import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// En desarrollo (npm run dev) ejecuta las funciones de /api igual que Vercel.
// Las claves se leen de .env.local (GROQ_API_KEY, SUPABASE_URL, SUPABASE_KEY).
function apiLocal() {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const ruta = req.url?.split('?')[0] || '';
        const m = ruta.match(/^\/api\/([a-z0-9-]+)$/i);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
          let datos = '';
          for await (const trozo of req) datos += trozo;
          req.body = datos;
          await mod.default(req, res);
        } catch (err) {
          if (/Failed to load|does not exist/i.test(err.message)) return next();
          console.error('[api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carga TODAS las variables de .env.local en el servidor (no se exponen al navegador)
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      apiLocal(),
    ],
  }
})
