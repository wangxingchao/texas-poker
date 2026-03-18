// Professional poker sound engine using Web Audio API
// Synthesized sounds — no external files needed

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Sound primitives ──────────────────────────────────────────────

function playTone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.frequency.value = freq;
  osc.type = type;
  const t = c.currentTime + delay;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

function playNoise(duration, volume = 0.08, delay = 0) {
  const c = getCtx();
  if (!c) return;
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  const t = c.currentTime + delay;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  source.start(t);
  source.stop(t + duration);
}

// ── Game sounds ───────────────────────────────────────────────────

export const Sounds = {
  // Card deal — short crisp "snap"
  cardDeal() {
    playNoise(0.06, 0.2);
    playTone(1200, 0.04, 'square', 0.05, 0.01);
  },

  // Card flip at showdown
  cardFlip() {
    playNoise(0.08, 0.15);
    playTone(800, 0.05, 'square', 0.06);
    playTone(1600, 0.03, 'sine', 0.04, 0.03);
  },

  // Chip bet — clink sound
  chipBet() {
    playTone(3000, 0.04, 'sine', 0.08);
    playTone(4200, 0.03, 'sine', 0.06, 0.02);
    playTone(2500, 0.05, 'triangle', 0.04, 0.04);
  },

  // Chips sliding to pot
  chipsToPot() {
    for (let i = 0; i < 4; i++) {
      playTone(2800 + i * 300, 0.04, 'sine', 0.06, i * 0.04);
      playNoise(0.03, 0.04, i * 0.04);
    }
  },

  // Check — soft tap
  check() {
    playTone(600, 0.08, 'sine', 0.06);
    playNoise(0.03, 0.04);
  },

  // Fold — swoosh
  fold() {
    playTone(400, 0.15, 'sine', 0.06);
    playTone(200, 0.2, 'sine', 0.04, 0.05);
    playNoise(0.1, 0.03, 0.02);
  },

  // Raise — assertive ascending
  raise() {
    playTone(500, 0.08, 'square', 0.06);
    playTone(700, 0.08, 'square', 0.06, 0.06);
    playTone(900, 0.1, 'square', 0.08, 0.12);
    Sounds.chipBet();
  },

  // All-in — dramatic
  allIn() {
    playTone(300, 0.15, 'sawtooth', 0.08);
    playTone(450, 0.15, 'sawtooth', 0.08, 0.1);
    playTone(600, 0.15, 'sawtooth', 0.08, 0.2);
    playTone(900, 0.25, 'sawtooth', 0.12, 0.3);
    for (let i = 0; i < 6; i++) {
      playTone(2500 + i * 400, 0.04, 'sine', 0.05, 0.3 + i * 0.03);
    }
  },

  // Community card reveal (flop/turn/river)
  communityCard() {
    playNoise(0.05, 0.12);
    playTone(880, 0.06, 'sine', 0.08);
    playTone(1100, 0.04, 'sine', 0.06, 0.04);
  },

  // Your turn — attention chime
  yourTurn() {
    playTone(880, 0.12, 'sine', 0.1);
    playTone(1100, 0.12, 'sine', 0.1, 0.12);
    playTone(1320, 0.15, 'sine', 0.12, 0.24);
  },

  // Timer warning (< 10s)
  timerWarning() {
    playTone(1000, 0.08, 'square', 0.08);
  },

  // ── WIN — Big celebratory fanfare ──
  win() {
    // Ascending triumphant notes
    const notes = [523, 659, 784, 1047, 1318];
    notes.forEach((f, i) => {
      playTone(f, 0.2, 'sine', 0.12, i * 0.1);
      playTone(f * 1.5, 0.15, 'triangle', 0.06, i * 0.1 + 0.05);
    });
    // Final chord
    playTone(1047, 0.5, 'sine', 0.15, 0.5);
    playTone(1318, 0.5, 'sine', 0.12, 0.5);
    playTone(1568, 0.5, 'sine', 0.1, 0.5);
    // Chip shower
    for (let i = 0; i < 8; i++) {
      playTone(2000 + Math.random() * 3000, 0.04, 'sine', 0.04, 0.6 + i * 0.05);
    }
  },

  // LOSE — Descending sad trombone
  lose() {
    playTone(400, 0.25, 'sine', 0.08);
    playTone(380, 0.25, 'sine', 0.07, 0.2);
    playTone(350, 0.25, 'sine', 0.06, 0.4);
    playTone(300, 0.4, 'sine', 0.06, 0.6);
  },

  // Early win (everyone folded) — subtle win
  earlyWin() {
    Sounds.chipsToPot();
    playTone(660, 0.15, 'sine', 0.1, 0.2);
    playTone(880, 0.2, 'sine', 0.1, 0.3);
  },

  // New hand starting
  newHand() {
    playTone(440, 0.08, 'sine', 0.06);
    playNoise(0.05, 0.06, 0.05);
  },
};
