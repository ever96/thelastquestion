import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function App() {
  const mountRef = useRef(null);

  // Estados del Flujo de Juego
  const [gameState, setGameState] = useState('MENU'); // 'MENU' | 'PLAYING'
  const [suspectStress, setSuspectStress] = useState(20);
  const [dialogueText, setDialogueText] = useState("No tengo nada que decirte, detective. Estás perdiendo el tiempo.");
  const [suspectStatus, setSuspectStatus] = useState("CALMADO");
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [activeTab, setActiveTab] = useState('INFO');
  
  // Estado para versión móvil (alternar paneles inferiores/laterales)
  const [mobilePanel, setMobilePanel] = useState('chat'); // 'chat' | 'metrics' | 'notes'

  // NUEVO: Estados para rastrear el progreso del interrogatorio (Secretos de Carter)
  const [secretA, setSecretA] = useState("DESCONOCIDO");
  const [secretB, setSecretB] = useState("DESCONOCIDO");

  // Historial de conversación táctico
  const [chatHistory, setChatHistory] = useState([
    { sender: 'TÚ', text: '¿Dónde estabas anoche a las 22:00?' },
    { sender: 'CARTER', text: 'No tengo nada que decirte, detective. Estás perdiendo el tiempo.' }
  ]);

  // Notas clave del detective
  const [detectiveNotes, setDetectiveNotes] = useState([
    { id: 1, text: "Afirma que estaba en su apartamento solo, pero no hay testigos.", category: "Coartada" },
    { id: 2, text: "Evita el contacto visual directo al mencionar el Bar Central.", category: "Comportamiento" }
  ]);
  const [newNoteText, setNewNoteText] = useState('');

  // Referencias para Three.js y modelos
  const suspectGroupRef = useRef(null);
  const cameraRef = useRef(null);
  const mixersRef = useRef([]);
  const modelsCacheRef = useRef({});
  const clockRef = useRef(null);
  
  // Posiciones de cámara
  const camPositions = {
    MENU: { x: 1.8, y: 1.8, z: 2.2, lookX: -0.2, lookY: 0.9, lookZ: -0.9 },
    PLAYING: { x: 0, y: 1.5, z: 2.6, lookX: 0, lookY: 0.8, lookZ: -0.9 },
    ZOOM: { x: 0.15, y: 1.25, z: 0.4, lookX: 0, lookY: 1.2, lookZ: -0.9 }
  };

  const targetCamPos = useRef(camPositions.MENU);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    // 1. ESCENA Y CONFIGURACIÓN CINEMATOGRÁFICA
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020203);
    scene.fog = new THREE.FogExp2(0x020203, 0.18);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(camPositions.MENU.x, camPositions.MENU.y, camPositions.MENU.z);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    currentMount.appendChild(renderer.domElement);

    // 2. MATERIALES DEL ENTORNO
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.9 });
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.3, metalness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x111113, metalness: 0.9, roughness: 0.2 });

    // 3. ENTORNO
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), wallMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
    backWall.position.set(0, 2.5, -3.5);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 1.4),
      new THREE.MeshPhysicalMaterial({ color: 0x05080c, roughness: 0.1, metalness: 0.95, clearcoat: 1 })
    );
    mirror.position.set(0, 2, -3.49);
    scene.add(mirror);

    // 4. MESA DE INTERROGATORIO
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.0), tableMat);
    table.position.set(0, 0.75, -0.2);
    table.castShadow = true;
    table.receiveShadow = true;
    scene.add(table);

    [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), metalMat);
      leg.position.set(x, 0.375, z - 0.2);
      leg.castShadow = true;
      scene.add(leg);
    });

    // 5. CONTENEDOR PARA LOS MODELOS 3D
    const suspectGroup = new THREE.Group();
    suspectGroup.position.set(0, 0, -1.0);
    suspectGroupRef.current = suspectGroup;
    scene.add(suspectGroup);

    const loader = new GLTFLoader();
    mixersRef.current = [];

    const loadModelToCache = (name, path, scale, isDefaultVisible = false) => {
      loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(scale, scale, scale);
          model.position.set(0, 0, 0);
          model.visible = isDefaultVisible;

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
              const action = mixer.clipAction(clip);
              action.play();
            });
            mixersRef.current.push(mixer);
          }

          suspectGroup.add(model);
          modelsCacheRef.current[name] = model;
        },
        undefined,
        (error) => {
          console.error(`Error al cargar ${path}:`, error);
        }
      );
    };

    loadModelToCache('sentado', '/models/sentado.glb', 1.6, true);
    loadModelToCache('detective', '/models/detective.glb', 1.6, false);

    // 6. ILUMINACIÓN
    const ambientLight = new THREE.AmbientLight(0x0d1117, 0.25);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffedd8, 120);
    spotLight.position.set(0, 2.7, -0.3);
    spotLight.angle = Math.PI / 3.5;
    spotLight.penumbra = 0.6;
    spotLight.decay = 2;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    scene.add(spotLight);

    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.18, 16), metalMat);
    lamp.position.set(0, 2.65, -0.3);
    scene.add(lamp);

    // 7. LOOP
    let animationFrameId;
    let clock = new THREE.Clock();
    clockRef.current = clock;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      mixersRef.current.forEach((mixer) => mixer.update(delta));

      camera.position.x += (targetCamPos.current.x - camera.position.x) * 0.03;
      camera.position.y += (targetCamPos.current.y - camera.position.y) * 0.03;
      camera.position.z += (targetCamPos.current.z - camera.position.z) * 0.03;

      if (gameState === 'MENU') {
        const orbitRadius = 0.3;
        const menuTargetX = camPositions.MENU.x + Math.sin(elapsedTime * 0.5) * orbitRadius;
        camera.position.x += (menuTargetX - camera.position.x) * 0.02;
      }

      camera.lookAt(targetCamPos.current.lookX, targetCamPos.current.lookY, targetCamPos.current.lookZ);

      spotLight.intensity = 120 + Math.sin(elapsedTime * 3) * 5;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!currentMount) return;
      const w = currentMount.clientWidth;
      const h = currentMount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [gameState]);

  const startGame = () => {
    setGameState('PLAYING');
    targetCamPos.current = camPositions.PLAYING;
  };

  const switchActiveModel = (modelName) => {
    const cache = modelsCacheRef.current;
    Object.keys(cache).forEach((key) => {
      if (cache[key]) {
        cache[key].visible = (key === modelName);
      }
    });
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    try {
      const response = await fetch("http://localhost:3001/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNoteText, category: "Observación Personal" })
      });
      const savedNote = await response.json();
      if (response.ok) {
        setDetectiveNotes(prev => [...prev, savedNote]);
      }
    } catch (error) {
      console.error("Error al guardar la nota en el backend:", error);
      // Fallback local si falla la red
      setDetectiveNotes(prev => [
        ...prev,
        { id: Date.now(), text: newNoteText, category: "Observación Personal" }
      ]);
    }
    setNewNoteText('');
  };

  // CHAT CONECTADO AL BACKEND DE NODE (GROQ + SUPABASE)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const currentQuestion = userInput;
    setUserInput('');
    setIsLoading(true);
    targetCamPos.current = camPositions.ZOOM;

    setTimeout(() => {
      targetCamPos.current = camPositions.PLAYING;
    }, 3500);

    // 1. Guardar la pregunta del usuario en el historial visual
    setChatHistory(prev => [...prev, { sender: 'TÚ', text: currentQuestion }]);

    try {
      // 2. Mapear el historial visual al formato que entiende el Backend/LLM
      const apiHistory = chatHistory.map(msg => ({
        role: msg.sender === 'TÚ' ? 'user' : 'assistant',
        content: msg.text
      }));

      // 3. Enviar la data al backend
      const response = await fetch("http://localhost:3001/api/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentQuestion,
          chatHistory: apiHistory, // Enviamos el historial
          secretA,                 // Estado actual del Secreto A
          secretB                  // Estado actual del Secreto B
        })
      });

      const result = await response.json();

      // 4. Actualizar la interfaz con la respuesta y estados del sistema
      setDialogueText(result.dialogo);
      
      if (result.disposicion) {
        setSuspectStatus(result.disposicion.toUpperCase());
        // Calcular estrés basado en la disposición
        let newStress = suspectStress;
        switch(result.disposicion.toLowerCase()) {
          case 'calmado': newStress = 20; break;
          case 'nervioso': newStress = 50; break;
          case 'irritado': newStress = 75; break;
          case 'hostil': newStress = 90; break;
          case 'cerrado': newStress = 100; break;
          default: newStress = 50;
        }
        setSuspectStress(newStress);
      }

      if (result.estado_secreto_A) setSecretA(result.estado_secreto_A);
      if (result.estado_secreto_B) setSecretB(result.estado_secreto_B);

      // Si el backend devuelve un cambio de modelo (opcional/fallback)
      if (result.modelToUse && (result.modelToUse === 'sentado' || result.modelToUse === 'detective')) {
        switchActiveModel(result.modelToUse);
      }

      // 5. Actualizar el historial visual con la respuesta de Carter
      setChatHistory(prev => [...prev, { sender: 'CARTER', text: result.dialogo }]);

    } catch (error) {
      console.error("Error al conectar con el backend:", error);
      const fallbackText = "... (El sospechoso guarda silencio absoluto y te ignora).";
      setDialogueText(fallbackText);
      setSuspectStatus("CERRADO");
      setSuspectStress(100);
      setChatHistory(prev => [...prev, { sender: 'CARTER', text: fallbackText }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000', userSelect: 'none' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />

      {/* MARCOS CINEMATOGRÁFICOS SUPERIOR E INFERIOR */}
      <div style={topBar} />
      <div style={bottomBar} />

      {/* ==================== MENÚ INICIAL ==================== */}
      {gameState === 'MENU' && (
        <div style={menuOverlay}>
          <div style={menuContent}>
            <span style={subtitleTag}>PSYCHOLOGICAL THRILLER</span>
            <h1 style={gameTitle}>THE LAST QUESTION</h1>
            <p style={gameDesc}>
              Caso #409: Interrogatorio en curso.<br />
              Tienes pocos minutos antes de que el abogado del sospechoso llegue a liberarlo.
            </p>
            <div style={btnGroup}>
              <button style={startBtn} onClick={startGame}>
                INICIAR INTERROGATORIO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== INTERFAZ DE JUEGO HUD TÁCTICO & RESPONSIVE ==================== */}
      {gameState === 'PLAYING' && (
        <>
          {/* BARRA SUPERIOR DE ESTADO & REC */}
          <div style={hudHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={recIndicator}>● REC</span>
              <h2 style={suspectTitleHeader}>SUJETO #409</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={mobileNavToggle}>
                <button style={{ ...mobileNavBtn, background: mobilePanel === 'metrics' ? '#e2a03f' : '#0f172a', color: mobilePanel === 'metrics' ? '#000' : '#e2a03f' }} onClick={() => setMobilePanel('metrics')}>📊</button>
                <button style={{ ...mobileNavBtn, background: mobilePanel === 'chat' ? '#e2a03f' : '#0f172a', color: mobilePanel === 'chat' ? '#000' : '#e2a03f' }} onClick={() => setMobilePanel('chat')}>💬</button>
                <button style={{ ...mobileNavBtn, background: mobilePanel === 'notes' ? '#e2a03f' : '#0f172a', color: mobilePanel === 'notes' ? '#000' : '#e2a03f' }} onClick={() => setMobilePanel('notes')}>📝</button>
              </div>
              <button style={expedienteBtn} onClick={() => setShowExpediente(true)}>
                📁 EXPEDIENTE
              </button>
            </div>
          </div>

          {/* PANEL LATERAL IZQUIERDO: Métricas y Evidencias */}
          <div style={{ ...leftPanel, display: mobilePanel === 'metrics' || window.innerWidth > 900 ? 'flex' : 'none' }}>
            <div style={panelSection}>
              <h4 style={panelTitle}>ESTADO PSICOLÓGICO</h4>
              <div style={{ margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>
                  <span>NIVEL DE ESTRÉS</span>
                  <span style={{ color: suspectStress > 60 ? '#d93838' : '#e2a03f', fontWeight: 'bold' }}>{suspectStress}%</span>
                </div>
                <div style={stressBarBackground}>
                  <div style={{ ...stressBarFill, width: `${suspectStress}%`, background: suspectStress > 60 ? '#d93838' : '#e2a03f' }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic', display: 'block', marginTop: '4px' }}>
                  Estado: [{suspectStatus}]
                </span>

                {/* NUEVO: ESTADO DE LOS SECRETOS DE CARTER */}
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '4px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <h4 style={{ ...panelTitle, borderBottom: 'none', marginBottom: '8px' }}>PROGRESO INVESTIGACIÓN</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>OBSESIÓN (SEC. A)</span>
                    <span style={{ 
                      color: secretA === 'CONFESADO' ? '#ef4444' : (secretA === 'CONFIRMADO' ? '#e2a03f' : '#64748b'),
                      fontWeight: 'bold' 
                    }}>
                      {secretA}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                    <span style={{ color: '#94a3b8' }}>TRÁFICO (SEC. B)</span>
                    <span style={{ 
                      color: secretB === 'CONFESADO' ? '#ef4444' : (secretB === 'CONFIRMADO' ? '#e2a03f' : '#64748b'),
                      fontWeight: 'bold' 
                    }}>
                      {secretB}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            <div style={panelSection}>
              <h4 style={panelTitle}>EVIDENCIAS CLAVE</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <div style={evidenceBadge}>📷 Foto Bar Central</div>
                <div style={evidenceBadge}>📄 Recibo de taxi</div>
                <div style={evidenceBadge}>✉️ Mensaje de Laura</div>
              </div>
            </div>
          </div>

          {/* PANEL LATERAL DERECHO: Historial de Conversación */}
          <div style={{ ...rightPanel, display: mobilePanel === 'chat' || window.innerWidth > 900 ? 'flex' : 'none' }}>
            <h4 style={panelTitle}>HISTORIAL DE CONVERSACIÓN</h4>
            <div style={historyScrollContainer}>
              {chatHistory.map((msg, index) => (
                <div key={index} style={historyItem}>
                  <span style={{ color: msg.sender === 'TÚ' ? '#e2a03f' : '#64748b', fontWeight: 'bold', fontSize: '0.65rem' }}>
                    {msg.sender}:
                  </span>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.35' }}>
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN INFERIOR MÓVIL: Notas */}
          <div style={{ ...notesMobileContainer, display: mobilePanel === 'notes' && window.innerWidth <= 900 ? 'flex' : 'none' }}>
            <h4 style={panelTitle}>NOTAS RÁPIDAS</h4>
            <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
              <input 
                type="text" 
                placeholder="Añadir nota rápida..." 
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                style={noteInputStyle}
              />
              <button type="submit" style={addNoteBtn}>+</button>
            </form>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {detectiveNotes.map((note) => (
                <div key={note.id || Math.random()} style={noteCard}>
                  <span style={noteCategoryTag}>{note.category}</span>
                  <p style={{ margin: '2px 0 0 0', color: '#e2e8f0', fontSize: '0.75rem' }}>{note.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CAJA DE DIÁLOGO CENTRAL INFERIOR */}
          <div style={dialogueBox}>
            <div style={characterNameTag}>CARTER (SUJETO)</div>
            <p style={dialogueContent}>"{dialogueText}"</p>
          </div>

          {/* BARRA DE ENTRADA DE CHAT & ACCIONES */}
          <form onSubmit={handleSendMessage} style={chatBarContainer}>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isLoading ? "Analizando..." : "Escribe tu pregunta u objeción..."}
              disabled={isLoading}
              style={textInputStyle}
            />
            <button type="submit" disabled={isLoading} style={sendBtnStyle}>
              {isLoading ? "..." : "INTERROGAR"}
            </button>
          </form>
        </>
      )}

      {/* ==================== MODAL DE EXPEDIENTE & NOTAS ==================== */}
      {showExpediente && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHeader}>
              <h2 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '1px', color: '#e2a03f' }}>EXPEDIENTE #409</h2>
              <button style={closeBtn} onClick={() => setShowExpediente(false)}>✕ CERRAR</button>
            </div>

            <div style={tabContainer}>
              <button 
                style={{ ...tabBtn, borderBottom: activeTab === 'INFO' ? '2px solid #e2a03f' : '2px solid transparent', color: activeTab === 'INFO' ? '#e2a03f' : '#64748b' }}
                onClick={() => setActiveTab('INFO')}
              >
                📋 DATOS
              </button>
              <button 
                style={{ ...tabBtn, borderBottom: activeTab === 'NOTAS' ? '2px solid #e2a03f' : '2px solid transparent', color: activeTab === 'NOTAS' ? '#e2a03f' : '#64748b' }}
                onClick={() => setActiveTab('NOTAS')}
              >
                📝 NOTAS ({detectiveNotes.length})
              </button>
            </div>

            <div style={modalBody}>
              {activeTab === 'INFO' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                  <div>
                    <h3 style={modalSubTitle}>INFORMACIÓN GENERAL</h3>
                    <p style={modalText}><strong>Fecha:</strong> 14 de octubre, 23:47</p>
                    <p style={modalText}><strong>Lugar:</strong> Apartamento 7B</p>
                    <p style={modalText}><strong>Estado:</strong> Investigación en curso</p>
                    
                    <h3 style={{ ...modalSubTitle, marginTop: '15px' }}>OBJETIVOS</h3>
                    <ul style={{ paddingLeft: '18px', color: '#cbd5e1', lineHeight: '1.4', fontSize: '0.8rem' }}>
                      <li>Descubre qué hizo Carter esa noche.</li>
                      <li>Averigua su relación con la víctima.</li>
                      <li>Encuentra contradicciones en su coartada.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Nueva nota de investigación..." 
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      style={noteInputStyle}
                    />
                    <button type="submit" style={addNoteBtn}>AÑADIR</button>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '35vh', overflowY: 'auto' }}>
                    {detectiveNotes.map((note) => (
                      <div key={note.id || Math.random()} style={noteCard}>
                        <span style={noteCategoryTag}>{note.category}</span>
                        <p style={{ margin: '4px 0 0 0', color: '#e2e8f0', fontSize: '0.8rem' }}>{note.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ESTILOS ====================
const topBar = { position: 'absolute', top: 0, left: 0, width: '100%', height: '25px', background: '#000', zIndex: 10 };
const bottomBar = { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '25px', background: '#000', zIndex: 10 };

const menuOverlay = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', background: 'radial-gradient(circle at center, rgba(15,23,42,0.9) 0%, rgba(2,2,3,0.98) 100%)',
  zIndex: 20, fontFamily: 'monospace', textAlign: 'center'
};

const menuContent = { maxWidth: '480px', color: '#fff' };
const subtitleTag = { color: '#e2a03f', fontSize: '0.7rem', letterSpacing: '3px', fontWeight: 'bold' };
const gameTitle = { fontSize: 'clamp(2rem, 5vw, 3.2rem)', margin: '10px 0', letterSpacing: '4px', textTransform: 'uppercase', lineHeight: '1', color: '#f8fafc' };
const gameDesc = { color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '25px', fontFamily: 'sans-serif' };

const btnGroup = { display: 'flex', flexDirection: 'column', gap: '12px' };
const startBtn = {
  background: '#e2a03f', border: 'none', color: '#000', padding: '14px 24px',
  fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '2px', cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(226, 160, 63, 0.3)', width: '100%'
};

const hudHeader = {
  position: 'absolute', top: '35px', left: '15px', right: '15px', height: '45px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20, fontFamily: 'monospace'
};

const recIndicator = { color: '#ef4444', fontSize: '0.7rem', letterSpacing: '1px', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' };
const suspectTitleHeader = { margin: 0, fontSize: '0.85rem', letterSpacing: '2px', color: '#f1f5f9' };

const mobileNavToggle = { display: window.innerWidth <= 900 ? 'flex' : 'none', gap: '4px' };
const mobileNavBtn = { border: '1px solid #334155', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' };

const expedienteBtn = {
  background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #e2a03f', color: '#e2a03f',
  padding: '6px 12px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'monospace',
  borderRadius: '4px', backdropFilter: 'blur(4px)'
};

const leftPanel = {
  position: 'absolute', top: '90px', left: '15px', width: '250px', maxHeight: 'calc(100vh - 200px)',
  backgroundColor: 'rgba(10, 14, 23, 0.85)', border: '1px solid rgba(51, 65, 85, 0.6)', padding: '12px',
  zIndex: 20, fontFamily: 'monospace', color: '#cbd5e1', backdropFilter: 'blur(6px)', borderRadius: '6px',
  flexDirection: 'column', gap: '15px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
};

const panelSection = { display: 'flex', flexDirection: 'column' };
const panelTitle = { fontSize: '0.65rem', color: '#e2a03f', letterSpacing: '2px', margin: '0 0 8px 0', borderBottom: '1px solid rgba(51, 65, 85, 0.4)', paddingBottom: '3px' };
const stressBarBackground = { width: '100%', height: '5px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' };
const stressBarFill = { height: '100%', transition: 'width 0.4s ease, background 0.4s ease' };
const evidenceBadge = { backgroundColor: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.8)', padding: '6px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#e2e8f0' };

const rightPanel = {
  position: 'absolute', top: '90px', right: '15px', width: '270px', maxHeight: 'calc(100vh - 200px)',
  backgroundColor: 'rgba(10, 14, 23, 0.85)', border: '1px solid rgba(51, 65, 85, 0.6)', padding: '12px',
  zIndex: 20, fontFamily: 'monospace', color: '#cbd5e1', backdropFilter: 'blur(6px)', borderRadius: '6px',
  flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
};

const historyScrollContainer = { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', marginTop: '6px', maxHeight: '250px' };
const historyItem = { backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(30, 41, 59, 0.8)', padding: '6px 8px', borderRadius: '4px' };

const notesMobileContainer = {
  position: 'absolute', top: '90px', left: '15px', right: '15px', maxHeight: 'calc(100vh - 200px)',
  backgroundColor: 'rgba(10, 14, 23, 0.95)', border: '1px solid rgba(51, 65, 85, 0.8)', padding: '12px',
  zIndex: 20, fontFamily: 'monospace', color: '#cbd5e1', borderRadius: '6px', flexDirection: 'column', gap: '8px'
};

const dialogueBox = {
  position: 'absolute', bottom: '80px', left: '15px', right: '15px', maxWidth: '700px', margin: '0 auto',
  backgroundColor: 'rgba(10, 14, 23, 0.92)', borderLeft: '3px solid #e2a03f', border: '1px solid rgba(51,65,85,0.6)',
  padding: '10px 15px', backdropFilter: 'blur(6px)', zIndex: 20, fontFamily: 'sans-serif', borderRadius: '6px'
};

const characterNameTag = { margin: 0, fontSize: '0.6rem', color: '#e2a03f', letterSpacing: '2px', fontWeight: 'bold', fontFamily: 'monospace' };
const dialogueContent = { margin: '4px 0 0 0', fontSize: '0.9rem', color: '#f1f5f9', lineHeight: '1.3', fontStyle: 'italic' };

const chatBarContainer = {
  position: 'absolute', bottom: '35px', left: '15px', right: '15px', maxWidth: '700px', margin: '0 auto',
  display: 'flex', gap: '8px', zIndex: 20
};

const textInputStyle = {
  flex: 1, background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(51, 65, 85, 0.8)', color: '#fff',
  padding: '10px 12px', fontSize: '0.8rem', fontFamily: 'sans-serif', borderRadius: '4px', outline: 'none'
};

const sendBtnStyle = {
  background: '#e2a03f', border: 'none', color: '#000', padding: '0 16px',
  fontWeight: 'bold', fontSize: '0.7rem', letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'monospace'
};

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  backgroundColor: 'rgba(2, 2, 3, 0.85)', backdropFilter: 'blur(8px)',
  display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100,
  fontFamily: 'sans-serif', padding: '15px'
};

const modalContent = {
  width: '100%', maxWidth: '700px', backgroundColor: '#0a0e17',
  border: '1px solid rgba(51, 65, 85, 0.8)', borderRadius: '8px', overflow: 'hidden', color: '#e2e8f0',
  boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
};

const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px', backgroundColor: '#0f172a', borderBottom: '1px solid rgba(51, 65, 85, 0.6)'
};

const closeBtn = {
  background: 'transparent', border: '1px solid #475569', color: '#cbd5e1',
  padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontFamily: 'monospace', borderRadius: '4px'
};

const tabContainer = {
  display: 'flex', backgroundColor: '#090d16', borderBottom: '1px solid rgba(51, 65, 85, 0.6)'
};

const tabBtn = {
  flex: 1, padding: '10px', background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px'
};

const modalBody = {
  display: 'flex', padding: '20px', minHeight: '220px', maxHeight: '55vh', overflowY: 'auto'
};

const modalSubTitle = { fontSize: '0.7rem', color: '#e2a03f', letterSpacing: '1px', margin: '0 0 8px 0' };
const modalText = { fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0' };

const noteInputStyle = {
  flex: 1, background: '#0f172a', border: '1px solid rgba(51, 65, 85, 0.8)', color: '#fff',
  padding: '8px 12px', borderRadius: '4px', fontSize: '0.8rem', outline: 'none'
};

const addNoteBtn = {
  background: '#e2a03f', border: 'none', color: '#000', padding: '0 12px',
  fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer', borderRadius: '4px', fontFamily: 'monospace'
};

const noteCard = {
  backgroundColor: '#0f172a', border: '1px solid rgba(51, 65, 85, 0.6)', padding: '10px',
  borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '3px'
};

const noteCategoryTag = {
  fontSize: '0.55rem', color: '#e2a03f', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px'
};