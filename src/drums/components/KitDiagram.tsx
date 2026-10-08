// Top-down view of the Alesis Nitro Max (right-handed setup), with pads lit by limb.

import { INSTS, LIMB_SHORT, type Inst, type Limb } from '../engine/kit';

export type PadState = 'next' | 'good' | 'bad' | 'live';

export interface PadMark {
  state: PadState;
  limb?: Limb;
}

interface Pad {
  inst: Inst;
  x: number;
  y: number;
  r: number;
  cymbal?: boolean;
  label: string;
}

// The two hi-hat sounds share one pad
const PADS: Pad[] = [
  { inst: 'crash', x: 150, y: 62, r: 44, cymbal: true, label: 'Crash' },
  { inst: 'ride', x: 452, y: 82, r: 46, cymbal: true, label: 'Ride' },
  { inst: 'hhClosed', x: 92, y: 168, r: 38, cymbal: true, label: 'Hi-hat' },
  { inst: 'tom1', x: 248, y: 112, r: 31, label: 'Tom 1' },
  { inst: 'tom2', x: 336, y: 112, r: 31, label: 'Tom 2' },
  { inst: 'snare', x: 196, y: 210, r: 36, label: 'Snare' },
  { inst: 'tom3', x: 402, y: 212, r: 35, label: 'Tom 3' },
];

const FEET = [
  { inst: 'hhPedal' as Inst, x: 120, y: 292, label: 'Hi-hat pedal' },
  { inst: 'kick' as Inst, x: 292, y: 292, label: 'Kick pedal' },
];

function markFor(marks: Map<Inst, PadMark> | undefined, inst: Inst): PadMark | undefined {
  if (!marks) return undefined;
  if (inst === 'hhClosed') return marks.get('hhClosed') ?? marks.get('hhOpen');
  return marks.get(inst);
}

export default function KitDiagram({ marks, compact = false, onHit }: { marks?: Map<Inst, PadMark>; compact?: boolean; onHit?: (i: Inst) => void }) {
  return (
    <svg className={`kit ${compact ? 'compact' : ''}`} viewBox="0 0 540 340" role="img" aria-label="Drum kit layout">
      {/* Kick drum body seen from above */}
      <rect x={240} y={168} width={104} height={86} rx={12} className={`pad kickbody ${markFor(marks, 'kick') ? `st-${markFor(marks, 'kick')!.state}` : ''}`} />
      <text x={292} y={216} textAnchor="middle" className="padlabel">Kick</text>
      {PADS.map((p) => {
        const m = markFor(marks, p.inst);
        const open = p.inst === 'hhClosed' && marks?.has('hhOpen') && !marks?.has('hhClosed');
        return (
          <g key={p.inst} onPointerDown={onHit ? () => onHit(p.inst) : undefined}>
            <circle cx={p.x} cy={p.y} r={p.r} className={`pad ${p.cymbal ? 'cym' : 'drum'} ${m ? `st-${m.state}` : ''}`} />
            {p.cymbal && <circle cx={p.x} cy={p.y} r={p.r * 0.18} className="bell" />}
            <text x={p.x} y={p.y + p.r + 15} textAnchor="middle" className="padlabel">{open ? 'Hi-hat (open)' : p.label}</text>
            {m?.limb && <LimbBadge x={p.x} y={p.y} limb={m.limb} />}
          </g>
        );
      })}
      {FEET.map((f) => {
        const m = markFor(marks, f.inst);
        return (
          <g key={f.inst}>
            <rect x={f.x - 22} y={f.y - 30} width={44} height={60} rx={8} className={`pad pedal ${m ? `st-${m.state}` : ''}`} />
            <text x={f.x} y={f.y + 46} textAnchor="middle" className="padlabel">{f.label}</text>
            {m?.limb && <LimbBadge x={f.x} y={f.y} limb={m.limb} />}
          </g>
        );
      })}
    </svg>
  );
}

function LimbBadge({ x, y, limb }: { x: number; y: number; limb: Limb }) {
  return (
    <g className={`limb limb-${limb}`} pointerEvents="none">
      <circle cx={x} cy={y} r={15} />
      <text x={x} y={y + 5} textAnchor="middle">{LIMB_SHORT[limb]}</text>
    </g>
  );
}

export function instLabel(i: Inst) {
  return INSTS[i].name;
}
