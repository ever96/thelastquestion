// Adaptador común para las funciones de /api (Vercel) y el servidor de desarrollo
import { limitar } from './interrogatorio.js';

export function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || req.socket?.remoteAddress || 'desconocida';
}

export function crearHandler(accion, { metodo = 'POST', limite = null } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== metodo) {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Método no permitido' }));
    }
    if (limite && !limitar(`${limite.clave}:${ipDe(req)}`, limite.maximo)) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Demasiadas preguntas seguidas. Espera un momento.' }));
    }
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { status, json } = await accion(body || {});
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(json));
  };
}
