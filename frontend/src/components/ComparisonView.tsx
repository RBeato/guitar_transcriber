import { useMemo } from "react";
import type { TranscriptionResult } from "../services/api";
import type { Logger } from "../services/api";
import TabViewer from "./TabViewer";

type ViewMode = "tab" | "score" | "both";

interface ComparisonViewProps {
  audioResult: TranscriptionResult | null;
  midiResult: TranscriptionResult | null;
  audioError: string | null;
  midiError: string | null;
  viewMode: ViewMode;
  log: Logger;
}

function parseNotesSummary(summary: string): Set<number> {
  const pitches = new Set<number>();
  // notesSummary format: "s1f0(64) s2f3(62) ..."
  for (const match of summary.matchAll(/\((\d+)\)/g)) {
    pitches.add(Number(match[1]));
  }
  return pitches;
}

interface ComparisonStats {
  audioOnly: number;
  midiOnly: number;
  shared: number;
  audioTotal: number;
  midiTotal: number;
  difference: number;
}

function computeStats(
  audioResult: TranscriptionResult | null,
  midiResult: TranscriptionResult | null,
): ComparisonStats | null {
  if (!audioResult || !midiResult) return null;

  const audioTotal = audioResult.noteCount;
  const midiTotal = midiResult.noteCount;
  const difference = audioTotal - midiTotal;

  // Pitch-level overlap (rough approximation from summary)
  const audioPitches = parseNotesSummary(audioResult.notesSummary);
  const midiPitches = parseNotesSummary(midiResult.notesSummary);

  let shared = 0;
  for (const p of audioPitches) {
    if (midiPitches.has(p)) shared++;
  }
  const audioOnly = audioPitches.size - shared;
  const midiOnly = midiPitches.size - shared;

  return { audioOnly, midiOnly, shared, audioTotal, midiTotal, difference };
}

export default function ComparisonView({
  audioResult,
  midiResult,
  audioError,
  midiError,
  viewMode,
  log,
}: ComparisonViewProps) {
  const stats = useMemo(
    () => computeStats(audioResult, midiResult),
    [audioResult, midiResult],
  );

  return (
    <div className="mt-6 space-y-3">
      {/* Comparison stats bar */}
      {stats && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-800/70 border border-gray-700 text-xs">
          <span className="text-gray-400 font-medium">Comparison:</span>
          <span className="text-amber-300">
            Audio: {stats.audioTotal} notes
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-green-300">
            MIDI: {stats.midiTotal} notes
          </span>
          <span className="text-gray-600">|</span>
          <span className={stats.difference === 0 ? "text-gray-300" : stats.difference > 0 ? "text-amber-400" : "text-green-400"}>
            {stats.difference === 0
              ? "Same count"
              : stats.difference > 0
                ? `Audio has ${stats.difference} more`
                : `MIDI has ${Math.abs(stats.difference)} more`}
          </span>
          {stats.shared > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">
                Pitches: {stats.shared} shared, {stats.audioOnly} audio-only, {stats.midiOnly} MIDI-only
              </span>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Audio pipeline */}
        <div className="rounded-lg border border-amber-700/50 bg-gray-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border-b border-amber-700/50">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-300">
              Audio Pipeline
              {audioResult && (
                <span className="ml-1 text-amber-400/70">
                  ({audioResult.noteCount} notes)
                </span>
              )}
            </span>
          </div>
          <div className="p-2">
            {audioError ? (
              <p className="text-sm text-red-400 p-2">{audioError}</p>
            ) : (
              <TabViewer
                tex={audioResult?.tex ?? null}
                log={log}
                viewMode={viewMode}
              />
            )}
          </div>
        </div>

        {/* MIDI pipeline */}
        <div className="rounded-lg border border-green-700/50 bg-gray-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border-b border-green-700/50">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-300">
              MIDI Pipeline
              {midiResult && (
                <span className="ml-1 text-green-400/70">
                  ({midiResult.noteCount} notes)
                </span>
              )}
            </span>
          </div>
          <div className="p-2">
            {midiError ? (
              <p className="text-sm text-red-400 p-2">{midiError}</p>
            ) : (
              <TabViewer
                tex={midiResult?.tex ?? null}
                log={log}
                viewMode={viewMode}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
