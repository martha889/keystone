// Hand diagrams: finger numbers (top view) and hand shape (side view).

import type { Hand } from '../music/fingering';

interface FingerGeom {
  f: number;
  x: number; // base x (relative to palm left edge, right hand)
  len: number;
  w: number;
  angle: number; // degrees, rotation about the finger base
}

// Right hand, palm down, seen from above, fingers pointing to the keyboard (up).
const RIGHT: FingerGeom[] = [
  { f: 1, x: 2, len: 30, w: 15, angle: -38 },
  { f: 2, x: 16, len: 40, w: 13, angle: -4 },
  { f: 3, x: 31, len: 45, w: 13, angle: 0 },
  { f: 4, x: 46, len: 41, w: 13, angle: 4 },
  { f: 5, x: 60, len: 32, w: 12, angle: 9 },
];

function OneHand({ hand, active, ox }: { hand: Hand; active: number[]; ox: number }) {
  const mirror = hand === 'L';
  const palmW = 74;
  const palmTop = 58;
  return (
    <g transform={mirror ? `translate(${ox + palmW + 4} 0) scale(-1 1)` : `translate(${ox} 0)`} className={`hand hand-${hand}`}>
      <rect x={2} y={palmTop} width={palmW} height={46} rx={20} className="palm" />
      {RIGHT.map((g) => {
        const on = active.includes(g.f);
        const baseX = g.x + g.w / 2;
        const baseY = g.f === 1 ? palmTop + 30 : palmTop + 8;
        return (
          <g key={g.f} transform={`rotate(${g.angle} ${baseX} ${baseY})`}>
            <rect x={baseX - g.w / 2} y={baseY - g.len} width={g.w} height={g.len + 10} rx={g.w / 2} className={`digit ${on ? 'on' : ''}`} />
            <g transform={mirror ? `translate(${baseX} ${baseY - g.len + 9}) scale(-1 1)` : `translate(${baseX} ${baseY - g.len + 9})`}>
              <circle r={7} className={`tip ${on ? 'on' : ''}`} />
              <text y={3.6} textAnchor="middle" className={`tip-num ${on ? 'on' : ''}`}>{g.f}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** Both hands with finger numbers; `active` fingers light up. */
export function HandsDiagram({ activeR = [], activeL = [], compact = false }: { activeR?: number[]; activeL?: number[]; compact?: boolean }) {
  return (
    <figure className={`hands-fig ${compact ? 'compact' : ''}`}>
      <svg viewBox="0 0 200 112" role="img" aria-label="Finger numbers: thumb 1, index 2, middle 3, ring 4, pinky 5, on both hands">
        <OneHand hand="L" active={activeL} ox={6} />
        <OneHand hand="R" active={activeR} ox={112} />
      </svg>
      {!compact && (
        <figcaption>
          <span className="lh-dot" /> Left hand <span className="rh-dot" /> Right hand · thumbs are 1, pinkies are 5
        </figcaption>
      )}
    </figure>
  );
}

/** Side view of a good hand shape over the keys. */
export function PostureDiagram() {
  return (
    <figure className="posture-fig">
      <svg viewBox="0 30 340 125" role="img" aria-label="Side view: forearm level with the keys, wrist level, knuckles arched, fingers curved, playing on the fingertips">
        {/* Keys */}
        <rect x={150} y={112} width={180} height={16} rx={2} className="pkey" />
        <line x1={150} y1={112} x2={330} y2={112} className="pkey-line" />
        {/* Forearm + wrist */}
        <path d="M10 86 L120 84 Q140 83 150 80" className="arm" />
        <path d="M10 104 L120 102 Q134 102 146 100" className="arm" />
        {/* Hand dome and curved finger */}
        <path d="M146 100 Q150 80 168 68 Q200 52 236 64 Q258 72 266 92 Q272 108 268 112" className="hand-side" />
        <path d="M150 80 Q170 70 196 70 Q224 72 238 84 Q248 96 252 112" className="hand-side inner" />
        <circle cx={260} cy={112} r={3.5} className="contact" />
        {/* Level guide */}
        <line x1={10} y1={95} x2={150} y2={95} className="guide" />
        {/* Labels */}
        <text x={20} y={78} className="plabel">Forearm level with the keys</text>
        <text x={160} y={46} className="plabel">Knuckles arched, like holding a ball</text>
        <text x={262} y={130} className="plabel">Play on the fingertip</text>
        <text x={14} y={122} className="plabel">Wrist relaxed and level, not dropped</text>
      </svg>
    </figure>
  );
}

export const POSTURE_TIPS = [
  '**Sit** centred on middle C, far enough back that your elbows are slightly in front of your body. Your forearms should be roughly level with the keys.',
  '**Curve** your fingers as if holding a small ball. The knuckles stay arched and never collapse inward.',
  '**Fingertips** strike the keys, close to the nail (keep nails short). The **thumb** plays on its outer side corner.',
  '**Rest** each finger lightly on its key before you play. That is your hand position. Fingers stay close to the keys; don’t lift them high.',
  '**Wrist** loose and level, moving smoothly sideways when the thumb passes under. Shoulders relaxed. If anything tightens, stop and shake it out.',
];
