// Som de "caixa registradora" gerado no próprio navegador (Web Audio API).
// Não depende de arquivo nem de site externo, então funciona sempre.

let ctx: AudioContext | null = null;

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

function bell(ac: AudioContext, freq: number, start: number, duration = 0.6) {
  const osc = ac.createOscillator();
  const harmonic = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  harmonic.type = 'triangle';
  osc.frequency.value = freq;
  harmonic.frequency.value = freq * 2.76; // brilho metálico de sino
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  harmonic.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  harmonic.start(start);
  osc.stop(start + duration);
  harmonic.stop(start + duration);
}

function coins(ac: AudioContext, start: number) {
  for (let i = 0; i < 6; i++) {
    const t = start + i * 0.05 + Math.random() * 0.03;
    bell(ac, 2200 + Math.random() * 1400, t, 0.12);
  }
}

/** Toca "TLIN TLIN + moedas". Chame depois de algum clique do usuário na página. */
export function playCashRegister() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime + 0.02;
  bell(ac, 1568, now);        // TLIN
  bell(ac, 2093, now + 0.18); // TLIN
  coins(ac, now + 0.4);       // moedas
}
