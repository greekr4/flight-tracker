"use client";

interface ControlsProps {
  playing: boolean;
  speed: number;
  progress: number;
  canPlay: boolean;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onRecord: () => void;
  recording: boolean;
}

const SPEEDS = [0.5, 1, 2];

export default function Controls({
  playing,
  speed,
  progress,
  canPlay,
  onTogglePlay,
  onSpeedChange,
  onRecord,
  recording,
}: ControlsProps) {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        disabled={!canPlay}
        className="w-10 h-10 flex items-center justify-center rounded-full
                   bg-cyan-500/20 border border-cyan-500/40 text-cyan-400
                   disabled:opacity-30 disabled:cursor-not-allowed
                   hover:bg-cyan-500/30 active:scale-95 transition-all"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 rounded-full transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Speed selector */}
      <div className="flex gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              speed === s
                ? "bg-cyan-500/30 text-cyan-400 border border-cyan-500/50"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Record button */}
      <button
        onClick={onRecord}
        disabled={!canPlay || recording}
        className={`w-10 h-10 flex items-center justify-center rounded-full
                   border transition-all
                   ${
                     recording
                       ? "bg-red-500/30 border-red-500/50 text-red-400 animate-pulse"
                       : "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-400 hover:bg-fuchsia-500/30"
                   }
                   disabled:opacity-30 disabled:cursor-not-allowed
                   active:scale-95`}
      >
        {recording ? (
          <div className="w-3 h-3 bg-red-400 rounded-sm" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="6" />
          </svg>
        )}
      </button>
    </div>
  );
}
