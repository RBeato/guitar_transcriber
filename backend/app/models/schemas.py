from pydantic import BaseModel


class NoteEventResponse(BaseModel):
    start_time: float
    end_time: float
    midi_pitch: int
    velocity: float
    string: int | None = None
    fret: int | None = None


class TranscriptionResponse(BaseModel):
    notes: list[NoteEventResponse]
