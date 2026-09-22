"""
routes/split.py — PDF Split API endpoint.

POST /api/split/run
Accepts multipart/form-data with:
  - file: single PDF file
  - mode: 'ranges' | 'every_n' | 'singles'
  - ranges: page range string (when mode='ranges')
  - n: number of pages per chunk (when mode='every_n')
"""

import threading
import logging
from pathlib import Path
from flask import Blueprint, request, jsonify

from services.job_manager import create_job, update_job
from services.file_manager import (
    create_job_temp_dir,
    create_job_output_dir,
    cleanup_job_temp,
    sanitise_filename,
)
from pdf.split import split_by_ranges, split_every_n, split_into_singles, PdfSplitError

split_bp = Blueprint("split", __name__)
log = logging.getLogger("pdf-swiss-knife.split")


def _run_split_job(job_id, input_path, mode, output_dir, **kwargs):
    try:
        def on_progress(current, total, filename):
            update_job(job_id, status="running", current=current, total=total,
                       current_file=filename, message=f"Splitting: {filename} ({current}/{total})")

        if mode == "ranges":
            result = split_by_ranges(input_path, kwargs["ranges"], output_dir, on_progress)
        elif mode == "every_n":
            result = split_every_n(input_path, kwargs["n"], output_dir, on_progress)
        else:
            result = split_into_singles(input_path, output_dir, on_progress)

        update_job(job_id, status="done", current=result["total"], total=result["total"],
                   completed=result["total"], result_path=output_dir,
                   message=f"Split into {result['total']} files.")
    except PdfSplitError as e:
        log.warning(f"Split error in job {job_id}: {e}")
        update_job(job_id, status="error", message=str(e), failed=1)
    except Exception as e:
        log.exception(f"Unexpected error in split job {job_id}")
        update_job(job_id, status="error", message=f"Unexpected error: {e}", failed=1)
    finally:
        cleanup_job_temp(job_id)


@split_bp.post("/api/split/run")
def run_split():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400
    uploaded = files[0]

    mode = request.form.get("mode", "singles")
    if mode not in ("ranges", "every_n", "singles"):
        return jsonify({"error": f"Invalid split mode: {mode}"}), 400

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(uploaded.filename or "document.pdf")
    input_path = temp_dir / safe_name
    uploaded.save(str(input_path))

    extra = {}
    if mode == "ranges":
        extra["ranges"] = request.form.get("ranges", "")
        if not extra["ranges"]:
            return jsonify({"error": "Page ranges are required."}), 400
    elif mode == "every_n":
        try:
            extra["n"] = int(request.form.get("n", "1"))
        except ValueError:
            return jsonify({"error": "Invalid page count."}), 400

    update_job(job_id, status="pending", current=0, total=0, message="Queued for splitting…")

    thread = threading.Thread(target=_run_split_job,
                              args=(job_id, input_path, mode, output_dir),
                              kwargs=extra, daemon=True)
    thread.start()
    return jsonify({"job_id": job_id, "mode": mode}), 202
