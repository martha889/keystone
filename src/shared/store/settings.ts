import { useSyncExternalStore } from 'react';

export interface Settings {
  inputMode: 'mic' | 'midi';
  latencyMs: number; // subtracted from detected onset times
  octaveLenient: boolean; // mic: accept right note in wrong octave
  clickVolume: number; // 0..1
  showNoteNames: boolean; // labels on the on-screen keyboard
  showFingering: boolean; // finger numbers and hand-position cues
  sensitivity: number; // onset threshold in dB above noise floor
  repeats: number; // play each exercise this many times in a row
}

const KEY = 'keystone.settings.v1';
const DEFAULTS: Settings = {
  inputMode: 'mic',
  latencyMs: 40,
  octaveLenient: false,
  clickVolume: 0.5,
  showNoteNames: true,
  showFingering: true,
  sensitivity: 14,
  repeats: 1,
};

function load(): Settings {
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

export function getSettings(): Settings {
  return state;
}

export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
