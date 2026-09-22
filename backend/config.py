"""
config.py — Application-wide configuration for PDF Swiss-Knife backend.
All tunable parameters live here. Routes and services import from here.
"""

from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent.parent.resolve()
FRONTEND_DIR = BASE_DIR / "frontend"
TEMP_DIR = BASE_DIR / "temp"
OUTPUT_DIR = BASE_DIR / "output"

# ─── Server ───────────────────────────────────────────────────────────────────

HOST = "127.0.0.1"
PORT = 5000
DEBUG = True  # Set False in production

# ─── Limits ───────────────────────────────────────────────────────────────────

# Maximum upload size per request (bytes). Flask enforces this.
MAX_CONTENT_LENGTH = 512 * 1024 * 1024  # 512 MB

# ─── Jobs ─────────────────────────────────────────────────────────────────────

# Jobs older than this (seconds) will be removed from memory by cleanup
JOB_TTL_SECONDS = 3600  # 1 hour

# ─── Frontend polling ─────────────────────────────────────────────────────────

# Advisory value sent to frontend; frontend uses this as its poll interval
POLL_INTERVAL_MS = 500

# ─── Filenames ────────────────────────────────────────────────────────────────

# Characters illegal on Windows filesystems
ILLEGAL_FILENAME_CHARS = r'\/:*?"<>|'

# Maximum length of a sanitised filename (characters)
MAX_FILENAME_LENGTH = 200
