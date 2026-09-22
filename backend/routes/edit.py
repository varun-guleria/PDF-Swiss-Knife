"""
routes/edit.py — PDF editing API endpoints.

POST /api/edit/watermark       — Add watermark
POST /api/edit/page-numbers    — Add page numbers
POST /api/edit/header-footer   — Add header/footer
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
from pdf.edit import add_watermark, add_page_numbers, add_header_footer, crop_pdf, PdfEditError

edit_bp = Blueprint("edit", __name__)
log = logging.getLogger("pdf-swiss-knife.edit")


def _simple_job(job_id, operation_fn, input_path, output_path, done_msg, **kwargs):
    """Generic wrapper for single-file edit operations."""
    try:
        update_job(job_id, status="running", message="Processing…")
        result = operation_fn(input_path, output_path, **kwargs)
        update_job(job_id, status="done", completed=1, total=1, current=1,
                   result_path=output_path.parent,
                   message=done_msg.format(**result))
    except PdfEditError as e:
        update_job(job_id, status="error", message=str(e))
    except Exception as e:
        log.exception(f"Edit error in job {job_id}: {e}")
        update_job(job_id, status="error", message=f"Unexpected error: {e}")
    finally:
        cleanup_job_temp(job_id)


def _setup_job(prefix):
    """Common setup for edit routes: save uploaded file, create dirs."""
    files = request.files.getlist("file")
    if not files:
        return None, None, None, None, (jsonify({"error": "Please upload a PDF file."}), 400)

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))
    output_path = output_dir / f"{prefix}_{safe_name}"

    return job_id, input_path, output_path, output_dir, None


@edit_bp.post("/api/edit/watermark")
def run_watermark():
    job_id, input_path, output_path, output_dir, err = _setup_job("watermarked")
    if err:
        return err

    text = request.form.get("text", "DRAFT")
    try:
        opacity = float(request.form.get("opacity", "0.15"))
    except ValueError:
        opacity = 0.15
    try:
        font_size = int(request.form.get("font_size", "60"))
    except ValueError:
        font_size = 60
    color = request.form.get("color", "#888888")
    try:
        rotation = int(request.form.get("rotation", "45"))
    except ValueError:
        rotation = 45

    update_job(job_id, status="pending", message="Queued for watermarking…")
    threading.Thread(target=_simple_job, daemon=True,
                     args=(job_id, add_watermark, input_path, output_path,
                           "Watermark applied to {total_pages} pages."),
                     kwargs=dict(text=text, opacity=opacity, font_size=font_size,
                                 color=color, rotation=rotation)).start()
    return jsonify({"job_id": job_id}), 202


@edit_bp.post("/api/edit/page-numbers")
def run_page_numbers():
    job_id, input_path, output_path, output_dir, err = _setup_job("numbered")
    if err:
        return err

    position = request.form.get("position", "bottom-center")
    try:
        start_number = int(request.form.get("start_number", "1"))
    except ValueError:
        start_number = 1
    try:
        font_size = int(request.form.get("font_size", "11"))
    except ValueError:
        font_size = 11
    fmt = request.form.get("format", "{n}")

    update_job(job_id, status="pending", message="Queued for page numbering…")
    threading.Thread(target=_simple_job, daemon=True,
                     args=(job_id, add_page_numbers, input_path, output_path,
                           "Page numbers added to {total_pages} pages."),
                     kwargs=dict(position=position, start_number=start_number,
                                 font_size=font_size, fmt=fmt)).start()
    return jsonify({"job_id": job_id}), 202


@edit_bp.post("/api/edit/header-footer")
def run_header_footer():
    job_id, input_path, output_path, output_dir, err = _setup_job("headerfooter")
    if err:
        return err

    try:
        font_size = int(request.form.get("font_size", "9"))
    except ValueError:
        font_size = 9

    kwargs = {
        "header_left": request.form.get("header_left", ""),
        "header_center": request.form.get("header_center", ""),
        "header_right": request.form.get("header_right", ""),
        "footer_left": request.form.get("footer_left", ""),
        "footer_center": request.form.get("footer_center", ""),
        "footer_right": request.form.get("footer_right", ""),
        "font_size": font_size,
    }

    update_job(job_id, status="pending", message="Queued for header/footer…")
    threading.Thread(target=_simple_job, daemon=True,
                     args=(job_id, add_header_footer, input_path, output_path,
                           "Header/footer added to {total_pages} pages."),
                     kwargs=kwargs).start()
    return jsonify({"job_id": job_id}), 202


@edit_bp.post("/api/edit/crop")
def run_crop():
    job_id, input_path, output_path, output_dir, err = _setup_job("cropped")
    if err:
        return err

    try:
        top = float(request.form.get("top", "0"))
        bottom = float(request.form.get("bottom", "0"))
        left = float(request.form.get("left", "0"))
        right = float(request.form.get("right", "0"))
    except ValueError:
        return jsonify({"error": "Invalid margin values."}), 400

    unit = request.form.get("unit", "pt").lower()
    if unit not in ("pt", "in", "mm", "%"):
        unit = "pt"

    update_job(job_id, status="pending", message="Queued for cropping…")
    threading.Thread(target=_simple_job, daemon=True,
                     args=(job_id, crop_pdf, input_path, output_path,
                           "Cropped margins on {total_pages} pages."),
                     kwargs=dict(top=top, bottom=bottom, left=left, right=right, unit=unit)).start()
    return jsonify({"job_id": job_id}), 202
