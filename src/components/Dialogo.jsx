import { useEffect, useRef, useState } from 'react';
import { sonidoTecla } from '../game/sonido.js';

// Convierte "*se ríe* Hola" en una acción en gris + texto hablado.
// Funciona también con texto a medio escribir.
export function TextoConAcciones({ texto }) {
  return texto.split('*').map((parte, i) =>
    i % 2 === 1 ? <span key={i} className="accion">{parte}</span> : <span key={i}>{parte}</span>
  );
}

// Caja de diálogo con efecto máquina de escribir. Clic = mostrar todo.
export default function Dialogo({ texto, pensando, disposicion, onEscribiendo }) {
  const [visible, setVisible] = useState('');
  const timer = useRef(null);
  const onEscribiendoRef = useRef(onEscribiendo);
  useEffect(() => {
    onEscribiendoRef.current = onEscribiendo;
  }, [onEscribiendo]);

  useEffect(() => {
    clearInterval(timer.current);
    if (!texto) return;
    let i = 0;
    setVisible('');
    onEscribiendoRef.current?.(true);
    timer.current = setInterval(() => {
      i++;
      setVisible(texto.slice(0, i));
      if (i % 3 === 0 && texto[i] !== ' ') sonidoTecla();
      if (i >= texto.length) {
        clearInterval(timer.current);
        onEscribiendoRef.current?.(false);
      }
    }, 28);
    return () => clearInterval(timer.current);
  }, [texto]);

  const completar = () => {
    clearInterval(timer.current);
    setVisible(texto);
    onEscribiendoRef.current?.(false);
  };

  const escribiendo = visible.length < (texto?.length || 0);

  return (
    <div className={`dialogo animo-${(disposicion || 'CALMADO').toLowerCase()}`} onClick={completar}>
      <div className="dialogo-nombre">
        CARTER <span className="dialogo-animo">· {disposicion}</span>
      </div>
      {pensando ? (
        <p className="dialogo-texto pensando">
          <span>.</span><span>.</span><span>.</span>
        </p>
      ) : (
        <p className="dialogo-texto">
          <TextoConAcciones texto={visible} />
          {escribiendo && <span className="cursor">▍</span>}
        </p>
      )}
    </div>
  );
}
