import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

export function useWavesurfer(containerRef: React.RefObject<HTMLDivElement | null>) {
  const wsRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ws = WaveSurfer.create({
      container: el,
      waveColor: "#4f46e5",
      progressColor: "#818cf8",
      cursorColor: "#c7d2fe",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      normalize: true,
    });

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [containerRef]);

  const loadBlob = (blob: Blob) => {
    if (wsRef.current) {
      wsRef.current.loadBlob(blob);
    }
  };

  const loadUrl = (url: string) => {
    if (wsRef.current) {
      wsRef.current.load(url);
    }
  };

  return { ws: wsRef, loadBlob, loadUrl };
}
