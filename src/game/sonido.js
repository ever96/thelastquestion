// Sonido procedural con WebAudio (sin archivos): zumbido de la sala,
// latido con estrés alto, golpe en la mesa, papel sobre la mesa y "tecleo".

let ctx = null;
let maestro = null;
let latidoTimer = null;
let estresActual = 0;
let silenciado = false;

export function iniciarSonido() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  maestro = ctx.createGain();
  maestro.gain.value = silenciado ? 0 : 0.8;
  maestro.connect(ctx.destination);

  // Zumbido eléctrico de fluorescente (50 Hz + armónico)
  [50, 100].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.018 : 0.008;
    o.connect(filtro).connect(g).connect(maestro);
    o.start();
  });

  // Ruido de sala (aire acondicionado)
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  const ruido = ctx.createBufferSource();
  ruido.buffer = buffer;
  ruido.loop = true;
  const fr = ctx.createBiquadFilter();
  fr.type = 'lowpass';
  fr.frequency.value = 400;
  const gr = ctx.createGain();
  gr.gain.value = 0.02;
  ruido.connect(fr).connect(gr).connect(maestro);
  ruido.start();

  programarLatido();
}

function programarLatido() {
  clearTimeout(latidoTimer);
  const intervalo = 1100 - estresActual * 5; // más rápido con más estrés
  latidoTimer = setTimeout(() => {
    if (estresActual >= 65) {
      golpeGrave(0.0, 0.35 * ((estresActual - 60) / 40));
      golpeGrave(0.16, 0.22 * ((estresActual - 60) / 40));
    }
    programarLatido();
  }, Math.max(450, intervalo));
}

function golpeGrave(retraso, volumen, frecuencia = 55) {
  if (!ctx || volumen <= 0) return;
  const t = ctx.currentTime + retraso;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(frecuencia * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(frecuencia, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(maestro);
  o.start(t);
  o.stop(t + 0.4);
}

function rafagaRuido(duracion, frecuencia, volumen, retraso = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + retraso;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duracion), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = frecuencia;
  const g = ctx.createGain();
  g.gain.value = volumen;
  s.connect(f).connect(g).connect(maestro);
  s.start(t);
}

export function setEstresSonido(estres) {
  estresActual = estres;
}

export function sonidoGolpe() {
  golpeGrave(0.22, 0.9, 45);
  rafagaRuido(0.25, 300, 0.6, 0.22);
}

export function sonidoPapel() {
  rafagaRuido(0.35, 2500, 0.25);
  rafagaRuido(0.12, 900, 0.3, 0.45);
}

export function sonidoTecla() {
  rafagaRuido(0.02, 3500, 0.05);
}

export function sonidoRevelacion() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [220, 207.65].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.25);
    g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.25 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 1.4);
    o.connect(g).connect(maestro);
    o.start(t + i * 0.25);
    o.stop(t + i * 0.25 + 1.5);
  });
}

export function alternarSilencio() {
  silenciado = !silenciado;
  if (maestro) maestro.gain.value = silenciado ? 0 : 0.8;
  return silenciado;
}
