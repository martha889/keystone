import { useSyncExternalStore } from 'react';

export interface AttemptSummary {
  t: number;
  score: number; // 0..1
  stars: number;
  bpm?: number;
}

export interface ExerciseRecord {
  attempts: number;
  bestStars: number;
  bestScore: number;
  bestBpm?: number; // highest tempo with ≥2 stars
  last: number;
  history: AttemptSummary[];
}

export interface Progress {
  exercises: Record<string, ExerciseRecord>;
  xp: number;
  days: Record<string, number>; // YYYY-MM-DD → practice seconds
  confusions: Record<string, number>; // "expected>played" → count (pitch-class names)
}

const KEY = 'keystone.progress.v1';

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { exercises: {}, xp: 0, days: {}, confusions: {}, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { exercises: {}, xp: 0, days: {}, confusions: {} };
}

let state = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function recordAttempt(id: string, a: { score: number; stars: number; bpm?: number; seconds: number; confusions?: Record<string, number>; repeats?: number }): { xp: number; newBest: boolean } {
  const prev = state.exercises[id];
  const rec: ExerciseRecord = prev
    ? { ...prev, history: [...prev.history] }
    : { attempts: 0, bestStars: 0, bestScore: 0, last: 0, history: [] };
  const newBest = a.score > rec.bestScore;
  rec.attempts++;
  rec.last = Date.now();
  rec.bestScore = Math.max(rec.bestScore, a.score);
  // Stars earned below the starting tempo don't count as mastery for tempo exercises; handled by caller.
  const starGain = Math.max(0, a.stars - rec.bestStars);
  rec.bestStars = Math.max(rec.bestStars, a.stars);
  if (a.bpm && a.stars >= 2) rec.bestBpm = Math.max(rec.bestBpm ?? 0, a.bpm);
  rec.history.push({ t: Date.now(), score: a.score, stars: a.stars, bpm: a.bpm });
  if (rec.history.length > 30) rec.history.shift();

  // Longer runs (repeated exercises) earn proportionally more practice XP
  const xp = Math.round((5 + a.score * 10) * Math.max(1, a.repeats ?? 1) + starGain * 15);
  const d = today();
  const confusions = { ...state.confusions };
  for (const [k, v] of Object.entries(a.confusions ?? {})) confusions[k] = (confusions[k] ?? 0) + v;
  state = {
    ...state,
    exercises: { ...state.exercises, [id]: rec },
    xp: state.xp + xp,
    days: { ...state.days, [d]: (state.days[d] ?? 0) + Math.round(a.seconds) },
    confusions,
  };
  save();
  return { xp, newBest };
}

export function addPracticeSeconds(seconds: number) {
  const d = today();
  state = { ...state, days: { ...state.days, [d]: (state.days[d] ?? 0) + Math.round(seconds) } };
  save();
}

export function streak(p: Progress = state): number {
  let s = 0;
  const d = new Date();
  // Today counts if practised; otherwise start from yesterday
  if (!p.days[today(d)]) d.setDate(d.getDate() - 1);
  while (p.days[today(d)]) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

export function resetProgress() {
  state = { exercises: {}, xp: 0, days: {}, confusions: {} };
  save();
}

export function exportProgress(): string {
  return JSON.stringify(state);
}

export function importProgress(json: string) {
  const p = JSON.parse(json);
  if (typeof p !== 'object' || !p.exercises) throw new Error('Not a progress file');
  state = { exercises: {}, xp: 0, days: {}, confusions: {}, ...p };
  save();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => state);
}

/** Rank title by XP. */
export function rankFor(xp: number): { title: string; next: number; prev: number } {
  const ranks: [number, string][] = [
    [0, 'Novice'], [150, 'Beginner'], [500, 'Apprentice'], [1200, 'Student'], [2500, 'Intermediate'],
    [4500, 'Advanced'], [7500, 'Virtuoso-in-training'], [12000, 'Virtuoso'], [20000, 'Elite'],
  ];
  let i = 0;
  while (i + 1 < ranks.length && xp >= ranks[i + 1][0]) i++;
  return { title: ranks[i][1], prev: ranks[i][0], next: ranks[i + 1]?.[0] ?? ranks[i][0] };
}
