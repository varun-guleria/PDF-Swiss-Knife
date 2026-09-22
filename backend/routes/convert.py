"""
routes/convert.py — PDF ↔ Image conversion API endpoints.

POST /api/convert/to-images   — PDF → Images
POST /api/convert/to-pdf      — Images → PDF
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
from pdf.convert import pdf_to_images, images_to_pdf, PdfConvertError

convert_bp = Blueprint("convert", __name__)
log = logging.getLogger("pdf-swiss-knife.convert")


def _run_to_images_job(job_id, input_path, output_dir, fmt, dpi):
    try:
        def on_progress(current, total, filename):
            update_job(job_id, status="running", current=current, total=total,
                       current_file=filename, message=f"Rendering page {current}/{total}")

        result = pdf_to_images(input_path, output_dir, fmt=fmt, dpi=dpi,
                               progress_callback=on_progress)

        update_job(job_id, status="done", current=result["total"], total=result["total"],
                   completed=result["total"], result_path=output_dir,
                   message=f"Exported {result['total']} page images.")
    except PdfConvertError as e:
        update_job(job_id, status="error", message=str(e), failed=1)
    except Exception as e:
        log.exception(f"Unexpected error in to-images job {job_id}")
        update_job(job_id, status="error", message=f"Unexpected error: {e}", failed=1)
    finally:
        cleanup_job_temp(job_id)


@convert_bp.post("/api/convert/to-images")
def run_to_images():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    fmt = request.form.get("format", "png")
    try:
        dpi = int(request.form.get("dpi", "150"))
    except ValueError:
        dpi = 150

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))

    update_job(job_id, status="pending", message="Queued for image conversion…")

    thread = threading.Thread(target=_run_to_images_job,
                              args=(job_id, input_path, output_dir, fmt, dpi), daemon=True)
    thread.start()
    return jsonify({"job_id": job_id, "format": fmt, "dpi": dpi}), 202


def _run_to_pdf_job(job_id, input_paths, output_path):
    try:
        def on_progress(current, total, filename):
            update_job(job_id, status="running", current=current, total=total,
                       current_file=filename, message=f"Processing {filename} ({current}/{total})")

        result = images_to_pdf(input_paths, output_path, progress_callback=on_progress)

        update_job(job_id, status="done", current=result["total_pages"],
                   total=result["total_pages"], completed=result["total_pages"],
                   result_path=output_path.parent,
                   message=f"Created PDF with {result['total_pages']} pages.")
    except PdfConvertError as e:
        update_job(job_id, status="error", message=str(e), failed=1)
    except Exception as e:
        log.exception(f"Unexpected error in to-pdf job {job_id}")
        update_job(job_id, status="error", message=f"Unexpected error: {e}", failed=1)
    finally:
        cleanup_job_temp(job_id)


@convert_bp.post("/api/convert/to-pdf")
def run_to_pdf():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "Please upload at least one image."}), 400

    output_name = request.form.get("output_name", "images_combined.pdf")
    output_name = sanitise_filename(output_name)
    if not output_name.lower().endswith(".pdf"):
        output_name += ".pdf"

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)
    output_path = output_dir / output_name

    saved_paths = []
    for idx, uploaded in enumerate(files):
        safe_name = sanitise_filename(uploaded.filename or f"image_{idx+1}")
        target = temp_dir / f"{idx:04d}_{safe_name}"
        uploaded.save(str(target))
        saved_paths.append(target)

    update_job(job_id, status="pending", message="Queued for PDF creation…")

    thread = threading.Thread(target=_run_to_pdf_job,
                              args=(job_id, saved_paths, output_path), daemon=True)
    thread.start()
    return jsonify({"job_id": job_id, "output_name": output_name}), 202
