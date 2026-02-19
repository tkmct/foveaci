import { IconPlayerPlay, IconPlayerPause } from "@tabler/icons-react";
import type { ReplayEngine } from "../hooks/useReplayEngine";

interface ReplayControlsProps {
  engine: ReplayEngine;
}

function formatTime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export function ReplayControls({ engine }: ReplayControlsProps) {
  const timelinePct =
    engine.duration > 0 ? (engine.currentTime / engine.duration) * 100 : 0;

  return (
    <div className="controls">
      {engine.playing ? (
        <button onClick={engine.pause}>
          <IconPlayerPause size={14} /> Pause
        </button>
      ) : (
        <button onClick={engine.play}>
          <IconPlayerPlay size={14} /> Play
        </button>
      )}
      <input
        type="range"
        min="0"
        max="100"
        value={timelinePct}
        onChange={(e) => engine.seek(Number(e.target.value))}
      />
      <span className="time">
        {formatTime(engine.currentTime)} / {formatTime(engine.duration)}
      </span>
      <select
        defaultValue="1"
        onChange={(e) => engine.setSpeed(parseFloat(e.target.value))}
      >
        <option value="1">1x</option>
        <option value="2">2x</option>
        <option value="4">4x</option>
        <option value="0.5">0.5x</option>
      </select>
    </div>
  );
}
