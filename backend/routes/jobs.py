"""
routes/jobs.py — Job status polling endpoint.

GET  /api/jobs/<job_id>/status  → returns current job state as JSON
GET  /api/jobs/<job_id>/cleanup → remove job and its output files
GET  /api/health                → simple health check
"""

from flask import Blueprint, jsonify

from services.job_manager import get_job, delete_job, job_to_dict, cleanup_old_jobs
from services.file_manager import cleanup_job_temp, cleanup_job_output

jobs_bp = Blueprint("jobs", __name__)


@jobs_bp.get("/api/health")
def health():
    """Health check — confirms the backend is running."""
    cleanup_old_jobs()  # Opportunistic cleanup on each health check
    return jsonify({"status": "ok", "service": "PDF Swiss-Knife"})


@jobs_bp.get("/api/jobs/<job_id>/status")
def job_status(job_id: str):
    """Return the current state of a job."""
    job = get_job(job_id)
    if job is None:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job_to_dict(job))


@jobs_bp.delete("/api/jobs/<job_id>")
def cleanup_job(job_id: str):
    """Remove a job and its associated files."""
    cleanup_job_temp(job_id)
    cleanup_job_output(job_id)
    delete_job(job_id)
    return jsonify({"status": "deleted"})
