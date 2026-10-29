import { useState } from 'react';

export function ImagenEvidencia({ evidencia, className = '' }) {
  const [falla, setFalla] = useState(false);
  if (falla) {
    return (
      <div className={`evidencia-provisional ${className}`}>
        <span>{evidencia.icono}</span>
        <small>FOTO PENDIENTE</small>
      </div>
    );
  }
  return <img className={className} src={evidencia.imagen} alt={evidencia.nombre} onError={() => setFalla(true)} />;
}

export default function EvidenciaModal({ evidencia, yaMostrada, onPresentar, onCerrar, deshabilitado }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal evidencia-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecera">
          <h2>{evidencia.icono} {evidencia.nombre.toUpperCase()}</h2>
          <button className="btn-cerrar" onClick={onCerrar}>✕</button>
        </div>
        <div className="evidencia-foto">
          <ImagenEvidencia evidencia={evidencia} />
          <span className="evidencia-sello">EVIDENCIA · {evidencia.hora}</span>
        </div>
        <p className="evidencia-desc">{evidencia.descripcion}</p>
        <button className="btn-primario" disabled={deshabilitado} onClick={onPresentar}>
          {yaMostrada ? 'VOLVER A MOSTRAR A CARTER' : 'PRESENTAR A CARTER'}
        </button>
      </div>
    </div>
  );
}
