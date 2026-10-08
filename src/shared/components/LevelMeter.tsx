import { useLive } from '../audio/input';
import { noteName } from '../../piano/music/theory';

/** Compact input indicator: level bar + the note currently heard. */
export default function LevelMeter() {
  const live = useLive();
  if (!live.running) return <div className="meter off" title="Input not started">Input off</div>;
  if (live.source === 'midi') {
    return (
      <div className="meter" title={live.midiDevices.join(', ') || 'No MIDI device found'}>
        <span className="meter-src">MIDI</span>
        <span className="meter-note">
          {live.held.length
            ? live.held.slice(-3).map((m) => noteName(m)).join(' ') + (live.held.length > 3 ? ' …' : '')
            : live.midiDevices.length ? 'connected' : 'no device'}
        </span>
      </div>
    );
  }
  const pct = Math.min(100, (live.levelDb / 45) * 100);
  return (
    <div className="meter" title="Microphone level and detected pitch">
      <span className="meter-src">🎤</span>
      <span className="meter-bar"><span style={{ width: `${pct}%` }} /></span>
      <span className="meter-note">{live.pitch ? noteName(live.pitch.midi) : '—'}</span>
    </div>
  );
}
