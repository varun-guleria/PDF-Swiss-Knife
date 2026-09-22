"""
run.py — Application launcher for PDF Swiss-Knife.

Usage:
    python run.py

This script:
1. Verifies Python version and dependencies
2. Detects if server is already running (auto-opens browser)
3. Launches the local Flask backend
4. Automatically opens the app in your default browser
"""

import sys
import time
import os
import socket
import threading
import webbrowser
import urllib.request
import json
from pathlib import Path

# Ensure root workspace and backend directories are in sys.path
ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(BACKEND_DIR))


def check_python_version():
    """Ensure Python is 3.10 or higher."""
    if sys.version_info < (3, 10):
        print("\n[ERROR] PDF Swiss-Knife requires Python 3.10 or higher.")
        print(f"Current version: {sys.version.split()[0]}\n")
        sys.exit(1)


def check_dependencies():
    """Verify required packages are installed."""
    missing = []
    required = ["flask", "pypdf", "pikepdf", "pypdfium2", "PIL", "img2pdf", "reportlab", "cryptography"]
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print("\n[INFO] Missing dependencies detected:", ", ".join(missing))
        print("Installing dependencies from requirements.txt...")
        import subprocess
        res = subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(ROOT_DIR / "requirements.txt")])
        if res.returncode != 0:
            print("\n[ERROR] Failed to install dependencies. Please run:")
            print(f"    pip install -r \"{ROOT_DIR / 'requirements.txt'}\"\n")
            sys.exit(1)
        print("[SUCCESS] Dependencies installed successfully.\n")


def is_port_in_use(host: str, port: int) -> bool:
    """Check if a network port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def is_app_already_running(url: str) -> bool:
    """Check if PDF Swiss-Knife is already responding at the given URL."""
    try:
        req = urllib.request.Request(f"{url}/api/health", headers={"User-Agent": "PDFSwissKnifeLauncher"})
        with urllib.request.urlopen(req, timeout=1.0) as res:
            if res.status == 200:
                data = json.loads(res.read().decode())
                return data.get("service") == "PDF Swiss-Knife"
    except Exception:
        pass
    return False


def open_browser(url: str, delay: float = 1.0):
    """Open default web browser after server starts."""
    def _open():
        time.sleep(delay)
        webbrowser.open(url)

    thread = threading.Thread(target=_open, daemon=True)
    thread.start()


def main():
    check_python_version()
    check_dependencies()

    from config import HOST, PORT, FRONTEND_DIR
    from services.file_manager import ensure_base_dirs
    from app import create_app

    ensure_base_dirs()
    url = f"http://{HOST}:{PORT}"

    # Check if the server is already running
    if is_port_in_use(HOST, PORT):
        if is_app_already_running(url):
            print("=" * 64)
            print("      PDF Swiss-Knife is already running!")
            print("=" * 64)
            print(f"  • URL: {url}")
            print("=" * 64)
            print("  Opening browser to existing instance…\n")
            webbrowser.open(url)
            sys.exit(0)
        else:
            print(f"\n[ERROR] Port {PORT} is already in use by another application.")
            print(f"Please close the application using port {PORT} or change PORT in backend/config.py.\n")
            sys.exit(1)

    print("=" * 64)
    print("      PDF Swiss-Knife — Local PDF Workspace")
    print("=" * 64)
    print(f"  • Frontend:  {FRONTEND_DIR}")
    print(f"  • Workspace: {ROOT_DIR}")
    print(f"  • URL:       {url}")
    print("=" * 64)
    print("  Opening browser… Press Ctrl+C in this terminal to stop.")
    print("=" * 64 + "\n")

    # Automatically launch user's browser
    open_browser(url)

    app = create_app()
    try:
        app.run(host=HOST, port=PORT, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n[INFO] PDF Swiss-Knife stopped.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
