"""
services/job_manager.py — In-memory job state management.

Each long-running operation (batch processing, compress, convert) creates a Job.
Jobs are polled by the frontend at /api/jobs/<job_id>/status.

This is an in-memory store — intentionally simple for a local single-user tool.
Jobs are cleaned up after JOB_TTL_SECONDS from last update.
"""

import uuid
import threading
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config import JOB_TTL_SECONDS


# ─── Data model ───────────────────────────────────────────────────────────────

@dataclass
class JobError:
    filename: str
    reason: str


@dataclass
class JobState:
    job_id: str
    status: str = "pending"       # pending | running | done | error
    current: int = 0              # current item index (1-based)
    total: int = 0                # total items
    current_file: str = ""        # name of file being processed
    completed: int = 0            # successfully completed items
    failed: int = 0               # failed items
    errors: list = field(default_factory=list)  # list of JobError dicts
    result_path: Optional[Path] = None
    message: str = ""             # human-readable status summary
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Storage ──────────────────────────────────────────────────────────────────

_jobs: dict[str, JobState] = {}
_lock = threading.Lock()


# ─── Public API ───────────────────────────────────────────────────────────────

def create_job() -> str:
    """Create a new job, return its job_id."""
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = JobState(job_id=job_id)
    return job_id


def update_job(job_id: str, **kwargs) -> None:
    """Update fields on an existing job. Silently ignores unknown job_ids."""
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        for key, value in kwargs.items():
            if hasattr(job, key):
                setattr(job, key, value)
        job.updated_at = datetime.now(timezone.utc)


def get_job(job_id: str) -> Optional[JobState]:
    """Return job state or None if not found."""
    with _lock:
        return _jobs.get(job_id)


def delete_job(job_id: str) -> None:
    """Remove a job from memory."""
    with _lock:
        _jobs.pop(job_id, None)


def cleanup_old_jobs() -> int:
    """Remove jobs that have not been updated within JOB_TTL_SECONDS. Returns count removed."""
    now = datetime.now(timezone.utc)
    removed = 0
    with _lock:
        expired = [
            jid for jid, job in _jobs.items()
            if (now - job.updated_at).total_seconds() > JOB_TTL_SECONDS
        ]
        for jid in expired:
            del _jobs[jid]
            removed += 1
    return removed


def job_to_dict(job: JobState) -> dict:
    """Serialise a JobState to a JSON-safe dictionary."""
    return {
        "job_id": job.job_id,
        "status": job.status,
        "current": job.current,
        "total": job.total,
        "current_file": job.current_file,
        "completed": job.completed,
        "failed": job.failed,
        "errors": job.errors,
        "message": job.message,
        "result_path": str(job.result_path) if job.result_path else None,
    }
