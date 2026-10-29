import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ============================================================
// ESCENA DE INTERROGATORIO
// Se crea UNA sola vez. React solo le manda órdenes:
//   setModo, setAnimo, gesto, setHablando, presentarEvidencia, flash
// ============================================================

const CAMARAS = {
  MENU: { pos: [1.8, 1.75, 2.2], mira: [-0.2, 0.95, -0.9], fov: 50 },
  JUEGO: { pos: [0, 1.5, 2.4], mira: [0, 1.0, -0.9], fov: 55 },
  ENFOQUE: { pos: [0.12, 1.38, 0.9], mira: [0, 1.28, -0.95], fov: 42 },
  MESA: { pos: [0, 1.65, 0.85], mira: [0, 0.78, -0.05], fov: 50 },
  FINAL: { pos: [-0.9, 1.3, 1.1], mira: [0, 1.05, -0.95], fov: 38 },
};

// Gestos: offsets (radianes) para cabeza, cuello y torso
const GESTOS = {
  NEUTRO: { cabeza: [0, 0], torso: 0 },
  EVITA_MIRADA: { cabeza: [0.28, 0.55], torso: 0.02 },
  SE_INCLINA: { cabeza: [-0.12, 0], torso: 0.22 },
  GOLPE_MESA: { cabeza: [-0.1, 0], torso: 0.3 },
  NIEGA: { cabeza: [0.05, 0], torso: 0 },
  RIE: { cabeza: [-0.22, 0.1], torso: -0.05 },
  SE_DERRUMBA: { cabeza: [0.55, 0.15], torso: 0.3 },
};

const amortiguar = (actual, objetivo, velocidad, dt) => actual + (objetivo - actual) * (1 - Math.exp(-velocidad * dt));

export class Escena {
  constructor(contenedor, { onProgreso } = {}) {
    this.contenedor = contenedor;
    this.onProgreso = onProgreso;
    this.modo = 'MENU';
    this.estres = 20;
    this.disposicion = 'CALMADO';
    this.gestoActual = 'NEUTRO';
    this.gestoInicio = 0;
    this.hablando = false;
    this.enfoqueHasta = 0;
    this.sacudida = 0;
    this.parpadeo = 0;
    this.huesos = { cabeza: [], cuello: [], torso: [] };
    this.offsets = { cabezaX: 0, cabezaY: 0, torso: 0 };
    this.tarjetas = [];
    this.reloj = new THREE.Timer();
    this.reloj.connect?.(document);
    this.t = 0;
    this.disposed = false;

    this.#crearRenderer();
    this.#crearSala();
    this.#crearLuces();
    this.#crearPolvo();
    this.#cargarSospechoso();

    const c = CAMARAS.MENU;
    this.camPos = new THREE.Vector3(...c.pos);
    this.camMira = new THREE.Vector3(...c.mira);
    this.camFov = c.fov;
    this.camara.position.copy(this.camPos);

    this.onResize = () => this.#redimensionar();
    window.addEventListener('resize', this.onResize);
    this.renderer.setAnimationLoop((ts) => this.#cuadro(ts));
  }

  // ---------------- API pública ----------------
  setModo(modo) {
    this.modo = modo;
  }

  setAnimo(disposicion, estres) {
    this.disposicion = disposicion;
    this.estres = estres;
  }

  setHablando(v) {
    this.hablando = v;
  }

  enfocar(segundos = 3.5) {
    this.enfoqueHasta = this.t + segundos;
  }

  gesto(nombre) {
    if (!GESTOS[nombre]) nombre = 'NEUTRO';
    this.gestoActual = nombre;
    this.gestoInicio = this.t;
    if (nombre === 'GOLPE_MESA') {
      setTimeout(() => {
        this.sacudida = 1;
        this.flash(0.25);
        this.#temblarTarjetas();
      }, 220);
    }
  }

  flash(duracion = 0.15) {
    this.parpadeo = Math.max(this.parpadeo, duracion);
  }

  presentarEvidencia(evidencia) {
    if (this.tarjetas.some((t) => t.id === evidencia.id)) {
      const t = this.tarjetas.find((t) => t.id === evidencia.id);
      t.inicio = this.t - 0.6; // pequeño "golpecito" sobre la mesa
      return;
    }
    const indice = this.tarjetas.length;
    const textura = this.#texturaEvidencia(evidencia);
    const mat = new THREE.MeshStandardMaterial({ map: textura, roughness: 0.85, side: THREE.DoubleSide });
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), mat);
    malla.castShadow = true;
    malla.receiveShadow = true;
    this.escena.add(malla);
    const destinoX = -0.45 + indice * 0.45;
    this.tarjetas.push({
      id: evidencia.id,
      malla,
      inicio: this.t,
      desde: new THREE.Vector3(0.1, 1.35, 1.2),
      hasta: new THREE.Vector3(destinoX, 0.796, 0.05 + (indice % 2) * 0.06),
      giro: (Math.random() - 0.5) * 0.35,
    });
    this.camEvidenciaHasta = this.t + 1.6;
  }

  limpiarEvidencias() {
    this.tarjetas.forEach((t) => {
      this.escena.remove(t.malla);
      t.malla.geometry.dispose();
      t.malla.material.map?.dispose();
      t.malla.material.dispose();
    });
    this.tarjetas = [];
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.reloj.dispose?.();
    window.removeEventListener('resize', this.onResize);
    this.limpiarEvidencias();
    this.escena.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------- Construcción ----------------
  #crearRenderer() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color(0x020203);
    this.escena.fog = new THREE.FogExp2(0x030405, 0.16);

    this.camara = new THREE.PerspectiveCamera(50, w / h, 0.05, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.contenedor.appendChild(this.renderer.domElement);
  }

  #crearSala() {
    const pared = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.92 });
    const piso = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x111113, metalness: 0.9, roughness: 0.25 });
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.35, metalness: 0.5 });
    this.metal = metal;

    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), piso);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    this.escena.add(suelo);

    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), pared);
    fondo.position.set(0, 2.5, -3.5);
    fondo.receiveShadow = true;
    this.escena.add(fondo);

    [-3, 3].forEach((x) => {
      const lateral = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), pared);
      lateral.position.set(x, 2.5, 0);
      lateral.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      lateral.receiveShadow = true;
      this.escena.add(lateral);
    });

    // Falso espejo con marco
    const espejo = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 1.4),
      new THREE.MeshPhysicalMaterial({ color: 0x05080c, roughness: 0.08, metalness: 0.95, clearcoat: 1 })
    );
    espejo.position.set(0, 2, -3.49);
    this.escena.add(espejo);
    const marco = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.5, 0.03), metal);
    marco.position.set(0, 2, -3.5);
    this.escena.add(marco);

    // Puerta en la pared izquierda con luz por debajo
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.95), new THREE.MeshStandardMaterial({ color: 0x24282d, roughness: 0.6, metalness: 0.3 }));
    puerta.position.set(-2.97, 1.05, -1.8);
    this.escena.add(puerta);
    this.luzPuerta = new THREE.PointLight(0xffd59a, 0.25, 1.2, 2);
    this.luzPuerta.position.set(-2.85, 0.05, -1.8);
    this.escena.add(this.luzPuerta);

    // Mesa
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.0), mesaMat);
    mesa.position.set(0, 0.75, -0.2);
    mesa.castShadow = true;
    mesa.receiveShadow = true;
    this.escena.add(mesa);
    [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].forEach(([x, z]) => {
      const pata = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), metal);
      pata.position.set(x, 0.375, z - 0.2);
      pata.castShadow = true;
      this.escena.add(pata);
    });

    // Objetos sobre la mesa: carpeta, vaso de café, cenicero
    const carpeta = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.24), new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9 }));
    carpeta.position.set(0.68, 0.8, -0.5);
    carpeta.rotation.y = 0.25;
    carpeta.castShadow = true;
    this.escena.add(carpeta);

    const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 20), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 }));
    vaso.position.set(-0.62, 0.845, -0.35);
    vaso.castShadow = true;
    this.escena.add(vaso);
    const cafe = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.2 }));
    cafe.rotation.x = -Math.PI / 2;
    cafe.position.set(-0.62, 0.895, -0.35);
    this.escena.add(cafe);
    this.vaso = vaso;

    const cenicero = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.025, 24), metal);
    cenicero.position.set(0.35, 0.805, -0.45);
    this.escena.add(cenicero);
    this.objetosMesa = [carpeta, vaso, cafe, cenicero];
    this.objetosMesa.forEach((o) => (o.userData.y0 = o.position.y));

    // Silla del sospechoso
    const silla = new THREE.Group();
    const asiento = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.44), metal);
    asiento.position.y = 0.47;
    const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.03), metal);
    respaldo.position.set(0, 0.74, -0.22);
    silla.add(asiento, respaldo);
    [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.47, 8), metal);
      p.position.set(x, 0.235, z);
      silla.add(p);
    });
    silla.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    silla.position.set(0, 0, -1.1);
    this.escena.add(silla);
    this.silla = silla;
  }

  #crearLuces() {
    this.escena.add(new THREE.AmbientLight(0x0d1117, 0.3));

    // Luz fría de relleno desde el espejo (da volumen a la silueta)
    const relleno = new THREE.DirectionalLight(0x5a7aa8, 0.35);
    relleno.position.set(-2, 2.5, -3);
    this.escena.add(relleno);

    // Luz roja de tensión: crece con el estrés
    this.luzTension = new THREE.PointLight(0xff2a2a, 0, 6, 2);
    this.luzTension.position.set(1.5, 1.6, -2.5);
    this.escena.add(this.luzTension);

    this.foco = new THREE.SpotLight(0xffedd8, 120);
    this.foco.position.set(0, 2.7, -0.3);
    this.foco.angle = Math.PI / 3.5;
    this.foco.penumbra = 0.6;
    this.foco.decay = 2;
    this.foco.castShadow = true;
    this.foco.shadow.mapSize.set(2048, 2048);
    this.foco.shadow.bias = -0.0005;
    this.foco.target.position.set(0, 0.8, -0.5);
    this.escena.add(this.foco, this.foco.target);

    // Lámpara colgante (cable + pantalla + bombilla)
    this.lampara = new THREE.Group();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), this.metal);
    cable.position.y = 0.6;
    const pantalla = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.18, 24, 1, true), this.metal);
    const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff3dd }));
    bombilla.position.y = -0.06;
    this.bombilla = bombilla;
    this.lampara.add(cable, pantalla, bombilla);
    this.lampara.position.set(0, 2.65, -0.3);
    this.escena.add(this.lampara);

    // Cono de luz volumétrico (shader que se desvanece hacia abajo)
    const conoGeo = new THREE.ConeGeometry(1.35, 2.6, 48, 1, true);
    conoGeo.translate(0, -1.3, 0);
    this.conoMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { intensidad: { value: 0.09 }, color: { value: new THREE.Color(0xffe6c4) } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float intensidad; uniform vec3 color; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ float alto = clamp(1.0 + vY / 2.6, 0.0, 1.0);
          float borde = pow(abs(dot(vN, vV)), 1.5);
          gl_FragColor = vec4(color, intensidad * alto * alto * borde); }`,
    });
    const cono = new THREE.Mesh(conoGeo, this.conoMat);
    cono.position.set(0, 2.62, -0.3);
    this.escena.add(cono);
  }

  #crearPolvo() {
    const n = 450;
    const pos = new Float32Array(n * 3);
    this.polvoVel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(Math.random()) * 1.1;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.4 + Math.random() * 2.2;
      pos[i * 3 + 2] = -0.3 + Math.sin(a) * r;
      this.polvoVel[i] = 0.3 + Math.random() * 0.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 32;
    const ctx = lienzo.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,220,1)');
    g.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    this.polvo = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.012, map: new THREE.CanvasTexture(lienzo), transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.escena.add(this.polvo);
  }

  #cargarSospechoso() {
    this.grupo = new THREE.Group();
    this.grupo.position.set(0, 0, -1.0);
    this.escena.add(this.grupo);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_u, cargados, total) => this.onProgreso?.(cargados / total);
    const loader = new GLTFLoader(manager);
    loader.load(
      '/models/sentado.glb',
      (gltf) => {
        if (this.disposed) return;
        const modelo = gltf.scene;
        modelo.scale.setScalar(1.6);
        modelo.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
          if (o.isBone) {
            // El modelo trae huesos duplicados: se guardan todos para moverlos juntos
            if (/Head(_\d+)?$/.test(o.name) && !/HeadTop/.test(o.name)) this.huesos.cabeza.push(o);
            else if (/Neck(_\d+)?$/.test(o.name)) this.huesos.cuello.push(o);
            else if (/Spine2(_\d+)?$/.test(o.name)) this.huesos.torso.push(o);
          }
        });
        Object.values(this.huesos).flat().forEach((h) => (h.userData.reposo = h.quaternion.clone()));
        if (gltf.animations?.length) {
          this.mixer = new THREE.AnimationMixer(modelo);
          this.mixer.clipAction(gltf.animations[0]).play(); // solo el clip principal
        }
        this.grupo.add(modelo);
        this.onProgreso?.(1);
      },
      (e) => { if (e.total) this.onProgreso?.(Math.min(0.99, e.loaded / e.total)); },
      (err) => {
        console.error('Error al cargar el modelo del sospechoso:', err);
        this.onProgreso?.(1);
      }
    );
  }

  #texturaEvidencia(ev) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 512;
    lienzo.height = 376;
    const ctx = lienzo.getContext('2d');
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;

    const dibujarProvisional = () => {
      ctx.fillStyle = '#e9e1cf';
      ctx.fillRect(0, 0, 512, 376);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(24, 24, 464, 250);
      ctx.font = '90px serif';
      ctx.textAlign = 'center';
      ctx.fillText(ev.icono, 256, 180);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(ev.nombre.toUpperCase(), 256, 318);
      ctx.font = '22px monospace';
      ctx.fillStyle = '#7a2a1a';
      ctx.fillText(`EVIDENCIA · ${ev.hora}`, 256, 352);
      textura.needsUpdate = true;
    };
    dibujarProvisional();

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(0, 0, 512, 376);
      const m = 18;
      const escala = Math.min((512 - m * 2) / img.width, (376 - m * 2) / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, (512 - w) / 2, (376 - h) / 2, w, h);
      textura.needsUpdate = true;
    };
    img.src = ev.imagen;
    return textura;
  }

  #temblarTarjetas() {
    this.tiempoTemblor = this.t;
  }

  #redimensionar() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (!w || !h) return;
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------------- Bucle ----------------
  #cuadro(timestamp) {
    this.reloj.update(timestamp);
    const dt = Math.min(this.reloj.getDelta(), 0.05);
    this.t = this.reloj.getElapsed();
    const t = this.t;
    const tension = this.estres / 100;

    this.#animarSospechoso(dt, t, tension);
    this.#animarCamara(dt, t, tension);
    this.#animarLuz(dt, t, tension);
    this.#animarPolvo(dt, t);
    this.#animarTarjetas(t);

    // Temblor de los objetos de la mesa tras un golpe
    if (this.tiempoTemblor) {
      const e = t - this.tiempoTemblor;
      const salto = e < 0.5 ? Math.sin(e * 40) * 0.006 * (1 - e / 0.5) : 0;
      this.objetosMesa.forEach((o, i) => (o.position.y = o.userData.y0 + Math.abs(salto) * (1 + i * 0.3)));
    }

    this.renderer.render(this.escena, this.camara);
  }

  #animarSospechoso(dt, t, tension) {
    // 1) Restaurar huesos, 2) el mixer aplica la animación base, 3) sumar los gestos encima
    Object.values(this.huesos).flat().forEach((h) => h.quaternion.copy(h.userData.reposo));
    this.mixer?.update(dt * (1 + tension * 0.4));

    const g = GESTOS[this.gestoActual];
    const e = t - this.gestoInicio;
    // Los gestos duran unos segundos y vuelven a una postura que depende del ánimo
    const duracion = this.gestoActual === 'SE_DERRUMBA' ? Infinity : 4.5;
    const peso = e < duracion ? 1 : 0;
    let objX = g.cabeza[0] * peso;
    let objY = g.cabeza[1] * peso;
    let objT = g.torso * peso;

    // Postura base según disposición
    if (peso === 0) {
      if (this.disposicion === 'NERVIOSO') { objX = 0.12; objY = Math.sin(t * 0.7) * 0.25; }
      if (this.disposicion === 'HOSTIL' || this.disposicion === 'IRRITADO') { objX = -0.08; objT = 0.12; }
      if (this.disposicion === 'CERRADO') { objX = 0.3; objY = -0.35; objT = -0.05; }
      if (this.disposicion === 'QUEBRADO') { objX = 0.5; objT = 0.28; }
    }

    // Golpe en la mesa: impulso rápido hacia adelante
    if (this.gestoActual === 'GOLPE_MESA' && e < 0.6) objT += Math.sin(Math.min(e / 0.25, 1) * Math.PI) * 0.25;
    // Negar con la cabeza
    if (this.gestoActual === 'NIEGA' && e < 1.6) objY += Math.sin(e * 11) * 0.22 * (1 - e / 1.6);
    // Risa: pequeños rebotes
    if (this.gestoActual === 'RIE' && e < 1.5) objX += Math.abs(Math.sin(e * 14)) * -0.06 * (1 - e / 1.5);

    // Microgestos: respiración (más rápida con estrés), mirada inquieta y asentir al hablar
    const respiracion = Math.sin(t * (1.6 + tension * 2.4)) * (0.012 + tension * 0.012);
    const inquietud = tension > 0.5 ? (Math.sin(t * 2.3) * Math.sin(t * 3.7)) * 0.05 * tension : 0;
    const habla = this.hablando ? Math.sin(t * 9) * 0.035 + Math.sin(t * 5.3) * 0.02 : 0;

    const vel = this.gestoActual === 'GOLPE_MESA' ? 14 : 4;
    this.offsets.cabezaX = amortiguar(this.offsets.cabezaX, objX, vel, dt);
    this.offsets.cabezaY = amortiguar(this.offsets.cabezaY, objY, vel, dt);
    this.offsets.torso = amortiguar(this.offsets.torso, objT, vel, dt);

    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const aplicar = (huesos, x, y) => {
      eul.set(x, y, 0);
      q.setFromEuler(eul);
      huesos.forEach((h) => h.quaternion.multiply(q));
    };
    aplicar(this.huesos.torso, this.offsets.torso * 0.6 + respiracion, 0);
    aplicar(this.huesos.cuello, this.offsets.cabezaX * 0.35, this.offsets.cabezaY * 0.4);
    aplicar(this.huesos.cabeza, this.offsets.cabezaX * 0.65 + habla, this.offsets.cabezaY * 0.6 + inquietud);
  }

  #animarCamara(dt, t, tension) {
    let c = CAMARAS[this.modo] || CAMARAS.JUEGO;
    if (this.modo === 'JUEGO' && t < this.enfoqueHasta) c = CAMARAS.ENFOQUE;
    if (this.modo === 'JUEGO' && this.camEvidenciaHasta && t < this.camEvidenciaHasta) c = CAMARAS.MESA;

    const objetivo = new THREE.Vector3(...c.pos);
    if (this.modo === 'MENU') {
      objetivo.x += Math.sin(t * 0.25) * 0.35;
      objetivo.y += Math.sin(t * 0.17) * 0.08;
    }
    if (this.modo === 'FINAL') {
      objetivo.x += Math.sin(t * 0.1) * 0.25;
    }
    const vel = this.modo === 'MENU' ? 0.8 : 1.8;
    this.camPos.x = amortiguar(this.camPos.x, objetivo.x, vel, dt);
    this.camPos.y = amortiguar(this.camPos.y, objetivo.y, vel, dt);
    this.camPos.z = amortiguar(this.camPos.z, objetivo.z, vel, dt);
    this.camMira.x = amortiguar(this.camMira.x, c.mira[0], vel * 1.2, dt);
    this.camMira.y = amortiguar(this.camMira.y, c.mira[1], vel * 1.2, dt);
    this.camMira.z = amortiguar(this.camMira.z, c.mira[2], vel * 1.2, dt);
    this.camFov = amortiguar(this.camFov, c.fov, vel, dt);

    // Cámara en mano: más temblorosa cuanto más tensa la sala
    const amp = 0.004 + tension * 0.008;
    const mano = new THREE.Vector3(
      Math.sin(t * 0.9) * amp + Math.sin(t * 2.1) * amp * 0.4,
      Math.sin(t * 1.3) * amp * 0.8,
      0
    );
    // Sacudida por golpe
    if (this.sacudida > 0) {
      this.sacudida = Math.max(0, this.sacudida - dt * 2.5);
      const s = this.sacudida * this.sacudida * 0.05;
      mano.x += (Math.random() - 0.5) * s;
      mano.y += (Math.random() - 0.5) * s;
    }
    this.camara.position.copy(this.camPos).add(mano);
    this.camara.fov = this.camFov;
    this.camara.updateProjectionMatrix();
    this.camara.lookAt(this.camMira);
  }

  #animarLuz(dt, t, tension) {
    // Parpadeo de tubo fluorescente: más frecuente con estrés
    if (this.parpadeo <= 0 && Math.random() < dt * (0.05 + tension * 0.5)) {
      this.parpadeo = 0.05 + Math.random() * 0.12;
    }
    let intensidad = 120 + Math.sin(t * 3) * 4;
    if (this.parpadeo > 0) {
      this.parpadeo -= dt;
      intensidad *= Math.random() < 0.5 ? 0.15 : 0.55;
    }
    if (this.modo === 'FINAL') intensidad *= 0.7;
    this.foco.intensity = intensidad;
    const k = intensidad / 120;
    this.conoMat.uniforms.intensidad.value = 0.09 * k;
    this.bombilla.material.color.setScalar(0.3 + 0.7 * k);

    // Luz roja de tensión
    const rojo = tension > 0.55 ? (tension - 0.55) * 8 * (0.8 + Math.sin(t * (2 + tension * 4)) * 0.2) : 0;
    this.luzTension.intensity = amortiguar(this.luzTension.intensity, rojo, 2, dt);

    // La lámpara se balancea un poco (y mucho tras un golpe)
    const balanceo = 0.015 + this.sacudida * 0.08;
    this.lampara.rotation.z = Math.sin(t * 1.1) * balanceo;
    this.lampara.rotation.x = Math.cos(t * 0.8) * balanceo * 0.6;
  }

  #animarPolvo(dt, t) {
    const p = this.polvo.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 0.02 * this.polvoVel[i];
      if (y < 0.4) y = 2.6;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01);
    }
    p.needsUpdate = true;
  }

  #animarTarjetas(t) {
    this.tarjetas.forEach((tar) => {
      const e = Math.min((t - tar.inicio) / 0.9, 1);
      // Curva con un pequeño rebote al caer sobre la mesa
      const k = 1 - Math.pow(1 - e, 3);
      tar.malla.position.lerpVectors(tar.desde, tar.hasta, k);
      tar.malla.position.y += Math.sin(e * Math.PI) * 0.12;
      tar.malla.rotation.set(-Math.PI / 2 * k + (1 - k) * 0.2, 0, tar.giro * k + (1 - k) * 0.6);
      if (this.tiempoTemblor) {
        const d = t - this.tiempoTemblor;
        if (d < 0.5) tar.malla.position.y += Math.abs(Math.sin(d * 40)) * 0.008 * (1 - d / 0.5);
      }
    });
  }
}
