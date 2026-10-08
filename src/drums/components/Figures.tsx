// Technique diagrams for drummers: stick grip and posture at the kit.

export function GripDiagram() {
  return (
    <figure className="posture-fig">
      <svg viewBox="0 0 400 150" role="img" aria-label="Matched grip: the stick is pinched between thumb and index finger about one third from the butt end; other fingers wrap loosely">
        {/* Stick */}
        <line x1={30} y1={110} x2={330} y2={60} className="stick" />
        <circle cx={330} cy={60} r={5} className="stick-tip" />
        {/* Hand (simplified, palm down) */}
        <path d="M70 128 Q60 96 88 84 L128 76 Q150 74 156 92 Q160 108 146 118 L100 132 Q80 138 70 128 Z" className="hand-side" />
        {/* Thumb on top of the stick, index curled below */}
        <path d="M120 80 Q140 70 158 80" className="hand-side inner" />
        <path d="M146 98 Q162 104 156 116" className="hand-side inner" />
        {/* Fulcrum */}
        <circle cx={130} cy={88} r={6} className="contact" />
        <line x1={130} y1={82} x2={150} y2={36} className="guide" />
        <text x={152} y={32} className="plabel">Fulcrum: thumb pad + index finger</text>
        <text x={36} y={146} className="plabel">⅓ from the butt end</text>
        <line x1={30} y1={118} x2={130} y2={101} className="guide" />
        <text x={200} y={122} className="plabel">Other fingers wrap loosely</text>
      </svg>
    </figure>
  );
}

export function DrumPostureDiagram() {
  return (
    <figure className="posture-fig">
      <svg viewBox="0 0 360 200" role="img" aria-label="Side view at the kit: thighs sloping slightly down, back tall, snare just above the thighs, forearms angled down to the snare">
        {/* Throne */}
        <rect x={50} y={128} width={70} height={10} rx={4} className="pkey" />
        <line x1={85} y1={138} x2={85} y2={190} className="arm" />
        {/* Body: back, thigh, shin */}
        <path d="M80 128 L84 50" className="arm" />
        <circle cx={86} cy={36} r={13} className="hand-side" />
        <path d="M84 128 L170 136 L176 186" className="arm" />
        {/* Arm to snare */}
        <path d="M84 62 L120 104 L190 112" className="arm" />
        {/* Snare */}
        <rect x={180} y={112} width={70} height={14} rx={3} className="pkey" />
        {/* Pedal */}
        <path d="M160 190 L206 182" className="arm" />
        <text x={160} y={60} className="plabel">Sit tall, shoulders relaxed</text>
        <text x={196} y={104} className="plabel">Snare just above thighs</text>
        <text x={186} y={150} className="plabel">Thighs slope slightly down</text>
        <text x={210} y={190} className="plabel">Knee ≈ 90°, foot on pedal</text>
      </svg>
    </figure>
  );
}

export const DRUM_TECHNIQUE_TIPS = [
  '**Grip:** pinch each stick at the **fulcrum** (thumb pad + first joint of the index finger), about a third up from the butt. The back fingers wrap loosely.',
  '**Stroke:** throw the stick down from the wrist and **let it rebound**. Don’t push into the pad. Height = volume: high for accents, low for taps and ghost notes.',
  '**Posture:** sit tall, thighs sloping slightly down, snare a little above your thighs. The right hand crosses over the left to reach the hi-hat.',
  '**Feet:** kick with the ball of the foot (heel-up for power, heel-down for control). The left foot keeps the hi-hat closed unless the music asks for open.',
  '**Relax:** tension slows you down. If your forearms tighten, lower the tempo and shake out your hands.',
];
