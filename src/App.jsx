import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function App() {
  const mountRef = useRef(null);

  // Estados del Flujo de Juego
  const [gameState, setGameState] = useState('MENU'); // 'MENU' | 'PLAYING'
  const [suspectStress, setSuspectStress] = useState(20);
  const [dialogueText, setDialogueText] = useState("No tengo nada que decirte, detective. Estás perdiendo el tiempo.");
  const [suspectStatus, setSuspectStatus] = useState("Calmado");

  // Referencias para controlar animación y cámara 3D
  const suspectRef = useRef(null);
  const cameraRef = useRef(null);
  
  // Posiciones de cámara para Menú vs Juego
  const camPositions = {
    MENU: { x: 1.8, y: 1.8, z: 2.2, lookX: -0.2, lookY: 0.9, lookZ: -0.9 },
    PLAYING: { x: 0, y: 1.5, z: 2.6, lookX: 0, lookY: 0.8, lookZ: -0.9 },
    ZOOM: { x: 0.15, y: 1.25, z: 0.4, lookX: 0, lookY: 1.2, lookZ: -0.9 }
  };

  const targetCamPos = useRef(camPositions.MENU);

  useEffect(() => {
    const currentMount = mountRef.current;
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

    // 2. MATERIALES
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.9 });
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.3, metalness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x111113, metalness: 0.9, roughness: 0.2 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a381, roughness: 0.6 });

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

    // 4. MESA
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

    // 5. SOSPECHOSO (Representación 3D)
    const suspectGroup = new THREE.Group();
    suspectGroup.position.set(0, 0, -0.9);
    suspectRef.current = suspectGroup;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), clothMat);
    torso.position.set(0, 0.8, 0);
    torso.castShadow = true;
    suspectGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), skinMat);
    head.scale.set(1, 1.2, 1);
    head.position.set(0, 1.22, 0.02);
    head.castShadow = true;
    suspectGroup.add(head);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), clothMat);
    leftArm.position.set(-0.22, 0.72, 0.22);
    leftArm.rotation.x = Math.PI / 3;
    leftArm.rotation.z = -Math.PI / 12;
    leftArm.castShadow = true;
    suspectGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), clothMat);
    rightArm.position.set(0.22, 0.72, 0.22);
    rightArm.rotation.x = Math.PI / 3;
    rightArm.rotation.z = Math.PI / 12;
    rightArm.castShadow = true;
    suspectGroup.add(rightArm);

    const hands = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), skinMat);
    hands.position.set(0, 0.75, 0.4);
    hands.castShadow = true;
    suspectGroup.add(hands);

    scene.add(suspectGroup);

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

    // 7. LOOP DE ANIMACIÓN Y CÁMARA
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Transición suave de Cámara (LERP)
      camera.position.x += (targetCamPos.current.x - camera.position.x) * 0.03;
      camera.position.y += (targetCamPos.current.y - camera.position.y) * 0.03;
      camera.position.z += (targetCamPos.current.z - camera.position.z) * 0.03;

      // Órbita panorámica sutil si estamos en el MENÚ
      if (gameState === 'MENU') {
        const orbitRadius = 0.3;
        const menuTargetX = camPositions.MENU.x + Math.sin(elapsedTime * 0.5) * orbitRadius;
        camera.position.x += (menuTargetX - camera.position.x) * 0.02;
      }

      camera.lookAt(targetCamPos.current.lookX, targetCamPos.current.lookY, targetCamPos.current.lookZ);

      // Animación del personaje
      if (suspectGroup) {
        suspectGroup.position.y = Math.sin(elapsedTime * 2) * 0.003;
        if (suspectStress > 60) {
          suspectGroup.rotation.y = (Math.random() - 0.5) * 0.015;
        } else {
          suspectGroup.rotation.y = 0;
        }
      }

      spotLight.intensity = 120 + Math.sin(elapsedTime * 3) * 5;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
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
      currentMount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [gameState, suspectStress]);

  // INICIAR JUEGO
  const startGame = () => {
    setGameState('PLAYING');
    targetCamPos.current = camPositions.PLAYING;
  };

  // INTERACCIÓN DE PREGUNTAS
  const handleQuestion = (option) => {
    targetCamPos.current = camPositions.ZOOM;

    setTimeout(() => {
      targetCamPos.current = camPositions.PLAYING;
    }, 3500);

    if (option === 1) {
      setSuspectStress((prev) => Math.min(prev + 10, 100));
      setDialogueText("Estaba en mi apartamento solo. Viendo televisión. Nadie puede confirmarlo, ¿y qué?");
      setSuspectStatus("A la defensiva");
    } else if (option === 2) {
      setSuspectStress((prev) => Math.min(prev + 35, 100));
      setDialogueText("¡¿De dónde sacaste eso?! ¡Eso no es mío! Alguien tuvo que ponerlo ahí, te lo juro.");
      setSuspectStatus("Nervioso / Inestable");
    } else if (option === 3) {
      setSuspectStress((prev) => Math.max(prev - 15, 0));
      setDialogueText("... (Evita el contacto visual y traga saliva. El silencio lo incomoda).");
      setSuspectStatus("Intimidado");
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* 3D Canvas */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* BARRAS NEGRAS CINE */}
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
              Tienes pocos minutos antes de que el abogado del sospechoso llegue.
            </p>
            <div style={btnGroup}>
              <button style={startBtn} onClick={startGame}>
                INICIAR INTERROGATORIO
              </button>
              <button style={secondaryBtn} onClick={() => alert("Usa las preguntas estratégicamente para hacer colapsar al sospechoso.")}>
                EXPEDIENTE DEL CASO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== INTERFAZ DE JUEGO ==================== */}
      {gameState === 'PLAYING' && (
        <>
          <div style={headerUI}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '3px', color: '#e2e2e2' }}>SUJETO #409 - "CARTER"</h2>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>ESTRÉS: {suspectStress}%</span>
              <div style={stressBarBackground}>
                <div style={{ ...stressBarFill, width: `${suspectStress}%`, background: suspectStress > 60 ? '#d93838' : '#e2a03f' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>[{suspectStatus}]</span>
            </div>
          </div>

          <div style={dialogueBox}>
            <p style={characterName}>SUSPECT CARTER</p>
            <p style={dialogueContent}>"{dialogueText}"</p>
          </div>

          <div style={optionsContainer}>
            <button style={optionBtn} onClick={() => handleQuestion(1)}>
              <span style={btnNumber}>01.</span> "¿Dónde estabas anoche a las 11:00 PM?"
            </button>
            <button style={optionBtn} onClick={() => handleQuestion(2)}>
              <span style={btnNumber}>02.</span> [Mostrar foto de la escena del crimen]
            </button>
            <button style={optionBtn} onClick={() => handleQuestion(3)}>
              <span style={btnNumber}>03.</span> [Mirenlo en silencio sin pestañear]
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ESTILOS DE LA INTERFAZ
const topBar = { position: 'absolute', top: 0, left: 0, width: '100%', height: '50px', background: '#000', zIndex: 10 };
const bottomBar = { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '50px', background: '#000', zIndex: 10 };

// MENÚ ESTILOS
const menuOverlay = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
  paddingLeft: '10%', background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%)',
  zIndex: 20, fontFamily: 'monospace'
};

const menuContent = { maxWidth: '500px', color: '#fff' };
const subtitleTag = { color: '#e2a03f', fontSize: '0.8rem', letterSpacing: '3px', fontWeight: 'bold' };
const gameTitle = { fontSize: '3rem', margin: '10px 0', letterSpacing: '4px', textTransform: 'uppercase', lineHeight: '1' };
const gameDesc = { color: '#aaa', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '30px', fontFamily: 'sans-serif' };

const btnGroup = { display: 'flex', flexDirection: 'column', gap: '12px' };

const startBtn = {
  background: '#e2a03f', border: 'none', color: '#000', padding: '16px 24px',
  fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '2px', cursor: 'pointer',
  transition: 'transform 0.2s, background 0.2s'
};

const secondaryBtn = {
  background: 'transparent', border: '1px solid #444', color: '#ccc', padding: '12px 24px',
  fontSize: '0.8rem', letterSpacing: '1px', cursor: 'pointer'
};

// JUEGO ESTILOS
const headerUI = { position: 'absolute', top: '65px', left: '40px', zIndex: 20, fontFamily: 'monospace' };
const stressBarBackground = { width: '120px', height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' };
const stressBarFill = { height: '100%', transition: 'width 0.5s ease, background 0.5s ease' };

const dialogueBox = {
  position: 'absolute', bottom: '140px', left: '50%', transform: 'translateX(-50%)',
  width: '60%', maxWidth: '700px', backgroundColor: 'rgba(10, 12, 16, 0.85)',
  borderLeft: '3px solid #e2a03f', padding: '15px 25px', backdropFilter: 'blur(4px)',
  zIndex: 20, fontFamily: 'sans-serif'
};

const characterName = { margin: 0, fontSize: '0.75rem', color: '#e2a03f', letterSpacing: '2px', fontWeight: 'bold' };
const dialogueContent = { margin: '8px 0 0 0', fontSize: '1.05rem', color: '#eee', lineHeight: '1.4', fontStyle: 'italic' };

const optionsContainer = {
  position: 'absolute', bottom: '65px', left: '50%', transform: 'translateX(-50%)',
  display: 'flex', gap: '12px', zIndex: 20
};

const optionBtn = {
  background: 'rgba(20, 24, 30, 0.9)', border: '1px solid #333d4d', color: '#ccc',
  padding: '12px 18px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'sans-serif',
  borderRadius: '4px', outline: 'none'
};

const btnNumber = { color: '#e2a03f', fontWeight: 'bold', marginRight: '6px' };