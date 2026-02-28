import type { MidiStatus as MidiStatusType } from "../hooks/useWebMidi";

interface MidiStatusProps {
  status: MidiStatusType;
  portName: string | null;
  error: string | null;
  noteCount: number;
  availablePorts: { id: string; name: string }[];
  onSelectPort: (portId: string) => void;
}

export default function MidiStatus({
  status,
  portName,
  error,
  noteCount,
  availablePorts,
  onSelectPort,
}: MidiStatusProps) {
  const dotColor =
    status === "connected" || status === "recording"
      ? "bg-green-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-gray-500";

  const label = (() => {
    switch (status) {
      case "unavailable":
        return "MIDI: Not available";
      case "disconnected":
        return "MIDI: No device";
      case "connected":
        return `MIDI: ${portName || "Connected"}`;
      case "recording":
        return `MIDI: Recording (${noteCount} notes)`;
      case "error":
        return `MIDI: ${error || "Error"}`;
    }
  })();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
      <span className="text-gray-400">{label}</span>

      {availablePorts.length > 1 && status !== "recording" && (
        <select
          value={availablePorts.find((p) => p.name === portName)?.id ?? ""}
          onChange={(e) => onSelectPort(e.target.value)}
          className="ml-2 text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300"
        >
          {availablePorts.map((port) => (
            <option key={port.id} value={port.id}>
              {port.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
