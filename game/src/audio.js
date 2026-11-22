// Tiny WebAudio sounds, synthesized on the fly — no audio files to ship. Soft
// footsteps while the player moves (quieter and slower while sneaking), faint guard
// steps that grow louder as a guard draws near and pan with where the guard is, a
// rising blip when the alarm goes up, a chime for loot, a low buzz when caught.
// The context is created lazily on the first user gesture (browsers block audio
// before one) and stays silent in screenshot mode, where nothing calls it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let stepAt = 0;
  let guardAt = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** One short tone: frequency, seconds, wave shape, volume, stereo pan (-1..1). */
  function tone(freq, dur, type, volume, pan) {
    const c = ensure();
    if (!c || c.state !== 'running') return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const panner = c.createStereoPanner ? c.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.value = freq;
    const now = c.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  return {
    /** Call from a key press or click: wakes the context so later sounds play. */
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    /** A soft step while the player moves; call every frame, it throttles itself. */
    footstep(moving, sneaking, panX) {
      if (!moving) return;
      const now = performance.now();
      const gap = sneaking ? 520 : 340;
      if (now - stepAt < gap) return;
      stepAt = now;
      tone(sneaking ? 140 : 190, 0.07, 'sine', sneaking ? 0.05 : 0.11, panX);
    },
    /**
     * A guard's step, louder the nearer the guard is: call every frame with the
     * nearest guard's distance and its x relative to the player (-1..1).
     */
    guardStep(distance, panX) {
      if (distance > 320) return;
      const now = performance.now();
      if (now - guardAt < 480) return;
      guardAt = now;
      tone(110, 0.09, 'triangle', 0.16 * (1 - distance / 320), panX);
    },
    alarm() {
      tone(520, 0.14, 'square', 0.12, 0);
      setTimeout(() => tone(760, 0.2, 'square', 0.12, 0), 150);
    },
    loot() {
      tone(880, 0.12, 'sine', 0.14, 0);
      setTimeout(() => tone(1320, 0.18, 'sine', 0.12, 0), 90);
    },
    caught() {
      tone(140, 0.35, 'sawtooth', 0.14, 0);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.13, 0), i * 120));
    },
  };
}
