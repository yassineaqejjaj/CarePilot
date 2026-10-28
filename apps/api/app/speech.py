"""Offline CPU speech recognition with faster-whisper. Audio is deleted immediately; no cloud transcription."""
import os
import subprocess
import tempfile
import threading
from functools import lru_cache
from pathlib import Path

_lock = threading.Semaphore(1)


@lru_cache
def model():
    from faster_whisper import WhisperModel
    return WhisperModel(os.getenv("VOICE_MODEL_PATH", "/opt/voice/tiny"), device="cpu", compute_type="int8", cpu_threads=2, local_files_only=True)


def available() -> bool:
    return (Path(os.getenv("VOICE_MODEL_PATH", "/opt/voice/tiny")) / "model.bin").exists()


def transcribe(data: bytes) -> dict:
    if not available():
        raise RuntimeError("Le modèle de transcription locale n'est pas installé.")
    if not _lock.acquire(blocking=False):
        raise RuntimeError("Une transcription est en cours. Réessayez dans quelques secondes.")
    try:
        with tempfile.TemporaryDirectory(prefix="cp-voice-") as tmp:
            src, wav = Path(tmp) / "input.audio", Path(tmp) / "clip.wav"
            src.write_bytes(data)
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(src), "-t", "31", "-ar", "16000", "-ac", "1", str(wav)],
                           check=True, capture_output=True, timeout=15)
            import wave
            with wave.open(str(wav)) as audio:
                if audio.getnframes() / audio.getframerate() > 30.2:
                    raise ValueError("Message vocal limité à 30 secondes.")
            segments, info = model().transcribe(str(wav), beam_size=1, vad_filter=True)
            text = " ".join(s.text.strip() for s in segments)[:2000]
            return {"text": text, "language": info.language, "engine": "whisper-local", "review_required": True}
    finally:
        _lock.release()
