import { useState, useRef, useCallback } from "react";
import { encodeWav } from "../utils/wavEncoder";

export type MicStatus = "idle" | "recording" | "stopped";

export function useMicrophone() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setWavBlob(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      contextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessor to collect raw PCM (works everywhere)
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    // Disconnect audio nodes
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    contextRef.current?.close();

    // Merge chunks into a single Float32Array
    const totalLength = chunksRef.current.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const blob = encodeWav(merged, 44100);
    setWavBlob(blob);
    setStatus("stopped");
    chunksRef.current = [];
  }, []);

  const resetMic = useCallback(() => {
    setStatus("idle");
    setWavBlob(null);
    setError(null);
  }, []);

  return { status, wavBlob, error, startRecording, stopRecording, resetMic };
}
