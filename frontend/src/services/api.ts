const API_BASE = "/api";

export interface TranscriptionResult {
  tex: string;
  gp5Base64: string;
  noteCount: number;
  notesSummary: string;
}

export type Logger = {
  info: (msg: string) => void;
  success: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export interface FilteringParams {
  onsetThreshold?: number;
  frameThreshold?: number;
  minimumNoteLength?: number;
  minimumVelocity?: number;
  mergeToleranceMs?: number;
}

export interface MidiNote {
  startTime: number;
  endTime: number;
  midiPitch: number;
  velocity: number;
}

export async function transcribeAudio(
  file: File | Blob,
  log?: Logger,
  targetFret?: number | null,
  filterParams?: FilteringParams,
): Promise<TranscriptionResult> {
  const name = file instanceof File ? file.name : "recording.wav";
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  log?.info(`Uploading ${name} (${sizeMB} MB)...`);

  const formData = new FormData();
  formData.append("file", file, name);
  if (targetFret != null) {
    formData.append("target_fret", String(targetFret));
    log?.info(`Position hint: fret ${targetFret}`);
  }

  // Append filtering params
  if (filterParams) {
    if (filterParams.onsetThreshold != null)
      formData.append("onset_threshold", String(filterParams.onsetThreshold));
    if (filterParams.frameThreshold != null)
      formData.append("frame_threshold", String(filterParams.frameThreshold));
    if (filterParams.minimumNoteLength != null)
      formData.append("minimum_note_length", String(filterParams.minimumNoteLength));
    if (filterParams.minimumVelocity != null)
      formData.append("minimum_velocity", String(filterParams.minimumVelocity));
    if (filterParams.mergeToleranceMs != null)
      formData.append("merge_tolerance_ms", String(filterParams.mergeToleranceMs));
  }

  log?.info("POST /api/transcribe — waiting for server...");
  const t0 = performance.now();

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    body: formData,
  });

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Transcription failed" }));
    const msg = error.detail || `Server error: ${response.status}`;
    log?.error(`Server returned ${response.status} after ${elapsed}s: ${msg}`);
    throw new Error(msg);
  }

  log?.info(`Server responded 200 OK in ${elapsed}s — parsing JSON...`);
  const data = await response.json();

  log?.success(
    `Transcription complete: ${data.noteCount} notes detected`
  );
  if (data.notesSummary) {
    log?.info(`Notes: ${data.notesSummary}`);
  }
  log?.info(`alphaTex: ${data.tex}`);

  return {
    tex: data.tex,
    gp5Base64: data.gp5,
    noteCount: data.noteCount,
    notesSummary: data.notesSummary || "",
  };
}

export async function transcribeMidi(
  notes: MidiNote[],
  log?: Logger,
  targetFret?: number | null,
): Promise<TranscriptionResult> {
  log?.info(`Sending ${notes.length} MIDI notes for transcription...`);

  const body = {
    notes: notes.map((n) => ({
      start_time: n.startTime,
      end_time: n.endTime,
      midi_pitch: n.midiPitch,
      velocity: n.velocity,
    })),
    target_fret: targetFret ?? null,
  };

  const t0 = performance.now();

  const response = await fetch(`${API_BASE}/transcribe-midi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "MIDI transcription failed" }));
    const msg = error.detail || `Server error: ${response.status}`;
    log?.error(`Server returned ${response.status} after ${elapsed}s: ${msg}`);
    throw new Error(msg);
  }

  log?.info(`Server responded 200 OK in ${elapsed}s — parsing JSON...`);
  const data = await response.json();

  log?.success(`MIDI transcription complete: ${data.noteCount} notes`);
  if (data.notesSummary) {
    log?.info(`Notes: ${data.notesSummary}`);
  }

  return {
    tex: data.tex,
    gp5Base64: data.gp5,
    noteCount: data.noteCount,
    notesSummary: data.notesSummary || "",
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
