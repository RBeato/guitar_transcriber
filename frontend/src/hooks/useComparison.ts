import { useState, useCallback } from "react";
import {
  transcribeAudio,
  transcribeMidi,
  TranscriptionResult,
  Logger,
  FilteringParams,
  MidiNote,
} from "../services/api";

export type ComparisonStatus = "idle" | "running" | "done" | "error";

interface ComparisonState {
  status: ComparisonStatus;
  audioResult: TranscriptionResult | null;
  midiResult: TranscriptionResult | null;
  audioError: string | null;
  midiError: string | null;
}

export function useComparison(log?: Logger) {
  const [state, setState] = useState<ComparisonState>({
    status: "idle",
    audioResult: null,
    midiResult: null,
    audioError: null,
    midiError: null,
  });

  const runComparison = useCallback(
    async (
      audioBlob: File | Blob,
      midiNotes: MidiNote[],
      targetFret?: number | null,
      filterParams?: FilteringParams,
    ) => {
      setState({
        status: "running",
        audioResult: null,
        midiResult: null,
        audioError: null,
        midiError: null,
      });

      log?.info("Running A/B comparison: Audio vs MIDI pipelines...");

      const [audioSettled, midiSettled] = await Promise.allSettled([
        transcribeAudio(audioBlob, log, targetFret, filterParams),
        transcribeMidi(midiNotes, log, targetFret),
      ]);

      const audioResult =
        audioSettled.status === "fulfilled" ? audioSettled.value : null;
      const audioError =
        audioSettled.status === "rejected"
          ? String(audioSettled.reason)
          : null;

      const midiResult =
        midiSettled.status === "fulfilled" ? midiSettled.value : null;
      const midiError =
        midiSettled.status === "rejected"
          ? String(midiSettled.reason)
          : null;

      if (audioResult || midiResult) {
        log?.success(
          `Comparison complete: Audio=${audioResult?.noteCount ?? "failed"} notes, MIDI=${midiResult?.noteCount ?? "failed"} notes`,
        );
      }

      setState({
        status: "done",
        audioResult,
        midiResult,
        audioError,
        midiError,
      });
    },
    [log],
  );

  const rerunAudio = useCallback(
    async (
      audioBlob: File | Blob,
      targetFret?: number | null,
      filterParams?: FilteringParams,
    ) => {
      log?.info("Re-running audio pipeline with updated filters...");
      try {
        const audioResult = await transcribeAudio(
          audioBlob,
          log,
          targetFret,
          filterParams,
        );
        setState((prev) => ({
          ...prev,
          audioResult,
          audioError: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          audioResult: null,
          audioError: String(err),
        }));
      }
    },
    [log],
  );

  const resetComparison = useCallback(() => {
    setState({
      status: "idle",
      audioResult: null,
      midiResult: null,
      audioError: null,
      midiError: null,
    });
  }, []);

  return { ...state, runComparison, rerunAudio, resetComparison };
}
