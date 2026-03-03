import { useState, useRef, useCallback } from "react";
import { encodeWav } from "../utils/wavEncoder";

export type MicStatus = "idle" | "recording" | "stopped";

export function useMicrophone() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
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

      // Try AudioWorklet first, fall back to ScriptProcessorNode
      let useWorklet = false;
      if (ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule("/audio-recorder-processor.js");
          useWorklet = true;
        } catch {
          // AudioWorklet unavailable (insecure context, file not found, etc.)
        }
      }

      if (useWorklet) {
        const workletNode = new AudioWorkletNode(ctx, "audio-recorder-processor");
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event: MessageEvent) => {
          if (event.data instanceof Float32Array) {
            chunksRef.current.push(new Float32Array(event.data));
          }
        };

        source.connect(workletNode);
        workletNode.connect(ctx.destination);
      } else {
        // Fallback: deprecated ScriptProcessorNode (still widely supported)
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const data = e.inputBuffer.getChannelData(0);
          chunksRef.current.push(new Float32Array(data));
        };

        source.connect(processor);
        processor.connect(ctx.destination);
      }

      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    // Stop worklet or processor
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage("stop");
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    processorRef.current?.disconnect();
    processorRef.current = null;

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
