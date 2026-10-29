import { useCallback, useEffect, useRef, useState } from 'react';
import { Escena } from './scene/Escena.js';
import { API_URL, EVIDENCIAS, NOTAS_INICIALES, PRIMERA_LINEA, TIEMPO, formatoHora } from './game/caso.js';
import * as sonido from './game/sonido.js';
import Menu from './components/Menu.jsx';
import Dialogo, { TextoConAcciones } from './components/Dialogo.jsx';
import Expediente, { Notas } from './components/Expediente.jsx';
import EvidenciaModal, { ImagenEvidencia } from './components/EvidenciaModal.jsx';
import Final from './components/Final.jsx';

const ESTADO_INICIAL = { estres: 20, secretoA: 'DESCONOCIDO', secretoB: 'DESCONOCIDO', evidencias: [] };
const HISTORIAL_INICIAL = [
  { sender: 'TÚ', text: '¿Dónde estabas anoche a las 22:00?' },
  { sender: 'CARTER', text: PRIMERA_LINEA },
];

export default function App() {
  const montaje = useRef(null);
  const escena = useRef(null);

  const [fase, setFase] = useState('MENU'); // MENU | BRIEFING | JUEGO | FINAL
  const [progreso, setProgreso] = useState(0);
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [disposicion, setDisposicion] = useState('CALMADO');
  const [minuto, setMinuto] = useState(TIEMPO.inicioMin);
  const [historial, setHistorial] = useState(HISTORIAL_INICIAL);
  const [dialogo, setDialogo] = useState(PRIMERA_LINEA);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [notas, setNotas] = useState(NOTAS_INICIALES);
  const [panelMovil, setPanelMovil] = useState('chat');
  const [expediente, setExpediente] = useState(false);
  const [evidenciaAbierta, setEvidenciaAbierta] = useState(null);
  const [adjunta, setAdjunta] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [preguntas, setPreguntas] = useState(0);
  const [silencio, setSilencio] = useState(false);
  const [destello, setDestello] = useState(0);

  const historialRef = useRef(null);
  const inputRef = useRef(null);

  // ---------- Escena 3D: se crea UNA sola vez ----------
  useEffect(() => {
    const e = new Escena(montaje.current, { onProgreso: setProgreso });
    escena.current = e;
    return () => e.dispose();
  }, []);

  useEffect(() => {
    escena.current?.setAnimo(disposicion, estado.estres);
    sonido.setEstresSonido(estado.estres);
  }, [disposicion, estado.estres]);

  useEffect(() => {
    historialRef.current?.scrollTo({ top: historialRef.current.scrollHeight, behavior: 'smooth' });
  }, [historial, cargando]);

  const avisar = useCallback((texto, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3800);
  }, []);

  // ---------- Flujo ----------
  const iniciar = () => {
    sonido.iniciarSonido();
    setFase('BRIEFING');
    escena.current?.setModo('JUEGO');
    setTimeout(() => {
      setFase('JUEGO');
      escena.current?.enfocar(2.5);
      escena.current?.gesto('RIE');
      setTimeout(() => inputRef.current?.focus(), 400);
    }, 3800);
  };

  const reiniciar = () => {
    escena.current?.limpiarEvidencias();
    escena.current?.gesto('NEUTRO');
    escena.current?.setModo('JUEGO');
    setEstado(ESTADO_INICIAL);
    setDisposicion('CALMADO');
    setMinuto(TIEMPO.inicioMin);
    setHistorial(HISTORIAL_INICIAL);
    setDialogo(PRIMERA_LINEA);
    setResultado(null);
    setPreguntas(0);
    setAdjunta(null);
    setNotas(NOTAS_INICIALES);
    setFase('JUEGO');
  };

  const terminar = (tipo, final = null) => {
    setTimeout(() => {
      if (tipo === 'DERROTA') {
        escena.current?.flash(0.4);
        sonido.sonidoGolpe();
        avisar('🚪 Golpean la puerta: llegó el abogado.', 'alerta');
      }
      setTimeout(() => {
        escena.current?.setModo('FINAL');
        setResultado({ tipo, final });
        setFase('FINAL');
      }, tipo === 'DERROTA' ? 1600 : 2500);
    }, 2600);
  };

  const presentar = (id) => {
    setAdjunta(id);
    setEvidenciaAbierta(null);
    setPanelMovil('chat');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const enviar = async (e) => {
    e?.preventDefault();
    const texto = pregunta.trim();
    if ((!texto && !adjunta) || cargando || fase !== 'JUEGO') return;

    const evidencia = adjunta;
    const ev = EVIDENCIAS.find((x) => x.id === evidencia);
    setPregunta('');
    setAdjunta(null);
    setCargando(true);

    const entrada = { sender: 'TÚ', text: texto || '¿Me lo explicas?', evidencia: ev?.nombre };
    setHistorial((h) => [...h, entrada]);

    if (ev) {
      escena.current?.presentarEvidencia(ev);
      sonido.sonidoPapel();
    } else {
      escena.current?.enfocar(4);
    }

    const apiHistorial = historial.map((m) => ({
      role: m.sender === 'TÚ' ? 'user' : 'assistant',
      content: m.evidencia ? `*Pone sobre la mesa: ${m.evidencia}* ${m.text}` : m.text,
    }));

    try {
      const r = await fetch(`${API_URL}/api/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: texto, evidencia, estado, historial: apiHistorial }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok || !datos.dialogo) throw new Error(datos.error || `Error ${r.status}`);

      const nuevoMinuto = minuto + (ev ? TIEMPO.costoEvidencia : TIEMPO.costoPregunta);
      setMinuto(nuevoMinuto);
      setPreguntas((n) => n + 1);
      setEstado(datos.estado);
      setDisposicion(datos.disposicion);
      setDialogo(datos.dialogo);
      setHistorial((h) => [...h, { sender: 'CARTER', text: datos.dialogo }]);

      escena.current?.setAnimo(datos.disposicion, datos.estado.estres);
      escena.current?.gesto(datos.gesto);
      escena.current?.enfocar(ev ? 5 : 4);
      if (datos.gesto === 'GOLPE_MESA') sonido.sonidoGolpe();

      const nombres = { A: 'OBSESIÓN', B: 'TRÁFICO' };
      Object.entries(datos.cambios || {}).forEach(([k, v]) => {
        if (!v) return;
        sonido.sonidoRevelacion();
        setDestello((d) => d + 1);
        avisar(`${v === 'CONFESADO' ? '🔓' : '🔍'} SECRETO ${nombres[k]}: ${v}`, v === 'CONFESADO' ? 'exito' : 'pista');
        setNotas((n) => [...n, {
          id: Date.now() + k,
          text: v === 'CONFESADO'
            ? `Carter confesó lo relacionado con ${nombres[k].toLowerCase()}.`
            : `Hay base sólida para el secreto de ${nombres[k].toLowerCase()}. Falta la confesión.`,
          category: 'Progreso',
        }]);
      });

      if (datos.resuelto) terminar('VICTORIA', datos.final);
      else if (nuevoMinuto >= TIEMPO.limiteMin) terminar('DERROTA');
      else if (TIEMPO.limiteMin - nuevoMinuto <= 6 && TIEMPO.limiteMin - minuto > 6) {
        avisar('⏱ El abogado está por llegar.', 'alerta');
      }
    } catch (err) {
      console.error('Error al hablar con el backend:', err);
      // No se consume tiempo si falla la conexión
      setHistorial((h) => h.slice(0, -1));
      setPregunta(texto);
      setAdjunta(evidencia);
      avisar(`⚠ ${err.message || 'No hay conexión con el servidor.'}`, 'alerta');
    } finally {
      setCargando(false);
    }
  };

  const agregarNota = async (texto) => {
    const local = { id: Date.now(), text: texto, category: 'Observación Personal' };
    setNotas((n) => [...n, local]);
    try {
      await fetch(`${API_URL}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto, category: local.category }),
      });
    } catch {
      /* la nota ya está guardada localmente */
    }
  };

  const restantes = TIEMPO.limiteMin - minuto;
  const evAdjunta = EVIDENCIAS.find((x) => x.id === adjunta);
  const nivelEstres = estado.estres > 75 ? 'critico' : estado.estres > 50 ? 'alto' : 'normal';

  return (
    <div className={`app fase-${fase.toLowerCase()} movil-${panelMovil} estres-${nivelEstres}`}>
      <div ref={montaje} className="lienzo" />
      <div className="vineta" />
      <div className="grano" />
      <div className="barra-cine arriba" />
      <div className="barra-cine abajo" />
      {destello > 0 && <div key={destello} className="destello" />}

      {fase === 'MENU' && <Menu progreso={progreso} onIniciar={iniciar} />}

      {fase === 'BRIEFING' && (
        <div className="briefing">
          <p className="b1">14 DE OCTUBRE · 02:10 AM</p>
          <p className="b2">Sala de interrogatorios N.º 3</p>
          <p className="b3">Tienes 30 minutos.</p>
        </div>
      )}

      {fase === 'JUEGO' && (
        <>
          <header className="hud-cabecera">
            <div className="hud-izq">
              <span className="rec">● REC</span>
              <h2>SUJETO #409 · E. CARTER</h2>
            </div>
            <div className={`reloj ${restantes <= 6 ? 'urgente' : ''}`} title="Hora actual / llegada del abogado">
              <span>{formatoHora(minuto)}</span>
              <small>ABOGADO {formatoHora(TIEMPO.limiteMin)}</small>
            </div>
            <div className="hud-der">
              <nav className="nav-movil">
                {[['metricas', '📊'], ['chat', '💬'], ['notas', '📝']].map(([id, ic]) => (
                  <button key={id} className={panelMovil === id ? 'activo' : ''} onClick={() => setPanelMovil(id)}>{ic}</button>
                ))}
              </nav>
              <button className="btn-borde" onClick={() => setSilencio(sonido.alternarSilencio())}>{silencio ? '🔇' : '🔊'}</button>
              <button className="btn-borde" onClick={() => setExpediente(true)}>📁 <span className="ocultar-movil">EXPEDIENTE</span></button>
            </div>
          </header>

          <aside className="panel panel-izq">
            <h4>ESTADO PSICOLÓGICO</h4>
            <div className="estres-cabecera">
              <span>NIVEL DE ESTRÉS</span>
              <strong>{estado.estres}%</strong>
            </div>
            <div className="estres-barra"><div style={{ width: `${estado.estres}%` }} /></div>
            <span className="estado-animo">Estado: [{disposicion}]</span>

            <div className="progreso">
              <h4>PROGRESO INVESTIGACIÓN</h4>
              {[['OBSESIÓN (SEC. A)', estado.secretoA], ['TRÁFICO (SEC. B)', estado.secretoB]].map(([n, v]) => (
                <div key={n} className="secreto">
                  <span>{n}</span>
                  <strong key={v} className={`s-${v.toLowerCase()}`}>{v}</strong>
                </div>
              ))}
            </div>

            <h4>EVIDENCIAS</h4>
            <div className="evidencias">
              {EVIDENCIAS.map((ev) => (
                <button
                  key={ev.id}
                  className={`evidencia ${estado.evidencias.includes(ev.id) ? 'mostrada' : ''} ${adjunta === ev.id ? 'adjunta' : ''}`}
                  onClick={() => setEvidenciaAbierta(ev.id)}
                >
                  <ImagenEvidencia evidencia={ev} className="miniatura" />
                  <span>{ev.nombre}</span>
                  {estado.evidencias.includes(ev.id) && <em>MOSTRADA</em>}
                </button>
              ))}
            </div>
          </aside>

          <aside className="panel panel-der">
            <h4>HISTORIAL DE CONVERSACIÓN</h4>
            <div className="historial" ref={historialRef}>
              {historial.map((m, i) => (
                <div key={i} className={`mensaje ${m.sender === 'TÚ' ? 'yo' : 'el'}`}>
                  <span>{m.sender}:</span>
                  {m.evidencia && <em className="mensaje-ev">📎 {m.evidencia}</em>}
                  <p><TextoConAcciones texto={m.text} /></p>
                </div>
              ))}
              {cargando && <div className="mensaje el escribiendo"><span>CARTER:</span><p>…</p></div>}
            </div>
          </aside>

          <section className="panel panel-notas">
            <h4>NOTAS RÁPIDAS</h4>
            <Notas notas={notas} onAgregar={agregarNota} compacta />
          </section>

          <Dialogo
            texto={dialogo}
            pensando={cargando}
            disposicion={disposicion}
            onEscribiendo={(v) => escena.current?.setHablando(v)}
          />

          <form onSubmit={enviar} className="barra-chat">
            {evAdjunta && (
              <div className="adjunto">
                📎 Presentando: <strong>{evAdjunta.nombre}</strong>
                <button type="button" onClick={() => setAdjunta(null)}>✕</button>
              </div>
            )}
            <div className="barra-chat-fila">
              <input
                ref={inputRef}
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder={cargando ? 'Carter está pensando…' : evAdjunta ? 'Pregunta sobre esta prueba (opcional)…' : 'Escribe tu pregunta u objeción…'}
                disabled={cargando}
                maxLength={400}
              />
              <button type="submit" className="btn-primario" disabled={cargando || (!pregunta.trim() && !adjunta)}>
                {cargando ? '…' : evAdjunta ? 'PRESENTAR' : 'INTERROGAR'}
              </button>
            </div>
          </form>
        </>
      )}

      {fase === 'FINAL' && resultado && (
        <Final resultado={resultado} estado={estado} preguntas={preguntas} onReiniciar={reiniciar} />
      )}

      <div className="avisos">
        {avisos.map((a) => <div key={a.id} className={`aviso ${a.tipo}`}>{a.texto}</div>)}
      </div>

      {expediente && <Expediente notas={notas} onAgregarNota={agregarNota} onCerrar={() => setExpediente(false)} />}
      {evidenciaAbierta && (
        <EvidenciaModal
          evidencia={EVIDENCIAS.find((x) => x.id === evidenciaAbierta)}
          yaMostrada={estado.evidencias.includes(evidenciaAbierta)}
          deshabilitado={cargando}
          onPresentar={() => presentar(evidenciaAbierta)}
          onCerrar={() => setEvidenciaAbierta(null)}
        />
      )}
    </div>
  );
}
