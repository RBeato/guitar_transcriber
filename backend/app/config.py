from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Audio constraints
    max_file_size_mb: int = 50
    supported_formats: list[str] = ["wav", "mp3", "ogg", "flac", "m4a"]

    # Basic Pitch thresholds
    onset_threshold: float = 0.5
    frame_threshold: float = 0.3
    minimum_note_length: float = 0.05  # seconds

    # Guitar constraints
    min_fret: int = 0
    max_fret: int = 24
    chord_window_ms: float = 50.0  # notes within this window are a chord
    max_fret_span: int = 5  # max span in a chord

    # Solver weights
    position_jump_weight: float = 1.0
    stretch_weight: float = 0.5
    high_fret_penalty_weight: float = 0.1

    # Quantization
    tempo_bpm: int = 120
    ticks_per_beat: int = 960

    model_config = {"env_prefix": "GT_"}


settings = Settings()
