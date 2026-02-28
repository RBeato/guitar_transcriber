import { useRef, useEffect } from "react";
import { useWavesurfer } from "../hooks/useWavesurfer";

interface WaveformDisplayProps {
  audioSource: File | Blob | null;
}

export default function WaveformDisplay({ audioSource }: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { loadBlob } = useWavesurfer(containerRef);

  useEffect(() => {
    if (audioSource) {
      loadBlob(audioSource);
    }
  }, [audioSource, loadBlob]);

  if (!audioSource) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Waveform</h3>
      <div ref={containerRef} className="bg-gray-900 rounded-lg p-2" />
    </div>
  );
}
