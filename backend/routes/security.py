"""
routes/security.py — PDF protection API endpoints.

POST /api/security/protect    — Add password protection
POST /api/security/unprotect  — Remove password protection
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
from pdf.security import protect_pdf, unprotect_pdf, PdfSecurityError

security_bp = Blueprint("security", __name__)
log = logging.getLogger("pdf-swiss-knife.security")


@security_bp.post("/api/security/protect")
def run_protect():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    user_password = request.form.get("user_password", "")
    owner_password = request.form.get("owner_password", "")
    allow_printing = request.form.get("allow_printing", "true").lower() == "true"
    allow_copying = request.form.get("allow_copying", "false").lower() == "true"

    if not user_password and not owner_password:
        return jsonify({"error": "At least one password is required."}), 400

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))
    output_path = output_dir / f"protected_{safe_name}"

    def worker():
        try:
            update_job(job_id, status="running", message="Encrypting PDF…")
            result = protect_pdf(input_path, output_path,
                                 user_password=user_password,
                                 owner_password=owner_password,
                                 allow_printing=allow_printing,
                                 allow_copying=allow_copying)
            update_job(job_id, status="done", completed=1, total=1, current=1,
                       result_path=output_dir,
                       message=f"PDF protected. {result['total_pages']} pages.")
        except PdfSecurityError as e:
            update_job(job_id, status="error", message=str(e))
        except Exception as e:
            log.exception(f"Protect error: {e}")
            update_job(job_id, status="error", message=f"Unexpected error: {e}")
        finally:
            cleanup_job_temp(job_id)

    update_job(job_id, status="pending", message="Queued for encryption…")
    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id}), 202


@security_bp.post("/api/security/unprotect")
def run_unprotect():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    password = request.form.get("password", "")

    job_id = create_job()
    temp_dir = create_job_temp_dir(job_id)
    output_dir = create_job_output_dir(job_id)

    safe_name = sanitise_filename(files[0].filename or "document.pdf")
    input_path = temp_dir / safe_name
    files[0].save(str(input_path))
    output_path = output_dir / f"unprotected_{safe_name}"

    def worker():
        try:
            update_job(job_id, status="running", message="Removing protection…")
            result = unprotect_pdf(input_path, output_path, password=password)
            update_job(job_id, status="done", completed=1, total=1, current=1,
                       result_path=output_dir,
                       message=f"Protection removed. {result['total_pages']} pages.")
        except PdfSecurityError as e:
            update_job(job_id, status="error", message=str(e))
        except Exception as e:
            log.exception(f"Unprotect error: {e}")
            update_job(job_id, status="error", message=f"Unexpected error: {e}")
        finally:
            cleanup_job_temp(job_id)

    update_job(job_id, status="pending", message="Queued for decryption…")
    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id}), 202
