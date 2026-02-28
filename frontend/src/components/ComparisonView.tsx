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

export default function ComparisonView({
  audioResult,
  midiResult,
  audioError,
  midiError,
  viewMode,
  log,
}: ComparisonViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
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
  );
}
