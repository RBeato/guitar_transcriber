# Guitar Transcriber

A web application that transcribes guitar audio into tablature. Supports two input pipelines — **audio analysis** (via Spotify's Basic Pitch) and **real-time MIDI capture** (via Jam Origin MIDI Guitar 3) — with side-by-side comparison to tune accuracy.

## Quick Start

```bash
# Install everything
make install

# Run both servers (backend :8000, frontend :5173)
make dev

# Run tests
make test
```

Then open http://localhost:5173.

### Prerequisites

- Python 3.11+ (tested on 3.13)
- Node.js 18+
- For MIDI input: [Jam Origin MIDI Guitar 3](https://www.jamorigin.com/) running in standalone mode

### Manual Setup

```bash
# Backend
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -e "backend/.[dev]"

# Note: On Python 3.13 / macOS, install tensorflow first, then
# basic-pitch with --no-deps to avoid the tensorflow-macos conflict.

# Frontend
cd frontend && npm install
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite + TypeScript + Tailwind)  :5173          │
│                                                                     │
│  ┌─ AudioUploader ─┐  ┌─ MicrophoneRecorder ─┐  ┌─ Web MIDI ────┐ │
│  │  File drop/pick  │  │  ScriptProcessorNode │  │  Jam Origin   │ │
│  └────────┬─────────┘  └──────────┬───────────┘  └──────┬────────┘ │
│           │                       │                      │          │
│           │            ┌──────────┴──────────┐           │          │
│           │            │  Post-record choice  │           │          │
│           │            │  Audio / MIDI / Both │           │          │
│           │            └──┬────────┬────────┬┘           │          │
│           │               │        │        │            │          │
│  ┌────────▼───────────────▼─┐   ┌──▼────────▼──────────┐│          │
│  │  POST /api/transcribe    │   │ POST /api/transcribe- ││          │
│  │  (multipart: file + opts)│   │ midi (JSON: notes)    ││          │
│  └────────┬─────────────────┘   └──────────┬────────────┘│          │
│           │                                │             │          │
│           │    ┌───────────────────────┐    │             │          │
│           └───►│  ComparisonView (A/B) │◄───┘             │          │
│                │  or single TabViewer  │                  │          │
│                └───────────────────────┘                  │          │
│  ┌─ FilterControls ─┐  ┌─ PositionHint ─┐  ┌─ MidiStatus ──┐      │
│  │  Slider panel     │  │  Fret zone     │  │  Device info   │      │
│  └───────────────────┘  └────────────────┘  └───────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Vite dev proxy /api → :8000
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  Backend (Python 3.13 + FastAPI)  :8000                            │
│                                                                     │
│  /api/transcribe (multipart)         /api/transcribe-midi (JSON)   │
│       │                                    │                        │
│       ▼                                    │                        │
│  AudioProcessor.save_upload()              │                        │
│       │                                    │                        │
│       ▼                                    │                        │
│  PitchDetector.detect()                    │                        │
│  (Basic Pitch ONNX model)                  │                        │
│  → range filter → velocity filter          │                        │
│  → deduplicate → merge close notes         │                        │
│       │                                    │                        │
│       └──────────────┬─────────────────────┘                        │
│                      ▼                                              │
│              TabSolver.solve()                                      │
│              (Viterbi DP: position/stretch/zone costs)              │
│                      │                                              │
│               ┌──────┴──────┐                                       │
│               ▼             ▼                                       │
│     AlphaTexBuilder   GuitarProBuilder                              │
│     (.tex string)     (.gp5 bytes)                                  │
│                                                                     │
│  Response: { tex, gp5 (base64), noteCount, notesSummary }          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Audio Pipeline
1. Upload an audio file (WAV, MP3, OGG, FLAC, M4A) or record from the microphone
2. Basic Pitch detects polyphonic notes from the audio
3. Configurable filtering removes ghost notes, harmonics, and noise
4. Viterbi DP solver assigns optimal string/fret positions
5. Outputs Guitar Pro 5 (.gp5) and alphaTex for in-browser rendering

### MIDI Pipeline
1. Connect Jam Origin MIDI Guitar 3 (or any MIDI device) via Web MIDI API
2. MIDI notes are captured in real-time alongside microphone recording
3. Notes bypass Basic Pitch entirely — sent directly to the solver
4. Produces cleaner transcriptions when MIDI tracking is accurate

### A/B Comparison
1. When both audio and MIDI are available, choose "Compare Both"
2. Both pipelines run in parallel and render side by side
3. Adjust filter sliders to see the audio pipeline converge toward the MIDI ground truth
4. Helps tune optimal filter settings for audio-only use

### Note Filtering Controls
| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Onset Sensitivity | 0.1–0.9 | 0.60 | Higher = fewer note onsets detected |
| Minimum Volume | 0.1–0.9 | 0.40 | Filters quiet harmonics and noise |
| Min Note Length | 0.05–0.5s | 0.11s | Removes very short ghost notes |
| Merge Gap | 0–100ms | 30ms | Merges same-pitch notes with small gaps |
| Frame Threshold | 0.1–0.9 | 0.50 | *(Advanced)* Basic Pitch frame confidence |

### Position Hint
- Manual fret zone selector or automatic via hand tracking (MediaPipe)
- Biases the solver toward a fret region (e.g., open position, 5th position, 7th position)
- "Re-solve" re-runs the solver without re-detecting notes

### Rendering
- **Tab view** — standard guitar tablature
- **Sheet music** — standard notation
- **Both** — combined view
- Powered by alphaTab (SVG renderer, no Web Workers)
- GP5 download for Guitar Pro / TuxGuitar

---

## Project Structure

```
guitar_transcriber/
├── Makefile                          # dev/install/test commands
├── README.md
│
├── backend/
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── pytest.ini
│   │
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS, lifespan
│   │   ├── config.py                 # Settings (env: GT_*)
│   │   │
│   │   ├── api/
│   │   │   ├── router.py             # Mounts all routers at /api
│   │   │   ├── health.py             # GET /api/health
│   │   │   ├── transcribe.py         # POST /api/transcribe
│   │   │   └── transcribe_midi.py    # POST /api/transcribe-midi
│   │   │
│   │   ├── models/
│   │   │   ├── guitar.py             # Tuning, candidates_for_pitch()
│   │   │   ├── note_event.py         # NoteEvent, TabNote dataclasses
│   │   │   └── schemas.py            # (Pydantic response models)
│   │   │
│   │   └── services/
│   │       ├── audio_processor.py    # File validation + temp save
│   │       ├── pitch_detector.py     # Basic Pitch wrapper + filtering
│   │       ├── tab_solver.py         # Viterbi DP string/fret solver
│   │       ├── guitarpro_builder.py  # GP5 file generation
│   │       ├── alphatex_builder.py   # alphaTex string generation
│   │       └── transcription.py      # Pipeline orchestrator
│   │
│   └── tests/
│       ├── conftest.py               # AsyncClient fixture
│       ├── test_health.py
│       ├── test_guitar.py            # Guitar model tests
│       ├── test_tab_solver.py        # Viterbi solver tests
│       ├── test_guitarpro_builder.py # GP5 builder tests
│       ├── test_pitch_detector.py    # Merge + dedup unit tests
│       └── test_transcribe_midi.py   # MIDI endpoint integration tests
│
└── frontend/
    ├── package.json
    ├── vite.config.ts                # React + alphaTab + /api proxy
    ├── tsconfig.json
    ├── tailwind.config.js
    │
    ├── public/
    │   ├── font/                     # alphaTab font files (symlink)
    │   └── soundfont/                # SONiVOX EAS soundfont
    │
    └── src/
        ├── main.tsx                  # React entry point
        ├── App.tsx                   # Root component, all state + wiring
        │
        ├── services/
        │   └── api.ts                # API client (transcribeAudio, transcribeMidi, healthCheck)
        │
        ├── hooks/
        │   ├── useTranscription.ts   # Audio + MIDI transcription state machine
        │   ├── useWebMidi.ts         # Web MIDI API: discover, capture, stop
        │   ├── useComparison.ts      # A/B parallel pipeline runner
        │   ├── useAlphaTab.ts        # alphaTab lifecycle management
        │   ├── useMicrophone.ts      # Mic recording (ScriptProcessorNode)
        │   ├── useWavesurfer.ts      # Waveform display
        │   ├── useHandTracking.ts    # MediaPipe hand landmark detection
        │   └── useLogs.ts            # Structured log panel state
        │
        ├── components/
        │   ├── Layout.tsx            # Page shell (dark theme)
        │   ├── AudioUploader.tsx     # Drag-and-drop file input
        │   ├── MicrophoneRecorder.tsx # Record/stop/transcribe buttons
        │   ├── MidiStatus.tsx        # MIDI device indicator + port picker
        │   ├── FilterControls.tsx    # Note filtering slider panel
        │   ├── PositionHint.tsx      # Fret zone selector + re-solve
        │   ├── VideoAnalysis.tsx     # Camera hand tracking UI
        │   ├── TranscriptionStatus.tsx # Processing/error banner
        │   ├── TabViewer.tsx         # alphaTab renderer (tab/score/both)
        │   ├── ComparisonView.tsx    # Side-by-side Audio vs MIDI tabs
        │   ├── WaveformDisplay.tsx   # wavesurfer.js waveform
        │   └── LogPanel.tsx          # Debug log output
        │
        └── utils/
            └── wavEncoder.ts         # Float32Array → 16-bit WAV
```

---

## API Reference

### `POST /api/transcribe`

Transcribes an audio file into guitar tablature.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | Yes | — | Audio file (WAV, MP3, OGG, FLAC, M4A, max 50 MB) |
| `target_fret` | int | No | null | Bias solver toward this fret zone |
| `onset_threshold` | float | No | 0.6 | Basic Pitch onset sensitivity (0.1–0.9) |
| `frame_threshold` | float | No | 0.5 | Basic Pitch frame threshold (0.1–0.9) |
| `minimum_note_length` | float | No | 0.11 | Min note duration in seconds |
| `minimum_velocity` | float | No | 0.4 | Min velocity to keep (0.0–1.0) |
| `merge_tolerance_ms` | float | No | 30.0 | Merge same-pitch notes within this gap (ms) |

**Response (200):**
```json
{
  "tex": "\\title 'Guitar Transcription' ...",
  "gp5": "<base64-encoded GP5 bytes>",
  "noteCount": 42,
  "notesSummary": "s1f0(64) s2f3(62) ..."
}
```

### `POST /api/transcribe-midi`

Transcribes pre-detected MIDI notes into guitar tablature (bypasses audio analysis).

**Content-Type:** `application/json`

```json
{
  "notes": [
    { "start_time": 0.0, "end_time": 0.5, "midi_pitch": 64, "velocity": 0.8 },
    { "start_time": 0.5, "end_time": 1.0, "midi_pitch": 62, "velocity": 0.7 }
  ],
  "target_fret": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notes` | array | Yes | Non-empty list of MIDI note objects |
| `notes[].start_time` | float | Yes | Note start time in seconds |
| `notes[].end_time` | float | Yes | Note end time in seconds |
| `notes[].midi_pitch` | int | Yes | MIDI note number (40–88 for guitar) |
| `notes[].velocity` | float | Yes | Note velocity (0.0–1.0) |
| `target_fret` | int | No | Bias solver toward this fret zone |

**Response:** Same shape as `/api/transcribe`.

### `GET /api/health`

Returns `{ "status": "ok" }`.

---

## Configuration

All backend settings can be overridden via environment variables with the `GT_` prefix:

```bash
GT_ONSET_THRESHOLD=0.7 GT_MINIMUM_VELOCITY=0.5 make dev-backend
```

See `backend/app/config.py` for the full list.

---

## Testing

```bash
# All tests
make test

# Backend only (34 tests)
make test-backend

# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend unit tests (if any)
make test-frontend
```

### Backend Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `test_health.py` | 1 | Health endpoint |
| `test_guitar.py` | 6 | Guitar model, pitch-to-string/fret mapping |
| `test_tab_solver.py` | 9 | Viterbi DP solver (chords, zones, stickiness) |
| `test_guitarpro_builder.py` | 3 | GP5 file generation |
| `test_pitch_detector.py` | 11 | Note merging + deduplication |
| `test_transcribe_midi.py` | 4 | MIDI endpoint integration |

---

## What Was Done (Recent Implementation)

### Phase 1: Note Filtering

**Problem:** The audio pipeline (Basic Pitch) produces ghost notes from harmonics/string resonance, redundant detections, and has no user-tunable parameters.

**What was built:**

- **`_merge_close_notes()` in `pitch_detector.py`** — New post-processing step that merges same-pitch notes separated by a configurable gap (default 30ms). This catches cases where Basic Pitch splits a single sustained note into two due to a momentary dip in confidence. The merged note extends the end time and keeps the maximum velocity.

- **Per-request parameter overrides** — `PitchDetector.detect()` now accepts optional `onset_threshold`, `frame_threshold`, `minimum_note_length`, `minimum_velocity`, and `merge_tolerance_ms` parameters. Each falls back to the global setting if not provided. This lets the frontend send different thresholds per request without changing server config.

- **`FilterControls` component** — Collapsible slider panel in the frontend. Four sliders visible by default (onset sensitivity, minimum volume, min note length, merge gap), with frame threshold behind a "Show advanced" toggle. "Reset to defaults" button appears when any value differs from defaults.

- **Full threading** — Filter params flow from `FilterControls` → `App` state → `useTranscription.transcribe()` → `api.transcribeAudio()` → FormData fields → FastAPI Form params → `TranscriptionService.transcribe()` → `PitchDetector.detect()`. In comparison mode, changing filters auto-reruns only the audio pipeline.

**Processing chain order:** range filter → velocity filter → deduplicate → merge close notes → sort by (start_time, pitch).

### Phase 2: Web MIDI Input (Jam Origin MIDI Guitar 3)

**Problem:** Basic Pitch is an ML model that makes mistakes. Jam Origin MIDI Guitar 3 converts guitar audio to MIDI in real-time through a virtual MIDI port, providing a potentially more accurate note source.

**What was built:**

- **`useWebMidi` hook** — Full Web MIDI API integration. On mount, calls `navigator.requestMIDIAccess()`, scans for Jam Origin (port name containing "midi guitar"), falls back to first available port. Exposes `startCapture()` / `stopCapture()` which record Note On (0x90) and Note Off (0x80) messages with timestamps relative to recording start. Filters to guitar MIDI range [40–88]. Flushes any active notes (Note On without matching Note Off) on stop.

- **`MidiStatus` component** — Shows connection state with a colored dot (green = connected, red = error, gray = disconnected). Displays port name and live note count during recording. Port selector dropdown when multiple MIDI inputs are detected.

- **`POST /api/transcribe-midi` endpoint** — Accepts a JSON array of `{ start_time, end_time, midi_pitch, velocity }` notes. Converts to internal `NoteEvent` objects and calls `TranscriptionService.transcribe_from_notes()`, which skips audio processing and pitch detection entirely and goes straight to the Viterbi solver. Returns the same response shape as `/api/transcribe`.

- **Recording integration** — When a MIDI device is connected and the user starts a microphone recording, MIDI capture starts simultaneously. When recording stops, if MIDI notes were captured, the user sees a three-way choice: "Transcribe from Audio", "Transcribe from MIDI (N notes)", or "Compare Both". Without MIDI, the audio pipeline runs as before.

### Phase 3: A/B Comparison Mode

**Problem:** How do you know if your audio pipeline filter settings are good? You need a ground truth to compare against.

**What was built:**

- **`useComparison` hook** — Runs `transcribeAudio()` and `transcribeMidi()` in parallel using `Promise.allSettled` (so one failure doesn't cancel the other). Holds `audioResult` and `midiResult` separately. Supports `rerunAudio()` to update just the audio side when filters or position hints change.

- **`ComparisonView` component** — Two-column layout (stacks on mobile). Left panel has an amber border/header ("Audio Pipeline, N notes"), right panel has a green border/header ("MIDI Pipeline, N notes"). Each renders an independent `TabViewer` instance.

- **Interactive tuning** — In comparison mode, adjusting filter sliders triggers `rerunAudio()` which re-sends the audio file with updated parameters. The MIDI side stays fixed as the reference. The user can watch the audio result converge toward the MIDI ground truth as they tune.

---

## What Needs to Be Done

### High Priority

- **End-to-end testing with real hardware** — The MIDI pipeline has been implemented and unit-tested, but needs manual testing with Jam Origin MIDI Guitar 3 actually running. Verify: port auto-detection, note capture accuracy, timing alignment, and comparison mode interaction.

- **Chrome-only Web MIDI** — Web MIDI API is only available in Chromium-based browsers (Chrome, Edge, Brave). Firefox and Safari do not support it. Consider adding a clear message in `MidiStatus` when the browser doesn't support Web MIDI, or investigate the [WebMIDI.js](https://github.com/djipco/webmidi) polyfill.

- **MIDI timing alignment** — Currently, MIDI capture timestamps are relative to `performance.now()` at capture start, and audio recording timestamps are relative to `ScriptProcessorNode` buffer offsets. These may not be perfectly aligned. If comparison shows consistent timing offsets, a calibration step may be needed.

- **Re-solve with MIDI notes** — Currently `handleReSolve` in comparison mode only re-runs the audio side. There's no way to re-solve the MIDI side with a different `target_fret` without re-running the full comparison. Should add `rerunMidi()` to the comparison hook.

### Medium Priority

- **Persist filter presets** — Save filter settings to `localStorage` so users don't lose their tuned values on page reload. Consider a "Save as preset" / "Load preset" UI.

- **Live MIDI monitoring** — Show incoming MIDI notes in real-time (e.g., a piano roll or note list) before/during recording, so users can verify MIDI Guitar is tracking correctly before committing to a take.

- **Note count comparison stats** — In comparison mode, show a diff summary: how many notes are in audio-only, MIDI-only, and in both. This would help quantify the gap between pipelines.

- **Audio file + MIDI file import** — Currently MIDI notes can only come from live capture. Allow importing a `.mid` file (e.g., exported from Jam Origin) as an alternative input. This would enable offline comparison without needing the MIDI device connected.

- **Better error messages for MIDI** — The current error handling in `useWebMidi` is minimal. Add specific messages for common failure modes: user denied MIDI permission, device disconnected mid-recording, etc.

- **ScriptProcessorNode deprecation** — `useMicrophone.ts` uses the deprecated `ScriptProcessorNode`. Should migrate to `AudioWorklet` for better performance and future-proofing. Not urgent but will eventually stop working in some browsers.

### Low Priority / Future

- **Tempo detection** — Currently hardcoded at 120 BPM. Add beat/tempo detection (e.g., `librosa.beat.beat_track`) to quantize notes to the actual tempo.

- **Quantization improvements** — The current quantization snaps to the nearest standard duration. Could improve with beat-grid alignment, tuplet detection, and tie handling.

- **Multi-track support** — Currently generates a single guitar track. Support for multiple tracks (e.g., lead + rhythm) or splitting chords across voices.

- **Alternative tunings** — `STANDARD_TUNING` is hardcoded. Add support for Drop D, DADGAD, Open G, etc. The solver already accepts a `tuning` parameter — just need a UI selector.

- **Undo/redo for filter changes** — In comparison mode, it would be useful to undo a filter change and see the previous audio result again.

- **Export formats** — Currently only GP5. Add MusicXML, MIDI, and PDF export options.

- **Batch processing** — Process multiple audio files in sequence, useful for transcribing a full setlist or practice session.

- **WebSocket streaming** — Replace the request/response model with WebSocket streaming for real-time transcription during recording (progressive results as audio comes in).

---

## Known Limitations

- **Basic Pitch accuracy** — ML-based note detection is inherently imperfect. Fast passages, heavy distortion, and polyphonic sections (especially with open strings ringing) produce ghost notes. The filter controls help but don't eliminate the problem.

- **Solver limitations** — The Viterbi DP solver minimizes a cost function but doesn't guarantee the "correct" fingering. It works well for single-note lines and simple chords but may produce awkward positions for complex passages.

- **No rhythm analysis** — Notes are quantized purely by duration, not aligned to a beat grid. This means the tablature may not look rhythmically natural even when the pitches are correct.

- **GP5 format** — Using Guitar Pro 5 format (not GP6/7) for maximum compatibility. Some features of newer formats are not available.

- **Single guitar, standard tuning only** — No support for bass, ukulele, or alternative tunings yet.

- **Browser compatibility** — Web MIDI requires Chrome/Edge. MediaPipe hand tracking requires a GPU-capable browser. alphaTab rendering is CPU-bound and may be slow on very long transcriptions.
