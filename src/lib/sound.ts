// Som de caixa registradora ("ka-ching") tocado quando chega pedido novo no painel.
// Arquivo: public/sounds/caixa-registradora.mp3 (Epidemic Sound).
// Se o arquivo não carregar, toca um "tlin tlin" gerado no próprio navegador.

const SOUND_URL = '/sounds/caixa-registradora.mp3';

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Baixa o som antes, para tocar na hora em que o pedido chegar. */
export function preloadCashRegister() {
  if (buffer || loading) return loading;
  const ac = getCtx();
  if (!ac) return null;
  loading = fetch(SOUND_URL)
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('som não encontrado'))))
    .then(data => ac.decodeAudioData(data))
    .then(decoded => { buffer = decoded; })
    .catch(() => { loading = null; });
  return loading;
}

function bell(ac: AudioContext, freq: number, start: number, duration = 0.6) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function playFallback(ac: AudioContext) {
  const now = ac.currentTime + 0.02;
  bell(ac, 1568, now);
  bell(ac, 2093, now + 0.18);
}

/** Toca o "ka-ching". O navegador só libera som depois de algum clique na página. */
export async function playCashRegister() {
  const ac = getCtx();
  if (!ac) {
    // navegador sem Web Audio: tenta o <audio> comum
    try { await new Audio(SOUND_URL).play(); } catch { /* sem som */ }
    return;
  }
  if (!buffer) await preloadCashRegister();
  if (buffer) {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    src.start();
  } else {
    playFallback(ac);
  }
}
