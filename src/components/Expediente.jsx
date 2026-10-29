import { useState } from 'react';
import { EXPEDIENTE } from '../game/caso.js';

export function Notas({ notas, onAgregar, compacta = false }) {
  const [texto, setTexto] = useState('');
  const enviar = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    onAgregar(texto.trim());
    setTexto('');
  };
  return (
    <div className={`notas ${compacta ? 'compacta' : ''}`}>
      <form onSubmit={enviar} className="notas-form">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nueva nota de investigación…" maxLength={300} />
        <button type="submit" className="btn-chico">AÑADIR</button>
      </form>
      <div className="notas-lista">
        {notas.map((n) => (
          <div key={n.id} className="nota">
            <span className="nota-cat">{n.category}</span>
            <p>{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Expediente({ notas, onAgregarNota, onCerrar }) {
  const [tab, setTab] = useState('INFO');
  const e = EXPEDIENTE;
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal expediente" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-cabecera">
          <h2>EXPEDIENTE #{e.numero}</h2>
          <button className="btn-cerrar" onClick={onCerrar}>✕ CERRAR</button>
        </div>
        <div className="tabs">
          <button className={tab === 'INFO' ? 'activa' : ''} onClick={() => setTab('INFO')}>📋 DATOS</button>
          <button className={tab === 'NOTAS' ? 'activa' : ''} onClick={() => setTab('NOTAS')}>📝 NOTAS ({notas.length})</button>
        </div>
        <div className="modal-cuerpo">
          {tab === 'INFO' ? (
            <div className="expediente-info">
              <h3>LA VÍCTIMA</h3>
              <p>{e.victima}</p>
              <p><strong>Lugar:</strong> {e.lugar}</p>
              <p><strong>Hallazgo:</strong> {e.hallazgo}</p>
              <p><strong>Forense:</strong> {e.causa}</p>
              <h3>EL SOSPECHOSO</h3>
              <p>{e.sospechoso}</p>
              <p><strong>Antecedentes:</strong> {e.antecedentes}</p>
              <p><strong>Coartada:</strong> {e.coartada}</p>
              <h3>OBJETIVOS</h3>
              <ul>{e.objetivos.map((o) => <li key={o}>{o}</li>)}</ul>
              <h3>CÓMO JUGAR</h3>
              <p>Pregunta libremente. Abre una evidencia y pulsa <strong>PRESENTAR</strong> para ponerla sobre la mesa junto con tu pregunta. Sin pruebas, Carter no va a ceder. Cada pregunta consume 2 minutos; cada prueba, 3.</p>
            </div>
          ) : (
            <Notas notas={notas} onAgregar={onAgregarNota} />
          )}
        </div>
      </div>
    </div>
  );
}
