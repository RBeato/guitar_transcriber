"""Tests for the /api/transcribe-midi endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_transcribe_midi_basic(client):
    """Submitting MIDI notes should return a valid transcription."""
    payload = {
        "notes": [
            {"start_time": 0.0, "end_time": 0.5, "midi_pitch": 64, "velocity": 0.8},
            {"start_time": 0.5, "end_time": 1.0, "midi_pitch": 62, "velocity": 0.7},
            {"start_time": 1.0, "end_time": 1.5, "midi_pitch": 60, "velocity": 0.9},
        ]
    }
    response = await client.post("/api/transcribe-midi", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["noteCount"] == 3
    assert "tex" in data
    assert "gp5" in data  # base64-encoded
    assert len(data["gp5"]) > 0


@pytest.mark.anyio
async def test_transcribe_midi_with_target_fret(client):
    """Target fret should influence string/fret assignments."""
    payload = {
        "notes": [
            {"start_time": 0.0, "end_time": 0.5, "midi_pitch": 69, "velocity": 0.8},
        ],
        "target_fret": 5,
    }
    response = await client.post("/api/transcribe-midi", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["noteCount"] == 1
    # A4 (69) with target_fret=5 should prefer string 1 fret 5
    assert "s1f5" in data["notesSummary"]


@pytest.mark.anyio
async def test_transcribe_midi_empty_notes(client):
    """Empty note list should return 400."""
    payload = {"notes": []}
    response = await client.post("/api/transcribe-midi", json=payload)
    assert response.status_code == 400


@pytest.mark.anyio
async def test_transcribe_midi_single_note(client):
    payload = {
        "notes": [
            {"start_time": 0.0, "end_time": 1.0, "midi_pitch": 40, "velocity": 0.5},
        ]
    }
    response = await client.post("/api/transcribe-midi", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["noteCount"] == 1
    # E2 = string 6 fret 0
    assert "s6f0" in data["notesSummary"]
