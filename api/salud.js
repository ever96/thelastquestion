import { salud } from '../server/interrogatorio.js';
import { crearHandler } from '../server/http.js';

export default crearHandler(salud, { metodo: 'GET' });
