// Shared AudioContext, a simple piano-like synth, and a sample-accurate metronome.

import { midiToFreq } from '../../piano/music/theory';

let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Convert an AudioContext time (seconds) to performance.now() milliseconds, as heard. */
export function ctxTimeToPerf(t: number): number {
  const c = audioCtx();
  const ts = c.getOutputTimestamp();
  if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.performanceTime + (t - ts.contextTime) * 1000;
  }
  return performance.now() + (t - c.currentTime) * 1000 + (c.outputLatency || c.baseLatency || 0) * 1000;
}

export function perfToCtxTime(p: number): number {
  const c = audioCtx();
  const ts = c.getOutputTimestamp();
  if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.contextTime + (p - ts.performanceTime) / 1000;
  }
  return c.currentTime + (p - performance.now()) / 1000;
}

let master: GainNode | null = null;
export function out(): GainNode {
  const c = audioCtx();
  if (!master) {
    master = c.createGain();
    master.gain.value = 0.6;
    const comp = c.createDynamicsCompressor();
    master.connect(comp).connect(c.destination);
  }
  return master;
}

/** Play a piano-ish note. `when` is AudioContext time (defaults to now). Returns end time. */
export function playNote(midi: number, duration = 0.8, when?: number, velocity = 0.7): number {
  const c = audioCtx();
  const t0 = when ?? c.currentTime + 0.02;
  const f = midiToFreq(midi);
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(12000, f * 10), t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 400), t0 + duration + 0.4);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.32 * velocity, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.12 * velocity, t0 + 0.25);
  g.gain.setTargetAtTime(0.0001, t0 + duration, 0.12);
  g.connect(lp).connect(out());
  const partials = [1, 2, 3, 4, 5, 6];
  const amps = [1, 0.5, 0.28, 0.16, 0.08, 0.05];
  const B = 0.0004; // slight inharmonicity
  partials.forEach((h, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * h * Math.sqrt(1 + B * h * h);
    const pg = c.createGain();
    pg.gain.value = amps[i] / (1 + (f > 800 ? i : 0));
    o.connect(pg).connect(g);
    o.start(t0);
    o.stop(t0 + duration + 1.0);
  });
  return t0 + duration;
}

export function playChord(midis: number[], duration = 1.2, when?: number): number {
  let end = 0;
  for (const m of midis) end = playNote(m, duration, when, 0.55);
  return end;
}

/** Play a sequence of note groups. Returns the AudioContext end time. */
export function playSequence(groups: number[][], secondsPerStep = 0.55, startDelay = 0.05): number {
  const c = audioCtx();
  let t = c.currentTime + startDelay;
  for (const g of groups) {
    if (g.length) playChord(g, secondsPerStep * 0.95, t);
    t += secondsPerStep;
  }
  return t;
}

let clickVolume = 0.5;
export function setClickVolume(v: number) {
  clickVolume = v;
}

/** Short, high, bright click — kept well above piano fundamentals so the detector can filter it out. */
export function click(when: number, accent: boolean) {
  if (clickVolume <= 0) return;
  const c = audioCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 4400 : 3500;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime((accent ? 0.5 : 0.3) * clickVolume, when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
  o.connect(hp).connect(g).connect(out());
  o.start(when);
  o.stop(when + 0.05);
}

/**
 * A metronome that schedules clicks ahead of time.
 * `onBeat` is called (roughly on time, from a timer) with the beat index and the
 * exact performance.now() time at which the click is heard.
 */
export class Metronome {
  bpm: number;
  beatsPerBar: number;
  private timer: number | null = null;
  private nextBeatTime = 0;
  private beat = 0;
  startPerf = 0; // perf time of beat 0
  private onBeat?: (beat: number, perfTime: number) => void;
  /** Return false to silence the click on a beat (e.g. "clock test" bars). */
  shouldClick: (beat: number) => boolean = () => true;

  constructor(bpm: number, beatsPerBar = 4) {
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
  }

  get beatMs() {
    return 60000 / this.bpm;
  }

  start(onBeat?: (beat: number, perfTime: number) => void, delay = 0.15) {
    const c = audioCtx();
    this.stop();
    this.onBeat = onBeat;
    this.beat = 0;
    this.nextBeatTime = c.currentTime + delay;
    this.startPerf = ctxTimeToPerf(this.nextBeatTime);
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
    return this.startPerf;
  }

  private tick() {
    const c = audioCtx();
    while (this.nextBeatTime < c.currentTime + 0.12) {
      const b = this.beat;
      if (this.shouldClick(b)) click(this.nextBeatTime, b % this.beatsPerBar === 0);
      const perf = ctxTimeToPerf(this.nextBeatTime);
      const cb = this.onBeat;
      if (cb) window.setTimeout(() => cb(b, perf), Math.max(0, perf - performance.now()));
      this.nextBeatTime += 60 / this.bpm;
      this.beat++;
    }
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
