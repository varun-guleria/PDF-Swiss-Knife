"""
test_landing_hero.py — Tests for the full-screen landing page hero.

Verifies:
- Hero HTML markup and video element in index.html
- Hero animation asset files (MP4 and poster JPG)
- landing.js autoplay controller module
- landing.css full-screen hero layout
- app.js landing/workspace routing integration
"""

from pathlib import Path
import re

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


def test_01_hero_html_structure():
    """Verify index.html has hero track, video element, poster, typography, and CTA."""
    html_path = FRONTEND_DIR / "index.html"
    content = html_path.read_text(encoding="utf-8")

    assert 'id="hero-track"' in content
    assert 'id="hero-video"' in content
    assert 'hero-animation.mp4' in content
    assert 'hero-poster.jpg' in content
    assert 'class="hero-headline"' in content
    assert 'class="hero-subhead"' in content
    assert 'id="hero-open-app-btn"' in content
    assert 'class="hero-eyebrow"' in content


def test_02_hero_video_asset_exists():
    """Verify hero-animation.mp4 exists and is non-trivial."""
    mp4 = FRONTEND_DIR / "assets" / "hero-animation.mp4"
    assert mp4.exists(), "hero-animation.mp4 not found"
    assert mp4.stat().st_size > 50_000, "MP4 too small — likely corrupt"


def test_03_hero_poster_asset_exists():
    """Verify hero-poster.jpg exists and is non-trivial."""
    poster = FRONTEND_DIR / "assets" / "hero-poster.jpg"
    assert poster.exists(), "hero-poster.jpg not found"
    assert poster.stat().st_size > 1_000, "Poster too small"


def test_04_landing_js_autoplay():
    """Verify landing.js implements autoplay video controller."""
    js_path = FRONTEND_DIR / "js" / "landing.js"
    assert js_path.exists()
    content = js_path.read_text(encoding="utf-8")

    assert "export function initLandingPage" in content
    assert "heroVideo.play()" in content or ".play()" in content
    assert "heroVideo.loop = false" in content
    assert "prefers-reduced-motion" in content
    assert "hero-open-app-btn" in content


def test_05_landing_css_rules():
    """Verify landing.css implements full-screen hero with no scroll."""
    css_path = FRONTEND_DIR / "css" / "landing.css"
    assert css_path.exists()
    content = css_path.read_text(encoding="utf-8")

    assert ".hero-track" in content
    assert ".hero-stage" in content
    assert "100vh" in content
    assert "overflow: hidden" in content
    assert "object-fit: cover" in content
    assert ".hero-readability-scrim" in content
    assert '@media (prefers-reduced-motion: reduce)' in content
    assert "@media (max-width: 640px)" in content


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
