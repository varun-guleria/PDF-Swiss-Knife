"""
test_m1_shell.py — Verification tests for Milestone 1 (App Shell & Infrastructure).
"""

import pytest
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app import create_app
from services.job_manager import create_job, get_job, update_job, delete_job
from services.file_manager import sanitise_filename, create_job_temp_dir, cleanup_job_temp


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_check(client):
    """Test that the /api/health endpoint returns 200 and status 'ok'."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "PDF Swiss-Knife"


def test_frontend_index_served(client):
    """Test that GET / serves index.html."""
    res = client.get("/")
    assert res.status_code == 200
    assert b"<!DOCTYPE html>" in res.data
    assert b"PDF Swiss-Knife" in res.data
    assert b'id="app"' in res.data


def test_static_css_served(client):
    """Verify all core CSS design system files are served."""
    css_files = ["tokens.css", "base.css", "layout.css", "components.css", "tools.css", "landing.css"]
    for css in css_files:
        res = client.get(f"/css/{css}")
        assert res.status_code == 200, f"Failed to serve /css/{css}"
        assert len(res.data) > 0


def test_static_js_served(client):
    """Verify all core JS modules are served."""
    js_files = ["app.js", "api.js", "utils.js", "tools/home.js"]
    for js in js_files:
        res = client.get(f"/js/{js}")
        assert res.status_code == 200, f"Failed to serve /js/{js}"
        assert len(res.data) > 0


def test_job_manager_flow():
    """Verify job lifecycle in job_manager."""
    job_id = create_job()
    assert job_id is not None
    job = get_job(job_id)
    assert job.status == "pending"

    update_job(job_id, status="running", current=1, total=5, message="Processing page 1")
    job = get_job(job_id)
    assert job.status == "running"
    assert job.current == 1
    assert job.total == 5

    delete_job(job_id)
    assert get_job(job_id) is None


def test_job_status_api(client):
    """Verify GET /api/jobs/<job_id>/status."""
    # 404 for nonexistent job
    res = client.get("/api/jobs/nonexistent-id/status")
    assert res.status_code == 404

    # Valid job
    job_id = create_job()
    update_job(job_id, status="done", message="Finished")
    res = client.get(f"/api/jobs/{job_id}/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["job_id"] == job_id
    assert data["status"] == "done"
    delete_job(job_id)


def test_sanitise_filename():
    """Verify illegal Windows characters and path traversals are stripped."""
    assert sanitise_filename("normal_file.pdf") == "normal_file.pdf"
    assert sanitise_filename("bad:file*name?.pdf") == "bad_file_name_.pdf"
    assert sanitise_filename("../../../secret.pdf") == "secret.pdf"
    assert sanitise_filename("") == "file"
