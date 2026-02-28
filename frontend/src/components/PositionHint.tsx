interface PositionHintProps {
  value: number | null;
  onChange: (fret: number | null) => void;
  onReSolve: (fret: number | null) => void;
  showReSolve: boolean;
  disabled: boolean;
}

const PRESETS = [
  { label: "Auto", value: null },
  { label: "Open", value: 0 },
  { label: "Pos I", value: 1 },
  { label: "Pos III", value: 3 },
  { label: "Pos V", value: 5 },
  { label: "Pos VII", value: 7 },
  { label: "Pos IX", value: 9 },
  { label: "Pos XII", value: 12 },
] as const;

export default function PositionHint({
  value,
  onChange,
  onReSolve,
  showReSolve,
  disabled,
}: PositionHintProps) {
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-400 mr-1">Position:</span>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => onChange(p.value)}
          disabled={disabled}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            value === p.value
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200"
          } disabled:opacity-50`}
        >
          {p.label}
        </button>
      ))}
      {showReSolve && (
        <button
          onClick={() => onReSolve(value)}
          disabled={disabled}
          className="ml-2 px-3 py-1 rounded text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
        >
          Re-solve
        </button>
      )}
    </div>
  );
}
