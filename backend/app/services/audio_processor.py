import tempfile
from pathlib import Path

from fastapi import UploadFile, HTTPException

from app.config import settings


class AudioProcessor:
    """Validates uploaded audio and saves to a temp file."""

    SUPPORTED_EXTENSIONS = set(settings.supported_formats)
    MAX_SIZE = settings.max_file_size_mb * 1024 * 1024

    async def save_upload(self, file: UploadFile) -> Path:
        filename = file.filename or ""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if ext not in self.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format: .{ext}. Supported: {', '.join(sorted(self.SUPPORTED_EXTENSIONS))}",
            )

        content = await file.read()

        if len(content) > self.MAX_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.max_file_size_mb}MB",
            )

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        suffix = f".{ext}" if ext else ".wav"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(content)
        tmp.close()

        return Path(tmp.name)
