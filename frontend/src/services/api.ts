const API_BASE = "/api";

export interface TranscriptionResult {
  tex: string;
  gp5Base64: string;
  noteCount: number;
}

export async function transcribeAudio(file: File | Blob): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", file, file instanceof File ? file.name : "recording.wav");

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Transcription failed" }));
    throw new Error(error.detail || `Server error: ${response.status}`);
  }

  const data = await response.json();
  return {
    tex: data.tex,
    gp5Base64: data.gp5,
    noteCount: data.noteCount,
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
