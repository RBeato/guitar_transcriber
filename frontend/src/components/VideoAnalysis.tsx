import { useEffect, useRef } from "react";
import { useHandTracking } from "../hooks/useHandTracking";

interface VideoAnalysisProps {
  enabled: boolean;
  active: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onZoneDetected: (fret: number | null) => void;
  disabled?: boolean;
}

export default function VideoAnalysis({
  enabled,
  active,
  onEnabledChange,
  onZoneDetected,
  disabled,
}: VideoAnalysisProps) {
  const {
    status,
    liveZone,
    error,
    videoRef,
    canvasRef,
    initialize,
    startDetection,
    stopDetection,
    resetTracking,
  } = useHandTracking();

  const prevActiveRef = useRef(active);

  // Phase 1: Initialize camera + model when checkbox enabled
  useEffect(() => {
    if (enabled && status === "idle") {
      initialize();
    }
    if (!enabled) {
      resetTracking();
    }
  }, [enabled, status, initialize, resetTracking]);

  // Phase 2: Start/stop detection when recording starts/stops
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    if (!enabled) return;

    if (!wasActive && active && status === "ready") {
      startDetection();
    } else if (wasActive && !active) {
      if (status === "tracking") {
        const result = stopDetection();
        onZoneDetected(result.estimatedFret);
      } else {
        // Camera failed or wasn't ready — report null so caller knows
        onZoneDetected(null);
      }
    }
  }, [active, enabled, status, startDetection, stopDetection, onZoneDetected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      resetTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-4">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
        />
        <span className="text-sm text-gray-300">Video hand tracking</span>
        {enabled && liveZone && status === "tracking" && (
          <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-green-800 text-green-300">
            {liveZone}
          </span>
        )}
        {enabled && status === "loading" && (
          <span className="ml-2 text-xs text-gray-500">Loading model...</span>
        )}
        {enabled && error && (
          <span className="ml-2 text-xs text-red-400">{error}</span>
        )}
      </label>

      {enabled && (
        <div className="mt-2 relative inline-block rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="block"
            style={{
              width: 320,
              height: 240,
              transform: "scaleX(-1)",
            }}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            style={{
              width: 320,
              height: 240,
              transform: "scaleX(-1)",
            }}
          />
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-300">Loading hand tracking model...</span>
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <span className="text-sm text-red-400 px-4 text-center">
                {error}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
