import { useMicrophone } from "../hooks/useMicrophone";

interface MicrophoneRecorderProps {
  onRecordingComplete: (wavBlob: Blob) => void;
  disabled?: boolean;
}

export default function MicrophoneRecorder({
  onRecordingComplete,
  disabled,
}: MicrophoneRecorderProps) {
  const { status, wavBlob, error, startRecording, stopRecording, resetMic } =
    useMicrophone();

  const handleStop = () => {
    stopRecording();
  };

  const handleUse = () => {
    if (wavBlob) {
      onRecordingComplete(wavBlob);
      resetMic();
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status === "idle" && (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Record from mic
        </button>
      )}

      {status === "recording" && (
        <>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-400">Recording...</span>
          <button
            onClick={handleStop}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            Stop
          </button>
        </>
      )}

      {status === "stopped" && (
        <>
          <span className="text-sm text-green-400">Recording ready</span>
          <button
            onClick={handleUse}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
          >
            Transcribe recording
          </button>
          <button
            onClick={resetMic}
            className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
          >
            Discard
          </button>
        </>
      )}

      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
