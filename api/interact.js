import { procesarInteraccion } from '../server/interrogatorio.js';
import { crearHandler } from '../server/http.js';

export default crearHandler(procesarInteraccion, { limite: { clave: 'interact', maximo: 20 } });
