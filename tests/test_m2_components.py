"""
test_m2_components.py — Verification of Milestone 2 (Design system & reusable components).
"""

import pytest
import sys
from pathlib import Path

backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_components_js_served(client):
    """Verify all reusable frontend components are served properly."""
    components = [
        "components/dropzone.js",
        "components/fileRow.js",
        "components/progress.js",
        "components/dialog.js",
    ]
    for comp in components:
        res = client.get(f"/js/{comp}")
        assert res.status_code == 200, f"Failed to serve /js/{comp}"
        assert len(res.data) > 0
        assert b"export " in res.data


def test_theme_tokens_present(client):
    """Verify light and dark theme definitions exist in tokens.css."""
    res = client.get("/css/tokens.css")
    assert res.status_code == 200
    css = res.data.decode("utf-8")
    assert "[data-theme=\"light\"]" in css or ":root" in css
    assert "[data-theme=\"dark\"]" in css
    assert "--color-bg-app" in css
    assert "--color-brand" in css
    assert "--color-border" in css
