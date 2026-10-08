// Scoring and coaching feedback from a finished run.

import type { ExerciseDef, Step } from '../curriculum/types';
import { keySigAccidentals, noteName, pc, spelledName } from '../music/theory';

export type StepStatus = 'pending' | 'correct' | 'fixed' | 'wrong' | 'missed' | 'rest';

export interface StepResult {
  status: StepStatus;
  wrong: number[][]; // wrong attempts (what was heard)
  timeMs?: number; // follow: time spent reaching this note
  offsetMs?: number; // tempo: timing error (+ late, − early)
  octaveOff?: boolean;
  missingNotes?: number[]; // chord notes not heard
}

export interface RunResult {
  kind: ExerciseDef['kind'];
  steps: Step[];
  results: StepResult[];
  strays: number; // tempo: notes played when nothing was expected
  seconds: number;
  bpm?: number;
  keySig?: number;
  roundScores?: number[]; // ear
  roundAnswers?: string[];
}

export interface Report {
  score: number; // 0..1
  stars: number;
  headline: string;
  stats: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }[];
  tips: string[];
  confusions: Record<string, number>;
}

export function starsFor(score: number, pass: number): number {
  if (score >= 0.95) return 3;
  if (score >= 0.85) return 2;
  if (score >= pass) return 1;
  return 0;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stepName(st: Step): string {
  if (st.label && st.notes.length > 1) return st.label;
  return st.spelled.map((s) => spelledName(s)).join('+');
}

export function analyse(run: RunResult, def: ExerciseDef): Report {
  const pass = def.passAccuracy ?? 0.75;
  const tips: string[] = [];
  const stats: Report['stats'] = [];
  const confusions: Record<string, number> = {};
  const playable = run.results.map((r, i) => ({ r, st: run.steps[i], i })).filter((x) => x.r.status !== 'rest');
  const total = Math.max(1, playable.length);

  // Wrong-note confusions (expected → played)
  for (const { r, st } of playable) {
    if (st.notes.length !== 1) continue;
    for (const w of r.wrong) {
      if (w.length !== 1) continue;
      if (pc(w[0]) === pc(st.notes[0])) continue;
      const key = `${spelledName(st.spelled[0], false)}>${noteName(w[0], false, st.spelled[0].acc < 0)}`;
      confusions[key] = (confusions[key] ?? 0) + 1;
    }
  }

  let score = 0;
  if (run.kind === 'follow' || run.kind === 'ear') {
    const wrongs = playable.reduce((a, x) => a + x.r.wrong.length, 0);
    const firstTry = playable.filter((x) => x.r.status === 'correct').length;
    if (run.kind === 'ear' && run.roundScores) {
      score = run.roundScores.reduce((a, b) => a + b, 0) / Math.max(1, run.roundScores.length);
      const perfect = run.roundScores.filter((s) => s === 1).length;
      stats.push({ label: 'Rounds perfect', value: `${perfect}/${run.roundScores.length}`, tone: perfect === run.roundScores.length ? 'good' : undefined });
    } else {
      score = total / (total + wrongs);
      stats.push({ label: 'First-try notes', value: `${firstTry}/${total}`, tone: firstTry === total ? 'good' : undefined });
    }
    stats.push({ label: 'Wrong notes', value: String(wrongs), tone: wrongs === 0 ? 'good' : wrongs > total * 0.3 ? 'bad' : 'warn' });

    if (run.kind === 'follow') {
      const times = playable.slice(1).map((x) => x.r.timeMs ?? 0).filter((t) => t > 0);
      const med = median(times);
      if (med) stats.push({ label: 'Median time per note', value: `${(med / 1000).toFixed(2)}s`, tone: med < 900 ? 'good' : undefined });
      // Hesitations
      const slow = playable
        .slice(1)
        .filter((x) => (x.r.timeMs ?? 0) > Math.max(1500, med * 2.3))
        .sort((a, b) => (b.r.timeMs ?? 0) - (a.r.timeMs ?? 0))
        .slice(0, 2);
      for (const x of slow) {
        const prev = run.steps[x.i - 1];
        const fingerA = prev?.fingers?.[0];
        const fingerB = x.st.fingers?.[0];
        const crossing = fingerA && fingerB && ((fingerB === 1 && fingerA >= 3) || (fingerA === 1 && fingerB >= 3));
        tips.push(
          crossing
            ? `You hesitated at the finger crossing **${stepName(prev)} → ${stepName(x.st)}** (finger ${fingerA} → ${fingerB}). Practise just those two notes slowly 5 times, keeping your wrist level.`
            : `You paused before **${stepName(x.st)}** (note ${x.i + 1}). Practise the move from ${prev ? stepName(prev) : 'the start'} to ${stepName(x.st)} on its own, then play the passage again.`,
        );
      }
      if (score >= 0.95 && med && med < 700 && def.hints === 'keys') tips.push('Accurate and fluent. Try the next exercise, or play this one again without looking at the keyboard highlights.');
    }
  } else {
    // Tempo
    let sum = 0;
    const offsets: number[] = [];
    let wrong = 0, missed = 0;
    for (const { r } of playable) {
      if (r.status === 'correct' || r.status === 'fixed') {
        const off = Math.abs(r.offsetMs ?? 0);
        const t = off <= 45 ? 1 : Math.max(0.5, 1 - (off - 45) / 300);
        sum += r.status === 'fixed' ? t * 0.5 : t;
        offsets.push(r.offsetMs ?? 0);
      } else if (r.status === 'wrong') wrong++;
      else if (r.status === 'missed') missed++;
    }
    score = Math.max(0, Math.min(1, sum / total - (run.strays * 0.25) / total));
    const hit = offsets.length;
    stats.push({ label: 'Notes hit', value: `${hit}/${total}`, tone: hit === total ? 'good' : hit < total * 0.8 ? 'bad' : 'warn' });
    stats.push({ label: 'Wrong / missed', value: `${wrong} / ${missed}`, tone: wrong + missed === 0 ? 'good' : 'warn' });
    if (offsets.length >= 3) {
      const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
      const sd = Math.sqrt(offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / offsets.length);
      stats.push({ label: 'Average timing', value: `${mean > 0 ? '+' : ''}${Math.round(mean)} ms`, tone: Math.abs(mean) < 30 ? 'good' : 'warn' });
      stats.push({ label: 'Steadiness (±)', value: `${Math.round(sd)} ms`, tone: sd < 35 ? 'good' : sd > 80 ? 'bad' : 'warn' });
      if (mean > 35) tips.push(`You’re **dragging**: on average ${Math.round(mean)} ms behind the beat. Anticipate a little: prepare each finger over its key before the click.`);
      else if (mean < -35) tips.push(`You’re **rushing**: on average ${Math.round(-mean)} ms ahead of the beat. Breathe, listen for the click, and feel the space between notes.`);
      if (sd > 60) tips.push(`Your timing varies by about ±${Math.round(sd)} ms. Count the subdivisions aloud (“1-and-2-and”) to steady the pulse.`);
      // Drift: compare first and second half
      const h = Math.floor(offsets.length / 2);
      if (h >= 4) {
        const a = offsets.slice(0, h).reduce((x, y) => x + y, 0) / h;
        const b = offsets.slice(h).reduce((x, y) => x + y, 0) / (offsets.length - h);
        if (b - a > 45) tips.push('You **slowed down** towards the end. Keep your energy through the last bars.');
        if (a - b > 45) tips.push('You **sped up** as you went. Stay locked to the click all the way through.');
      }
    }
    if (missed > total * 0.2) tips.push(`${missed} notes were missed. If the passage feels too fast, drop the tempo by 10 bpm. Accuracy first, then speed.`);
    if (run.strays > 2) tips.push(`${run.strays} extra notes were heard between the expected ones. Aim for clean, deliberate attacks (or check for background noise).`);
    if (run.bpm && def.targetBpm) {
      if (score >= 0.9 && run.bpm < def.targetBpm) tips.push(`Solid at ♩=${run.bpm}. Next time try **♩=${Math.min(def.targetBpm, run.bpm + 6)}**. Target for mastery: ♩=${def.targetBpm}.`);
      if (score >= 0.95 && run.bpm >= def.targetBpm) tips.push(`**Mastered at the target tempo (♩=${def.targetBpm}).** Excellent!`);
      if (score < 0.6) tips.push(`Try ♩=${Math.max(30, run.bpm - 12)} or learn the notes in follow mode first.`);
    }
  }

  // Confusion tips
  const accs = run.keySig !== undefined ? keySigAccidentals(run.keySig) : null;
  const topConf = Object.entries(confusions).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [k, c] of topConf) {
    const [exp, got] = k.split('>');
    const letter = 'CDEFGAB'.indexOf(exp[0]);
    const sigAcc = accs && letter >= 0 ? accs[letter] : 0;
    if (exp[0] === got[0] && sigAcc !== 0) {
      tips.push(`You played **${got}** instead of **${exp}**${c > 1 ? ` ${c}×` : ''}. The key signature makes every ${exp[0]} a ${exp}. Check it before you start.`);
    } else if (exp[0] === got[0]) {
      tips.push(`You played **${got}** instead of **${exp}**${c > 1 ? ` ${c}×` : ''}. Watch the accidentals.`);
    } else {
      tips.push(`You played **${got}** where **${exp}** was written${c > 1 ? ` (${c}×)` : ''}. ${def.hints === 'staff' ? 'Find it from a landmark note (middle C, treble G, bass F).' : 'Check your hand position and finger numbers.'}`);
    }
  }
  const octaveIssues = playable.filter((x) => x.r.octaveOff).length;
  if (octaveIssues >= 2) tips.push(`${octaveIssues} notes were the right letter but in the wrong octave. Middle C is C4. Notes on the staff tell you exactly which octave.`);
  const chordMisses: Record<string, number> = {};
  for (const { r } of playable) for (const m of r.missingNotes ?? []) chordMisses[noteName(m)] = (chordMisses[noteName(m)] ?? 0) + 1;
  const topMiss = Object.entries(chordMisses).sort((a, b) => b[1] - a[1])[0];
  if (topMiss && topMiss[1] >= 2) tips.push(`In chords, **${topMiss[0]}** was often not heard. Press all keys firmly and exactly together, and hold for half a second.`);

  if (!tips.length) {
    if (score >= 0.95) tips.push('Excellent. Clean and confident. Move on, or come back tomorrow to make it permanent.');
    else if (score >= 0.8) tips.push('Good work. One more clean run will lock it in.');
    else tips.push('Slow down and aim for zero mistakes. Repeating errors builds them in as habits.');
  }

  const stars = starsFor(score, pass);
  const headline = stars === 3 ? 'Superb!' : stars === 2 ? 'Great job!' : stars === 1 ? 'Passed. Keep polishing.' : 'Keep practising';
  return { score, stars, headline, stats, tips, confusions };
}
