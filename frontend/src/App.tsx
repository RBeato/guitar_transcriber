import { useCallback } from "react";
import Layout from "./components/Layout";
import AudioUploader from "./components/AudioUploader";
import MicrophoneRecorder from "./components/MicrophoneRecorder";
import WaveformDisplay from "./components/WaveformDisplay";
import TranscriptionStatus from "./components/TranscriptionStatus";
import TabViewer from "./components/TabViewer";
import { useTranscription } from "./hooks/useTranscription";

function App() {
  const { status, result, error, audioSource, transcribe, reset } =
    useTranscription();

  const isProcessing = status === "processing";

  const handleFile = useCallback(
    (file: File) => transcribe(file),
    [transcribe]
  );

  const handleRecording = useCallback(
    (blob: Blob) => transcribe(blob),
    [transcribe]
  );

  const handleDownload = useCallback(() => {
    if (!result?.gp5Base64) return;
    const bytes = Uint8Array.from(atob(result.gp5Base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcription.gp5";
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <Layout>
      <AudioUploader onFileSelected={handleFile} disabled={isProcessing} />

      <div className="mt-4 flex items-center justify-between">
        <MicrophoneRecorder
          onRecordingComplete={handleRecording}
          disabled={isProcessing}
        />
        {status !== "idle" && (
          <button
            onClick={reset}
            className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Start over
          </button>
        )}
      </div>

      <TranscriptionStatus status={status} error={error} />
      <WaveformDisplay audioSource={audioSource} />
      <TabViewer tex={result?.tex ?? null} />

      {result && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
          >
            Download .gp5
          </button>
          <span className="text-sm text-gray-400">
            {result.noteCount} note{result.noteCount !== 1 ? "s" : ""} detected
          </span>
        </div>
      )}
    </Layout>
  );
}

export default App;
