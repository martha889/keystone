// Grand-staff notation renderer (SVG).

import { useEffect, useMemo, useState } from 'react';
import type { Step } from '../curriculum/types';
import type { StepStatus } from '../practice/feedback';
import { keySigAccidentals, keySigLetters, type Spelled } from '../music/theory';
import { handOf } from '../music/fingering';

interface Props {
  steps: Step[];
  keySig?: number;
  timeSig?: [number, number];
  pickup?: number;
  statuses?: StepStatus[];
  current?: number; // highlighted step index
  playheadBeat?: number | null; // tempo mode
  showFingers?: boolean;
  hidden?: boolean; // ear training: hide note heads
}

const S = 10; // staff space
const HALF = S / 2;

// Diatonic index: octave*7 + letter
const dIndex = (s: Spelled) => s.octave * 7 + s.letter;

function clefOf(step: Step, k: number): 'T' | 'B' {
  return handOf(step, k) === 'R' ? 'T' : 'B';
}

interface Laid {
  i: number;
  x: number;
  w: number;
  beat: number;
  barBefore: boolean;
}

function layoutPages(steps: Step[], barBeats: number, pickup: number, maxSteps: number, maxBars: number) {
  // Beat positions and bar membership
  const beats: number[] = [];
  let b = 0;
  for (const st of steps) {
    beats.push(b);
    b += st.beats;
  }
  const barOf = (beat: number) => (pickup > 0 ? (beat < pickup - 1e-6 ? 0 : 1 + Math.floor((beat - pickup + 1e-6) / barBeats)) : Math.floor((beat + 1e-6) / barBeats));
  // Pages: group whole bars, ≤ 16 steps and ≤ 4 bars per page
  const pages: number[][] = [];
  let page: number[] = [];
  let pageBars = new Set<number>();
  let curBar = -1;
  let barSteps: number[] = [];
  const flushBar = () => {
    if (!barSteps.length) return;
    if (page.length && (page.length + barSteps.length > maxSteps || pageBars.size >= maxBars)) {
      pages.push(page);
      page = [];
      pageBars = new Set();
    }
    page.push(...barSteps);
    pageBars.add(curBar);
    barSteps = [];
  };
  steps.forEach((_, i) => {
    const bar = barOf(beats[i]);
    if (bar !== curBar) {
      flushBar();
      curBar = bar;
    }
    barSteps.push(i);
    // Very long bars (e.g. 16 sixteenths): split
    if (barSteps.length >= maxSteps) flushBar();
  });
  flushBar();
  if (page.length) pages.push(page);
  return { pages, beats, barOf };
}

function stepWidth(st: Step): number {
  const acc = st.spelled.some((s) => s.acc !== 0) ? 8 : 0;
  return 22 + 15 * Math.log2(1 + st.beats * 2) + acc;
}

export default function Staff({ steps, keySig = 0, timeSig = [4, 4], pickup = 0, statuses, current = -1, playheadBeat = null, showFingers = false, hidden = false }: Props) {
  const barBeats = (timeSig[0] * 4) / timeSig[1];
  const vw = useViewportWidth();
  const [maxSteps, maxBars] = vw < 520 ? [8, 2] : vw < 860 ? [12, 3] : [16, 4];
  const { pages, beats, barOf } = useMemo(() => layoutPages(steps, barBeats, pickup, maxSteps, maxBars), [steps, barBeats, pickup, maxSteps, maxBars]);

  // Which page to show
  let pageIdx = 0;
  if (playheadBeat !== null && playheadBeat !== undefined) {
    const idx = beats.findIndex((b, i) => b + steps[i].beats > playheadBeat);
    const target = idx < 0 ? steps.length - 1 : idx;
    pageIdx = Math.max(0, pages.findIndex((p) => p.includes(target)));
  } else if (current >= 0) {
    pageIdx = Math.max(0, pages.findIndex((p) => p.includes(Math.min(current, steps.length - 1))));
  }
  const page = pages[pageIdx] ?? [];

  // Clefs needed (across the whole piece so the layout doesn't jump)
  const { useT, useB, minD, maxD } = useMemo(() => {
    let t = false, bb = false, mn = 99, mx = 0;
    for (const st of steps)
      for (const [k, s] of st.spelled.entries()) {
        if (clefOf(st, k) === 'T') t = true;
        else bb = true;
        mn = Math.min(mn, dIndex(s));
        mx = Math.max(mx, dIndex(s));
      }
    if (!t && !bb) t = true;
    return { useT: t, useB: bb, minD: mn, maxD: mx };
  }, [steps]);

  // Vertical layout
  const topExtra = useT ? Math.max(0, (maxD - 38) * HALF) : Math.max(0, (maxD - 26) * HALF);
  const botExtra = useB ? Math.max(0, (18 - minD) * HALF) : Math.max(0, (30 - minD) * HALF);
  const hasFingers = showFingers && steps.some((st) => st.fingers?.some((f) => f != null));
  const hasLabels = steps.some((st) => st.label);
  // Chord fingerings are stacked vertically, so reserve one line per stacked number.
  const stackOf = (clef: 'T' | 'B') =>
    Math.max(0, ...steps.map((st) => st.notes.filter((_, k) => clefOf(st, k) === clef && st.fingers?.[k] != null).length));
  const stackT = hasFingers ? stackOf('T') : 0;
  const stackB = hasFingers ? stackOf('B') : 0;
  const fingerRow = stackT ? 6 + 11 * stackT : 0;
  const labelRow = hasLabels ? 18 : 0;
  const padTop = 30 + topExtra + fingerRow + labelRow;
  const trebleTop = padTop;
  const trebleBottom = trebleTop + 4 * S;
  const bassTop = useT ? trebleBottom + 6 * S : padTop;
  const bassBottom = bassTop + 4 * S;
  const lastLine = useB ? bassBottom : trebleBottom;
  const height = lastLine + 30 + botExtra + (stackB ? 6 + 11 * stackB : 0);
  const firstLine = useT ? trebleTop : bassTop;

  const yOf = (s: Spelled, clef: 'T' | 'B') => (clef === 'T' ? trebleBottom - (dIndex(s) - 30) * HALF : bassBottom - (dIndex(s) - 18) * HALF);

  // Horizontal layout
  const sigCount = Math.abs(keySig);
  const headerW = 52 + sigCount * 10 + 26;
  const laid: Laid[] = [];
  let x = headerW + 12;
  page.forEach((i, k) => {
    const barBefore = k > 0 && barOf(beats[i]) !== barOf(beats[page[k - 1]]);
    if (barBefore) x += 14;
    const w = stepWidth(steps[i]);
    laid.push({ i, x: x + 8, w, beat: beats[i], barBefore });
    x += w;
  });
  const width = Math.max(x + 16, 360);

  const sigAccs = keySigAccidentals(keySig);
  const sigLetters = keySigLetters(keySig);

  // Key signature positions (diatonic index) for treble; bass = −14
  const sharpD = [38, 35, 39, 36, 33, 37, 34];
  const flatD = [34, 37, 33, 36, 32, 35, 31];

  const colorFor = (i: number) => {
    const st = statuses?.[i];
    if (st === 'correct') return 'var(--good)';
    if (st === 'fixed') return 'var(--warn)';
    if (st === 'wrong' || st === 'missed') return 'var(--bad)';
    if (i === current) return 'var(--accent)';
    return 'var(--ink)';
  };

  // Playhead x
  let playX: number | null = null;
  if (playheadBeat !== null && playheadBeat !== undefined && laid.length) {
    const first = laid[0];
    if (playheadBeat <= first.beat) playX = first.x - (first.beat - playheadBeat) * 30;
    for (let k = 0; k < laid.length; k++) {
      const a = laid[k];
      const bEnd = a.beat + steps[a.i].beats;
      if (playheadBeat >= a.beat && playheadBeat < bEnd) {
        const nx = k + 1 < laid.length ? laid[k + 1].x : a.x + a.w;
        playX = a.x + ((playheadBeat - a.beat) / steps[a.i].beats) * (nx - a.x);
      }
    }
    if (playX === null && playheadBeat > laid[laid.length - 1].beat) playX = laid[laid.length - 1].x + laid[laid.length - 1].w;
  }

  const staffLines = (top: number) => [0, 1, 2, 3, 4].map((k) => <line key={k} x1={4} x2={width - 4} y1={top + k * S} y2={top + k * S} className="staff-line" />);

  return (
    <div className="staff-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="staff" role="img" aria-label="Music notation" style={{ maxHeight: Math.max(height * 1.6, 120) }}>
        {useT && staffLines(trebleTop)}
        {useB && staffLines(bassTop)}
        {/* System bar + brace line */}
        <line x1={4} x2={4} y1={firstLine} y2={lastLine} className="bar-line" />
        <line x1={width - 4} x2={width - 4} y1={firstLine} y2={lastLine} className="bar-line" />
        {/* Clefs */}
        {useT && <text x={8} y={trebleBottom - S} className="clef" fontSize={S * 6.4}>𝄞</text>}
        {useB && <text x={9} y={bassTop + S} className="clef" fontSize={S * 3.6}>𝄢</text>}
        {/* Key signature */}
        {sigLetters.map((_, k) => {
          const dT = keySig > 0 ? sharpD[k] : flatD[k];
          const sx = 52 + k * 10;
          const sym = keySig > 0 ? '♯' : '♭';
          return (
            <g key={k}>
              {useT && <text x={sx} y={trebleBottom - (dT - 30) * HALF + (keySig > 0 ? 6 : 3.5)} className="acc ks">{sym}</text>}
              {useB && <text x={sx} y={bassBottom - (dT - 14 - 18) * HALF + (keySig > 0 ? 6 : 3.5)} className="acc ks">{sym}</text>}
            </g>
          );
        })}
        {/* Time signature */}
        {pageIdx === 0 && (
          <g className="timesig">
            {useT && (
              <>
                <text x={headerW - 14} y={trebleTop + 2 * S - 1}>{timeSig[0]}</text>
                <text x={headerW - 14} y={trebleTop + 4 * S - 1}>{timeSig[1]}</text>
              </>
            )}
            {useB && (
              <>
                <text x={headerW - 14} y={bassTop + 2 * S - 1}>{timeSig[0]}</text>
                <text x={headerW - 14} y={bassTop + 4 * S - 1}>{timeSig[1]}</text>
              </>
            )}
          </g>
        )}

        {/* Current column highlight */}
        {laid.map((a) =>
          a.i === current && playheadBeat === null ? (
            <rect key={`h${a.i}`} x={a.x - 14} y={firstLine - 24 - topExtra - fingerRow} width={28} height={lastLine - firstLine + 48 + topExtra + botExtra + fingerRow} rx={6} className="current-col" />
          ) : null,
        )}

        {/* Bar lines */}
        {laid.map((a) => (a.barBefore ? <line key={`b${a.i}`} x1={a.x - 15} x2={a.x - 15} y1={firstLine} y2={lastLine} className="bar-line" /> : null))}

        {/* Notes */}
        {laid.map((a) => {
          const st = steps[a.i];
          const col = colorFor(a.i);
          if (!st.notes.length) return <Rest key={a.i} x={a.x} beats={st.beats} y={(useT ? trebleTop : bassTop) + 2 * S} color={col} />;
          if (hidden && statuses?.[a.i] !== 'correct' && statuses?.[a.i] !== 'fixed') {
            return <text key={a.i} x={a.x - 4} y={(useT ? trebleTop : bassTop) + 2 * S + 5} className="hidden-q">?</text>;
          }
          const groups: Record<'T' | 'B', Spelled[]> = { T: [], B: [] };
          st.spelled.forEach((s, k) => groups[clefOf(st, k)].push(s));
          return (
            <g key={a.i} style={{ color: col }}>
              {(['T', 'B'] as const).map((clef) => {
                const g = groups[clef];
                if (!g.length) return null;
                const lines: number[] = [];
                const ds = g.map(dIndex);
                const lo = Math.min(...ds), hi = Math.max(...ds);
                const [bottomLine, topLine] = clef === 'T' ? [30, 38] : [18, 26];
                for (let d = bottomLine - 2; d >= lo; d -= 2) lines.push(d);
                for (let d = topLine + 2; d <= hi; d += 2) lines.push(d);
                const yD = (d: number) => (clef === 'T' ? trebleBottom - (d - 30) * HALF : bassBottom - (d - 18) * HALF);
                const mid = clef === 'T' ? 34 : 22;
                const stemUp = (lo + hi) / 2 < mid;
                const filled = st.beats < 2;
                const hasStem = st.beats < 4;
                const sorted = [...g].sort((p, q) => dIndex(p) - dIndex(q));
                // Second-interval offsets
                const offs = sorted.map((s, k) => (k > 0 && dIndex(s) - dIndex(sorted[k - 1]) === 1 ? (stemUp ? 11 : -11) : 0));
                const stemX = a.x + (stemUp ? 5.6 : -5.6);
                const yLo = yD(lo), yHi = yD(hi);
                const stemEnd = stemUp ? yHi - 3.4 * S : yLo + 3.4 * S;
                const flags = st.beats <= 0.375 ? 2 : st.beats <= 0.75 ? 1 : 0;
                const dotted = [0.75, 1.5, 3, 0.375].includes(st.beats);
                return (
                  <g key={clef}>
                    {lines.map((d) => <line key={d} x1={a.x - 10} x2={a.x + 10} y1={yD(d)} y2={yD(d)} className="ledger" />)}
                    {sorted.map((s, k) => {
                      const y = yOf(s, clef);
                      const showAcc = s.acc !== sigAccs[s.letter];
                      const accSym = s.acc === 0 ? '♮' : s.acc === 1 ? '♯' : s.acc === -1 ? '♭' : s.acc === 2 ? '𝄪' : '𝄫';
                      return (
                        <g key={k}>
                          <ellipse cx={a.x + offs[k]} cy={y} rx={5.8} ry={4.2} transform={`rotate(-20 ${a.x + offs[k]} ${y})`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.6} />
                          {showAcc && <text x={a.x - 17} y={y + 4} className="acc" fill="currentColor">{accSym}</text>}
                          {dotted && <circle cx={a.x + 10} cy={y - (dIndex(s) % 2 === 0 ? HALF : 0)} r={1.6} fill="currentColor" />}
                        </g>
                      );
                    })}
                    {hasStem && <line x1={stemX} x2={stemX} y1={stemUp ? yLo : yHi} y2={stemEnd} stroke="currentColor" strokeWidth={1.3} />}
                    {Array.from({ length: flags }).map((_, f) => (
                      <path key={f} d={stemUp ? `M${stemX} ${stemEnd + f * 7} q 3 6 9 9 q -3 -2 -9 -3` : `M${stemX} ${stemEnd - f * 7} q 3 -6 9 -9 q -3 2 -9 3`} fill="currentColor" stroke="currentColor" strokeWidth={1} />
                    ))}
                    {showFingers && st.fingers && (
                      <text className={`finger finger-${clef === 'T' ? 'R' : 'L'}`} textAnchor="middle">
                        {st.notes
                          .map((m, k) => ({ m, f: st.fingers?.[k] }))
                          .filter((x, k) => x.f != null && clefOf(st, k) === clef)
                          .sort((p, q) => (clef === 'T' ? p.m - q.m : q.m - p.m))
                          .map((x, j) => (
                            <tspan key={j} x={a.x} y={clef === 'T' ? trebleTop - topExtra - 12 - j * 11 : bassBottom + botExtra + 24 + j * 11}>{x.f}</tspan>
                          ))}
                      </text>
                    )}
                  </g>
                );
              })}
              {st.label && <text x={a.x} y={firstLine - topExtra - fingerRow - 14} className="label" textAnchor="middle">{st.label}</text>}
            </g>
          );
        })}

        {playX !== null && <line x1={playX} x2={playX} y1={firstLine - 14} y2={lastLine + 14} className="playhead" />}
      </svg>
      {pages.length > 1 && <div className="page-ind">Line {pageIdx + 1} / {pages.length}</div>}
    </div>
  );
}

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

function Rest({ x, beats, y, color }: { x: number; beats: number; y: number; color: string }) {
  if (beats >= 4) return <rect x={x - 6} y={y - S} width={12} height={5} fill={color} />;
  if (beats >= 2) return <rect x={x - 6} y={y - 5} width={12} height={5} fill={color} />;
  if (beats >= 1)
    return <path d={`M${x - 2} ${y - 14} l 6 7 l -5 6 l 6 7 q -7 -3 -5 4 q -6 -6 2 -6 l -6 -7 l 5 -6 z`} fill={color} />;
  return (
    <g fill={color}>
      <circle cx={x - 2} cy={y - 4} r={2.6} />
      <path d={`M${x - 2} ${y - 3} q 4 1 6 -3 l -5 14`} stroke={color} strokeWidth={1.4} fill="none" />
    </g>
  );
}
