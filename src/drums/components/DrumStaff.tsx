// Drum notation: percussion staff with standard positions, beams, sticking and counting.

import { useEffect, useMemo, useState } from 'react';
import { INSTS, LIMB_SHORT } from '../engine/kit';
import type { DHit, DrumData, DStep } from '../engine/pattern';

export type StepMark = 'good' | 'warn' | 'bad' | 'current';

interface Props {
  data: DrumData;
  marks?: Map<number, StepMark>; // step index → colour
  current?: number;
  playheadBeat?: number | null;
  showSticking?: boolean;
}

const S = 10;
const HALF = S / 2;
const TOP = 46; // y of the top staff line
const BOTTOM = TOP + 4 * S; // E4 line
const STEM_UP = TOP - 30;
const STEM_DOWN = BOTTOM + 30;
const STICK_Y = BOTTOM + 50;
const COUNT_Y = BOTTOM + 66;
const HEIGHT = COUNT_Y + 12;

const yOf = (h: DHit) => BOTTOM - INSTS[h.inst].staffPos * HALF;

function countLabels(sub: number, beat: number): string[] {
  const n = String(beat + 1);
  switch (sub) {
    case 1: return [n];
    case 2: return [n, '&'];
    case 3: return [n, 'trip', 'let'];
    case 4: return [n, 'e', '&', 'a'];
    case 6: return [n, '·', '·', '&', '·', '·'];
    default: return [n, ...Array(sub - 1).fill('·')];
  }
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

export default function DrumStaff({ data, marks, current = -1, playheadBeat = null, showSticking = true }: Props) {
  const vw = useViewportWidth();
  const bpb = data.beatsPerBar;
  const maxSlots = Math.max(...data.barSub.map((s) => s * bpb));
  const barsPerPage = vw < 600 || maxSlots > 16 ? 1 : 2;
  const pages = Math.ceil(data.bars / barsPerPage);

  // Page from playhead or current step
  let page = 0;
  if (playheadBeat !== null && playheadBeat !== undefined) page = Math.floor(Math.max(0, playheadBeat) / bpb / barsPerPage);
  else if (current >= 0 && data.steps[current]) page = Math.floor(data.steps[current].pos / bpb / barsPerPage);
  page = Math.min(pages - 1, Math.max(0, page));
  const firstBar = page * barsPerPage;
  const barsHere = Math.min(barsPerPage, data.bars - firstBar);

  const header = 58;
  const barW = Math.max(300, maxSlots * 28 + 24);
  const width = header + barsHere * barW + 8;

  const stepsByBar = useMemo(() => {
    const m = new Map<number, { s: DStep; i: number }[]>();
    data.steps.forEach((s, i) => {
      const b = Math.floor(s.pos / bpb + 1e-9);
      if (!m.has(b)) m.set(b, []);
      m.get(b)!.push({ s, i });
    });
    return m;
  }, [data, bpb]);

  const els: React.ReactNode[] = [];
  for (let k = 0; k < barsHere; k++) {
    const bar = firstBar + k;
    const sub = data.barSub[bar] ?? 2;
    const slots = sub * bpb;
    const x0 = header + k * barW;
    const slotW = (barW - 24) / slots;
    const xOfPos = (pos: number) => x0 + 16 + (pos - bar * bpb) * sub * slotW;
    const isCall = data.callBars?.includes(bar);
    const isSilent = data.silentBars?.includes(bar);
    if (isCall) els.push(<rect key={`call${bar}`} x={x0 + 2} y={TOP - 40} width={barW - 4} height={HEIGHT - TOP + 36} rx={8} className="call-bar" />);
    if (isCall) els.push(<text key={`calll${bar}`} x={x0 + barW / 2} y={TOP - 30} textAnchor="middle" className="bar-tag">Listen…</text>);
    if (isSilent) els.push(<text key={`sil${bar}`} x={x0 + barW / 2} y={TOP - 30} textAnchor="middle" className="bar-tag">🔇 no click: keep time!</text>);

    // Counting
    for (let sl = 0; sl < slots; sl++) {
      const beat = Math.floor(sl / sub);
      const lab = countLabels(sub, beat)[sl % sub];
      els.push(<text key={`c${bar}-${sl}`} x={x0 + 16 + sl * slotW} y={COUNT_Y} textAnchor="middle" className={`count ${sl % sub === 0 ? 'beat' : ''}`}>{lab}</text>);
    }
    els.push(<line key={`bl${bar}`} x1={x0 + barW} x2={x0 + barW} y1={TOP} y2={BOTTOM} className="bar-line" />);

    const items = stepsByBar.get(bar) ?? [];
    // Voices: hands (stems up) and feet (stems down)
    const voices: { up: boolean; notes: { i: number; s: DStep; hits: DHit[]; x: number; slot: number }[] }[] = [
      { up: true, notes: [] },
      { up: false, notes: [] },
    ];
    for (const { s, i } of items) {
      const x = xOfPos(s.pos);
      const slot = Math.round((s.pos - bar * bpb) * sub);
      const hands = s.hits.filter((h) => !INSTS[h.inst].foot);
      const feet = s.hits.filter((h) => INSTS[h.inst].foot);
      if (hands.length) voices[0].notes.push({ i, s, hits: hands, x, slot });
      if (feet.length) voices[1].notes.push({ i, s, hits: feet, x, slot });
    }

    for (const v of voices) {
      const stemEnd = v.up ? STEM_UP : STEM_DOWN;
      for (const n of v.notes) {
        const mk = marks?.get(n.i) ?? (n.i === current ? 'current' : undefined);
        const cls = `dn ${mk ? `dn-${mk}` : ''} ${isCall ? 'dn-call' : ''}`;
        const ys = n.hits.map(yOf);
        const near = v.up ? Math.max(...ys) : Math.min(...ys);
        const sx = n.x + (v.up ? 5 : -5);
        els.push(
          <g key={`n${n.i}-${v.up}`} className={cls}>
            {n.hits.map((h, j) => <Head key={j} x={n.x} y={ys[j]} h={h} />)}
            {n.hits.some((h) => INSTS[h.inst].staffPos >= 10 || INSTS[h.inst].staffPos <= -2) && (
              <line x1={n.x - 9} x2={n.x + 9} y1={TOP - S} y2={TOP - S} className="ledger" />
            )}
            <line x1={sx} x2={sx} y1={near} y2={stemEnd} className="stem" />
            {n.hits.some((h) => h.dyn === 'a') && <text x={n.x} y={v.up ? STEM_UP - 8 : STEM_DOWN + 14} textAnchor="middle" className="accent">&gt;</text>}
            {n.hits.some((h) => h.inst === 'hhOpen') && <circle cx={n.x} cy={STEM_UP - 18} r={3.5} className="open-mark" />}
          </g>,
        );
      }
      // Beams within each beat
      for (let beat = 0; beat < bpb; beat++) {
        const g = v.notes.filter((n) => Math.floor(n.slot / sub) === beat);
        if (sub === 1 || !g.length) continue;
        const sx = (n: (typeof g)[number]) => n.x + (v.up ? 5 : -5);
        const dir = v.up ? 1 : -1;
        if (g.length >= 2) {
          els.push(<line key={`b${bar}-${beat}-${v.up}`} x1={sx(g[0])} x2={sx(g[g.length - 1])} y1={stemEnd} y2={stemEnd} className="beam" />);
          if (sub >= 4) {
            for (let a = 0; a + 1 < g.length; a++) {
              if (g[a + 1].slot - g[a].slot === 1 || (sub >= 6 && g[a + 1].slot - g[a].slot <= 2))
                els.push(<line key={`b2${bar}-${beat}-${a}-${v.up}`} x1={sx(g[a])} x2={sx(g[a + 1])} y1={stemEnd + dir * 5} y2={stemEnd + dir * 5} className="beam" />);
            }
          }
          if (sub === 3 || sub === 6) els.push(<text key={`t${bar}-${beat}-${v.up}`} x={(sx(g[0]) + sx(g[g.length - 1])) / 2} y={v.up ? stemEnd - 4 : stemEnd + 12} textAnchor="middle" className="tuplet">{sub === 3 ? 3 : 6}</text>);
        } else {
          // A single note in the beat: flag unless it fills the whole beat
          const n = g[0];
          const fills = n.slot % sub === 0 && !v.notes.some((o) => o.slot > n.slot && o.slot < (beat + 1) * sub);
          if (!fills) {
            const flags = sub >= 4 && n.slot % 2 === 1 ? 2 : 1;
            for (let f = 0; f < flags; f++)
              els.push(<path key={`f${n.i}-${f}-${v.up}`} d={`M${sx(n)} ${stemEnd + dir * f * 6} q 4 ${dir * 6} 9 ${dir * 9}`} className="flag" />);
          }
        }
      }
    }

    // Sticking letters
    if (showSticking)
      for (const { s, i } of items) {
        const hands = s.hits.filter((h) => !INSTS[h.inst].foot && h.limb);
        if (!hands.length || isCall) continue;
        const x = xOfPos(s.pos);
        els.push(
          <text key={`st${i}`} x={x} y={STICK_Y} textAnchor="middle" className="sticking">
            {hands.map((h, j) => (
              <tspan key={j} className={`stk-${h.limb}`}>{(j ? ' ' : '') + LIMB_SHORT[h.limb!]}</tspan>
            ))}
          </text>,
        );
      }
  }

  // Playhead
  let playX: number | null = null;
  if (playheadBeat !== null && playheadBeat !== undefined) {
    const bar = Math.floor(playheadBeat / bpb);
    const k = bar - firstBar;
    if (k >= 0 && k < barsHere) {
      const sub = data.barSub[bar] ?? 2;
      const slotW = (barW - 24) / (sub * bpb);
      playX = header + k * barW + 16 + (playheadBeat - bar * bpb) * sub * slotW;
    }
  }

  return (
    <div className="staff-wrap">
      <svg viewBox={`0 ${TOP - 46} ${width} ${HEIGHT - TOP + 50}`} className="staff drum-staff" role="img" aria-label="Drum notation">
        {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={4} x2={width - 4} y1={TOP + k * S} y2={TOP + k * S} className="staff-line" />)}
        <line x1={4} x2={4} y1={TOP} y2={BOTTOM} className="bar-line" />
        {/* Percussion clef */}
        <rect x={14} y={TOP + S} width={4} height={2 * S} className="perc-clef" />
        <rect x={21} y={TOP + S} width={4} height={2 * S} className="perc-clef" />
        {page === 0 && (
          <g className="timesig">
            <text x={42} y={TOP + 2 * S - 1} textAnchor="middle">{data.timeSig[0]}</text>
            <text x={42} y={TOP + 4 * S - 1} textAnchor="middle">{data.timeSig[1]}</text>
          </g>
        )}
        {els}
        {playX !== null && <line x1={playX} x2={playX} y1={TOP - 24} y2={COUNT_Y + 4} className="playhead" />}
      </svg>
      {pages > 1 && <div className="page-ind">Bars {firstBar + 1}–{firstBar + barsHere} of {data.bars}</div>}
    </div>
  );
}

function Head({ x, y, h }: { x: number; y: number; h: DHit }) {
  const info = INSTS[h.inst];
  const head = info.x ? (
    <g className="xhead">
      <line x1={x - 4.5} x2={x + 4.5} y1={y - 4.5} y2={y + 4.5} />
      <line x1={x - 4.5} x2={x + 4.5} y1={y + 4.5} y2={y - 4.5} />
    </g>
  ) : (
    <ellipse cx={x} cy={y} rx={5.6} ry={4.2} transform={`rotate(-20 ${x} ${y})`} className="ohead" />
  );
  return (
    <g>
      {h.flam && (
        <g className="grace">
          <ellipse cx={x - 11} cy={y} rx={3.3} ry={2.5} transform={`rotate(-20 ${x - 11} ${y})`} />
          <line x1={x - 8} x2={x - 8} y1={y} y2={y - 16} />
          <line x1={x - 12} x2={x - 4} y1={y - 6} y2={y - 12} />
        </g>
      )}
      {head}
      {h.dyn === 'g' && (
        <>
          <text x={x - 10} y={y + 4} className="ghost-paren">(</text>
          <text x={x + 7} y={y + 4} className="ghost-paren">)</text>
        </>
      )}
    </g>
  );
}
