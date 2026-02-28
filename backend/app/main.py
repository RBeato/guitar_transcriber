import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router

# Configure logging — structured, visible output
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger("guitar_transcriber")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload Basic Pitch model in background (TF import is slow)
    import threading
    from app.services.pitch_detector import PitchDetector

    thread = threading.Thread(target=PitchDetector.preload, daemon=True)
    thread.start()
    logger.info("Server started, Basic Pitch model loading in background")
    yield
    logger.info("Server shutting down")


app = FastAPI(
    title="Guitar Transcriber",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal error: {type(exc).__name__}: {exc}"},
    )


app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "Guitar Transcriber API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/health",
    }
