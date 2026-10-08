# Keystone

Learn **piano** and **drums** from your very first note to elite level, right in the browser. Keystone listens to you play, through your microphone or a USB-MIDI cable, and coaches you on every note, chord and beat.

It is built for two instruments, but works with similar ones:

| | Instrument | Best connection |
| --- | --- | --- |
| 🎹 | **Casio Casiotone CT-S1** (61 keys, C2–C7) | USB-MIDI, or the microphone |
| 🥁 | **Alesis Nitro Max** electronic drum kit | USB-MIDI (the microphone can only judge timing) |

Everything runs locally in your browser: no account, no server. Audio from your microphone is analysed on your device and never uploaded. Progress is saved in the browser (Setup lets you export it).

## Features

### Piano

- **10 levels · 44 lessons · 126 exercises:** Foundations → Reading Music → Rhythm & First Songs → Scales → Chords & Harmony → Hands Together & Repertoire → All Twelve Keys → Technique & Advanced Harmony → Advanced Performance → **Elite** (all 24 keys, 3-octave hands-together scales at ♩=120 sixteenths, arpeggios, Hanon, sight-reading in any key, seventh-chord ear training).
- **Fingering and hand position for every exercise:** a finger number on every note and key (blue = right hand, orange = left), a starting hand-position card, a lit-up hand diagram, and cues before every hand move (“thumb passes under to F4”).
- **Three exercise modes:** *Follow* (waits for each correct note), *Tempo* (metronome, scored for pitch and timing) and *Ear* (play back what you hear).
- **Coach’s notes** after every run: frequent wrong notes, hesitation spots, rushing or dragging, and when to raise the tempo.

### Drums

- **10 levels · 30 lessons · 73 exercises:** pads and grip → counting → rudiments → rock beats → fills → hi-hat and feet → styles (funk, shuffle, jazz, bossa nova, reggae, 6/8) → flams and triplet rudiments → odd time, linear grooves and polyrhythm → **Elite** (singles ♩=180, doubles ♩=150, clock tests where the click drops out, sixteenth-triplet fills, four-way coordination).
- **Drum notation** with sticking (R/L) and the count (“1 e & a”) under every note, plus a **kit diagram** that lights up the next pads with the limb to use.
- **Feedback from pad velocity and timing:** per-limb timing (“your kick is 28 ms behind your hands”), left/right hand balance, accent and ghost-note levels, flam spacing, wrong pads, open vs closed hi-hat, and drift when the click goes silent.
- **Call and response** bars and **Teach the app my kit** for modules with non-standard MIDI notes.

### Both

- **Practice Gym:** build any drill at any tempo.
- **Free Play:** play anything and see your tempo and evenness.
- **Repeat ×1–×8** on any exercise for longer sessions; random drills generate fresh material on every pass.
- Stars, best tempo, XP and ranks, daily streak and practice time.

## Use it

Open the hosted app (see [Deploying](#deploying-to-github-pages)) or run it locally:

```bash
npm install
npm run dev        # then open the printed http://localhost:5173 link
```

- Use **Chrome or Edge.** Safari doesn’t support Web MIDI.
- The microphone needs `localhost` or HTTPS (GitHub Pages is HTTPS).
- First visit: open **Setup** (piano) or **Drums → Setup** to connect your instrument.

**Connecting by USB:** both the CT-S1 and the Nitro Max module have a USB port that sends MIDI. Plug it into your computer and choose **USB-MIDI** in Setup. This gives exact notes, chords, timing and velocity. On the Nitro Max, keep **Local mode (LOC) on** so the module still makes sound.

## Deploying to GitHub Pages

The repository includes a workflow (`.github/workflows/deploy.yml`) that builds and publishes the app on every push to `main`.

1. Create a repository on GitHub and push this project to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push (or run the workflow from the **Actions** tab). The site appears at `https://<your-username>.github.io/<repository-name>/`.

The build uses relative paths and hash-based routing (`#/drums/…`), so it works under any repository name with no extra configuration.

## Project structure

```
src/
  main.tsx                 entry point
  app/                     app shell: top bar, routing, global styles
  shared/
    audio/                 microphone/MIDI input hub, pitch detection, synth + metronome
    store/                 progress (XP, stars, streaks) and settings, saved in localStorage
    components/            small shared UI (level meter, repeat picker, markdown text)
  piano/
    music/                 theory (spelling, scales, chords, keys) and automatic fingering
    curriculum/            lesson content (levels.ts) and exercise builders/generators
    practice/              note matching and scoring/feedback
    components/            staff notation, keyboard, hand diagrams, exercise runner
    pages/                 home, lessons, practice gym, free play, setup
  drums/
    engine/                kit and MIDI map, pattern notation, sticking, scoring, drum sounds
    curriculum/            lesson content
    components/            drum notation, kit diagram, technique figures, exercise runner
    pages/                 home and lessons, practice gym, free play, setup
```

## How the listening works

- **Piano notes:** YIN pitch detection with a sub-harmonic guard. Attacks are found from energy rises plus spectral flux, so fast legato passages and repeated notes register.
- **Chords:** the app knows what you *should* play, so it checks that each expected note’s partials appear and grow at the attack, and that no unexplained new notes appear. This is more reliable than blind polyphonic transcription.
- **Drums:** every MIDI hit is matched to the written part by pad and time. Velocity drives the dynamics feedback.
- **Timing:** attacks are latency-compensated (calibrate in Setup) and compared against the scheduled metronome beats. The metronome click is high-pitched and filtered out of the microphone detector.

## Development

```bash
npm run dev      # dev server with hot reload
npm run build    # type-check and build to dist/
npm run lint     # oxlint
```

Built with React, TypeScript and Vite, using the Web Audio and Web MIDI APIs. No backend.

## Limitations

- Through the microphone, very fast overlapping notes (sixteenths at elite tempos) are less reliable than USB-MIDI.
- The app hears *which* keys you play, not *which fingers* you use. Check the fingering numbers yourself.
- Drum notation is simplified: rests aren’t drawn, and the count under the staff shows where the gaps fall.
- Some song transcriptions were written from memory. Check them against a published score.
