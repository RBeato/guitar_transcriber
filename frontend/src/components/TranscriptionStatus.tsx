import { TranscriptionStatus as Status } from "../hooks/useTranscription";

interface TranscriptionStatusProps {
  status: Status;
  error: string | null;
}

export default function TranscriptionStatus({ status, error }: TranscriptionStatusProps) {
  if (status === "idle") return null;

  return (
    <div className="mt-6">
      {status === "processing" && (
        <div className="flex items-center gap-3 text-indigo-400">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Transcribing audio... This may take a moment.</span>
        </div>
      )}

      {status === "done" && (
        <p className="text-green-400">Transcription complete!</p>
      )}

      {status === "error" && (
        <p className="text-red-400">Error: {error}</p>
      )}
    </div>
  );
}
