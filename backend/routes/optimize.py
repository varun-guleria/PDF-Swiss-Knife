"""
routes/optimize.py — PDF optimization, repair, and information API endpoints.

POST /api/optimize/compress  — Compress PDF
POST /api/optimize/repair    — Repair/normalize PDF
POST /api/optimize/info      — Get PDF information
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
from pdf.optimize import compress_pdf, repair_pdf, get_pdf_info, PdfOptimizeError

optimize_bp = Blueprint("optimize", __name__)
log = logging.getLogger("pdf-swiss-knife.optimize")


@optimize_bp.post("/api/optimize/compress")
def run_compress():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))
    output_path = output_dir / f"compressed_{safe_name}"

    def worker():
        try:
            update_job(job_id, status="running", message="Compressing PDF…")
            result = compress_pdf(input_path, output_path)
            update_job(job_id, status="done", completed=1, total=1, current=1,
                       result_path=output_dir,
                       message=f"Compressed: {result['savings_percent']}% smaller "
                               f"({result['original_size']} → {result['compressed_size']} bytes)")
        except PdfOptimizeError as e:
            update_job(job_id, status="error", message=str(e))
        except Exception as e:
            log.exception(f"Compress error: {e}")
            update_job(job_id, status="error", message=f"Unexpected error: {e}")
        finally:
            cleanup_job_temp(job_id)

    update_job(job_id, status="pending", message="Queued for compression…")
    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id}), 202


@optimize_bp.post("/api/optimize/repair")
def run_repair():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))
    output_path = output_dir / f"repaired_{safe_name}"

    def worker():
        try:
            update_job(job_id, status="running", message="Repairing PDF…")
            result = repair_pdf(input_path, output_path)
            update_job(job_id, status="done", completed=1, total=1, current=1,
                       result_path=output_dir,
                       message=f"Repaired successfully. {result['total_pages']} pages.")
        except PdfOptimizeError as e:
            update_job(job_id, status="error", message=str(e))
        except Exception as e:
            log.exception(f"Repair error: {e}")
            update_job(job_id, status="error", message=f"Unexpected error: {e}")
        finally:
            cleanup_job_temp(job_id)

    update_job(job_id, status="pending", message="Queued for repair…")
    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id}), 202


@optimize_bp.post("/api/optimize/info")
def run_info():
    """Extract PDF information — synchronous (fast operation)."""
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))

    try:
        info = get_pdf_info(input_path)
        cleanup_job_temp(job_id)
        return jsonify(info)
    except PdfOptimizeError as e:
        cleanup_job_temp(job_id)
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        cleanup_job_temp(job_id)
        return jsonify({"error": f"Unexpected error: {e}"}), 500
