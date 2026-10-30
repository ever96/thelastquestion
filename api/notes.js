import { guardarNota } from '../server/interrogatorio.js';
import { crearHandler } from '../server/http.js';

export default crearHandler(guardarNota, { limite: { clave: 'notes', maximo: 15 } });
