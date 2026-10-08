// Decide whether a play event matches the expected step.

import type { PlayEvent } from '../../shared/audio/input';
import { verifyNotes, type Spectrum } from '../../shared/audio/pitch';
import type { Step } from '../curriculum/types';
import { pc } from '../music/theory';

export interface MatchOutcome {
  correct: boolean;
  unclear?: boolean; // nothing expected was heard at all: probably noise, not a wrong answer
  partial?: boolean; // some chord notes so far, nothing wrong — keep waiting
  heard: number[]; // what we think was played (for display)
  missing: number[];
  extra: number[];
  octaveOff?: boolean;
}

export function isChordStep(step: Step) {
  return step.notes.length > 1;
}

/**
 * Match without waiting. Returns null when the decision needs a later spectrum
 * (microphone + chord).
 */
export function matchNow(ev: PlayEvent, step: Step, held: number[], octaveLenient: boolean): MatchOutcome | null {
  const exp = step.notes;
  const any = !!step.anyOctave;

  if (ev.source === 'midi') {
    const struck = ev.notes;
    const pool = new Set([...struck, ...held]);
    const has = (m: number) => (any ? [...pool].some((x) => pc(x) === pc(m)) : pool.has(m));
    const missing = exp.filter((m) => !has(m));
    const expPcs = new Set(exp.map(pc));
    const extra = struck.filter((m) => (any ? !expPcs.has(pc(m)) : !exp.includes(m)));
    const octaveOff = !any && missing.length > 0 && extra.length > 0 && missing.every((m) => extra.some((x) => pc(x) === pc(m)));
    if (!missing.length && !extra.length) return { correct: true, heard: struck, missing, extra };
    if (missing.length && !extra.length && missing.length < exp.length) return { correct: false, partial: true, heard: struck, missing, extra };
    return { correct: false, heard: struck, missing, extra, octaveOff };
  }

  // Microphone
  if (isChordStep(step)) return null;
  const m = exp[0];
  const heard = ev.notes[0];
  if (heard === m) return { correct: true, heard: [heard], missing: [], extra: [] };
  if (heard !== undefined && pc(heard) === pc(m)) {
    if (any) return { correct: true, heard: [heard], missing: [], extra: [] };
    // YIN octave errors happen on piano; confirm with the spectrum before blaming the player
    if (ev.spectrum && verifyNotes(ev.spectrum, [m], ev.before).ok) return { correct: true, heard: [m], missing: [], extra: [] };
    if (octaveLenient) return { correct: true, heard: [heard], missing: [], extra: [], octaveOff: true };
    return { correct: false, heard: [heard], missing: [m], extra: [heard], octaveOff: true };
  }
  // Pitch tracker disagreed: fall back to spectral verification of the expected note
  if (ev.spectrum) {
    const chk = verifyNotes(ev.spectrum, [m], ev.before, any);
    if (chk.ok && chk.confidence > 0.3) return { correct: true, heard: [m], missing: [], extra: [] };
  }
  return { correct: false, heard: heard !== undefined ? [heard] : [], missing: [m], extra: heard !== undefined ? [heard] : [] };
}

/** Microphone chord check using a spectrum taken a moment after the attack. */
export function matchChord(ev: PlayEvent, spec: Spectrum | null, step: Step): MatchOutcome {
  if (!spec) return { correct: false, heard: ev.notes, missing: step.notes, extra: [] };
  const chk = verifyNotes(spec, step.notes, ev.before, !!step.anyOctave);
  // Map extra pitch classes to a nearby octave for display
  if (chk.missing.length === step.notes.length && !chk.extraPcs.length) return { correct: false, unclear: true, heard: [], missing: chk.missing, extra: [] };
  const center = step.notes[0];
  const extra = chk.extraPcs.map((p) => {
    let m = center - (pc(center) - p);
    if (m < center - 6) m += 12;
    return m;
  });
  if (chk.ok) return { correct: true, heard: step.notes, missing: [], extra: [] };
  return { correct: false, heard: [...step.notes.filter((m) => !chk.missing.includes(m)), ...extra], missing: chk.missing, extra };
}
