export default function Final({ resultado, estado, preguntas, onReiniciar }) {
  const victoria = resultado.tipo === 'VICTORIA';
  const secretos = [estado.secretoA, estado.secretoB];
  const confesados = secretos.filter((s) => s === 'CONFESADO').length;
  const confirmados = secretos.filter((s) => s !== 'DESCONOCIDO').length;

  let rango = 'Novato';
  if (victoria) rango = preguntas <= 10 ? 'Leyenda del departamento' : 'Detective de primera';
  else if (confesados === 1) rango = 'Casi lo tenías';
  else if (confirmados > 0) rango = 'Buen instinto';

  return (
    <div className={`final ${victoria ? 'victoria' : 'derrota'}`}>
      <div className="final-contenido">
        <div className="final-sello">{victoria ? 'CASO CERRADO' : 'SOSPECHOSO LIBERADO'}</div>
        <p className="final-texto">
          {victoria
            ? resultado.final?.texto
            : 'Son las 02:40. Tocan la puerta: es el abogado de Carter. Sin una confesión, no hay caso. Carter sale de la sala sonriendo.'}
        </p>
        <div className="final-stats">
          <div><span>PREGUNTAS</span><strong>{preguntas}</strong></div>
          <div><span>OBSESIÓN</span><strong className={`s-${estado.secretoA.toLowerCase()}`}>{estado.secretoA}</strong></div>
          <div><span>TRÁFICO</span><strong className={`s-${estado.secretoB.toLowerCase()}`}>{estado.secretoB}</strong></div>
          <div><span>PRUEBAS</span><strong>{estado.evidencias.length}/3</strong></div>
        </div>
        <p className="final-rango">Rango: <strong>{rango}</strong></p>
        <button className="btn-primario" onClick={onReiniciar}>JUGAR DE NUEVO</button>
      </div>
    </div>
  );
}
