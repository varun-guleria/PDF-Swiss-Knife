# PDF Swiss-Knife — Local PDF Workspace

A polished, local-first PDF manipulation workspace.  
All processing happens on your machine — no cloud uploads, no third-party services.

---

## What it does

| Category | Tools |
|---|---|
| **Organise** | Merge PDFs, Split PDF, Organise Pages, Extract Pages |
| **Edit** | Rotate, Crop, Watermark, Page Numbers, Header & Footer |
| **Convert** | PDF → Images, Images → PDF |
| **Optimise** | Compress, Repair/Normalize, PDF Information |
| **Security** | Protect PDF (password), Remove Protection |
| **Advanced** | **Custom Batch PDF Builder** |

### Custom Batch PDF Builder

The distinctive feature: generate one merged PDF per unique file.

Example: 3 repeating PDFs (cover, instructions, terms) + 100 unique PDFs (student reports)  
→ 100 output PDFs, each containing the 3 repeating pages + one student report.

The number of repeating PDF slots is fully dynamic — configurable from the UI with `[−] N [+]` controls.

---

## Requirements

- Python 3.10 or newer
- pip

---

## Installation

```bash
# Clone / download the project
cd "f:\PDF Swiss-Knife"

# Install Python dependencies
pip install -r requirements.txt
```

---

## Starting the application

You can start PDF Swiss-Knife using any of the following:

### Option 1: Double-click (Windows)
Double-click `run.bat` in the project folder.

### Option 2: Python launcher (auto-opens browser)
```bash
python run.py
```

### Option 3: PowerShell
```powershell
.\run.ps1
```

### Option 4: Direct Flask server
```bash
python backend/app.py
```
Then visit: `http://127.0.0.1:5000`

The Python backend serves both the API and the frontend.  
No separate frontend build step or dev server is required.

---

## Supported operations

| Status | Feature | Description |
|---|---|---|
| ✅ | **Application Shell** | Modern responsive SPA with light/dark/system themes |
| ✅ | **Standard PDF Merge** | Combine multiple documents with drag-and-drop reordering |
| ✅ | **Split PDF** | Split into single pages, chunks of N, or custom page ranges |
| ✅ | **Organise Pages** | Visual thumbnail grid, per-page rotation, delete, and reorder |
| ✅ | **Extract Pages** | Pull out custom page ranges into a new document |
| ✅ | **Rotate Pages** | Document-wide 90°, 180°, or 270° orientation adjustment |
| ✅ | **Crop Pages** | Trim margins on all pages (points, mm, inches, percent) |
| ✅ | **Watermark** | Diagonal/horizontal text stamp with opacity, color, and size controls |
| ✅ | **Page Numbers** | Customizable numbering in 6 positions with offset and templates |
| ✅ | **Header & Footer** | 6 header/footer slots with dynamic `{n}` and `{total}` variables |
| ✅ | **PDF → Images** | High-fidelity rendering to PNG/JPEG at custom DPI with ZIP download |
| ✅ | **Images → PDF** | Lossless compilation of multiple images into a single PDF |
| ✅ | **Compress PDF** | Lossless stream compression and image downsampling |
| ✅ | **Repair / Normalize** | Clean corrupt or non-standard PDFs with `pikepdf` |
| ✅ | **PDF Information** | Instant inspection of metadata, encryption, and page dimensions |
| ✅ | **Protect PDF** | 256-bit AES encryption with password protection and permissions |
| ✅ | **Remove Protection** | Remove passwords and unlock protected PDFs |
| ✅ | **Custom Batch PDF Builder** | High-throughput batch builder: N repeating × M unique documents |

---

## Project structure

```
PDF Swiss-Knife/
├── frontend/           Browser-based UI (HTML + CSS + vanilla JS)
│   ├── index.html      Single-page application shell
│   ├── css/            Design system CSS
│   └── js/             JavaScript modules
├── backend/            Python Flask backend
│   ├── app.py          Entry point — run this to start
│   ├── config.py       Configuration (port, limits, paths)
│   ├── routes/         Flask route blueprints
│   ├── services/       Job manager, file manager
│   └── pdf/            PDF operation implementations
├── tests/              pytest test suite
├── temp/               Temporary files (created at runtime)
├── output/             Generated output files (created at runtime)
├── requirements.txt    Python dependencies
├── PROJECT_PLAN.md     Product scope and milestone plan
├── PROJECT_PROGRESS.md Living development progress tracker
└── ARCHITECTURE.md     Technical architecture documentation
```

---

## Configuration

Edit `backend/config.py` to change:

- `PORT` — default `5000`
- `HOST` — default `127.0.0.1` (localhost only)
- `MAX_CONTENT_LENGTH` — default 512 MB per upload
- `JOB_TTL_SECONDS` — how long job results are kept before cleanup

---

## Local-first model

- PDFs are **never** sent to any external server
- All operations run in the Python process on your machine
- Temporary files are stored in `temp/` and cleaned after each job
- Output files are stored in `output/` until you download them

---

## Troubleshooting

**Backend won't start:**
- Check Python version: `python --version` (requires 3.10+)
- Reinstall dependencies: `pip install -r requirements.txt`
- Check if port 5000 is in use: change `PORT` in `backend/config.py`

**"Cannot connect to backend" in browser:**
- Make sure `python backend/app.py` is running
- Check the terminal for error messages
- Confirm the port matches (default: 5000)

**PDF operation fails:**
- Check the terminal (backend) for the full error message
- The browser shows a friendly summary; the terminal has full diagnostics

---

## Development progress

See [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) for the current state of implementation.

All features are tracked honestly — unimplemented features are marked as such.
