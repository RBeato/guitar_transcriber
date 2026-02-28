import { useState, useCallback, useRef } from "react";
import type { MidiNote } from "../services/api";

export type MidiStatus =
  | "unavailable"
  | "disconnected"
  | "connected"
  | "recording"
  | "error";

const GUITAR_MIN_MIDI = 40;
const GUITAR_MAX_MIDI = 88;

interface ActiveNote {
  pitch: number;
  velocity: number;
  startTime: number;
}

export function useWebMidi() {
  const [status, setStatus] = useState<MidiStatus>("disconnected");
  const [portName, setPortName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [availablePorts, setAvailablePorts] = useState<
    { id: string; name: string }[]
  >([]);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const activeInputRef = useRef<MIDIInput | null>(null);
  const capturedNotesRef = useRef<MidiNote[]>([]);
  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map());
  const recordingStartRef = useRef<number>(0);

  const initialize = useCallback(async (preferredPortId?: string) => {
    if (!navigator.requestMIDIAccess) {
      setStatus("unavailable");
      setError("Web MIDI API not supported in this browser");
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;

      const ports: { id: string; name: string }[] = [];
      access.inputs.forEach((input) => {
        ports.push({ id: input.id, name: input.name || input.id });
      });
      setAvailablePorts(ports);

      if (ports.length === 0) {
        setStatus("disconnected");
        setPortName(null);
        return;
      }

      // Try to find preferred port, then Jam Origin, then first available
      let selectedInput: MIDIInput | null = null;

      if (preferredPortId) {
        selectedInput = access.inputs.get(preferredPortId) ?? null;
      }

      if (!selectedInput) {
        access.inputs.forEach((input) => {
          if (
            !selectedInput &&
            input.name &&
            input.name.toLowerCase().includes("midi guitar")
          ) {
            selectedInput = input;
          }
        });
      }

      if (!selectedInput) {
        selectedInput = access.inputs.values().next().value ?? null;
      }

      if (selectedInput) {
        activeInputRef.current = selectedInput;
        setPortName(selectedInput.name || selectedInput.id);
        setStatus("connected");
        setError(null);
      } else {
        setStatus("disconnected");
      }

      // Listen for port changes
      access.onstatechange = () => {
        const newPorts: { id: string; name: string }[] = [];
        access.inputs.forEach((input) => {
          newPorts.push({ id: input.id, name: input.name || input.id });
        });
        setAvailablePorts(newPorts);

        if (newPorts.length === 0) {
          activeInputRef.current = null;
          setStatus("disconnected");
          setPortName(null);
        }
      };
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to access MIDI devices",
      );
    }
  }, []);

  const selectPort = useCallback(
    (portId: string) => {
      if (!midiAccessRef.current) return;
      const input = midiAccessRef.current.inputs.get(portId);
      if (input) {
        activeInputRef.current = input;
        setPortName(input.name || input.id);
        setStatus("connected");
      }
    },
    [],
  );

  const startCapture = useCallback(() => {
    const input = activeInputRef.current;
    if (!input) return;

    capturedNotesRef.current = [];
    activeNotesRef.current.clear();
    setNoteCount(0);
    recordingStartRef.current = performance.now();

    input.onmidimessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;

      const command = data[0] & 0xf0;
      const pitch = data[1];
      const velocity = data[2];
      const now = (performance.now() - recordingStartRef.current) / 1000;

      // Filter to guitar range
      if (pitch < GUITAR_MIN_MIDI || pitch > GUITAR_MAX_MIDI) return;

      if (command === 0x90 && velocity > 0) {
        // Note On
        activeNotesRef.current.set(pitch, {
          pitch,
          velocity: velocity / 127,
          startTime: now,
        });
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        // Note Off
        const active = activeNotesRef.current.get(pitch);
        if (active) {
          capturedNotesRef.current.push({
            startTime: active.startTime,
            endTime: now,
            midiPitch: active.pitch,
            velocity: active.velocity,
          });
          activeNotesRef.current.delete(pitch);
          setNoteCount(capturedNotesRef.current.length);
        }
      }
    };

    setStatus("recording");
  }, []);

  const stopCapture = useCallback((): MidiNote[] => {
    const input = activeInputRef.current;
    if (input) {
      input.onmidimessage = null;
    }

    // Flush any active notes
    const now = (performance.now() - recordingStartRef.current) / 1000;
    activeNotesRef.current.forEach((active) => {
      capturedNotesRef.current.push({
        startTime: active.startTime,
        endTime: now,
        midiPitch: active.pitch,
        velocity: active.velocity,
      });
    });
    activeNotesRef.current.clear();

    const notes = [...capturedNotesRef.current];
    setNoteCount(notes.length);
    setStatus("connected");
    return notes;
  }, []);

  return {
    status,
    portName,
    error,
    noteCount,
    availablePorts,
    initialize,
    selectPort,
    startCapture,
    stopCapture,
  };
}
