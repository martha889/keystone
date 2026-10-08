// Automatic fingering and hand-position analysis.
//
// Exercises with hand-written fingering keep it. Everything else gets fingering from
// a small dynamic-programming search that scores every finger-to-finger move for
// comfort (span between fingers, thumb-under / finger-over crossings, thumbs on
// black keys…), the same idea as the classic Parncutt fingering model.

import type { Step } from '../curriculum/types';
import { isBlack, noteName } from './theory';

export type Hand = 'R' | 'L';

/** Which hand plays note k of a step (same rule the staff uses for clefs). */
export function handOf(step: Step, k: number): Hand {
  const h = step.hands?.[k] ?? step.hand;
  if (h) return h;
  const m = step.notes[k];
  if (step.notes.length > 1) {
    const top = Math.max(...step.notes);
    // Middle C and up is right hand; G3–B3 joins a right-hand chord unless it's an octave-or-more bass note.
    if (top >= 60) return m >= 60 || (m >= 55 && top - m < 12) ? 'R' : 'L';
  }
  return m >= 60 ? 'R' : 'L';
}

// Comfortable maximum stretch (semitones) between two fingers of one hand.
const MAX_COMF: Record<string, number> = {
  '1-2': 5, '1-3': 7, '1-4': 8, '1-5': 10, '2-3': 4, '2-4': 5, '2-5': 7, '3-4': 3, '3-5': 5, '4-5': 4,
};

/** Cost of moving from finger fa on note na to finger fb on note nb (right-hand geometry). */
function moveCost(fa: number, na: number, fb: number, nb: number, hand: Hand): number {
  let d = nb - na;
  if (hand === 'L') d = -d; // the left hand is a mirror image
  let cost = 0;
  if (isBlack(nb) && fb === 1) cost += 2.2; // thumbs prefer white keys
  if (isBlack(nb) && fb === 5 && !isBlack(na)) cost += 0.7;
  if (d === 0) return cost + (fa === fb ? 0 : 0.4);
  const span = Math.abs(d);
  if (span > 9) {
    // A leap: the whole hand moves, so any finger works; prefer strong middle fingers.
    return cost + 1 + [0, 0.6, 0.2, 0, 0.6, 0.6][fb];
  }
  if (fa === fb) return cost + 6 + span * 0.3;
  const natural = (d > 0 && fb > fa) || (d < 0 && fb < fa);
  if (natural) {
    const k = Math.abs(fb - fa);
    const key = `${Math.min(fa, fb)}-${Math.max(fa, fb)}`;
    // Ideal: one finger per white key (C–G is a 5-finger span, played 1–5)
    const wdist = Math.abs(whiteIndex(nb) - whiteIndex(na));
    cost += 0.3 * Math.abs(wdist - k);
    if (span > MAX_COMF[key]) cost += 2 * (span - MAX_COMF[key]);
    if (span < k) cost += 0.8 * (k - span);
    return cost;
  }
  // Crossings: only the thumb may pass under (or be passed over) a finger.
  const thumbUnder = d > 0 && fb === 1 && fa >= 2 && fa <= 4;
  const fingerOver = d < 0 && fa === 1 && fb >= 2 && fb <= 4;
  if ((thumbUnder || fingerOver) && span <= 5) {
    const other = thumbUnder ? fa : fb;
    return cost + 1.5 + (other === 2 ? 0.8 : other === 4 ? 0.3 : 0) + 0.2 * span;
  }
  return cost + 10 + span;
}

/** Best fingering for a single-note line in one hand; fixed[i] (if set) is respected. */
function fingerLine(notes: number[], hand: Hand, fixed: (number | null)[]): number[] {
  const L = notes.length;
  const INF = 1e9;
  const cost: number[][] = Array.from({ length: L }, () => [INF, INF, INF, INF, INF, INF]);
  const back: number[][] = Array.from({ length: L }, () => [0, 0, 0, 0, 0, 0]);
  const allowed = (i: number) => (fixed[i] ? [fixed[i]!] : [1, 2, 3, 4, 5]);
  for (const f of allowed(0)) cost[0][f] = (isBlack(notes[0]) && f === 1 ? 2.5 : 0) + [0, 0.2, 0.15, 0, 0.3, 0.1][f];
  for (let i = 1; i < L; i++)
    for (const fb of allowed(i))
      for (const fa of allowed(i - 1)) {
        const c = cost[i - 1][fa] + moveCost(fa, notes[i - 1], fb, notes[i], hand);
        if (c < cost[i][fb]) {
          cost[i][fb] = c;
          back[i][fb] = fa;
        }
      }
  let f = 1;
  for (let k = 2; k <= 5; k++) if (cost[L - 1][k] < cost[L - 1][f]) f = k;
  const out = new Array<number>(L);
  for (let i = L - 1; i >= 0; i--) {
    out[i] = f;
    f = back[i][f];
  }
  return out;
}

/** Standard fingering for notes played together by one hand (sorted low → high). */
function chordFingers(sorted: number[], hand: Hand): number[] {
  const n = sorted.length;
  const byInterval = (iv: number) => (iv <= 2 ? 2 : iv <= 4 ? 3 : iv <= 6 ? 4 : 5);
  if (n === 2) {
    const f = byInterval(sorted[1] - sorted[0]);
    return hand === 'R' ? [1, f] : [f, 1];
  }
  if (n === 3) {
    if (hand === 'R') return [1, sorted[2] - sorted[1] <= 4 ? 3 : 2, 5];
    return [5, sorted[1] - sorted[0] <= 4 ? 3 : 2, 1];
  }
  if (n === 4) return hand === 'R' ? [1, 2, 3, 5] : [5, 3, 2, 1];
  return sorted.map((_, i) => (hand === 'R' ? Math.min(5, i + 1) : Math.max(1, 5 - i)));
}

/** Fill in fingering for every note that doesn't have one. */
export function autoFinger(steps: Step[]): Step[] {
  const out = steps.map((s) => ({ ...s, fingers: s.notes.map((_, k) => s.fingers?.[k] ?? null) }));
  for (const hand of ['R', 'L'] as Hand[]) {
    // This hand's part: per step, the indices of its notes
    const part = out
      .map((s, i) => ({ i, ks: s.notes.map((_, k) => k).filter((k) => handOf(s, k) === hand) }))
      .filter((p) => p.ks.length);
    let run: typeof part = [];
    const flush = () => {
      if (!run.length) return;
      const notes = run.map((p) => out[p.i].notes[p.ks[0]]);
      const fixed = run.map((p) => out[p.i].fingers![p.ks[0]]);
      if (fixed.some((f) => f === null)) {
        const fs = fingerLine(notes, hand, fixed);
        run.forEach((p, j) => (out[p.i].fingers![p.ks[0]] = fs[j]));
      }
      run = [];
    };
    for (const p of part) {
      if (p.ks.length === 1) {
        run.push(p);
        continue;
      }
      flush();
      const s = out[p.i];
      if (p.ks.every((k) => s.fingers![k] !== null)) continue;
      const sortedKs = [...p.ks].sort((a, b) => s.notes[a] - s.notes[b]);
      const fs = chordFingers(sortedKs.map((k) => s.notes[k]), hand);
      sortedKs.forEach((k, j) => {
        if (s.fingers![k] === null) s.fingers![k] = fs[j];
      });
    }
    flush();
  }
  return out;
}

// ---------- Hand positions ----------

export interface Placement {
  hand: Hand;
  fingers: Map<number, number>; // finger → MIDI key it rests on
}

export interface Shift {
  step: number;
  hand: Hand;
  text: string; // coaching cue, e.g. "Thumb passes under to F4"
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];
function whiteIndex(m: number) {
  const oct = Math.floor(m / 12);
  const pcv = m % 12;
  let i = WHITE.indexOf(pcv);
  if (i < 0) i = WHITE.indexOf(pcv - 1); // black key: count from the white key below
  return oct * 7 + i;
}
function whiteMidi(idx: number) {
  return Math.floor(idx / 7) * 12 + WHITE[((idx % 7) + 7) % 7];
}

/** Five-finger placement implied by known (finger, key) pairs, filling gaps with neighbouring white keys. */
function completePlacement(hand: Hand, known: Map<number, number>): Map<number, number> {
  const res = new Map(known);
  const [f0, m0] = [...known.entries()][0];
  for (let f = 1; f <= 5; f++) {
    if (res.has(f)) continue;
    // Nearest known finger to anchor from
    let anchorF = f0, anchorM = m0;
    for (const [kf, km] of known) if (Math.abs(kf - f) < Math.abs(anchorF - f)) [anchorF, anchorM] = [kf, km];
    const off = (f - anchorF) * (hand === 'R' ? 1 : -1);
    const m = whiteMidi(whiteIndex(anchorM) + off);
    res.set(f, m);
  }
  return res;
}

/** Can (finger f on key m) join a hand position that already has these known finger→key pairs? */
function fitsPosition(hand: Hand, known: Map<number, number>, f: number, m: number): boolean {
  if (known.has(f)) return known.get(f) === m;
  for (const [kf, km] of known) {
    if (km === m) return false; // two fingers on one key
    const higherFinger = f > kf;
    const higherKey = hand === 'R' ? m > km : m < km;
    if (higherFinger !== higherKey) return false; // would need a crossing
    const key = `${Math.min(f, kf)}-${Math.max(f, kf)}`;
    if (Math.abs(m - km) > MAX_COMF[key] + 1) return false; // too wide a stretch
  }
  return true;
}

/**
 * Starting placement for each hand, plus every point where a hand has to move
 * (thumb-under, finger-over, or a shift to a new position).
 */
export function analyseHands(steps: Step[]): { start: Placement[]; shifts: Shift[]; positions: Map<number, Placement[]> } {
  const shifts: Shift[] = [];
  const positions = new Map<number, Placement[]>(); // step index → current placement of each hand
  const known: Partial<Record<Hand, Map<number, number>>> = {};
  const firstKnown: Partial<Record<Hand, Map<number, number>>> = {};
  const lastNote: Partial<Record<Hand, { f: number; m: number }>> = {};

  steps.forEach((s, i) => {
    for (const hand of ['R', 'L'] as Hand[]) {
      const ks = s.notes.map((_, k) => k).filter((k) => handOf(s, k) === hand && s.fingers?.[k]);
      if (!ks.length) continue;
      const pairs = ks.map((k) => [s.fingers![k]!, s.notes[k]] as [number, number]).sort((a, b) => a[1] - b[1]);
      const kn = known[hand];
      const merged = kn ? new Map(kn) : null;
      let fits = !!merged;
      if (merged)
        for (const [f, m] of pairs) {
          if (!fitsPosition(hand, merged, f, m)) {
            fits = false;
            break;
          }
          merged.set(f, m);
        }
      if (!kn) {
        known[hand] = new Map(pairs);
      } else if (fits) {
        known[hand] = merged!;
        if (firstKnown[hand] === kn) firstKnown[hand] = merged!;
      } else {
        const prev = lastNote[hand];
        const name = hand === 'R' ? 'Right hand' : 'Left hand';
        let text: string;
        if (pairs.length > 1) {
          const ordered = hand === 'R' ? pairs : [...pairs].reverse();
          text = `fingers ${ordered.map((p) => p[0]).join('-')} on ${ordered.map((p) => noteName(p[1])).join(' ')}`;
        } else {
          const [f, m] = pairs[0];
          const up = prev ? m > prev.m : true;
          const outward = hand === 'R' ? up : !up; // towards the pinky side
          if (prev && f === 1 && prev.f >= 2 && outward && Math.abs(m - prev.m) <= 5) text = `thumb passes under to ${noteName(m)}`;
          else if (prev && prev.f === 1 && f >= 2 && !outward && Math.abs(m - prev.m) <= 5) text = `finger ${f} crosses over the thumb to ${noteName(m)}`;
          else text = `move your hand, finger ${f} to ${noteName(m)}`;
        }
        shifts.push({ step: i, hand, text: `${name}: ${text}` });
        known[hand] = new Map(pairs);
      }
      if (!firstKnown[hand]) firstKnown[hand] = known[hand];
      const last = pairs[pairs.length - 1];
      lastNote[hand] = { f: last[0], m: last[1] };
    }
    positions.set(
      i,
      (['L', 'R'] as Hand[]).filter((h) => known[h]).map((h) => ({ hand: h, fingers: completePlacement(h, known[h]!) })),
    );
  });

  const start = (['L', 'R'] as Hand[]).filter((h) => firstKnown[h]).map((h) => ({ hand: h, fingers: completePlacement(h, firstKnown[h]!) }));
  return { start, shifts, positions };
}

export function describePlacement(p: Placement): string {
  const order = p.hand === 'R' ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
  return order.map((f) => `${f} on ${noteName(p.fingers.get(f)!)}`).join(' · ');
}
