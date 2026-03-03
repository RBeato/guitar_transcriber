interface TuningSelectorProps {
  value: string | null;
  onChange: (tuning: string | null) => void;
  disabled?: boolean;
}

const TUNINGS = [
  { id: "standard", label: "Standard", desc: "E A D G B E" },
  { id: "drop_d", label: "Drop D", desc: "D A D G B E" },
  { id: "half_step_down", label: "Eb Standard", desc: "Eb Ab Db Gb Bb Eb" },
  { id: "full_step_down", label: "D Standard", desc: "D G C F A D" },
  { id: "open_g", label: "Open G", desc: "D G D G B D" },
  { id: "open_d", label: "Open D", desc: "D A D F# A D" },
  { id: "dadgad", label: "DADGAD", desc: "D A D G A D" },
  { id: "open_e", label: "Open E", desc: "E B E G# B E" },
  { id: "drop_c", label: "Drop C", desc: "C G C F A D" },
] as const;

export default function TuningSelector({
  value,
  onChange,
  disabled,
}: TuningSelectorProps) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-sm text-gray-400">Tuning:</span>
      <select
        value={value ?? "standard"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "standard" ? null : v);
        }}
        disabled={disabled}
        className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 disabled:opacity-50"
      >
        {TUNINGS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} ({t.desc})
          </option>
        ))}
      </select>
    </div>
  );
}
