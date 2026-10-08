// The drum kit: pads of the Alesis Nitro Max, their MIDI notes, limbs, and staff positions.

import { useSyncExternalStore } from 'react';

export type Inst = 'kick' | 'snare' | 'hhClosed' | 'hhOpen' | 'hhPedal' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
export type Limb = 'RH' | 'LH' | 'RF' | 'LF';

export interface InstInfo {
  id: Inst;
  name: string;
  short: string; // pattern-row label
  staffPos: number; // diatonic steps above the bottom staff line (E4 = 0)
  x: boolean; // cymbals use an "x" notehead
  foot: boolean;
  family: string; // hits within a family are "close" (e.g. open vs closed hi-hat)
}

export const INSTS: Record<Inst, InstInfo> = {
  crash: { id: 'crash', name: 'Crash', short: 'CR', staffPos: 10, x: true, foot: false, family: 'crash' },
  hhOpen: { id: 'hhOpen', name: 'Hi-hat (open)', short: 'HO', staffPos: 9, x: true, foot: false, family: 'hh' },
  hhClosed: { id: 'hhClosed', name: 'Hi-hat', short: 'HH', staffPos: 9, x: true, foot: false, family: 'hh' },
  ride: { id: 'ride', name: 'Ride', short: 'RD', staffPos: 8, x: true, foot: false, family: 'ride' },
  tom1: { id: 'tom1', name: 'Tom 1 (high)', short: 'T1', staffPos: 7, x: false, foot: false, family: 'tom1' },
  tom2: { id: 'tom2', name: 'Tom 2 (mid)', short: 'T2', staffPos: 6, x: false, foot: false, family: 'tom2' },
  snare: { id: 'snare', name: 'Snare', short: 'SN', staffPos: 5, x: false, foot: false, family: 'snare' },
  tom3: { id: 'tom3', name: 'Tom 3 (floor)', short: 'T3', staffPos: 3, x: false, foot: false, family: 'tom3' },
  kick: { id: 'kick', name: 'Kick', short: 'BD', staffPos: 1, x: false, foot: true, family: 'kick' },
  hhPedal: { id: 'hhPedal', name: 'Hi-hat pedal', short: 'HP', staffPos: -1, x: true, foot: true, family: 'hhPedal' },
};

export const INST_ORDER: Inst[] = ['crash', 'hhOpen', 'hhClosed', 'ride', 'tom1', 'tom2', 'snare', 'tom3', 'kick', 'hhPedal'];

/**
 * MIDI notes sent by the Alesis Nitro Max module, from its user guide (section 5.2,
 * "Pad MIDI Note Numbers"), plus common General MIDI alternatives so other kits work too.
 * The optional fourth tom (41, rim 39) counts as the floor tom.
 */
export const DEFAULT_MAP: Record<number, Inst> = {
  35: 'kick', 36: 'kick',
  37: 'snare', 38: 'snare', 40: 'snare', // side-stick, head, rim
  42: 'hhClosed', 22: 'hhClosed',
  46: 'hhOpen', 26: 'hhOpen', 23: 'hhOpen', // open, half-open
  44: 'hhPedal', 21: 'hhPedal', // pedal chick, pedal splash
  48: 'tom1', 50: 'tom1',
  45: 'tom2', 47: 'tom2',
  43: 'tom3', 58: 'tom3', 41: 'tom3', 39: 'tom3',
  49: 'crash', 55: 'crash', 57: 'crash', 52: 'crash',
  51: 'ride', 53: 'ride', 59: 'ride',
};

// ---------- Drum settings (separate from the piano's) ----------

export interface DrumSettings {
  input: 'midi' | 'mic';
  learned: Record<number, Inst>; // notes learned from "teach the app my kit"
  latencyMs: number; // mic only
  clickVolume: number;
  repeats: number; // play each exercise this many times in a row
}

const KEY = 'keystone.drums.settings.v1';
const DEFAULTS: DrumSettings = { input: 'midi', learned: {}, latencyMs: 40, clickVolume: 0.6, repeats: 1 };

function load(): DrumSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}
let state = load();
const listeners = new Set<() => void>();

export function getDrumSettings() {
  return state;
}
export function updateDrumSettings(p: Partial<DrumSettings>) {
  state = { ...state, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
export function useDrumSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Which pad a MIDI note came from (learned notes win over the default map). */
export function instForNote(note: number): Inst | null {
  return state.learned[note] ?? DEFAULT_MAP[note] ?? null;
}

/** Hits on these pairs count as "nearly right" (e.g. closed hi-hat when open was written). */
export function sameFamily(a: Inst, b: Inst) {
  return INSTS[a].family === INSTS[b].family;
}

export const LIMB_NAME: Record<Limb, string> = { RH: 'Right hand', LH: 'Left hand', RF: 'Right foot', LF: 'Left foot' };
export const LIMB_SHORT: Record<Limb, string> = { RH: 'R', LH: 'L', RF: 'RF', LF: 'LF' };
