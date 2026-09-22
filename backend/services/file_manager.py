"""
services/file_manager.py — Manages temp and output directories for jobs.

Each job gets isolated directories:
  temp/<job_id>/   — uploaded input files, intermediate files
  output/<job_id>/ — generated output files

Cleanup removes these directories after use.
All filename handling goes through sanitise_filename() to prevent
path traversal and to handle Windows-illegal characters.
"""

import time
import shutil
import re
from pathlib import Path

from config import TEMP_DIR, OUTPUT_DIR, ILLEGAL_FILENAME_CHARS, MAX_FILENAME_LENGTH


# ─── Directory management ────────────────────────────────────────────────────

def create_job_temp_dir(job_id: str) -> Path:
    """Create and return the temp directory for a job."""
    path = TEMP_DIR / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def create_job_output_dir(job_id: str) -> Path:
    """Create and return the output directory for a job."""
    path = OUTPUT_DIR / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_job_temp_dir(job_id: str) -> Path:
    return TEMP_DIR / job_id


def get_job_output_dir(job_id: str) -> Path:
    return OUTPUT_DIR / job_id


def cleanup_job_temp(job_id: str) -> None:
    """Remove the temp directory for a job, if it exists."""
    path = TEMP_DIR / job_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def cleanup_job_output(job_id: str) -> None:
    """Remove the output directory for a job, if it exists."""
    path = OUTPUT_DIR / job_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def cleanup_stale_temp_dirs(max_age_hours: float = 2.0) -> int:
    """Clean up old temporary directories that are older than max_age_hours."""
    if not TEMP_DIR.exists():
        return 0
    now = time.time()
    max_age_seconds = max_age_hours * 3600
    cleaned = 0
    for child in TEMP_DIR.iterdir():
        if child.is_dir():
            try:
                mtime = child.stat().st_mtime
                if now - mtime > max_age_seconds:
                    shutil.rmtree(child, ignore_errors=True)
                    cleaned += 1
            except Exception:
                pass
    return cleaned


def ensure_base_dirs() -> None:
    """Create base temp and output directories if they do not exist, and clean stale temp files."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cleanup_stale_temp_dirs()


# ─── Filename sanitisation ────────────────────────────────────────────────────

def sanitise_filename(name: str) -> str:
    """
    Remove characters illegal on Windows filesystems and truncate to safe length.
    Returns a safe filename. Never returns an empty string (falls back to 'file').
    """
    # Strip illegal characters
    for ch in ILLEGAL_FILENAME_CHARS:
        name = name.replace(ch, "_")

    # Collapse multiple underscores/spaces
    name = re.sub(r"[_\s]{2,}", "_", name)

    # Strip leading/trailing dots, spaces, underscores
    name = name.strip(". _")

    # Truncate, preserving extension
    if len(name) > MAX_FILENAME_LENGTH:
        stem, sep, suffix = name.rpartition(".")
        if sep:
            max_stem = MAX_FILENAME_LENGTH - len(suffix) - 1
            name = stem[:max_stem] + "." + suffix
        else:
            name = name[:MAX_FILENAME_LENGTH]

    return name or "file"


def unique_path(directory: Path, filename: str) -> Path:
    """
    Return a path that does not collide with existing files.
    If 'filename' exists, appends _2, _3, etc. before the extension.
    """
    path = directory / filename
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    counter = 2
    while True:
        candidate = directory / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1
