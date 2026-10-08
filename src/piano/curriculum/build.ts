// Helpers for writing lessons compactly.

import {
  chord, keySignature, makeSpelled, parseNote, scale, scaleFingering, spellInKey,
  type ChordQuality, type Mode, type ScaleType, type Spelled,
} from '../music/theory';
import type { EarRound, ExerciseData, Step } from './types';

export function stepOf(spelled: Spelled[], beats = 1, extra: Partial<Step> = {}): Step {
  return { notes: spelled.map((s) => s.midi), spelled, beats, ...extra };
}

/**
 * Parse a compact melody string.
 *   "C4 D4/2 E4:2 r:1 C3+E4/1:0.5 |"
 * note[/finger][:beats], chords joined with '+', 'r' = rest, '|' ignored.
 */
export function mel(src: string, opts: { hand?: 'R' | 'L'; defaultBeats?: number; split?: boolean } = {}): Step[] {
  const steps: Step[] = [];
  for (const tok of src.split(/\s+/).filter((t) => t && t !== '|')) {
    const [body, beatsStr] = tok.split(':');
    const beats = beatsStr ? parseFloat(beatsStr) : opts.defaultBeats ?? 1;
    if (body === 'r') {
      steps.push({ notes: [], spelled: [], beats, hand: opts.hand });
      continue;
    }
    const parts = body.split('+');
    const spelled: Spelled[] = [];
    const fingers: (number | null)[] = [];
    for (const p of parts) {
      const [nm, f] = p.split('/');
      spelled.push(parseNote(nm));
      fingers.push(f ? parseInt(f, 10) : null);
    }
    steps.push({
      notes: spelled.map((s) => s.midi),
      spelled,
      beats,
      fingers: fingers.some((f) => f !== null) ? fingers : undefined,
      hand: opts.hand,
      // split: in "bass+melody" tokens the lowest note is the left hand, the rest the right
      hands: opts.split && spelled.length > 1 ? spelled.map((s) => (s.midi === Math.min(...spelled.map((x) => x.midi)) ? 'L' : 'R')) : undefined,
    });
  }
  return steps;
}

export function scaleSteps(
  tonic: string, type: ScaleType, hand: 'R' | 'L', octaves = 1, beats = 1, upAndDown = true,
): Step[] {
  const notes = scale(tonic, type, octaves, upAndDown);
  const fing = scaleFingering(tonic, type, hand, octaves, upAndDown);
  return notes.map((s, i) => stepOf([s], beats, { hand, fingers: fing ? [fing[i]] : undefined }));
}

/** Both hands, an octave apart (LH an octave below `rhTonic`). */
export function scaleHandsTogether(rhTonic: string, type: ScaleType, octaves = 1, beats = 1): Step[] {
  const rh = scale(rhTonic, type, octaves);
  const t = parseNote(rhTonic);
  const lhTonic = `${rhTonic.replace(/-?\d+$/, '')}${t.octave - 1}`;
  const lh = scale(lhTonic, type, octaves);
  const fr = scaleFingering(rhTonic, type, 'R', octaves, true);
  const fl = scaleFingering(lhTonic, type, 'L', octaves, true);
  return rh.map((s, i) => stepOf([lh[i], s], beats, { fingers: fr && fl ? [fl[i], fr[i]] : undefined, hands: ['L', 'R'] }));
}

/** Contrary motion: both hands start on the same tonic (an octave apart) and move outward. */
export function contraryMotion(rhTonic: string, octaves = 1, beats = 1): Step[] {
  const rh = scale(rhTonic, 'major', octaves);
  const t = parseNote(rhTonic);
  const lhUp = scale(`${rhTonic.replace(/-?\d+$/, '')}${t.octave - 1 - octaves}`, 'major', octaves, false).reverse();
  const lh = [...lhUp, ...lhUp.slice(0, -1).reverse()];
  return rh.map((s, i) => stepOf([lh[i], s], beats, { hands: ['L', 'R'] }));
}

export function chordStep(root: string, q: ChordQuality, inversion = 0, beats = 2, label?: string, hand?: 'R' | 'L'): Step {
  return stepOf(chord(root, q, inversion), beats, { label, hand });
}

/** Broken chord / arpeggio over `octaves` octaves, up and down. */
export function arpeggio(root: string, q: ChordQuality, octaves: number, hand: 'R' | 'L', beats = 0.5): Step[] {
  const tones = chord(root, q);
  const up: Spelled[] = [];
  for (let o = 0; o < octaves; o++) for (const t of tones) up.push(makeSpelled(t.letter, t.acc, t.octave + o));
  const top = tones[0];
  up.push(makeSpelled(top.letter, top.acc, top.octave + octaves));
  const all = [...up, ...up.slice(0, -1).reverse()];
  const per = tones.length;
  // Standard fingering for root-position triad arpeggios (C/G/F-type)
  const rf = per === 3 ? [1, 2, 3] : [1, 2, 3, 4];
  const lf = per === 3 ? [5, 4, 2] : [5, 4, 3, 2];
  const fingerUp = up.map((_, i) => {
    if (i === up.length - 1) return hand === 'R' ? 5 : 1;
    if (hand === 'R') return rf[i % per];
    if (i < per) return lf[i];
    return (per === 3 ? [1, 3, 2] : [1, 4, 3, 2])[i % per];
  });
  const fingers = [...fingerUp, ...fingerUp.slice(0, -1).reverse()];
  return all.map((s, i) => stepOf([s], beats, { hand, fingers: [fingers[i]] }));
}

/** Hanon exercise No. 1 pattern over the white keys, ascending then descending. */
export function hanon1(startOctave: number, hand: 'R' | 'L', patterns = 7, beats = 0.25): Step[] {
  const out: Step[] = [];
  const base = startOctave * 7; // diatonic index of C at that octave
  const sp = (d: number) => makeSpelled(((d % 7) + 7) % 7, 0, Math.floor(d / 7));
  const fUp = hand === 'R' ? [1, 2, 3, 4, 5, 4, 3, 2] : [5, 4, 3, 2, 1, 2, 3, 4];
  for (let p = 0; p < patterns; p++) {
    const d = base + p;
    [d, d + 2, d + 3, d + 4, d + 5, d + 4, d + 3, d + 2].forEach((x, i) =>
      out.push(stepOf([sp(x)], beats, { hand, fingers: [fUp[i]] })),
    );
  }
  const fDown = hand === 'R' ? [5, 4, 3, 2, 1, 2, 3, 4] : [1, 2, 3, 4, 5, 4, 3, 2];
  for (let p = 0; p < patterns; p++) {
    const d = base + patterns + 4 - p;
    [d, d - 2, d - 3, d - 4, d - 5, d - 4, d - 3, d - 2].forEach((x, i) =>
      out.push(stepOf([sp(x)], beats, { hand, fingers: [fDown[i]] })),
    );
  }
  out.push(stepOf([sp(base)], 1, { hand, fingers: [hand === 'R' ? 1 : 5] }));
  return out;
}

export function data(steps: Step[], extra: Partial<ExerciseData> = {}): ExerciseData {
  return { steps, timeSig: [4, 4], ...extra };
}

export function keyOf(tonic: string, m: Mode = 'major') {
  return keySignature(tonic, m);
}

// ---------- Randomised generators ----------

export function rand<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random white (or diatonic-in-key) notes in a MIDI range, no immediate repeats. */
export function randomNotes(count: number, lo: number, hi: number, sig = 0, opts: { stepwise?: number; hand?: 'R' | 'L'; chromatic?: number } = {}): Step[] {
  const pool: Spelled[] = [];
  for (let m = lo; m <= hi; m++) {
    const s = spellInKey(m, sig);
    const accs = [0, 0, 0, 0, 0, 0, 0];
    // diatonic check: spelled accidental must equal key signature's
    const sigAcc = sig > 0 ? [3, 0, 4, 1, 5, 2, 6].slice(0, sig) : [6, 2, 5, 1, 4, 0, 3].slice(0, -sig);
    for (const l of sigAcc) accs[l] = sig > 0 ? 1 : -1;
    if (s.acc === accs[s.letter]) pool.push(s);
  }
  const out: Step[] = [];
  let prevIdx = Math.floor(Math.random() * pool.length);
  for (let i = 0; i < count; i++) {
    let idx: number;
    if (opts.stepwise && Math.random() < opts.stepwise) {
      const delta = rand([-2, -1, 1, 2]);
      idx = Math.min(pool.length - 1, Math.max(0, prevIdx + delta));
      if (idx === prevIdx) idx = prevIdx + (prevIdx > 0 ? -1 : 1);
    } else {
      do idx = Math.floor(Math.random() * pool.length);
      while (pool.length > 1 && idx === prevIdx);
    }
    prevIdx = idx;
    let s = pool[idx];
    if (opts.chromatic && Math.random() < opts.chromatic) {
      const up = Math.random() < 0.5;
      const m = s.midi + (up ? 1 : -1);
      if (m >= lo && m <= hi) s = { ...s, acc: s.acc + (up ? 1 : -1), midi: m };
    }
    out.push(stepOf([s], 1, { hand: opts.hand }));
  }
  return out;
}

// ---------- Ear training ----------

export function earRounds(count: number, gen: () => EarRound): EarRound[] {
  return Array.from({ length: count }, gen);
}

export function noteEcho(lo: number, hi: number, whiteOnly = true): EarRound {
  let m: number;
  do m = lo + Math.floor(Math.random() * (hi - lo + 1));
  while (whiteOnly && [1, 3, 6, 8, 10].includes(m % 12));
  const s = spellInKey(m, 0);
  return { prompt: [[m]], steps: [stepOf([s])], answer: `${'CDEFGAB'[s.letter]}${s.acc ? (s.acc > 0 ? '♯' : '♭') : ''}${s.octave}` };
}

const INTERVAL_NAMES = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];

export function intervalEcho(intervals: number[], root = 60, harmonic = false): EarRound {
  const iv = rand(intervals);
  const r = root + rand([0, 2, 4, 5, 7]);
  const a = spellInKey(r, 0);
  const b = spellInKey(r + iv, 0);
  return {
    prompt: harmonic ? [[r, r + iv]] : [[r], [r + iv]],
    steps: harmonic ? [stepOf([a, b], 2)] : [stepOf([a]), stepOf([b])],
    answer: INTERVAL_NAMES[iv],
  };
}

export function chordQualityEcho(qualities: ChordQuality[], roots = ['C4', 'D4', 'E4', 'F4', 'G4', 'A3']): EarRound {
  const q = rand(qualities);
  const root = rand(roots);
  const tones = chord(root, q);
  const label: Record<string, string> = { maj: 'Major', min: 'Minor', dim: 'Diminished', aug: 'Augmented', dom7: 'Dominant 7th', maj7: 'Major 7th', min7: 'Minor 7th', sus4: 'Sus4', sus2: 'Sus2', m7b5: 'Half-diminished', dim7: 'Diminished 7th' };
  return {
    prompt: [tones.map((t) => t.midi)],
    steps: [stepOf(tones, 2)],
    answer: `${label[q]} (${tones.map((t) => 'CDEFGAB'[t.letter] + (t.acc > 0 ? '♯' : t.acc < 0 ? '♭' : '')).join('–')})`,
  };
}

export function melodyEcho(length: number, tonic = 'C4', mode: Mode = 'major', range = 7): EarRound {
  const t = parseNote(tonic);
  const sig = keySignature(tonic.replace(/-?\d+$/, ''), mode);
  const sc = scale(tonic, mode === 'major' ? 'major' : 'naturalMinor', 1, false);
  const pool = sc.slice(0, Math.min(8, range + 1));
  const steps: Step[] = [];
  let idx = 0; // start on tonic
  for (let i = 0; i < length; i++) {
    if (i > 0) {
      const delta = rand([-2, -1, -1, 1, 1, 2, 0]);
      idx = Math.min(pool.length - 1, Math.max(0, idx + (delta === 0 ? 1 : delta)));
    }
    steps.push(stepOf([spellInKey(pool[idx].midi, sig)]));
  }
  void t;
  return { prompt: steps.map((s) => s.notes), steps, answer: steps.map((s) => 'CDEFGAB'[s.spelled[0].letter] + (s.spelled[0].acc > 0 ? '♯' : s.spelled[0].acc < 0 ? '♭' : '')).join(' ') };
}

export function progressionEcho(tonic = 'C'): EarRound {
  // I–?–V–I with ? from IV, ii, vi ; voiced in close position around middle C
  const prog = rand([
    ['I', 'IV', 'V', 'I'], ['I', 'vi', 'IV', 'V'], ['I', 'ii', 'V', 'I'], ['I', 'V', 'vi', 'IV'],
  ]);
  const degree: Record<string, [number, ChordQuality]> = { I: [0, 'maj'], ii: [2, 'min'], IV: [5, 'maj'], V: [7, 'maj'], vi: [9, 'min'] };
  const sig = keySignature(tonic, 'major');
  const t = parseNote(`${tonic}3`);
  const steps: Step[] = prog.map((r) => {
    const [off, q] = degree[r];
    const rootMidi = t.midi + off;
    const rootSp = spellInKey(rootMidi, sig);
    const name = `${'CDEFGAB'[rootSp.letter]}${rootSp.acc > 0 ? '#' : rootSp.acc < 0 ? 'b' : ''}${rootSp.octave}`;
    return stepOf(chord(name, q), 2, { label: r, anyOctave: true });
  });
  return { prompt: steps.map((s) => s.notes), steps, answer: prog.join(' – ') };
}
