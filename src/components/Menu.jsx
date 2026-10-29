export default function Menu({ progreso, onIniciar }) {
  const listo = progreso >= 1;
  return (
    <div className="menu">
      <div className="menu-contenido">
        <span className="menu-etiqueta">PSYCHOLOGICAL THRILLER</span>
        <h1 className="menu-titulo" data-texto="THE LAST QUESTION">THE LAST QUESTION</h1>
        <p className="menu-desc">
          Caso #409 · Laura Vega fue hallada muerta en su departamento.<br />
          El único sospechoso está sentado frente a ti. Su abogado llega a las 02:40.
        </p>
        <button className="btn-primario" onClick={onIniciar} disabled={!listo}>
          {listo ? 'INICIAR INTERROGATORIO' : `CARGANDO SALA… ${Math.round(progreso * 100)}%`}
        </button>
        <p className="menu-pista">Usa auriculares 🎧</p>
      </div>
    </div>
  );
}
