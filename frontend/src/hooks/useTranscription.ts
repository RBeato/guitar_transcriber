import { useState, useCallback } from "react";
import {
  transcribeAudio,
  transcribeMidi,
  transcribeMidiFile as apiTranscribeMidiFile,
  TranscriptionResult,
  Logger,
  FilteringParams,
  MidiNote,
} from "../services/api";

export type TranscriptionStatus = "idle" | "processing" | "done" | "error";

interface TranscriptionState {
  status: TranscriptionStatus;
  result: TranscriptionResult | null;
  error: string | null;
  audioSource: File | Blob | null;
  midiNotes: MidiNote[] | null;
}

export function useTranscription(log?: Logger) {
  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    result: null,
    error: null,
    audioSource: null,
    midiNotes: null,
  });

  const transcribe = useCallback(
    async (
      file: File | Blob,
      targetFret?: number | null,
      filterParams?: FilteringParams,
      tuning?: string | null,
    ) => {
      setState((prev) => ({
        ...prev,
        status: "processing",
        result: null,
        error: null,
        audioSource: file,
      }));
      log?.info("Starting transcription pipeline...");

      try {
        const result = await transcribeAudio(file, log, targetFret, filterParams, tuning);
        setState((prev) => ({ ...prev, status: "done", result, error: null }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log?.error(`Pipeline failed: ${message}`);
        setState((prev) => ({ ...prev, status: "error", result: null, error: message }));
      }
    },
    [log],
  );

  const transcribeMidiNotes = useCallback(
    async (notes: MidiNote[], targetFret?: number | null, tuning?: string | null) => {
      setState((prev) => ({
        ...prev,
        status: "processing",
        result: null,
        error: null,
        midiNotes: notes,
      }));
      log?.info(`Starting MIDI transcription (${notes.length} notes)...`);

      try {
        const result = await transcribeMidi(notes, log, targetFret, tuning);
        setState((prev) => ({ ...prev, status: "done", result, error: null }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log?.error(`MIDI pipeline failed: ${message}`);
        setState((prev) => ({ ...prev, status: "error", result: null, error: message }));
      }
    },
    [log],
  );

  const transcribeMidiFile = useCallback(
    async (file: File, targetFret?: number | null, tuning?: string | null) => {
      setState((prev) => ({
        ...prev,
        status: "processing",
        result: null,
        error: null,
        audioSource: null,
        midiNotes: null,
      }));
      log?.info(`Starting MIDI file transcription: ${file.name}...`);

      try {
        const result = await apiTranscribeMidiFile(file, log, targetFret, tuning);
        setState((prev) => ({ ...prev, status: "done", result, error: null }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log?.error(`MIDI file pipeline failed: ${message}`);
        setState((prev) => ({ ...prev, status: "error", result: null, error: message }));
      }
    },
    [log],
  );

  const reset = useCallback(() => {
    setState({
      status: "idle",
      result: null,
      error: null,
      audioSource: null,
      midiNotes: null,
    });
  }, []);

  return { ...state, transcribe, transcribeMidiNotes, transcribeMidiFile, reset };
}
