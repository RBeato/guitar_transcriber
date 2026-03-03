import { useEffect, useRef, useState } from "react";

interface MidiMonitorProps {
  isRecording: boolean;
  lastNote: { pitch: number; velocity: number; timestamp: number } | null;
  noteCount: number;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const note = NOTE_NAMES[pitch % 12];
  return `${note}${octave}`;
}

// Piano roll range for guitar: MIDI 40 (E2) to 88 (E6)
const MIN_PITCH = 40;
const MAX_PITCH = 88;
const PITCH_RANGE = MAX_PITCH - MIN_PITCH;

interface NoteEvent {
  pitch: number;
  velocity: number;
  timestamp: number;
}

export default function MidiMonitor({
  isRecording,
  lastNote,
  noteCount,
}: MidiMonitorProps) {
  const [recentNotes, setRecentNotes] = useState<NoteEvent[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Add new notes as they come in
  useEffect(() => {
    if (!lastNote) return;
    setRecentNotes((prev) => {
      const next = [...prev, lastNote];
      // Keep last 200 notes to prevent memory growth
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, [lastNote]);

  // Clear on recording start
  useEffect(() => {
    if (isRecording) {
      setRecentNotes([]);
    }
  }, [isRecording]);

  // Draw mini piano roll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, width, height);

    // Grid lines for octave boundaries
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    for (let pitch = MIN_PITCH; pitch <= MAX_PITCH; pitch += 12) {
      const y = height - ((pitch - MIN_PITCH) / PITCH_RANGE) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (recentNotes.length === 0) {
      ctx.fillStyle = "#4b5563";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        isRecording ? "Play to see notes..." : "Start recording to monitor",
        width / 2,
        height / 2,
      );
      return;
    }

    // Time window: show last 5 seconds
    const now = recentNotes[recentNotes.length - 1].timestamp;
    const windowMs = 5000;
    const startTime = now - windowMs;

    for (const note of recentNotes) {
      if (note.timestamp < startTime) continue;

      const x = ((note.timestamp - startTime) / windowMs) * width;
      const y = height - ((note.pitch - MIN_PITCH) / PITCH_RANGE) * height;
      const alpha = Math.max(0.2, 1 - (now - note.timestamp) / windowMs);

      ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 + note.velocity * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [recentNotes, isRecording]);

  if (!isRecording && noteCount === 0) return null;

  const latest = recentNotes[recentNotes.length - 1];

  return (
    <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-medium">MIDI Monitor</span>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {latest && (
            <span className="text-indigo-400 font-mono">
              {midiToNoteName(latest.pitch)} (vel: {Math.round(latest.velocity * 127)})
            </span>
          )}
          <span>{noteCount} notes</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={80}
        className="w-full h-20"
      />
    </div>
  );
}
