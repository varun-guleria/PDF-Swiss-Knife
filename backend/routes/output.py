"""
routes/output.py — Serving generated output files for download.

GET /api/output/<job_id>/download         → download single output file
GET /api/output/<job_id>/zip              → download all output files as ZIP
GET /api/output/<job_id>/list             → list output files for a job
"""

import zipfile
import io
from pathlib import Path
from flask import Blueprint, jsonify, send_file, abort

from services.file_manager import get_job_output_dir

output_bp = Blueprint("output", __name__)


@output_bp.get("/api/output/<job_id>/list")
def list_outputs(job_id: str):
    """List output files available for a job."""
    out_dir = get_job_output_dir(job_id)
    if not out_dir.exists():
        return jsonify({"files": []})

    files = []
    for f in sorted(out_dir.iterdir()):
        if f.is_file() and not f.name.startswith("."):
            files.append({
                "name": f.name,
                "size": f.stat().st_size,
            })
    return jsonify({"files": files})


@output_bp.get("/api/output/<job_id>/download")
@output_bp.get("/api/output/<job_id>/download/<filename>")
def download_file(job_id: str, filename: str = None):
    """Download a single output file. If filename is not given, downloads the first output file."""
    out_dir = get_job_output_dir(job_id)
    if not out_dir.exists():
        abort(404)

    if filename is None:
        files = [f for f in sorted(out_dir.iterdir()) if f.is_file() and not f.name.startswith(".")]
        if not files:
            abort(404)
        file_path = files[0]
        filename = file_path.name
    else:
        file_path = (out_dir / filename).resolve()
        # Security: ensure the resolved path is within the output directory
        try:
            file_path.relative_to(out_dir.resolve())
        except ValueError:
            abort(403)

    if not file_path.exists() or not file_path.is_file():
        abort(404)

    return send_file(file_path, as_attachment=True, download_name=filename)


@output_bp.get("/api/output/<job_id>/zip")
def download_zip(job_id: str):
    """Bundle all output files for a job into a ZIP and stream it."""
    out_dir = get_job_output_dir(job_id)
    if not out_dir.exists():
        abort(404)

    files = [f for f in sorted(out_dir.iterdir()) if f.is_file()]
    if not files:
        return jsonify({"error": "No output files found"}), 404

    # Build ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.write(f, arcname=f.name)
    buf.seek(0)

    zip_name = f"pdf_swiss_knife_{job_id[:8]}.zip"
    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=zip_name,
    )
