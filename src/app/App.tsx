import { useHashRoute } from './router';
import Home from '../piano/pages/Home';
import { ExercisePage, LessonPage, LevelPage, NotFound } from '../piano/pages/LessonPages';
import Gym from '../piano/pages/Gym';
import Setup from '../piano/pages/Setup';
import FreePlay from '../piano/pages/FreePlay';
import LevelMeter from '../shared/components/LevelMeter';
import { DrumExercisePage, DrumLessonPage, DrumLevelPage, DrumsHome } from '../drums/pages/DrumLessonPages';
import { DrumSetup } from '../drums/pages/DrumSetup';
import { DrumFree } from '../drums/pages/DrumFree';
import { DrumGym } from '../drums/pages/DrumGym';

export default function App() {
  const route = useHashRoute();
  const drums = route[0] === 'drums';
  const [head, arg] = drums ? route.slice(1) : route;
  let page;
  if (drums) {
    switch (head) {
      case undefined: page = <DrumsHome />; break;
      case 'level': page = <DrumLevelPage id={arg} />; break;
      case 'lesson': page = <DrumLessonPage id={arg} />; break;
      case 'ex': page = <DrumExercisePage id={arg} />; break;
      case 'gym': page = <DrumGym />; break;
      case 'free': page = <DrumFree />; break;
      case 'setup': page = <DrumSetup />; break;
      default: page = <NotFound />;
    }
  } else {
    switch (head) {
      case undefined: page = <Home />; break;
      case 'level': page = <LevelPage id={arg} />; break;
      case 'lesson': page = <LessonPage id={arg} />; break;
      case 'ex': page = <ExercisePage id={arg} />; break;
      case 'gym': page = <Gym />; break;
      case 'free': page = <FreePlay />; break;
      case 'setup': page = <Setup />; break;
      default: page = <NotFound />;
    }
  }
  const base = drums ? '#/drums' : '#';
  const nav = (h: string | undefined, label: string, path: string) => {
    const on = head === h || (h === 'path' && ['level', 'lesson', 'ex', undefined].includes(head));
    return <a href={`${base}/${path}`} className={on ? 'on' : ''}>{label}</a>;
  };
  return (
    <div className="app">
      <header className="topbar">
        <a href={drums ? '#/drums' : '#/'} className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 4v10M12 4v16M16 4v10" stroke="currentColor" strokeWidth="1.8" /></svg>
          </span>
          Keystone
        </a>
        <div className="seg inst-switch" role="tablist" aria-label="Instrument">
          <a href="#/" className={drums ? '' : 'on'} role="tab" aria-selected={!drums}>🎹 Piano</a>
          <a href="#/drums" className={drums ? 'on' : ''} role="tab" aria-selected={drums}>🥁 Drums</a>
        </div>
        <nav>
          {nav('path', 'Lessons', '')}
          {nav('gym', 'Practice Gym', 'gym')}
          {nav('free', 'Free Play', 'free')}
          {nav('setup', 'Setup', 'setup')}
        </nav>
        <div className="topbar-meter"><LevelMeter /></div>
      </header>
      <main>{page}</main>
    </div>
  );
}
