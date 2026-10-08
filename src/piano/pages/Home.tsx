import { LEVELS } from '../curriculum/levels';
import type { Level } from '../curriculum/types';
import { rankFor, streak, today, useProgress, type Progress } from '../../shared/store/progress';
import { useLive } from '../../shared/audio/input';
import { go } from '../../app/router';

export function levelStats(lv: Level, p: Progress) {
  let total = 0, done = 0, stars = 0;
  for (const ls of lv.lessons)
    for (const ex of ls.exercises) {
      total++;
      const r = p.exercises[ex.id];
      if (r && r.bestStars >= 1) done++;
      stars += r?.bestStars ?? 0;
    }
  return { total, done, stars, maxStars: total * 3 };
}

export function nextExercise(p: Progress): { id: string; title: string; lesson: string } | null {
  for (const lv of LEVELS)
    for (const ls of lv.lessons)
      for (const ex of ls.exercises) if (!p.exercises[ex.id] || p.exercises[ex.id].bestStars < 1) return { id: ex.id, title: ex.title, lesson: ls.title };
  return null;
}

export default function Home() {
  const p = useProgress();
  const live = useLive();
  const rank = rankFor(p.xp);
  const st = streak(p);
  const todayMin = Math.round((p.days[today()] ?? 0) / 60);
  const next = nextExercise(p);
  const started = Object.keys(p.exercises).length > 0;
  const weak = Object.entries(p.confusions).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Last 14 days activity
  const days: { d: string; s: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const k = today(dt);
    days.push({ d: k, s: p.days[k] ?? 0 });
  }
  const maxS = Math.max(600, ...days.map((d) => d.s));

  return (
    <div className="home">
      <section className="hero">
        <div>
          <div className="eyebrow">Casiotone CT-S1 · 61 keys</div>
          <h1>{started ? 'Welcome back.' : 'Learn piano, from first note to elite.'}</h1>
          <p className="lead">
            {started
              ? 'Pick up where you left off. A little every day beats a lot once a week.'
              : 'Ten levels of lessons and exercises. The app listens through your microphone and coaches you on every note, chord and beat.'}
          </p>
          <div className="row gap wrap">
            {next && (
              <button className="btn primary big" onClick={() => go(`ex/${next.id}`)}>
                {started ? 'Continue' : 'Start lesson 1'}: {next.title} →
              </button>
            )}
            {!live.running && <button className="btn big" onClick={() => go('setup')}>🎤 Sound check</button>}
          </div>
        </div>
        <div className="hero-stats">
          <div className="hs">
            <div className="hs-v">{rank.title}</div>
            <div className="hs-l">{p.xp} XP{rank.next > rank.prev ? ` · ${rank.next - p.xp} to next rank` : ''}</div>
            <div className="xpbar"><div style={{ width: `${rank.next > rank.prev ? ((p.xp - rank.prev) / (rank.next - rank.prev)) * 100 : 100}%` }} /></div>
          </div>
          <div className="hs-row">
            <div className="hs"><div className="hs-v">🔥 {st}</div><div className="hs-l">day streak</div></div>
            <div className="hs"><div className="hs-v">{todayMin}m</div><div className="hs-l">today</div></div>
          </div>
          <div className="spark" title="Practice time, last 14 days">
            {days.map((d) => <div key={d.d} className={d.d === today() ? 'today' : ''} style={{ height: `${Math.max(4, (d.s / maxS) * 100)}%`, opacity: d.s ? 1 : 0.25 }} title={`${d.d}: ${Math.round(d.s / 60)} min`} />)}
          </div>
        </div>
      </section>

      {weak.length > 0 && (
        <section className="card weak">
          <h3>Your common mix-ups</h3>
          <div className="row gap wrap">
            {weak.map(([k, c]) => {
              const [a, b] = k.split('>');
              return <span key={k} className="chip">expected <strong>{a}</strong>, played <strong>{b}</strong> · {c}×</span>;
            })}
          </div>
          <p className="muted small">Try the sight-reading and note-name drills in the <a href="#/gym">Practice Gym</a> to clear these up.</p>
        </section>
      )}

      <h2 className="section-title">The path</h2>
      <div className="levels">
        {LEVELS.map((lv) => {
          const s = levelStats(lv, p);
          const pct = s.total ? s.done / s.total : 0;
          return (
            <button key={lv.id} className={`level-card ${pct === 1 ? 'complete' : ''}`} onClick={() => go(`level/${lv.id}`)}>
              <div className="level-num">{lv.num}</div>
              <div className="level-body">
                <div className="level-name">{lv.name}</div>
                <div className="muted small">{lv.tagline}</div>
                <div className="level-prog">
                  <div className="bar"><div style={{ width: `${pct * 100}%` }} /></div>
                  <span className="small muted">{s.done}/{s.total} · ★ {s.stars}/{s.maxStars}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
