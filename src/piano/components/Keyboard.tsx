// On-screen keyboard (SVG) mirroring the CT-S1's 61 keys or a slice of them.

import { isBlack, noteName, KEYBOARD_HIGH, KEYBOARD_LOW, MIDDLE_C } from '../music/theory';

export type KeyMark = 'target' | 'good' | 'bad' | 'live' | 'hint';

/** A finger number drawn on a key. Ghost = where a finger rests; solid = the finger to play now. */
export interface FingerMark {
  f: number;
  hand: 'R' | 'L';
  ghost?: boolean;
}

interface Props {
  lo?: number;
  hi?: number;
  marks?: Map<number, KeyMark>;
  fingers?: Map<number, FingerMark>;
  showNames?: boolean;
  onPress?: (midi: number) => void;
}

const WW = 24; // white key width
const WH = 120;
const BW = 14;
const BH = 76;

export function rangeFor(notes: number[], minSpan = 24): [number, number] {
  if (!notes.length) return [48, 84];
  let lo = Math.min(...notes), hi = Math.max(...notes);
  lo = lo - (lo % 12); // down to a C
  hi = hi + (11 - (hi % 12)) + 1; // up to the next C
  while (hi - lo < minSpan) {
    if (lo - 12 >= KEYBOARD_LOW) lo -= 12;
    else hi += 12;
    if (hi - lo < minSpan && hi + 12 <= KEYBOARD_HIGH) hi += 12;
  }
  return [Math.max(KEYBOARD_LOW, lo), Math.min(KEYBOARD_HIGH, hi)];
}

export default function Keyboard({ lo = KEYBOARD_LOW, hi = KEYBOARD_HIGH, marks, fingers, showNames = true, onPress }: Props) {
  const whites: number[] = [];
  const blacks: { m: number; x: number }[] = [];
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) blacks.push({ m, x: whites.length * WW - BW / 2 });
    else whites.push(m);
  }
  const width = whites.length * WW;
  const cls = (m: number) => {
    const mk = marks?.get(m);
    return mk ? ` k-${mk}` : '';
  };
  return (
    <svg className="keyboard" viewBox={`0 0 ${width} ${WH + 2}`} role="img" aria-label="Keyboard" style={{ maxWidth: whites.length * 40 }}>
      {whites.map((m, i) => (
        <g key={m} onPointerDown={onPress ? () => onPress(m) : undefined}>
          <rect x={i * WW + 0.5} y={0.5} width={WW - 1} height={WH} rx={3} className={`wkey${cls(m)}`} />
          {m === MIDDLE_C && <circle cx={i * WW + WW / 2} cy={WH - 19} r={2.2} className="mid-c" />}
          {(showNames || m % 12 === 0 || marks?.has(m)) && (
            <text x={i * WW + WW / 2} y={WH - 8} className={`kname${m % 12 === 0 ? ' kname-c' : ''}`} textAnchor="middle">
              {m % 12 === 0 ? noteName(m) : noteName(m, false)}
            </text>
          )}
          {fingers?.has(m) && <FingerDot x={i * WW + WW / 2} y={WH - 33} r={8.5} mark={fingers.get(m)!} />}
        </g>
      ))}
      {blacks.map(({ m, x }) => (
        <g key={m} onPointerDown={onPress ? () => onPress(m) : undefined}>
          <rect x={x} y={0.5} width={BW} height={BH} rx={2} className={`bkey${cls(m)}`} />
          {fingers?.has(m) && <FingerDot x={x + BW / 2} y={BH - 14} r={6.5} mark={fingers.get(m)!} small />}
        </g>
      ))}
    </svg>
  );
}

function FingerDot({ x, y, r, mark, small }: { x: number; y: number; r: number; mark: FingerMark; small?: boolean }) {
  const cls = `fdot fdot-${mark.hand}${mark.ghost ? ' ghost' : ''}`;
  return (
    <g className={cls} pointerEvents="none">
      <circle cx={x} cy={y} r={r} />
      <text x={x} y={y + (small ? 3.3 : 3.8)} textAnchor="middle" className={small ? 'small' : ''}>{mark.f}</text>
    </g>
  );
}
