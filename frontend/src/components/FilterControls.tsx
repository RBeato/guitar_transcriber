import { useState, useEffect, useCallback } from "react";
import type { FilteringParams } from "../services/api";

const DEFAULTS: Required<FilteringParams> = {
  onsetThreshold: 0.6,
  frameThreshold: 0.5,
  minimumNoteLength: 0.11,
  minimumVelocity: 0.4,
  mergeToleranceMs: 30,
};

const STORAGE_KEY = "gt_filter_params";
const PRESETS_KEY = "gt_filter_presets";

interface FilterPreset {
  name: string;
  params: FilteringParams;
}

function loadSavedParams(): FilteringParams {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function savePresets(presets: FilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

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
  onInitialLoad?: (params: FilteringParams) => void;
  disabled?: boolean;
}

export default function FilterControls({
  value,
  onChange,
  onInitialLoad,
  disabled,
}: FilterControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showPresetInput, setShowPresetInput] = useState(false);

  // Load saved params on mount
  useEffect(() => {
    const saved = loadSavedParams();
    if (Object.keys(saved).length > 0) {
      onInitialLoad?.(saved);
    }
    setPresets(loadPresets());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist current params to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(value).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [value]);

  const getValue = (key: keyof FilteringParams): number =>
    value[key] ?? DEFAULTS[key];

  const handleChange = (key: keyof FilteringParams, val: number) => {
    onChange({ ...value, [key]: val });
  };

  const handleReset = () => {
    onChange({});
  };

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    const newPreset: FilterPreset = {
      name: presetName.trim(),
      params: { ...value },
    };
    const updated = [...presets.filter((p) => p.name !== newPreset.name), newPreset];
    setPresets(updated);
    savePresets(updated);
    setPresetName("");
    setShowPresetInput(false);
  }, [presetName, value, presets]);

  const handleLoadPreset = useCallback(
    (preset: FilterPreset) => {
      onChange(preset.params);
    },
    [onChange],
  );

  const handleDeletePreset = useCallback(
    (name: string) => {
      const updated = presets.filter((p) => p.name !== name);
      setPresets(updated);
      savePresets(updated);
    },
    [presets],
  );

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
            <div className="flex items-center gap-2">
              {!isDefault && (
                <>
                  <button
                    onClick={() => setShowPresetInput(!showPresetInput)}
                    disabled={disabled}
                    className="text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                  >
                    Save preset
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={disabled}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                  >
                    Reset to defaults
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Save preset input */}
          {showPresetInput && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                placeholder="Preset name..."
                className="flex-1 text-xs bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-300 placeholder-gray-600"
                autoFocus
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="text-xs px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowPresetInput(false)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Preset list */}
          {presets.length > 0 && (
            <div className="pt-1 border-t border-gray-700">
              <span className="text-xs text-gray-500">Presets:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {presets.map((preset) => (
                  <div key={preset.name} className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      disabled={disabled}
                      className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => handleDeletePreset(preset.name)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors px-0.5"
                      title="Delete preset"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
