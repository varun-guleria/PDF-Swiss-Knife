from pathlib import Path
"""
routes/batch.py — Batch PDF Builder API endpoint.

POST /api/batch/start
Accepts multipart/form-data with:
  - repeating_files: list of repeating PDF files (merged into every output)
  - unique_files:    list of unique PDF files (one output per file)
"""

import threading
import logging

from flask import Blueprint, request, jsonify

from services.job_manager import create_job, update_job
from services.file_manager import (
    create_job_temp_dir,
    create_job_output_dir,
    cleanup_job_temp,
    sanitise_filename,
)
from pdf.batch import batch_merge, PdfBatchError

batch_bp = Blueprint("batch", __name__)
log = logging.getLogger("pdf-swiss-knife.batch")


def _run_batch_job(
    job_id: str,
    repeating_paths: list[Path],
    unique_paths: list[Path],
    output_dir: Path,
):
    """Background worker that runs the batch merge and updates job status."""
    try:
        def on_progress(current: int, total: int, filename: str):
            update_job(
                job_id,
                status="running",
                current=current,
                total=total,
                current_file=filename,
                message=f"Generating {filename} ({current} of {total})",
            )

        result = batch_merge(
            repeating_paths,
            unique_paths,
            output_dir,
            progress_callback=on_progress,
        )

        if result["failed"] > 0 and result["completed"] == 0:
            # All failed — treat as error
            update_job(
                job_id,
                status="error",
                current=result["total"],
                total=result["total"],
                completed=result["completed"],
                failed=result["failed"],
                errors=result["errors"],
                message=f"Batch failed: all {result['total']} files failed to process.",
            )
        else:
            update_job(
                job_id,
                status="done",
                current=result["total"],
                total=result["total"],
                completed=result["completed"],
                failed=result["failed"],
                errors=result["errors"],
                result_path=output_dir,
                message=(
                    f"Batch complete: {result['completed']} of {result['total']} PDFs generated."
                    + (f" {result['failed']} failed." if result["failed"] > 0 else "")
                ),
            )
    except PdfBatchError as e:
        log.warning(f"Batch error in job {job_id}: {e}")
        update_job(job_id, status="error", message=str(e), failed=1)
    except Exception as e:
        log.exception(f"Unexpected error in batch job {job_id}")
        update_job(job_id, status="error", message=f"Unexpected error: {str(e)}", failed=1)
    finally:
        cleanup_job_temp(job_id)


@batch_bp.post("/api/batch/start")
def start_batch():
    """Handle batch PDF build request."""
    repeating_files = request.files.getlist("repeating_files")
    unique_files = request.files.getlist("unique_files")

    if not repeating_files:
        return jsonify({"error": "Please upload at least one repeating PDF."}), 400
    if not unique_files:
        return jsonify({"error": "Please upload at least one unique PDF."}), 400

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    # Save repeating files
    repeating_dir = temp_dir / "repeating"
    repeating_dir.mkdir(exist_ok=True)
    repeating_paths: list[Path] = []
    for idx, uploaded_file in enumerate(repeating_files):
        safe_name = sanitise_filename(uploaded_file.filename or f"repeating_{idx+1}.pdf")
        target_path = repeating_dir / f"{idx:04d}_{safe_name}"
        uploaded_file.save(str(target_path))
        repeating_paths.append(target_path)

    # Save unique files
    unique_dir = temp_dir / "unique"
    unique_dir.mkdir(exist_ok=True)
    unique_paths: list[Path] = []
    for idx, uploaded_file in enumerate(unique_files):
        safe_name = sanitise_filename(uploaded_file.filename or f"unique_{idx+1}.pdf")
        target_path = unique_dir / f"{idx:04d}_{safe_name}"
        uploaded_file.save(str(target_path))
        unique_paths.append(target_path)

    update_job(
        job_id,
        status="pending",
        current=0,
        total=len(unique_paths),
        message=f"Queued: {len(repeating_paths)} repeating × {len(unique_paths)} unique → {len(unique_paths)} output PDFs",
    )

    thread = threading.Thread(
        target=_run_batch_job,
        args=(job_id, repeating_paths, unique_paths, output_dir),
        daemon=True,
    )
    thread.start()

    return jsonify({
        "job_id": job_id,
        "repeating_count": len(repeating_paths),
        "unique_count": len(unique_paths),
        "output_count": len(unique_paths),
    }), 202
