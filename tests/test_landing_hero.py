"""
tests/test_landing_hero.py — Verification tests for Milestone 8 (Landing Page Hero Scroll Animation).

Verifies:
1. Landing page loads correctly at GET /.
2. Video and poster assets are served with HTTP 200.
3. Hero typography matches exact required text.
4. Scroll scrubbing engine (requestAnimationFrame, reverse scrubbing, reduced motion) in landing.js.
5. Landing page CSS (sticky hero, 250vh track, localized readability, responsive rules, themes).
6. Routing integration between landing page and app workspace.
"""

import sys
import os
import json
import pytest
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app import create_app

WORKSPACE = Path(__file__).parent.parent
FRONTEND_DIR = WORKSPACE / "frontend"

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_01_landing_page_loads(client):
    """Verify landing page loads with HTML5 semantic containers."""
    res = client.get("/")
    assert res.status_code == 200
    html = res.data.decode("utf-8")
    assert '<div id="landing-page"' in html
    assert '<div id="app"' in html
    assert '<nav class="landing-nav"' in html
    assert '<section id="hero-track"' in html
    assert '<div class="hero-stage">' in html
    assert '<video' in html
    assert 'id="hero-video"' in html
    assert 'id="hero-open-app-btn"' in html
    assert '<footer class="landing-footer">' in html

def test_02_hero_video_assets(client):
    """Verify the supplied MP4 video and poster frame are served."""
    video_res = client.get("/assets/hero-animation.mp4")
    assert video_res.status_code == 200
    assert video_res.headers.get("Content-Type") == "video/mp4"
    assert len(video_res.data) > 1000000  # ~1.14 MB

    poster_res = client.get("/assets/hero-poster.jpg")
    assert poster_res.status_code == 200
    assert poster_res.headers.get("Content-Type") == "image/jpeg"
    assert len(poster_res.data) > 5000

def test_03_hero_typography(client):
    """Verify hero text strictly matches requirements."""
    res = client.get("/")
    html = res.data.decode("utf-8")
    assert "PDF Swiss-Knife" in html
    assert "One workspace." in html
    assert "Every PDF task." in html
    assert "A local, all-in-one PDF workspace for merging, editing, organizing, converting and creating documents." in html
    assert "Open PDF Swiss-Knife" in html

def test_04_landing_js_scrubbing_engine():
    """Verify landing.js implements rAF scrubbing, reverse scrolling, and reduced motion."""
    landing_js_path = FRONTEND_DIR / "js" / "landing.js"
    assert landing_js_path.exists()
    content = landing_js_path.read_text(encoding="utf-8")

    assert "export function initLandingPage" in content
    assert "requestAnimationFrame" in content
    assert "getBoundingClientRect" in content
    assert "prefers-reduced-motion" in content
    assert "calculateProgress" in content
    assert "applyVideoTime" in content
    assert "fastSeek" in content
    assert "hero-open-app-btn" in content

def test_05_landing_css_rules():
    """Verify landing.css implements pinned stage, 250vh track, localized scrim, and themes."""
    css_path = FRONTEND_DIR / "css" / "landing.css"
    assert css_path.exists()
    content = css_path.read_text(encoding="utf-8")

    assert ".hero-track" in content
    assert "250vh" in content
    assert ".hero-stage" in content
    assert "position: sticky" in content
    assert "height: 100vh" in content
    assert ".hero-readability-scrim" in content
    assert "radial-gradient" in content
    assert '[data-theme="dark"]' in content
    assert "@media (max-width: 960px)" in content
    assert "@media (max-width: 640px)" in content
    assert "@media (prefers-reduced-motion: reduce)" in content

def test_06_app_routing_integration():
    """Verify app.js integrates landing view and app view routing."""
    app_js_path = FRONTEND_DIR / "js" / "app.js"
    content = app_js_path.read_text(encoding="utf-8")

    assert "import { initLandingPage } from './landing.js';" in content
    assert "showLandingView" in content
    assert "showAppView" in content
    assert "handleRoute" in content
    assert "topbar-landing-btn" in content
    assert "window.addEventListener('hashchange', handleRoute);" in content
