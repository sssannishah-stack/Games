/**
 * A tiny synthesized sound engine — every effect is generated live with the
 * Web Audio API, so the app ships zero audio files and works offline. Browsers
 * block audio until a user gesture, so nothing is created until `unlock()` is
 * called from a real interaction; `play()` is a no-op before then.
 *
 * Kept framework-agnostic (a plain singleton); React talks to it through
 * `useSound`.
 */

export type SoundName =
  | "correct"
  | "wrong"
  | "coin"
  | "purchase"
  | "card"
  | "tick"
  | "warning"
  | "reveal"
  | "climb"
  | "winner"
  | "notify"
  | "join"
  | "spin"
  | "tap";

type Ctx = AudioContext;

class SoundManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private volume = 0.6;

  /** Create/resume the context from within a user gesture. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  isReady() {
    return this.unlocked && !!this.ctx;
  }

  play(name: SoundName, gain = 1) {
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const t = this.ctx.currentTime + 0.001;
    const bus = this.ctx.createGain();
    bus.gain.value = gain;
    bus.connect(this.master);
    try {
      SOUNDS[name]?.(this.ctx, bus, t);
    } catch {
      /* never let a sound crash a render path */
    }
    // Tidy up the per-play bus a moment after the longest tail.
    window.setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* already gone */
      }
    }, 2500);
  }
}

/* ---------- synthesis helpers ---------- */

interface ToneOpts {
  freq: number;
  to?: number; // glide target
  type?: OscillatorType;
  start?: number; // offset seconds from t
  dur?: number;
  attack?: number;
  release?: number;
  gain?: number;
}

function tone(ctx: Ctx, out: GainNode, t: number, o: ToneOpts) {
  const {
    freq,
    to,
    type = "sine",
    start = 0,
    dur = 0.18,
    attack = 0.006,
    release = 0.09,
    gain = 0.3,
  } = o;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  const t0 = t + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.02);
}

function noise(
  ctx: Ctx,
  out: GainNode,
  t: number,
  o: { start?: number; dur?: number; gain?: number; type?: BiquadFilterType; filter?: number; filterTo?: number }
) {
  const { start = 0, dur = 0.2, gain = 0.2, type = "bandpass", filter = 1200, filterTo } = o;
  const t0 = t + start;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(filter, t0);
  if (filterTo) filt.frequency.exponentialRampToValueAtTime(Math.max(1, filterTo), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// Equal-tempered note frequencies used by the little melodies.
const N = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
};

/* ---------- the palette ---------- */

const SOUNDS: Record<SoundName, (ctx: Ctx, out: GainNode, t: number) => void> = {
  // Bright rising two-note "ding" — got it right.
  correct: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.E5, type: "triangle", dur: 0.1, gain: 0.32 });
    tone(ctx, out, t, { freq: N.A5, type: "triangle", start: 0.09, dur: 0.16, gain: 0.34 });
    tone(ctx, out, t, { freq: N.C6, type: "sine", start: 0.09, dur: 0.16, gain: 0.14 });
  },
  // Low descending buzz — wrong.
  wrong: (ctx, out, t) => {
    tone(ctx, out, t, { freq: 196, to: 130, type: "sawtooth", dur: 0.26, gain: 0.22, release: 0.12 });
    tone(ctx, out, t, { freq: 98, to: 70, type: "square", dur: 0.26, gain: 0.12, release: 0.12 });
  },
  // Classic two-tone coin.
  coin: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.G5, type: "square", dur: 0.06, gain: 0.22 });
    tone(ctx, out, t, { freq: N.E6, type: "square", start: 0.06, dur: 0.14, gain: 0.24 });
  },
  // Coin + a little sparkle for a store buy.
  purchase: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.G5, type: "square", dur: 0.06, gain: 0.2 });
    tone(ctx, out, t, { freq: N.C6, type: "square", start: 0.06, dur: 0.1, gain: 0.22 });
    tone(ctx, out, t, { freq: N.E6, type: "triangle", start: 0.14, dur: 0.18, gain: 0.18 });
    noise(ctx, out, t, { start: 0.14, dur: 0.25, gain: 0.05, filter: 5000, filterTo: 9000, type: "highpass" });
  },
  // Shimmer sweep — a power card arming.
  card: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.C5, to: N.G6, type: "triangle", dur: 0.22, gain: 0.2, release: 0.1 });
    noise(ctx, out, t, { dur: 0.28, gain: 0.06, filter: 800, filterTo: 6000, type: "bandpass" });
  },
  // Dry clock tick.
  tick: (ctx, out, t) => {
    tone(ctx, out, t, { freq: 1500, type: "square", dur: 0.02, attack: 0.001, release: 0.02, gain: 0.12 });
  },
  // Urgent double beep.
  warning: (ctx, out, t) => {
    tone(ctx, out, t, { freq: 880, type: "square", dur: 0.09, gain: 0.2 });
    tone(ctx, out, t, { freq: 880, type: "square", start: 0.14, dur: 0.09, gain: 0.2 });
  },
  // Bright chord stab — answer reveal.
  reveal: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.C5, type: "triangle", dur: 0.4, gain: 0.18, release: 0.2 });
    tone(ctx, out, t, { freq: N.E5, type: "triangle", dur: 0.4, gain: 0.16, release: 0.2 });
    tone(ctx, out, t, { freq: N.G5, type: "triangle", dur: 0.4, gain: 0.16, release: 0.2 });
    noise(ctx, out, t, { dur: 0.3, gain: 0.05, filter: 3000, filterTo: 7000, type: "highpass" });
  },
  // Ascending whoosh — a team climbing the board.
  climb: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.C5, to: N.C6, type: "sine", dur: 0.3, gain: 0.2, release: 0.12 });
    noise(ctx, out, t, { dur: 0.32, gain: 0.05, filter: 400, filterTo: 4000, type: "bandpass" });
  },
  // Little major-arpeggio fanfare — winner.
  winner: (ctx, out, t) => {
    const seq: [number, number][] = [
      [N.C5, 0],
      [N.E5, 0.12],
      [N.G5, 0.24],
      [N.C6, 0.36],
    ];
    seq.forEach(([f, s]) => tone(ctx, out, t, { freq: f, type: "triangle", start: s, dur: 0.22, gain: 0.28 }));
    tone(ctx, out, t, { freq: N.G5, type: "square", start: 0.36, dur: 0.5, gain: 0.14, release: 0.3 });
    tone(ctx, out, t, { freq: N.C6, type: "triangle", start: 0.5, dur: 0.5, gain: 0.2, release: 0.35 });
    noise(ctx, out, t, { start: 0.36, dur: 0.5, gain: 0.05, filter: 4000, filterTo: 9000, type: "highpass" });
  },
  // Gentle two-note chime — a notification (store open).
  notify: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.G5, type: "sine", dur: 0.14, gain: 0.22 });
    tone(ctx, out, t, { freq: N.C6, type: "sine", start: 0.12, dur: 0.2, gain: 0.2 });
  },
  // Friendly pop — a team joins.
  join: (ctx, out, t) => {
    tone(ctx, out, t, { freq: N.E5, to: N.C6, type: "sine", dur: 0.12, gain: 0.24, release: 0.08 });
  },
  // Rising spin riser.
  spin: (ctx, out, t) => {
    tone(ctx, out, t, { freq: 220, to: 1200, type: "sawtooth", dur: 0.6, gain: 0.12, release: 0.1 });
    noise(ctx, out, t, { dur: 0.6, gain: 0.05, filter: 600, filterTo: 5000, type: "bandpass" });
  },
  // Subtle UI tap.
  tap: (ctx, out, t) => {
    tone(ctx, out, t, { freq: 660, type: "sine", dur: 0.03, attack: 0.002, release: 0.03, gain: 0.1 });
  },
};

export const soundManager = new SoundManager();
