from pathlib import Path
"""
routes/merge.py — PDF Merge API endpoint.

POST /api/merge/run
Accepts multipart/form-data with:
  - files: list of PDF files
  - output_name (optional): desired output file name
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
from pdf.merge import merge_pdfs, PdfMergeError

merge_bp = Blueprint("merge", __name__)
log = logging.getLogger("pdf-swiss-knife.merge")


def _run_merge_job(job_id: str, input_paths: list[Path], output_path: Path):
    """Background worker that performs the merge and updates job status."""
    try:
        def on_progress(current: int, total: int, filename: str):
            update_job(
                job_id,
                status="running",
                current=current,
                total=total,
                current_file=filename,
                message=f"Merging {filename} ({current} of {total})",
            )

        result = merge_pdfs(input_paths, output_path, progress_callback=on_progress)
        update_job(
            job_id,
            status="done",
            current=result["input_count"],
            total=result["input_count"],
            completed=result["input_count"],
            result_path=output_path,
            message=f"Successfully merged {result['input_count']} files ({result['total_pages']} pages).",
        )
    except PdfMergeError as e:
        log.warning(f"Merge error in job {job_id}: {e}")
        update_job(job_id, status="error", message=str(e), failed=1)
    except Exception as e:
        log.exception(f"Unexpected error in merge job {job_id}")
        update_job(job_id, status="error", message=f"Unexpected error: {str(e)}", failed=1)
    finally:
        cleanup_job_temp(job_id)


@merge_bp.post("/api/merge/run")
def run_merge():
    """Handle PDF merge request."""
    files = request.files.getlist("files")
    if not files or len(files) < 2:
        return jsonify({"error": "Please upload at least 2 PDF files to merge."}), 400

    output_name = request.form.get("output_name", "merged.pdf").strip()
    if not output_name:
        output_name = "merged.pdf"
    output_name = sanitise_filename(output_name)
    if not output_name.lower().endswith(".pdf"):
        output_name += ".pdf"

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)
    output_path = output_dir / output_name

    saved_paths: list[Path] = []
    for idx, uploaded_file in enumerate(files):
        safe_name = sanitise_filename(uploaded_file.filename or f"file_{idx+1}.pdf")
        # Prefix with index to ensure ordering is preserved on filesystem
        target_path = temp_dir / f"{idx:04d}_{safe_name}"
        uploaded_file.save(str(target_path))
        saved_paths.append(target_path)

    update_job(
        job_id,
        status="pending",
        current=0,
        total=len(saved_paths),
        message="Queued for merging…",
    )

    thread = threading.Thread(
        target=_run_merge_job,
        args=(job_id, saved_paths, output_path),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "output_name": output_name}), 202
