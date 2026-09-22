"""
app.py — PDF Swiss-Knife Flask backend entry point.

Starts the local HTTP server that:
1. Serves the frontend static files (HTML, CSS, JS)
2. Provides the REST API for all PDF operations

Run with:
    python backend/app.py

Or from the project root:
    python -m backend.app   (not standard — use the former)
"""

import sys
import logging
from pathlib import Path
from flask import Flask, send_from_directory, jsonify

# ─── Path setup ──────────────────────────────────────────────────────────────
# Ensure the backend package is on the Python path when run as a script
sys.path.insert(0, str(Path(__file__).parent))

from config import HOST, PORT, DEBUG, MAX_CONTENT_LENGTH, FRONTEND_DIR
from services.file_manager import ensure_base_dirs
from routes.jobs import jobs_bp
from routes.output import output_bp
from routes.merge import merge_bp
from routes.pages import pages_bp
from routes.batch import batch_bp
from routes.split import split_bp
from routes.convert import convert_bp
from routes.optimize import optimize_bp
from routes.security import security_bp
from routes.edit import edit_bp

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pdf-swiss-knife")

# ─── App factory ──────────────────────────────────────────────────────────────

def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=str(FRONTEND_DIR),
        static_url_path="",
    )

    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    # ── Register route blueprints ──────────────────────────────────────────
    app.register_blueprint(jobs_bp)
    app.register_blueprint(output_bp)
    app.register_blueprint(merge_bp)
    app.register_blueprint(pages_bp)
    app.register_blueprint(batch_bp)
    app.register_blueprint(split_bp)
    app.register_blueprint(convert_bp)
    app.register_blueprint(optimize_bp)
    app.register_blueprint(security_bp)
    app.register_blueprint(edit_bp)

    # ── Frontend static serving ────────────────────────────────────────────
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        """Serve the frontend SPA. All unknown paths return index.html."""
        file_path = FRONTEND_DIR / path
        if path and file_path.exists() and file_path.is_file():
            return send_from_directory(str(FRONTEND_DIR), path)
        return send_from_directory(str(FRONTEND_DIR), "index.html")

    # ── Error handlers ────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "File too large (max 512 MB)"}), 413

    @app.errorhandler(500)
    def internal_error(e):
        log.exception("Internal server error")
        return jsonify({"error": "Internal server error"}), 500

    return app


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ensure_base_dirs()
    log.info("=" * 60)
    log.info("  PDF Swiss-Knife — Local PDF Workspace")
    log.info("=" * 60)
    log.info(f"  Frontend: {FRONTEND_DIR}")
    log.info(f"  Serving:  http://{HOST}:{PORT}")
    log.info("=" * 60)

    app = create_app()
    app.run(host=HOST, port=PORT, debug=DEBUG, threaded=True, use_reloader=False)
