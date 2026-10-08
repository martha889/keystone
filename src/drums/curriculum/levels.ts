// Drum curriculum for the Alesis Nitro Max: from first strokes to elite benchmarks.

import type { Inst } from '../engine/kit';
import {
  callResponse, concat, groove, randomRhythm, silent, sticks,
  type DrumData, type DrumExercise, type DrumLevel,
} from '../engine/pattern';

function tempo(id: string, title: string, instructions: string, build: () => DrumData, bpm: number, targetBpm: number): DrumExercise {
  return { id, title, kind: 'tempo', instructions, build, bpm, targetBpm };
}
function follow(id: string, title: string, instructions: string, build: () => DrumData): DrumExercise {
  return { id, title, kind: 'follow', instructions, build };
}

const rnd = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

// A single hit per slot, for pad-finding drills
function padSequence(insts: Inst[]): DrumData {
  return {
    steps: insts.map((inst, i) => ({ pos: i, hits: [{ inst, dyn: 'n' as const }] })),
    timeSig: [4, 4], beatsPerBar: 4, barSub: Array(Math.ceil(insts.length / 4)).fill(1), bars: Math.ceil(insts.length / 4),
  };
}

// ---------- Common grooves ----------

const ROCK = { hh: 'xxxxxxxx', sn: '..x...x.', bd: 'x...x...' };
const rock = (rep = 4) => groove({ rows: ROCK, repeat: rep });
const rockCrash = (rep = 4) => concat(groove({ rows: { cr: 'x.......', hh: '.xxxxxxx', sn: '..x...x.', bd: 'x...x...' } }), rock(rep - 1));

/**
 * 3 bars of groove + 1 bar whose end is a fill (16th grid, fill starts at slot `from`),
 * then a crash + kick on the next downbeat.
 */
function grooveAndFill(fill: { from: number; sn?: string; t1?: string; t2?: string; t3?: string; stick: string }, times = 1): DrumData {
  const g = groove({ rows: ROCK, repeat: 3 });
  const blank = '................';
  const pre = (pattern: string) => pattern.split('').map((c, i) => (i < fill.from ? c : '.')).join('');
  const merge = (a: string, b: string) => a.split('').map((c, i) => (b[i] && b[i] !== '.' ? b[i] : c)).join('');
  const fillBar = groove({
    sub: 4,
    rows: {
      hh: pre('x.x.x.x.x.x.x.x.'),
      sn: merge(pre('....x.......x...'), fill.sn ?? blank),
      t1: fill.t1 ?? blank, t2: fill.t2 ?? blank, t3: fill.t3 ?? blank,
      bd: pre('x.......x.......'),
    },
    stick: fill.stick,
  });
  const landing = groove({ rows: { cr: 'x.......', bd: 'x.......' } });
  const parts: DrumData[] = [];
  for (let i = 0; i < times; i++) parts.push(g, fillBar);
  parts.push(landing);
  return concat(...parts);
}

// ---------- Levels ----------

export const DRUM_LEVELS: DrumLevel[] = [
  {
    id: 'd1', num: 1, name: 'Getting Started', tagline: 'Set up the Nitro Max, hold the sticks, meet every pad',
    lessons: [
      {
        id: 'd1-1', title: 'Setting up your Nitro Max',
        summary: 'Pad layout, the module, and how to sit.',
        body: [
          '**Your kit.** The Alesis Nitro Max has an 8" mesh **snare**, three 8" mesh **toms** (high, mid and floor), a 10" **hi-hat** cymbal with its pedal controller on the left, a 10" **crash** (left) and a 10" **ride** (right), plus a **kick** tower and pedal. The diagram below shows the standard right-handed layout this course uses.',
          '**Connect it.** Plug a USB cable from the module’s **USB-MIDI** port into your computer. In this app, open **Drums → Setup**, choose **USB-MIDI**, and hit each pad in **“Teach the app my kit”**. That makes every pad recognised exactly, with its velocity (how hard you hit). Use Chrome or Edge.',
          '**The throne.** Sit so your thighs slope very slightly down towards your knees. The snare should sit a few centimetres above your thighs, roughly at belly-button height. Feet rest on the pedals with your knees at about a right angle. Sit tall but relaxed, close enough to reach the ride without stretching.',
          '**Module.** Start on the first kit preset and set the volume comfortably. Headphones keep the room quiet, and they also keep the metronome clear if you play the click through your computer.',
        ],
        figures: ['kit', 'posture'],
        exercises: [
          follow('d1-1-a', 'Meet the pads', 'Hit each pad as it lights up on the kit diagram: crash, hi-hat, ride, the three toms, snare, kick and hi-hat pedal.', () =>
            padSequence(['crash', 'hhClosed', 'ride', 'tom1', 'tom2', 'tom3', 'snare', 'kick', 'hhPedal'])),
          follow('d1-1-b', 'Find the pads', 'Random order. Hit the named pad without hunting for it.', () =>
            padSequence(Array.from({ length: 16 }, () => rnd(['crash', 'hhClosed', 'ride', 'tom1', 'tom2', 'tom3', 'snare', 'kick'] as Inst[])))),
        ],
      },
      {
        id: 'd1-2', title: 'Grip and the basic stroke',
        summary: 'Matched grip, the fulcrum, and letting the stick bounce.',
        body: [
          '**Matched grip.** Both hands hold the sticks the same way. Find the **fulcrum**: pinch the stick between the pad of your thumb and the first joint of your index finger, about a third of the way up from the butt end. Wrap the other fingers loosely around it. They guide the stick but don’t squeeze.',
          '**Palms down** (German grip) gives power, **thumbs up** (French grip) gives finesse, and halfway between (American grip) is the all-rounder to start with.',
          '**The stroke.** Start with the tip about 15–20 cm above the pad. Throw it down with the wrist and **let it rebound** back up, like dribbling a basketball. The stick should do most of the work. Stick height controls volume: higher means louder.',
          '**Sticking letters.** R means right hand, L means left hand. On the kit diagram, blue is right hand, orange is left hand, green is right foot and purple is left foot.',
        ],
        figures: ['grip'],
        exercises: [
          tempo('d1-2-a', 'Right-hand quarter notes', 'Snare, right hand, one stroke per click. Let it bounce.', () => sticks('R R R R', 1, { repeat: 4 }), 60, 100),
          tempo('d1-2-b', 'Left-hand quarter notes', 'Same with the left hand. Match the sound of your right.', () => sticks('L L L L', 1, { repeat: 4 }), 60, 100),
          tempo('d1-2-c', 'Alternating quarters', 'R L R L. Both hands should sound identical.', () => sticks('R L R L', 1, { repeat: 4 }), 60, 110),
        ],
      },
      {
        id: 'd1-3', title: 'Your feet',
        summary: 'Kick drum and hi-hat pedal.',
        body: [
          '**Kick.** Rest your right foot on the pedal. **Heel-up** (heel raised, pressing with the ball of the foot from the leg) gives power and is how most rock players start. **Heel-down** gives control at low volumes. Let the beater come back off the pad after each stroke; don’t bury it.',
          '**Hi-hat pedal.** Your left foot keeps the hi-hat closed while you play it with the sticks, and can “chick” it on its own. On the Nitro Max the pedal also chooses open or closed sound.',
        ],
        exercises: [
          tempo('d1-3-a', 'Kick on every beat', 'Right foot, quarter notes.', () => groove({ sub: 1, rows: { bd: 'xxxx' }, repeat: 4 }), 60, 110),
          tempo('d1-3-b', 'Hi-hat foot on 2 and 4', 'Left foot “chick” on beats 2 and 4.', () => groove({ sub: 1, rows: { hp: '.x.x' }, repeat: 4 }), 60, 110),
          tempo('d1-3-c', 'Both feet', 'Kick on 1 and 3, hi-hat foot on 2 and 4.', () => groove({ sub: 1, rows: { bd: 'x.x.', hp: '.x.x' }, repeat: 4 }), 60, 110),
        ],
      },
    ],
  },
  {
    id: 'd2', num: 2, name: 'Counting & Rhythm', tagline: 'Quarter, eighth and sixteenth notes; rests; reading',
    lessons: [
      {
        id: 'd2-1', title: 'Eighth notes',
        summary: 'Two notes per beat: “1 & 2 &”.',
        body: [
          'An **eighth note** splits the beat in two. Count “**1 & 2 & 3 & 4 &**”: numbers on the click, “&” exactly halfway between. Count out loud; it sounds silly, and it works.',
          'The count under the notation shows where each note falls.',
        ],
        exercises: [
          tempo('d2-1-a', 'Alternating eighths', 'R L R L… two strokes per click, perfectly even.', () => sticks('R L R L R L R L', 2, { repeat: 4 }), 60, 130),
          tempo('d2-1-b', 'Quarters and eighths', 'Read the rhythm. Sticking alternates.', () =>
            groove({ rows: { sn: 'x.x.xxx.|xxx.x.x.|x.xxx.x.|xxxxx...' } }), 60, 120),
          tempo('d2-1-c', 'Rests', 'Silence on the gaps. Keep counting through them.', () =>
            groove({ rows: { sn: 'x...x.x.|..x.x...|x.x...xx|x...x...' } }), 60, 120),
        ],
      },
      {
        id: 'd2-2', title: 'Sixteenth notes',
        summary: 'Four notes per beat: “1 e & a”.',
        body: [
          '**Sixteenth notes** split the beat into four: “**1 e & a 2 e & a**…”. Keep the strokes low and relaxed; speed comes from small motions.',
        ],
        exercises: [
          tempo('d2-2-a', 'Alternating sixteenths', 'R L R L four per click.', () => sticks('R L R L R L R L R L R L R L R L', 4, { repeat: 2 }), 60, 110),
          tempo('d2-2-b', 'Sixteenth rhythms', 'Read the gaps carefully.', () =>
            groove({ sub: 4, rows: { sn: 'x.xxx...xxx.x.x.|x..xx.x.xxxxx...' }, repeat: 2 }), 56, 100),
        ],
      },
      {
        id: 'd2-3', title: 'Reading and copying rhythms',
        summary: 'Sight-read new rhythms and play back what you hear.',
        body: [
          '**Reading:** a new random rhythm every attempt. Look ahead a beat while you play.',
          '**Call and response:** the app plays a bar (shown in grey), and you copy it in the next bar without stopping. This builds your ear and your time.',
        ],
        exercises: [
          tempo('d2-3-a', 'Sight-read eighths', 'A fresh four-bar rhythm each time.', () => concat(...Array.from({ length: 4 }, () => randomRhythm(2, 0.55))), 70, 120),
          tempo('d2-3-b', 'Call and response (eighths)', 'Listen to the app’s bar, then copy it in the next.', () => callResponse(4, 2, 0.5), 70, 110),
          tempo('d2-3-c', 'Sight-read sixteenths', 'Four bars of sixteenth-note rhythms.', () => concat(...Array.from({ length: 4 }, () => randomRhythm(4, 0.45))), 60, 100),
        ],
      },
    ],
  },
  {
    id: 'd3', num: 3, name: 'Rudiments I', tagline: 'Singles, doubles, paradiddles, accents',
    lessons: [
      {
        id: 'd3-1', title: 'Single and double strokes',
        summary: 'The two motions every roll is built from.',
        body: [
          '**Single stroke roll:** R L R L. Aim for identical height, volume and timing from each hand. The app compares your hands and tells you which one is louder or late.',
          '**Double stroke roll:** R R L L. The second stroke of each pair comes from the rebound plus a little finger pull. Don’t let it be weaker than the first.',
        ],
        exercises: [
          tempo('d3-1-a', 'Single stroke roll', 'Sixteenths, R L R L.', () => sticks('R L R L R L R L R L R L R L R L', 4, { repeat: 4 }), 70, 140),
          tempo('d3-1-b', 'Double stroke roll (eighths)', 'R R L L as eighth notes first.', () => sticks('R R L L R R L L', 2, { repeat: 4 }), 60, 120),
          tempo('d3-1-c', 'Double stroke roll (sixteenths)', 'Make the second stroke as strong as the first.', () => sticks('R R L L R R L L R R L L R R L L', 4, { repeat: 4 }), 60, 120),
        ],
      },
      {
        id: 'd3-2', title: 'Paradiddles',
        summary: 'R L R R · L R L L: singles and doubles combined.',
        body: [
          'The **single paradiddle** is R L R R L R L L. It switches the lead hand every half, which makes it the most useful rudiment for moving around the kit.',
        ],
        exercises: [
          tempo('d3-2-a', 'Single paradiddle', 'Sixteenths.', () => sticks('R L R R L R L L R L R R L R L L', 4, { repeat: 4 }), 60, 120),
          tempo('d3-2-b', 'Accented paradiddle', 'Accent the first note of each group (>). Unaccented notes stay low.', () =>
            sticks('>R L R R >L R L L >R L R R >L R L L', 4, { repeat: 4 }), 60, 116),
        ],
      },
      {
        id: 'd3-3', title: 'Accents',
        summary: 'Loud and soft notes in one hand motion.',
        body: [
          '**Accents (>)** are played from a high stick position; the other notes (“taps”) from low. Use **down strokes** for accents: hit and stop the stick low, ready for the taps. Volume is measured from your pads, so the app checks that accents are clearly louder.',
        ],
        exercises: [
          tempo('d3-3-a', 'Accents on the beat', 'Eighths with accents on every click.', () => sticks('>R L >R L >R L >R L', 2, { repeat: 4 }), 60, 120),
          tempo('d3-3-b', 'Moving accents', 'Sixteenths. The accent moves through 1, e, &, a.', () =>
            sticks('>R L R L >R L R L >R L R L >R L R L | R >L R L R >L R L R >L R L R >L R L | R L >R L R L >R L R L >R L R L >R L | R L R >L R L R >L R L R >L R L R >L', 4), 56, 100),
          tempo('d3-3-c', 'Call and response (sixteenths)', 'Copy the app’s bar.', () => callResponse(4, 4, 0.4), 60, 100),
        ],
      },
    ],
  },
  {
    id: 'd4', num: 4, name: 'First Beats', tagline: 'The rock beat and its variations',
    lessons: [
      {
        id: 'd4-1', title: 'The basic rock beat',
        summary: 'Hi-hat eighths, snare on 2 and 4, kick on 1 and 3.',
        body: [
          'This is the beat behind thousands of songs. Right hand plays **hi-hat eighth notes**, left hand plays **snare on 2 and 4** (the backbeat), right foot plays **kick on 1 and 3**.',
          'Your arms cross: the right hand reaches over to the hi-hat, the left stays on the snare. Keep your left foot pressing the hi-hat pedal down so the hi-hat sounds closed.',
          'Build it one layer at a time. Coordination is a skill your brain learns, so go slowly in follow mode first.',
        ],
        figures: ['kit'],
        exercises: [
          tempo('d4-1-a', 'Hi-hat and kick', 'Eighths on hi-hat, kick on 1 and 3.', () => groove({ rows: { hh: 'xxxxxxxx', bd: 'x...x...' }, repeat: 4 }), 60, 110),
          tempo('d4-1-b', 'Hi-hat and snare', 'Add the backbeat on 2 and 4.', () => groove({ rows: { hh: 'xxxxxxxx', sn: '..x...x.' }, repeat: 4 }), 60, 110),
          follow('d4-1-c', 'Rock beat: coordination', 'All three together, at your own speed. The app waits for each hit.', () => rock(2)),
          tempo('d4-1-d', 'Rock beat in time', 'Steady and relaxed.', () => rock(4), 60, 130),
        ],
      },
      {
        id: 'd4-2', title: 'Kick variations',
        summary: 'Move the kick to the “&”s.',
        body: ['The hands stay the same while the kick pattern changes. This is the start of **independence**. If a variation falls apart, play just the kick and hi-hat first.'],
        exercises: [
          tempo('d4-2-a', 'Kick on 1, 3 and the & of 3', 'Bass drum: 1, 3, 3&.', () => groove({ rows: { hh: 'xxxxxxxx', sn: '..x...x.', bd: 'x...xx..' }, repeat: 4 }), 60, 120),
          tempo('d4-2-b', 'Kick on 1, & of 2, 3', 'A classic syncopation.', () => groove({ rows: { hh: 'xxxxxxxx', sn: '..x...x.', bd: 'x..xx...' }, repeat: 4 }), 60, 120),
          tempo('d4-2-c', 'Mixed kick patterns', 'Four different kick patterns, one per bar.', () =>
            groove({ rows: { hh: 'xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx', sn: '..x...x.|..x...x.|..x...x.|..x...x.', bd: 'x...x...|x...xx..|x..xx...|x.x..xx.' } }), 60, 116),
        ],
      },
      {
        id: 'd4-3', title: 'Ride, crash and four-on-the-floor',
        summary: 'Other timekeepers and a crash on 1.',
        body: [
          'Move your right hand to the **ride** for a bigger sound. Hit a **crash together with the kick** on beat 1 to start a section. **Four-on-the-floor** (kick on every beat) drives dance music.',
        ],
        exercises: [
          tempo('d4-3-a', 'Rock beat on the ride', 'Right hand on the ride cymbal.', () => groove({ rows: { rd: 'xxxxxxxx', sn: '..x...x.', bd: 'x...x...' }, repeat: 4 }), 60, 130),
          tempo('d4-3-b', 'Crash on 1', 'Start with crash + kick, then the groove.', () => rockCrash(4), 60, 130),
          tempo('d4-3-c', 'Four on the floor', 'Kick on every beat, hi-hat eighths, snare 2 and 4.', () => groove({ rows: { hh: 'xxxxxxxx', sn: '..x...x.', bd: 'x.x.x.x.' }, repeat: 4 }), 70, 128),
        ],
      },
    ],
  },
  {
    id: 'd5', num: 5, name: 'Fills', tagline: 'Moving around the kit and back into the groove',
    lessons: [
      {
        id: 'd5-1', title: 'One- and two-beat fills',
        summary: 'Short fills that land on a crash.',
        body: [
          'A **fill** replaces the last beat(s) of a phrase, usually bar 4, and lands on **crash + kick** on the next “1”. The hardest part isn’t the fill, it’s getting back to the groove **in time**.',
          'Fills alternate R L starting with the right hand, so the right hand is free for the crash.',
        ],
        exercises: [
          tempo('d5-1-a', 'One-beat snare fill', 'Three bars of groove, then sixteenths on beat 4, crash on 1.', () =>
            grooveAndFill({ from: 12, sn: '............xxxx', stick: '............RLRL' }), 60, 110),
          tempo('d5-1-b', 'Two-beat fill around the toms', 'Snare, tom 1, tom 2, floor tom on beats 3 and 4.', () =>
            grooveAndFill({ from: 8, sn: '........xx......', t1: '..........xx....', t2: '............xx..', t3: '..............xx', stick: '........RLRLRLRL' }), 60, 110),
        ],
      },
      {
        id: 'd5-2', title: 'Full-bar fills',
        summary: 'A whole bar around the kit.',
        body: ['Lead with the right hand moving from left to right (snare → tom 1 → tom 2 → floor tom). Move from the shoulder; keep the strokes the same height on every drum.'],
        exercises: [
          follow('d5-2-a', 'Around the kit: learn the path', 'Four strokes on each drum, at your own pace.', () =>
            sticks('R L R L R:t1 L:t1 R:t1 L:t1 R:t2 L:t2 R:t2 L:t2 R:t3 L:t3 R:t3 L:t3', 4)),
          tempo('d5-2-b', 'Groove + full-bar fill', 'Three bars of groove, a bar of sixteenths around the kit, crash.', () =>
            concat(rock(3), sticks('R L R L R:t1 L:t1 R:t1 L:t1 R:t2 L:t2 R:t2 L:t2 R:t3 L:t3 R:t3 L:t3', 4), groove({ rows: { cr: 'x.......', bd: 'x.......' } })), 56, 104),
          tempo('d5-2-c', 'Eight-bar phrase', 'Groove, fill, groove, fill: keep the form.', () =>
            grooveAndFill({ from: 8, sn: '........xxxx....', t3: '............xxxx', stick: '........RLRLRLRL' }, 2), 60, 110),
        ],
      },
    ],
  },
  {
    id: 'd6', num: 6, name: 'Hi-hat & Independence', tagline: 'Open hi-hats, the hi-hat foot, sixteenth grooves',
    lessons: [
      {
        id: 'd6-1', title: 'Open and closed hi-hat',
        summary: 'Lift the left foot to open the hi-hat.',
        body: [
          'Lift your left foot slightly as you strike to get an **open hi-hat**, then press down to close it on the next note. The Nitro Max pedal controller sends open or closed sounds depending on how far it is pressed.',
          '**Disco:** open on every “&”, with kick on every beat.',
        ],
        exercises: [
          tempo('d6-1-a', 'Open on the & of 4', 'Rock beat with one open hi-hat at the end of each bar.', () =>
            groove({ rows: { hh: 'xxxxxxx.', ho: '.......x', sn: '..x...x.', bd: 'x...x...' }, repeat: 4 }), 60, 120),
          tempo('d6-1-b', 'Disco', 'Open hi-hat on every “&”, four on the floor.', () =>
            groove({ rows: { hh: 'x.x.x.x.', ho: '.x.x.x.x', sn: '..x...x.', bd: 'x.x.x.x.' }, repeat: 4 }), 70, 124),
        ],
      },
      {
        id: 'd6-2', title: 'The hi-hat foot',
        summary: 'Four limbs at once.',
        body: ['Right hand on the ride, left foot on the hi-hat pedal on **2 and 4**. Now all four limbs are working. Go slowly enough that every hit lands where it should.'],
        exercises: [
          follow('d6-2-a', 'Four limbs: coordination', 'Ride eighths, snare 2 & 4, kick 1 & 3, hi-hat foot 2 & 4.', () =>
            groove({ rows: { rd: 'xxxxxxxx', sn: '..x...x.', bd: 'x...x...', hp: '..x...x.' }, repeat: 2 })),
          tempo('d6-2-b', 'Four limbs in time', 'Keep the hi-hat foot locked with the snare.', () =>
            groove({ rows: { rd: 'xxxxxxxx', sn: '..x...x.', bd: 'x...x...', hp: '..x...x.' }, repeat: 4 }), 60, 120),
        ],
      },
      {
        id: 'd6-3', title: 'Sixteenth-note grooves',
        summary: 'One-handed sixteenths and syncopated kicks.',
        body: ['Playing sixteenths with one hand on the hi-hat needs a relaxed wrist with a little help from the fingers. Start slowly. The snare (left hand) lands together with a hi-hat note on 2 and 4.'],
        exercises: [
          tempo('d6-3-a', 'Sixteenth hi-hat groove', 'Right hand sixteenths on hi-hat.', () =>
            groove({ sub: 4, rows: { hh: 'xxxxxxxxxxxxxxxx', sn: '....x.......x...', bd: 'x.....x.x.......' }, repeat: 4 }), 56, 100),
          tempo('d6-3-b', 'Syncopated kick', 'Eighth hi-hat, sixteenth-note kick pattern.', () =>
            groove({ sub: 4, rows: { hh: 'x.x.x.x.x.x.x.x.', sn: '....x.......x...', bd: 'x..x..x...x..x..' }, repeat: 4 }), 60, 110),
        ],
      },
    ],
  },
  {
    id: 'd7', num: 7, name: 'Styles & Feel', tagline: 'Funk, shuffle, jazz, bossa nova, reggae, 6/8',
    lessons: [
      {
        id: 'd7-1', title: 'Funk and ghost notes',
        summary: 'Very soft snare notes between the backbeats.',
        body: [
          '**Ghost notes** (g) are barely-there snare notes played from 2–3 cm above the pad. They should be **much** quieter than the backbeat. The app measures your velocity and tells you if your ghosts are too loud.',
        ],
        exercises: [
          tempo('d7-1-a', 'Ghost-note groove', 'Accented backbeat, soft ghost notes.', () =>
            groove({ sub: 4, rows: { hh: 'x.x.x.x.x.x.x.x.', sn: '....X..g.g..X..g', bd: 'x.x.......x..x..' }, repeat: 4 }), 56, 100),
        ],
      },
      {
        id: 'd7-2', title: 'Shuffle and swing',
        summary: 'Triplet feel: “1-trip-let”.',
        body: [
          'Swing and shuffle split each beat into **three** (“1-trip-let 2-trip-let”) and play the first and last: long–short.',
          '**Jazz ride pattern:** “ding, ding-a ding, ding-a” on the ride, with the hi-hat foot on 2 and 4.',
        ],
        exercises: [
          tempo('d7-2-a', 'Blues shuffle', 'Hi-hat shuffle, snare 2 & 4, kick 1 & 3.', () =>
            groove({ sub: 3, rows: { hh: 'x.xx.xx.xx.x', sn: '...x.....x..', bd: 'x.....x.....' }, repeat: 4 }), 70, 120),
          tempo('d7-2-b', 'Jazz ride pattern', 'Ride “spang-a-lang” with hi-hat foot on 2 and 4.', () =>
            groove({ sub: 3, rows: { rd: 'x..x.xx..x.x', hp: '...x.....x..' }, repeat: 4 }), 80, 160),
        ],
      },
      {
        id: 'd7-3', title: 'Bossa nova, reggae and 6/8',
        summary: 'Latin, Caribbean and compound time.',
        body: [
          '**Bossa nova:** ride eighths, a two-bar cross-stick pattern on the snare, and a gentle kick figure.',
          '**One drop (reggae):** the kick and snare together on beat 3 only. Hold back!',
          '**6/8:** six eighth notes per bar, felt in two big beats. The metronome clicks every eighth note here.',
        ],
        exercises: [
          tempo('d7-3-a', 'Bossa nova', 'Two-bar pattern.', () =>
            groove({ rows: { rd: 'xxxxxxxx|xxxxxxxx', sn: 'x..x..x.|..x..x..', bd: 'x..xx..x|x..xx..x' }, repeat: 2 }), 70, 130),
          tempo('d7-3-b', 'One drop', 'Kick + snare on 3 only.', () => groove({ rows: { hh: 'xxxxxxxx', sn: '....x...', bd: '....x...' }, repeat: 4 }), 70, 140),
          tempo('d7-3-c', '6/8 ballad', 'Hi-hat on every eighth, snare on 4, kick on 1.', () =>
            groove({ sub: 1, ts: [6, 8], rows: { hh: 'xxxxxx', sn: '...x..', bd: 'x.....' }, repeat: 4 }), 100, 180),
        ],
      },
    ],
  },
  {
    id: 'd8', num: 8, name: 'Rudiments II & Dynamics', tagline: 'Flams, triplet rudiments, rudiments on the kit',
    lessons: [
      {
        id: 'd8-1', title: 'Flams',
        summary: 'A soft grace note just before the main stroke.',
        body: [
          'A **flam** is two strokes almost together: a soft **grace note** from low height, a split second before the **main stroke** from high. It should sound like one fat note (“fl-AM”), not two separate hits. The app measures the gap. Aim for about 20–40 ms.',
          'In “fR” the right hand plays the main stroke and the left plays the grace note.',
        ],
        exercises: [
          tempo('d8-1-a', 'Alternating flams', 'fR fL on quarter notes.', () => sticks('fR fL fR fL', 1, { repeat: 4 }), 50, 100),
          tempo('d8-1-b', 'Flam taps', 'fR R fL L in sixteenths.', () => sticks('fR R fL L fR R fL L fR R fL L fR R fL L', 4, { repeat: 2 }), 50, 100),
        ],
      },
      {
        id: 'd8-2', title: 'Triplet rudiments',
        summary: 'Paradiddle-diddle and the six-stroke roll.',
        body: ['Triplet rudiments group notes in threes and sixes. Count “1-trip-let”.'],
        exercises: [
          tempo('d8-2-a', 'Paradiddle-diddle', 'R L R R L L in triplets.', () => sticks('R L R R L L R L R R L L', 3, { repeat: 4 }), 60, 120),
          tempo('d8-2-b', 'Six-stroke roll', '>R L L R R >L in triplets.', () => sticks('>R L L R R >L >R L L R R >L', 3, { repeat: 4 }), 60, 116),
        ],
      },
      {
        id: 'd8-3', title: 'Rudiments on the kit',
        summary: 'Paradiddles as a groove, accents as a fill.',
        body: [
          'Put the **right hand on the hi-hat and the left on the snare** and play a paradiddle: instant funky groove. Accent the left-hand note on 2 and 4 to make the backbeat.',
        ],
        exercises: [
          tempo('d8-3-a', 'Paradiddle groove', 'R = hi-hat, L = snare, kick on 1 and 3.', () =>
            sticks('R:hh+RF:bd L R:hh R:hh >L R:hh L L R:hh+RF:bd L R:hh R:hh >L R:hh L L', 4, { repeat: 4 }), 56, 100),
          tempo('d8-3-b', 'Ghost and accent control', 'Accents loud, all other notes ghosted.', () =>
            sticks('>R gL gR gL >R gL gR gL >R gL gR gL >R gL gR gL', 4, { repeat: 4 }), 56, 110),
        ],
      },
    ],
  },
  {
    id: 'd9', num: 9, name: 'Advanced Coordination', tagline: 'Odd time, linear grooves, polyrhythm',
    lessons: [
      {
        id: 'd9-1', title: 'Odd time signatures',
        summary: '7/8 and 5/4.',
        body: [
          '**7/8** groups seven eighth notes, usually 2+2+3. Count “1-2 1-2 1-2-3”. The click is on every eighth note.',
          '**5/4** (think “Take Five”) has five beats: often felt as 3+2.',
        ],
        exercises: [
          tempo('d9-1-a', '7/8 groove', 'Grouped 2+2+3.', () => groove({ sub: 1, ts: [7, 8], rows: { hh: 'xxxxxxx', sn: '..x.x..', bd: 'x.....x' }, repeat: 4 }), 120, 220),
          tempo('d9-1-b', '5/4 groove', 'Feel it as 3+2.', () => groove({ ts: [5, 4], rows: { rd: 'xxxxxxxxxx', sn: '....x...x.', bd: 'x.....x...' }, repeat: 4 }), 70, 140),
        ],
      },
      {
        id: 'd9-2', title: 'Linear grooves',
        summary: 'No two limbs at the same time.',
        body: ['In a **linear** groove only one limb plays at a time, which creates a flowing, Gadd- or Garibaldi-style sound. Follow the sticking exactly.'],
        exercises: [
          follow('d9-2-a', 'Linear groove: learn it', 'One hit at a time.', () =>
            sticks('RF:bd R:hh L R:hh RF:bd RF:bd R:hh >L R:hh L R:hh RF:bd R:hh RF:bd >L R:hh', 4)),
          tempo('d9-2-b', 'Linear groove in time', 'Sixteenths, flowing.', () =>
            sticks('RF:bd R:hh L R:hh RF:bd RF:bd R:hh >L R:hh L R:hh RF:bd R:hh RF:bd >L R:hh', 4, { repeat: 4 }), 56, 100),
        ],
      },
      {
        id: 'd9-3', title: 'Polyrhythm 3 over 2',
        summary: 'Two pulses at once.',
        body: ['Right hand plays **three evenly spaced notes** on the ride across every two beats (quarter-note triplets), while the kick stays on the beat. Count the triplets in sixes: the hands land on 1, 3, 5 and the feet on 1 and 4.'],
        exercises: [
          follow('d9-3-a', '3 over 2: slowly', 'Learn how the two layers interlock.', () => groove({ sub: 3, rows: { rd: 'x.x.x.x.x.x.', bd: 'x..x..x..x..' }, repeat: 1 })),
          tempo('d9-3-b', '3 over 2 in time', 'Keep the kick rock-steady.', () => groove({ sub: 3, rows: { rd: 'x.x.x.x.x.x.', bd: 'x..x..x..x..', hp: '...x.....x..' }, repeat: 4 }), 60, 110),
        ],
      },
      {
        id: 'd9-4', title: 'Half-time and reading',
        summary: 'Big, wide feels and four-bar reading.',
        body: ['A **half-time** groove puts the snare only on beat 3, so the music feels half as fast while the hi-hat keeps moving.'],
        exercises: [
          tempo('d9-4-a', 'Half-time groove', 'Snare on 3, sixteenth hi-hat.', () =>
            groove({ sub: 4, rows: { hh: 'x.xxx.xxx.xxx.xx', sn: '........X.....g.', bd: 'x.....x..x......' }, repeat: 4 }), 60, 96),
          tempo('d9-4-b', 'Sight-read sixteenths on the kit', 'Snare and toms, new each time.', () =>
            concat(...Array.from({ length: 4 }, () => {
              const r = randomRhythm(4, 0.5);
              return { ...r, steps: r.steps.map((s) => ({ ...s, hits: [{ inst: rnd(['snare', 'tom1', 'tom2', 'tom3'] as Inst[]), dyn: 'n' as const }] })) };
            })), 60, 100),
        ],
      },
    ],
  },
  {
    id: 'd10', num: 10, name: 'Elite', tagline: 'Speed, time and control at a professional level',
    lessons: [
      {
        id: 'd10-1', title: 'Speed benchmarks',
        summary: 'Singles, doubles and paradiddles at professional tempos.',
        body: [
          'Professional benchmarks for sixteenth notes: **singles ♩=180+, doubles ♩=150+, paradiddles ♩=150+**, clean and even between hands. Speed comes from relaxation and rebound; if your forearms burn, drop 10 bpm.',
        ],
        exercises: [
          tempo('d10-1-a', 'Single strokes at speed', 'Sixteenths. Target ♩=180.', () => sticks('R L R L R L R L R L R L R L R L', 4, { repeat: 8 }), 120, 180),
          tempo('d10-1-b', 'Double strokes at speed', 'Sixteenths. Target ♩=150.', () => sticks('R R L L R R L L R R L L R R L L', 4, { repeat: 8 }), 100, 150),
          tempo('d10-1-c', 'Paradiddles at speed', 'Sixteenths. Target ♩=150.', () => sticks('R L R R L R L L R L R R L R L L', 4, { repeat: 8 }), 100, 150),
        ],
      },
      {
        id: 'd10-2', title: 'The clock test',
        summary: 'Keep perfect time when the metronome disappears.',
        body: [
          'Great drummers *are* the clock. Here the click plays for two bars and then **goes silent for two bars**, and you keep going. The app measures how far you drift while the click is gone.',
        ],
        exercises: [
          tempo('d10-2-a', 'Clock test: groove', 'Click on, click off. Stay locked.', () =>
            concat(rock(2), silent(rock(2)), rock(2), silent(rock(2)), rock(1)), 80, 120),
          tempo('d10-2-b', 'Clock test: slow quarters', 'Slow is harder! Quarter notes at ♩=60 with silent bars.', () =>
            concat(sticks('R L R L', 1, { repeat: 2 }), silent(sticks('R L R L', 1, { repeat: 4 })), sticks('R L R L', 1, { repeat: 1 })), 60, 60),
        ],
      },
      {
        id: 'd10-3', title: 'Advanced fills and independence',
        summary: 'Sixteenth-note-triplet fills, four-way coordination.',
        body: [
          '**Gospel-style fills:** sixteenth-note triplets (six per beat) moving R-L-L around the drums.',
          '**Four-way coordination:** jazz ride and hi-hat foot stay perfectly steady while the snare and kick “comp” (play conversational accents) on different triplet partials each time.',
        ],
        exercises: [
          tempo('d10-3-a', 'Sixteenth-triplet fill', 'Six notes per beat around the kit, crash.', () =>
            concat(rock(1), sticks('R L L R L L R:t1 L:t1 L:t1 R:t1 L:t1 L:t1 R:t2 L:t2 L:t2 R:t2 L:t2 L:t2 R:t3 L:t3 L:t3 R:t3 L:t3 L:t3', 6), groove({ rows: { cr: 'x.......', bd: 'x.......' } })), 56, 96),
          tempo('d10-3-b', 'Four-way coordination', 'Jazz time plus a different comping pattern each time.', () => {
            const bars: DrumData[] = [];
            for (let b = 0; b < 4; b++) {
              const comp = Array.from({ length: 12 }, (_, i) => (i % 3 !== 1 && Math.random() < 0.28 ? 'x' : '.')).join('');
              const kick = Array.from({ length: 12 }, (_, i) => (i % 3 !== 1 && comp[i] === '.' && Math.random() < 0.15 ? 'x' : '.')).join('');
              bars.push(groove({ sub: 3, rows: { rd: 'x..x.xx..x.x', hp: '...x.....x..', sn: comp, bd: kick } }));
            }
            return concat(...bars);
          }, 90, 180),
          tempo('d10-3-c', 'Elite reading', 'Four bars of syncopated sixteenths with accents on the kit.', () =>
            concat(...Array.from({ length: 4 }, () => {
              const r = randomRhythm(4, 0.55);
              return { ...r, steps: r.steps.map((s) => ({ ...s, hits: [{ inst: rnd(['snare', 'snare', 'tom1', 'tom2', 'tom3'] as Inst[]), dyn: Math.random() < 0.25 ? ('a' as const) : ('n' as const) }] })) };
            })), 70, 120),
        ],
      },
    ],
  },
];

export const DRUM_EXERCISES = new Map<string, { ex: DrumExercise; lessonId: string; levelId: string }>();
export const DRUM_LESSONS = new Map<string, { lesson: DrumLevel['lessons'][number]; level: DrumLevel }>();
for (const lv of DRUM_LEVELS)
  for (const ls of lv.lessons) {
    DRUM_LESSONS.set(ls.id, { lesson: ls, level: lv });
    for (const ex of ls.exercises) DRUM_EXERCISES.set(ex.id, { ex, lessonId: ls.id, levelId: lv.id });
  }

