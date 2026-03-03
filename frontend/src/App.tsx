import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import AudioUploader from "./components/AudioUploader";
import MicrophoneRecorder from "./components/MicrophoneRecorder";
import VideoAnalysis from "./components/VideoAnalysis";
import WaveformDisplay from "./components/WaveformDisplay";
import TranscriptionStatus from "./components/TranscriptionStatus";
import TabViewer from "./components/TabViewer";
import LogPanel from "./components/LogPanel";
import PositionHint from "./components/PositionHint";
import FilterControls from "./components/FilterControls";
import MidiStatus from "./components/MidiStatus";
import MidiFileUploader from "./components/MidiFileUploader";
import MidiMonitor from "./components/MidiMonitor";
import TuningSelector from "./components/TuningSelector";
import ComparisonView from "./components/ComparisonView";
import { useTranscription } from "./hooks/useTranscription";
import { useWebMidi } from "./hooks/useWebMidi";
import { useComparison } from "./hooks/useComparison";
import { useLogs } from "./hooks/useLogs";
import type { FilteringParams, MidiNote } from "./services/api";

type ViewMode = "tab" | "score" | "both";
type PostRecordChoice = "audio" | "midi" | "compare" | null;

function App() {
  const { logs, info, success, warn, error: logError, clear: clearLogs } = useLogs();
  const [targetFret, setTargetFret] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tab");
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [filterParams, setFilterParams] = useState<FilteringParams>({});
  const [pendingMidiNotes, setPendingMidiNotes] = useState<MidiNote[] | null>(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<File | Blob | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [tuning, setTuning] = useState<string | null>(null);

  const logger = useMemo(
    () => ({ info, success, warn, error: logError }),
    [info, success, warn, logError],
  );

  const {
    status, result, error, audioSource,
    transcribe, transcribeMidiNotes, transcribeMidiFile: transcribeMidiFileHook, reset,
  } = useTranscription(logger);

  const midi = useWebMidi();

  const comparison = useComparison(logger);

  const isProcessing = status === "processing" || comparison.status === "running";

  // Initialize Web MIDI on mount
  useEffect(() => {
    midi.initialize();
  }, [midi.initialize]);

  const handleFile = useCallback(
    (file: File) => {
      clearLogs();
      setShowComparison(false);
      setPendingMidiNotes(null);
      setPendingAudioBlob(null);
      info(`File selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      transcribe(file, targetFret, filterParams, tuning);
    },
    [transcribe, clearLogs, info, targetFret, filterParams, tuning],
  );

  const handleMidiFile = useCallback(
    (file: File) => {
      clearLogs();
      setShowComparison(false);
      setPendingMidiNotes(null);
      setPendingAudioBlob(null);
      info(`MIDI file selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      transcribeMidiFileHook(file, targetFret, tuning);
    },
    [clearLogs, info, targetFret, tuning, transcribeMidiFileHook],
  );

  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    if (midi.status === "connected") {
      // Pass shared epoch so MIDI timestamps align with audio recording
      const epoch = performance.now();
      midi.startCapture(epoch);
      info("MIDI capture started alongside audio recording (synced)");
    }
  }, [midi.status, midi.startCapture, info]);

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false);
    let capturedNotes: MidiNote[] | null = null;
    if (midi.status === "recording") {
      capturedNotes = midi.stopCapture();
      if (capturedNotes.length > 0) {
        info(`MIDI capture stopped: ${capturedNotes.length} notes captured`);
      }
    }
    // Store MIDI notes for post-recording choice
    if (capturedNotes && capturedNotes.length > 0) {
      setPendingMidiNotes(capturedNotes);
    } else {
      setPendingMidiNotes(null);
    }
  }, [midi.status, midi.stopCapture, info]);

  const handleRecording = useCallback(
    (blob: Blob) => {
      clearLogs();
      setShowComparison(false);
      info(`Recording ready: ${(blob.size / 1024).toFixed(0)} KB WAV`);

      if (pendingMidiNotes && pendingMidiNotes.length > 0) {
        // Both audio + MIDI available — let user choose
        setPendingAudioBlob(blob);
      } else {
        // Audio only
        setPendingAudioBlob(null);
        transcribe(blob, targetFret, filterParams, tuning);
      }
    },
    [transcribe, clearLogs, info, targetFret, filterParams, tuning, pendingMidiNotes],
  );

  const handlePostRecordChoice = useCallback(
    (choice: PostRecordChoice) => {
      if (!pendingAudioBlob) return;

      if (choice === "audio") {
        transcribe(pendingAudioBlob, targetFret, filterParams, tuning);
        setPendingAudioBlob(null);
        setPendingMidiNotes(null);
      } else if (choice === "midi" && pendingMidiNotes) {
        transcribeMidiNotes(pendingMidiNotes, targetFret, tuning);
        setPendingAudioBlob(null);
        setPendingMidiNotes(null);
      } else if (choice === "compare" && pendingMidiNotes) {
        setShowComparison(true);
        comparison.runComparison(
          pendingAudioBlob,
          pendingMidiNotes,
          targetFret,
          filterParams,
          tuning,
        );
        setPendingAudioBlob(null);
        // Keep pendingMidiNotes for re-runs
      }
    },
    [
      pendingAudioBlob,
      pendingMidiNotes,
      targetFret,
      filterParams,
      tuning,
      transcribe,
      transcribeMidiNotes,
      comparison.runComparison,
    ],
  );

  const handleVideoZoneDetected = useCallback(
    (fret: number | null) => {
      if (fret != null) {
        setTargetFret(fret);
        info(`Hand tracking detected fret zone: ${fret}`);
      }
    },
    [info],
  );

  const handleReSolve = useCallback(
    (fret: number | null) => {
      setTargetFret(fret);
      if (showComparison && pendingMidiNotes) {
        if (audioSource) {
          comparison.rerunAudio(audioSource, fret, filterParams, tuning);
        }
        comparison.rerunMidi(pendingMidiNotes, fret, tuning);
      } else if (audioSource && status === "done") {
        clearLogs();
        info(`Re-solving with position hint: ${fret != null ? `fret ${fret}` : "auto"}`);
        transcribe(audioSource, fret, filterParams, tuning);
      }
    },
    [
      audioSource,
      status,
      transcribe,
      clearLogs,
      info,
      filterParams,
      tuning,
      showComparison,
      pendingMidiNotes,
      comparison.rerunAudio,
      comparison.rerunMidi,
    ],
  );

  const handleFilterChange = useCallback(
    (params: FilteringParams) => {
      setFilterParams(params);
      // Re-run audio pipeline with new filters if we have results
      if (showComparison && audioSource) {
        comparison.rerunAudio(audioSource, targetFret, params, tuning);
      }
    },
    [showComparison, audioSource, targetFret, tuning, comparison.rerunAudio],
  );

  const handleDownload = useCallback(
    (format?: "midi" | "musicxml") => {
      const activeResult = showComparison
        ? comparison.midiResult || comparison.audioResult
        : result;
      if (!activeResult) return;

      let base64Data: string;
      let filename: string;
      let mimeType: string;

      if (format === "midi") {
        base64Data = activeResult.midiBase64;
        filename = "transcription.mid";
        mimeType = "audio/midi";
      } else if (format === "musicxml") {
        base64Data = activeResult.musicxmlBase64;
        filename = "transcription.musicxml";
        mimeType = "application/vnd.recordare.musicxml+xml";
      } else {
        base64Data = activeResult.gp5Base64;
        filename = "transcription.gp5";
        mimeType = "application/octet-stream";
      }

      if (!base64Data) {
        warn(`No ${format || "gp5"} data available`);
        return;
      }

      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      info(`Downloaded ${filename}`);
    },
    [result, comparison.audioResult, comparison.midiResult, showComparison, info, warn],
  );

  const handleReset = useCallback(() => {
    clearLogs();
    setTargetFret(null);
    setShowComparison(false);
    setPendingMidiNotes(null);
    setPendingAudioBlob(null);
    comparison.resetComparison();
    reset();
  }, [clearLogs, reset, comparison.resetComparison]);

  const hasResult = showComparison
    ? comparison.status === "done"
    : status === "done" && result != null;

  const activeNoteCount = showComparison
    ? (comparison.audioResult?.noteCount ?? 0) + (comparison.midiResult?.noteCount ?? 0)
    : result?.noteCount ?? 0;

  return (
    <Layout>
      <AudioUploader onFileSelected={handleFile} disabled={isProcessing} />

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MicrophoneRecorder
            onRecordingComplete={handleRecording}
            disabled={isProcessing}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
          />
          <MidiFileUploader onFileSelected={handleMidiFile} disabled={isProcessing} />
        </div>
        {(status !== "idle" || showComparison) && (
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Start over
          </button>
        )}
      </div>

      {/* MIDI status indicator */}
      <div className="mt-2">
        <MidiStatus
          status={midi.status}
          portName={midi.portName}
          error={midi.error}
          noteCount={midi.noteCount}
          availablePorts={midi.availablePorts}
          onSelectPort={midi.selectPort}
        />
      </div>

      {/* Live MIDI monitor */}
      {(midi.status === "recording" || midi.noteCount > 0) && (
        <MidiMonitor
          isRecording={midi.status === "recording"}
          lastNote={midi.lastNote}
          noteCount={midi.noteCount}
        />
      )}

      {/* Post-recording choice when both audio + MIDI are available */}
      {pendingAudioBlob && pendingMidiNotes && (
        <div className="mt-4 p-4 rounded-lg border border-gray-700 bg-gray-800/50">
          <p className="text-sm text-gray-300 mb-3">
            Both audio and MIDI ({pendingMidiNotes.length} notes) captured. Choose pipeline:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePostRecordChoice("audio")}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium transition-colors"
            >
              Transcribe from Audio
            </button>
            <button
              onClick={() => handlePostRecordChoice("midi")}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium transition-colors"
            >
              Transcribe from MIDI ({pendingMidiNotes.length} notes)
            </button>
            <button
              onClick={() => handlePostRecordChoice("compare")}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
            >
              Compare Both
            </button>
          </div>
        </div>
      )}

      <VideoAnalysis
        enabled={videoEnabled}
        active={isRecording}
        onEnabledChange={setVideoEnabled}
        onZoneDetected={handleVideoZoneDetected}
        disabled={isProcessing}
      />

      <PositionHint
        value={targetFret}
        onChange={setTargetFret}
        onReSolve={handleReSolve}
        showReSolve={hasResult}
        disabled={isProcessing}
      />

      <TuningSelector
        value={tuning}
        onChange={setTuning}
        disabled={isProcessing}
      />

      <FilterControls
        value={filterParams}
        onChange={handleFilterChange}
        onInitialLoad={setFilterParams}
        disabled={isProcessing}
      />

      <TranscriptionStatus status={status} error={error} />
      <LogPanel logs={logs} />
      <WaveformDisplay audioSource={audioSource} />

      {/* View mode toggle — only show when we have results */}
      {hasResult && (
        <div className="mt-6 flex items-center gap-2">
          <span className="text-sm text-gray-400 mr-2">View:</span>
          {(["tab", "score", "both"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === mode
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {mode === "tab" ? "Tab" : mode === "score" ? "Sheet Music" : "Both"}
            </button>
          ))}
        </div>
      )}

      {/* Comparison view or single tab viewer */}
      {showComparison && comparison.status === "done" ? (
        <ComparisonView
          audioResult={comparison.audioResult}
          midiResult={comparison.midiResult}
          audioError={comparison.audioError}
          midiError={comparison.midiError}
          viewMode={viewMode}
          log={logger}
        />
      ) : (
        <TabViewer tex={result?.tex ?? null} log={logger} viewMode={viewMode} />
      )}

      {hasResult && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => handleDownload()}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
          >
            Download .gp5
          </button>
          <button
            onClick={() => handleDownload("midi")}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            .mid
          </button>
          <button
            onClick={() => handleDownload("musicxml")}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            .musicxml
          </button>
          <span className="text-sm text-gray-400">
            {showComparison
              ? `Audio: ${comparison.audioResult?.noteCount ?? "—"} / MIDI: ${comparison.midiResult?.noteCount ?? "—"} notes`
              : `${activeNoteCount} note${activeNoteCount !== 1 ? "s" : ""} detected`}
          </span>
        </div>
      )}
    </Layout>
  );
}

export default App;
