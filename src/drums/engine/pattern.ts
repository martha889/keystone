// Drum exercise data model, a compact pattern notation, and sticking/limb assignment.

import { INSTS, type Inst, type Limb } from './kit';

export type Dyn = 'n' | 'a' | 'g'; // normal, accent, ghost

export interface DHit {
  inst: Inst;
  dyn: Dyn;
  flam?: boolean; // a soft grace note from the other hand just before
  limb?: Limb;
}

export interface DStep {
  pos: number; // beats from the start of the exercise
  hits: DHit[];
}

export interface DrumData {
  steps: DStep[];
  timeSig: [number, number]; // e.g. [4,4], [6,8], [7,8]
  beatsPerBar: number; // metronome beats per bar (= time-signature numerator)
  barSub: number[]; // grid slots per beat, per bar (2 = 8ths, 4 = 16ths, 3 = triplets)
  bars: number;
  callBars?: number[]; // bars the app plays for you (call & response)
  silentBars?: number[]; // bars without metronome clicks (clock test)
}

export type DrumKind = 'tempo' | 'follow';

export interface DrumExercise {
  id: string;
  title: string;
  kind: DrumKind;
  instructions: string;
  build: () => DrumData;
  bpm?: number;
  targetBpm?: number;
  passAccuracy?: number;
}

export interface DrumLesson {
  id: string;
  title: string;
  summary: string;
  body: string[];
  figures?: ('grip' | 'kit' | 'posture')[];
  exercises: DrumExercise[];
}

export interface DrumLevel {
  id: string;
  num: number;
  name: string;
  tagline: string;
  lessons: DrumLesson[];
}

// ---------- Grid notation ----------

const ROW: Record<string, Inst> = {
  hh: 'hhClosed', ho: 'hhOpen', hp: 'hhPedal', sn: 'snare', bd: 'kick', t1: 'tom1', t2: 'tom2', t3: 'tom3', cr: 'crash', rd: 'ride',
};

const CHAR: Record<string, { dyn: Dyn; flam?: boolean }> = {
  x: { dyn: 'n' }, o: { dyn: 'n' }, X: { dyn: 'a' }, O: { dyn: 'a' }, g: { dyn: 'g' }, f: { dyn: 'n', flam: true }, F: { dyn: 'a', flam: true },
};

export interface GrooveSpec {
  sub?: number; // slots per beat (default 2)
  ts?: [number, number]; // default 4/4
  rows: Partial<Record<keyof typeof ROW, string>>;
  stick?: string; // optional sticking per slot: R/L, '.' = none
  repeat?: number; // repeat the whole pattern
}

/**
 * Grid patterns, one string per instrument, one character per slot ('.' or '-' = nothing):
 *   x/o hit · X/O accent · g ghost note · f flam · F accented flam. Spaces and '|' are ignored.
 */
export function groove(spec: GrooveSpec): DrumData {
  const sub = spec.sub ?? 2;
  const ts = spec.ts ?? [4, 4];
  const bpb = ts[0];
  const clean = (s: string) => s.replace(/[\s|]/g, '');
  const rows = Object.entries(spec.rows).map(([k, v]) => [ROW[k], clean(v!)] as const);
  const len = Math.max(...rows.map(([, s]) => s.length));
  const stick = spec.stick ? clean(spec.stick) : '';
  const bars = Math.max(1, Math.round(len / (sub * bpb)));
  const one: DStep[] = [];
  for (let i = 0; i < len; i++) {
    const hits: DHit[] = [];
    for (const [inst, s] of rows) {
      const c = CHAR[s[i]];
      if (c) hits.push({ inst, ...c });
    }
    if (!hits.length) continue;
    const st = stick[i];
    if (st === 'R' || st === 'L') {
      const handHits = hits.filter((h) => !INSTS[h.inst].foot);
      if (handHits.length === 1) handHits[0].limb = st === 'R' ? 'RH' : 'LH';
    }
    one.push({ pos: i / sub, hits });
  }
  const d: DrumData = { steps: one, timeSig: ts, beatsPerBar: bpb, barSub: Array(bars).fill(sub), bars };
  return repeat(d, spec.repeat ?? 1);
}

/**
 * Sticking notation: space-separated tokens, one per slot.
 *   R / L stroke · >R accent · gR ghost · fR flam (grace from the other hand) · '-' rest
 *   append :t1 :t2 :t3 :hh :rd :cr :bd to play it on another drum (default snare).
 */
export function sticks(tokens: string, sub = 4, opts: { ts?: [number, number]; repeat?: number; inst?: Inst } = {}): DrumData {
  const ts = opts.ts ?? [4, 4];
  const toks = tokens.trim().split(/\s+/).filter((t) => t !== '|');
  const steps: DStep[] = [];
  toks.forEach((tok, i) => {
    if (tok === '-') return;
    for (const part of tok.split('+')) {
      const m = /^(>?)(g?)(f?)([RL]|RF|LF)(?::(\w+))?$/.exec(part);
      if (!m) throw new Error(`Bad sticking token ${part}`);
      const inst = m[5] ? ROW[m[5]] : opts.inst ?? 'snare';
      const limb: Limb = m[4] === 'RF' ? 'RF' : m[4] === 'LF' ? 'LF' : m[4] === 'R' ? 'RH' : 'LH';
      const hit: DHit = { inst, dyn: m[1] ? 'a' : m[2] ? 'g' : 'n', flam: !!m[3], limb };
      const last = steps[steps.length - 1];
      if (last && last.pos === i / sub) last.hits.push(hit);
      else steps.push({ pos: i / sub, hits: [hit] });
    }
  });
  const bars = Math.max(1, Math.ceil(toks.length / (sub * ts[0])));
  return repeat({ steps, timeSig: ts, beatsPerBar: ts[0], barSub: Array(bars).fill(sub), bars }, opts.repeat ?? 1);
}

export function repeat(d: DrumData, n: number): DrumData {
  if (n <= 1) return d;
  return concat(...Array.from({ length: n }, () => d));
}

/** Join exercises bar after bar. */
export function concat(...parts: DrumData[]): DrumData {
  const steps: DStep[] = [];
  const barSub: number[] = [];
  const callBars: number[] = [];
  const silentBars: number[] = [];
  let offsetBeats = 0;
  let offsetBars = 0;
  for (const p of parts) {
    for (const s of p.steps) steps.push({ pos: s.pos + offsetBeats, hits: s.hits.map((h) => ({ ...h })) });
    barSub.push(...p.barSub);
    p.callBars?.forEach((b) => callBars.push(b + offsetBars));
    p.silentBars?.forEach((b) => silentBars.push(b + offsetBars));
    offsetBeats += p.bars * p.beatsPerBar;
    offsetBars += p.bars;
  }
  const f = parts[0];
  return {
    steps, timeSig: f.timeSig, beatsPerBar: f.beatsPerBar, barSub, bars: offsetBars,
    callBars: callBars.length ? callBars : undefined, silentBars: silentBars.length ? silentBars : undefined,
  };
}

/** Mark bars as played by the app (call) — the student answers in the following bar. */
export function asCall(d: DrumData): DrumData {
  return { ...d, callBars: Array.from({ length: d.bars }, (_, i) => i) };
}

/** Mark bars as silent (no metronome). */
export function silent(d: DrumData): DrumData {
  return { ...d, silentBars: Array.from({ length: d.bars }, (_, i) => i) };
}

// ---------- Limb assignment ----------

const TIMEKEEPERS: Inst[] = ['hhClosed', 'hhOpen', 'ride'];
// Left-to-right position on the kit (for deciding which hand reaches which drum)
const KIT_X: Record<Inst, number> = { hhClosed: 1, hhOpen: 1, crash: 2, snare: 3, tom1: 4, tom2: 5, ride: 7, tom3: 6, kick: 4, hhPedal: 1 };

/**
 * Fill in which limb plays each hit (right-handed setup):
 * feet: kick = right foot, hi-hat pedal = left foot. Hands: in a groove the right hand
 * keeps time on hi-hat/ride and the left plays the drums; fills and rudiments alternate R-L.
 */
export function assignLimbs(d: DrumData): DrumData {
  const steps = d.steps.map((s) => ({ ...s, hits: s.hits.map((h) => ({ ...h })) }));
  const tkCount = steps.reduce((a, s) => a + s.hits.filter((h) => TIMEKEEPERS.includes(h.inst)).length, 0);
  const groove = tkCount >= 4;
  let lastHand: Limb | null = null;
  let lastPos = -10;
  steps.forEach((s, si) => {
    for (const h of s.hits) {
      if (h.inst === 'kick' && !h.limb) h.limb = 'RF';
      if (h.inst === 'hhPedal' && !h.limb) h.limb = 'LF';
    }
    const hands = s.hits.filter((h) => !INSTS[h.inst].foot);
    if (hands.length >= 2) {
      const sorted = [...hands].sort((a, b) => KIT_X[a.inst] - KIT_X[b.inst]);
      // Cymbal timekeeping stays in the right hand even though the hi-hat is on the left (crossed arms)
      const tk = sorted.find((h) => TIMEKEEPERS.includes(h.inst) || h.inst === 'crash');
      const right = tk ?? sorted[sorted.length - 1];
      for (const h of sorted) if (!h.limb) h.limb = h === right ? 'RH' : 'LH';
      lastHand = null;
    } else if (hands.length === 1) {
      const h = hands[0];
      if (!h.limb) {
        // Is the right hand busy keeping time around here?
        const near = (dp: number) => steps.some((o, oi) => oi !== si && Math.abs(o.pos - s.pos) <= dp && o.hits.some((x) => TIMEKEEPERS.includes(x.inst)));
        if (TIMEKEEPERS.includes(h.inst) && groove) h.limb = 'RH';
        else if (groove && near(0.5) && !TIMEKEEPERS.includes(h.inst)) h.limb = 'LH';
        else {
          // Alternate, starting each new phrase with the right hand
          const fresh = lastHand === null || s.pos - lastPos > 1;
          h.limb = fresh ? 'RH' : lastHand === 'RH' ? 'LH' : 'RH';
        }
      }
      lastHand = h.limb!;
      lastPos = s.pos;
    }
  });
  return { ...d, steps };
}

// ---------- Generators ----------

function rnd<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

/** A random one-bar snare rhythm for reading or call-and-response. */
export function randomRhythm(sub: 2 | 4, density = 0.5, inst: Inst = 'snare'): DrumData {
  const slots = sub * 4;
  const steps: DStep[] = [];
  for (let i = 0; i < slots; i++) {
    const onBeat = i % sub === 0;
    const p = onBeat ? Math.min(0.9, density + 0.25) : density * (i % 2 === 0 ? 0.9 : 0.6);
    if (i === 0 || Math.random() < p) steps.push({ pos: i / sub, hits: [{ inst, dyn: 'n' }] });
  }
  return { steps, timeSig: [4, 4], beatsPerBar: 4, barSub: [sub], bars: 1 };
}

/** Bars of call (app plays) and response (you copy), with a fresh rhythm each pair. */
export function callResponse(pairs: number, sub: 2 | 4, density: number, kitInsts?: Inst[]): DrumData {
  const parts: DrumData[] = [];
  for (let i = 0; i < pairs; i++) {
    let r = randomRhythm(sub, density);
    if (kitInsts) r = { ...r, steps: r.steps.map((s) => ({ ...s, hits: [{ inst: rnd(kitInsts), dyn: 'n' as Dyn }] })) };
    parts.push(asCall(r), r);
  }
  return concat(...parts);
}

/** Total length in beats. */
export function totalBeats(d: DrumData) {
  return d.bars * d.beatsPerBar;
}
