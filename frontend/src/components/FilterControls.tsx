import { useState } from "react";
import type { FilteringParams } from "../services/api";

const DEFAULTS: Required<FilteringParams> = {
  onsetThreshold: 0.6,
  frameThreshold: 0.5,
  minimumNoteLength: 0.11,
  minimumVelocity: 0.4,
  mergeToleranceMs: 30,
};

interface SliderConfig {
  key: keyof FilteringParams;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  advanced?: boolean;
}

const SLIDERS: SliderConfig[] = [
  {
    key: "onsetThreshold",
    label: "Onset Sensitivity",
    min: 0.1,
    max: 0.9,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: "minimumVelocity",
    label: "Minimum Volume",
    min: 0.1,
    max: 0.9,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: "minimumNoteLength",
    label: "Min Note Length (s)",
    min: 0.05,
    max: 0.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: "mergeToleranceMs",
    label: "Merge Gap (ms)",
    min: 0,
    max: 100,
    step: 5,
    format: (v) => String(v),
  },
  {
    key: "frameThreshold",
    label: "Frame Threshold",
    min: 0.1,
    max: 0.9,
    step: 0.05,
    format: (v) => v.toFixed(2),
    advanced: true,
  },
];

interface FilterControlsProps {
  value: FilteringParams;
  onChange: (params: FilteringParams) => void;
  disabled?: boolean;
}

export default function FilterControls({
  value,
  onChange,
  disabled,
}: FilterControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getValue = (key: keyof FilteringParams): number =>
    value[key] ?? DEFAULTS[key];

  const handleChange = (key: keyof FilteringParams, val: number) => {
    onChange({ ...value, [key]: val });
  };

  const handleReset = () => {
    onChange({});
  };

  const isDefault =
    Object.keys(value).length === 0 ||
    Object.entries(value).every(
      ([k, v]) => v === undefined || v === DEFAULTS[k as keyof FilteringParams]
    );

  const visibleSliders = SLIDERS.filter((s) => !s.advanced || showAdvanced);

  return (
    <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <span className="font-medium">Note Filtering</span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {visibleSliders.map((slider) => (
            <div key={slider.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">{slider.label}</label>
                <span className="text-xs font-mono text-gray-300">
                  {slider.format(getValue(slider.key))}
                </span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={getValue(slider.key)}
                onChange={(e) => handleChange(slider.key, Number(e.target.value))}
                disabled={disabled}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
              />
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showAdvanced ? "Hide advanced" : "Show advanced"}
            </button>
            {!isDefault && (
              <button
                onClick={handleReset}
                disabled={disabled}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                Reset to defaults
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
