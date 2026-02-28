import { useState, useCallback } from "react";
import { transcribeAudio, TranscriptionResult } from "../services/api";

export type TranscriptionStatus = "idle" | "processing" | "done" | "error";

interface TranscriptionState {
  status: TranscriptionStatus;
  result: TranscriptionResult | null;
  error: string | null;
  audioSource: File | Blob | null;
}

export function useTranscription() {
  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    result: null,
    error: null,
    audioSource: null,
  });

  const transcribe = useCallback(async (file: File | Blob) => {
    setState({ status: "processing", result: null, error: null, audioSource: file });

    try {
      const result = await transcribeAudio(file);
      setState({ status: "done", result, error: null, audioSource: file });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ status: "error", result: null, error: message, audioSource: file });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", result: null, error: null, audioSource: null });
  }, []);

  return { ...state, transcribe, reset };
}
