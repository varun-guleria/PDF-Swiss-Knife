from pathlib import Path
"""
routes/pages.py — Page organization routes.

POST /api/pages/inspect                       → upload & inspect PDF pages
GET  /api/pages/<doc_id>/thumbnail/<page_idx> → fetch page thumbnail JPEG
POST /api/pages/reorganize                    → submit page reorganization job
"""

import json
import threading
import logging

from flask import Blueprint, request, jsonify, send_file, abort

from services.job_manager import create_job, update_job
from services.file_manager import (
    create_job_temp_dir,
    create_job_output_dir,
    get_job_temp_dir,
    sanitise_filename,
)
from pdf.pages import (
    get_pdf_pages_info,
    render_page_thumbnail,
    reorganize_pdf,
    PdfPageError,
)

pages_bp = Blueprint("pages", __name__)
log = logging.getLogger("pdf-swiss-knife.pages")


@pages_bp.post("/api/pages/inspect")
def inspect_document():
    """Upload a PDF document for page inspection and thumbnail generation."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    uploaded_file = request.files["file"]
    filename = uploaded_file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        return jsonify({"error": "Uploaded file must be a PDF."}), 400

    # Create temporary doc storage
    doc_id = create_job()  # Using UUID
    temp_dir = create_job_temp_dir(doc_id)
    source_path = temp_dir / "source.pdf"
    uploaded_file.save(str(source_path))

    try:
        info = get_pdf_pages_info(source_path)
        info["doc_id"] = doc_id
        info["filename"] = filename
        return jsonify(info)
    except PdfPageError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        log.exception("Error inspecting PDF")
        return jsonify({"error": f"Failed to inspect PDF: {str(e)}"}), 500


@pages_bp.get("/api/pages/<doc_id>/thumbnail/<int:page_index>")
def get_thumbnail(doc_id: str, page_index: int):
    """Retrieve or generate a JPEG preview thumbnail for a specific page."""
    temp_dir = get_job_temp_dir(doc_id)
    source_path = temp_dir / "source.pdf"
    if not source_path.exists():
        abort(404)

    thumb_cache = temp_dir / f"thumb_{page_index}.jpg"
    if thumb_cache.exists():
        return send_file(thumb_cache, mimetype="image/jpeg")

    try:
        thumb_bytes = render_page_thumbnail(source_path, page_index)
        with open(thumb_cache, "wb") as f_out:
            f_out.write(thumb_bytes)
        return send_file(thumb_cache, mimetype="image/jpeg")
    except PdfPageError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        log.exception(f"Error rendering thumbnail for doc {doc_id} page {page_index}")
        return jsonify({"error": "Failed to render thumbnail"}), 500


def _run_reorganize_job(job_id: str, input_path: Path, output_path: Path, page_specs: list):
    """Worker thread that executes the page reorganization."""
    try:
        update_job(
            job_id,
            status="running",
            current=0,
            total=len(page_specs),
            message="Reorganizing pages…",
        )
        result = reorganize_pdf(input_path, output_path, page_specs)
        update_job(
            job_id,
            status="done",
            current=result["total_pages"],
            total=result["total_pages"],
            completed=result["total_pages"],
            result_path=output_path,
            message=f"Reorganization complete: {result['total_pages']} pages saved.",
        )
    except PdfPageError as e:
        log.warning(f"Reorganization error in job {job_id}: {e}")
        update_job(job_id, status="error", message=str(e), failed=1)
    except Exception as e:
        log.exception(f"Unexpected error in reorganize job {job_id}")
        update_job(job_id, status="error", message=f"Unexpected error: {str(e)}", failed=1)


@pages_bp.post("/api/pages/reorganize")
def run_reorganize():
    """Submit a page reorganization job."""
    data = request.get_json(silent=True) or request.form
    doc_id = data.get("doc_id")
    page_specs = data.get("page_specs")
    output_name = data.get("output_name", "organized_document.pdf")

    if not doc_id:
        return jsonify({"error": "doc_id is required."}), 400

    if isinstance(page_specs, str):
        try:
            page_specs = json.loads(page_specs)
        except Exception:
            return jsonify({"error": "Invalid page_specs JSON format."}), 400

    if not page_specs or not isinstance(page_specs, list):
        return jsonify({"error": "page_specs must be a non-empty list."}), 400

    temp_dir = get_job_temp_dir(doc_id)
    source_path = temp_dir / "source.pdf"
    if not source_path.exists():
        return jsonify({"error": "Source document session expired or not found."}), 404

    output_name = sanitise_filename(output_name)
    if not output_name.lower().endswith(".pdf"):
        output_name += ".pdf"

    job_id = create_job()
    output_dir = create_job_output_dir(job_id)
    output_path = output_dir / output_name

    update_job(
        job_id,
        status="pending",
        current=0,
        total=len(page_specs),
        message="Queued for reorganization…",
    )

    thread = threading.Thread(
        target=_run_reorganize_job,
        args=(job_id, source_path, output_path, page_specs),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "output_name": output_name}), 202
