# PDF Swiss-Knife — Technical Architecture

## Overview

PDF Swiss-Knife is a local-first PDF manipulation workspace.
The architecture is deliberately simple: a Python Flask backend serves both the
REST API and the frontend static files. The user opens a browser tab pointing to
`http://localhost:5000`. All file processing happens on the local machine.

```
┌─────────────────────────────────────┐
│         User's Browser              │
│                                     │
│   HTML + CSS + Vanilla JS SPA       │
│   ┌──────────────────────────────┐  │
│   │  App Shell (index.html)      │  │
│   │  Navigation sidebar          │  │
│   │  Tool panels (dynamic)       │  │
│   │  Progress polling            │  │
│   └──────────┬───────────────────┘  │
└──────────────┼──────────────────────┘
               │  HTTP REST (localhost:5000)
               │  multipart/form-data (uploads)
               │  JSON (control & status)
               │
┌──────────────▼──────────────────────┐
│         Flask Backend               │
│                                     │
│  app.py → routes/ → services/       │
│                    → pdf/           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Job Manager (in-memory)    │    │
│  │  { job_id: JobState }       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  File Manager               │    │
│  │  temp/<job_id>/             │    │
│  │  output/<job_id>/           │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  PDF Operations             │    │
│  │  pypdf + pikepdf + Pillow   │    │
│  │  + img2pdf + reportlab      │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
               │
               │  reads/writes
               ▼
┌─────────────────────────────────────┐
│  Local Filesystem                   │
│  f:\PDF Swiss-Knife\temp\           │
│  f:\PDF Swiss-Knife\output\         │
└─────────────────────────────────────┘
```

---

## Frontend Architecture

### Approach: Single-Page App (Vanilla JS)

The entire UI is contained in `frontend/index.html`.

Navigation in the sidebar updates which "tool panel" is displayed.
No page reloads. No router library required.

Each tool is a self-contained JavaScript module in `frontend/js/tools/`.

The app shell (sidebar + topbar + content area) is rendered once.
Tool panels are rendered into the content area on demand.

### Module Structure

```
js/
├── app.js           Entry point: init, nav routing, theme bootstrap
├── api.js           Fetch wrapper, error handling, upload helpers
├── utils.js         Formatters (file size, page count), sanitise, debounce
├── components/
│   ├── dropzone.js  Reusable drag-drop upload zone
│   ├── fileRow.js   Reusable file list row (name, size, pages, actions)
│   ├── progress.js  Progress bar + status display
│   └── dialog.js    Modal dialog (confirm, alert)
└── tools/
    ├── home.js      Home/welcome panel
    ├── merge.js     PDF Merge
    ├── split.js     PDF Split
    ├── organize.js  Page organizer
    ├── extract.js   Extract pages
    ├── rotate.js    Rotate pages
    ├── crop.js      Crop pages
    ├── watermark.js Watermark
    ├── pagenums.js  Page numbers
    ├── headerfooter.js Header/footer
    ├── toImages.js  PDF → Images
    ├── toPdf.js     Images → PDF
    ├── compress.js  Compress
    ├── repair.js    Repair/normalize
    ├── info.js      PDF information
    ├── protect.js   Protect PDF
    ├── unprotect.js Remove protection
    └── batch.js     Custom Batch PDF Builder
```

### State Management

No external state library. Each tool module manages its own local state
(array of files, job state). State is not shared between tools — the user
can only be in one tool at a time.

Theme preference is stored in `localStorage`.

### API Communication

All requests go through `api.js`:

```javascript
// api.js responsibilities:
// - Set base URL (configurable)
// - Handle multipart uploads
// - Handle JSON requests
// - Poll job status
// - Handle errors uniformly
// - Return structured result objects
```

### Progress Polling

For long-running operations (batch processing, compress, convert):

1. Client submits job → receives `{ job_id }`
2. Client starts polling `GET /api/jobs/{job_id}/status` every 500ms
3. Server returns `{ status, current, total, current_file, completed, failed, errors }`
4. When `status === 'done'` or `status === 'error'`, stop polling
5. Display result or error

---

## Backend Architecture

### Flask Application

`app.py` creates the Flask app, registers all route blueprints, serves
the frontend static files, and handles CORS for local development.

### Route Blueprints

Each feature area is a Flask Blueprint in `routes/`:

| Blueprint | Prefix | Handles |
|---|---|---|
| `merge` | `/api/merge` | PDF merge operation |
| `split` | `/api/split` | PDF split |
| `pages` | `/api/pages` | Page operations (rotate/extract/reorder/delete/duplicate) |
| `convert` | `/api/convert` | PDF↔images conversion |
| `edit` | `/api/edit` | Watermark, page numbers, header/footer, crop |
| `optimize` | `/api/optimize` | Compress, repair, info |
| `security` | `/api/security` | Protect, unprotect |
| `batch` | `/api/batch` | Custom batch builder |
| `jobs` | `/api/jobs` | Job status polling |
| `output` | `/api/output` | Download results, ZIP generation |

### PDF Operation Modules

Each `pdf/*.py` module contains pure functions:

```python
# pdf/merge.py
def merge_pdfs(input_paths: list[Path], output_path: Path) -> MergeResult:
    ...

# pdf/batch.py
def batch_merge(
    repeating_paths: list[Path],
    unique_paths: list[Path],
    output_dir: Path,
    progress_callback: Callable,
) -> BatchResult:
    ...
```

Routes call services, services call pdf modules. Routes never call pdf
modules directly. This separation makes unit testing straightforward.

### Job Manager

```python
# services/job_manager.py

class JobState:
    job_id: str
    status: str          # 'pending' | 'running' | 'done' | 'error'
    current: int
    total: int
    current_file: str
    completed: int
    failed: int
    errors: list[dict]
    result_path: Path | None
    created_at: datetime
    updated_at: datetime

# In-memory dict — sufficient for local single-user tool
_jobs: dict[str, JobState] = {}

def create_job() -> str: ...
def update_job(job_id: str, **kwargs) -> None: ...
def get_job(job_id: str) -> JobState | None: ...
def cleanup_old_jobs() -> None: ...  # Remove jobs older than 1 hour
```

### File Manager

```python
# services/file_manager.py

BASE_DIR = Path(__file__).parent.parent
TEMP_DIR = BASE_DIR / 'temp'
OUTPUT_DIR = BASE_DIR / 'output'

def create_job_temp_dir(job_id: str) -> Path: ...
def create_job_output_dir(job_id: str) -> Path: ...
def cleanup_job_temp(job_id: str) -> None: ...
def cleanup_job_output(job_id: str) -> None: ...
def sanitise_filename(name: str) -> str: ...
```

---

## PDF Library Strategy

### Primary: `pypdf`

- Merge: `PdfWriter.append()`
- Split: iterate `PdfReader.pages`, write subsets
- Rotate: `PageObject.rotate()`
- Extract: select specific page indices
- Reorder: reindex pages
- Delete: skip page indices
- Duplicate: append same page multiple times
- Metadata: `PdfReader.metadata`, `PdfWriter.add_metadata()`
- Crop: adjust `MediaBox` / `CropBox`

### Secondary: `pikepdf`

- Repair corrupt/linearized PDFs: `pikepdf.open(suppress_warnings=True)`
- Encrypt / set permissions: `pikepdf.Encryption`
- Decrypt / remove password: `pikepdf.open(password=...)`
- Better compatibility with non-standard PDFs

### Image Operations: `Pillow`

- Convert PDF page images for thumbnail display
- Process uploaded images before combining into PDF

### PDF-from-Images: `img2pdf`

- Lossless embedding of images into PDF
- Preserves original image quality
- Faster than Pillow-based approach for this operation

### PDF Rendering (for thumbnails/previews): `pypdfium2`

- Render PDF pages to PIL images
- Used for PDF→Images conversion and thumbnail generation
- Pure Python wheels, no system poppler dependency

### Text overlay (watermark, page numbers, header/footer): `reportlab`

- Generate a single-page PDF stamp with desired text/image
- Merge stamp onto target pages using `pypdf`

### Compression: `pypdf` + `Pillow`

- Re-encode images within PDF at lower quality
- Remove unused objects
- Note: True PDF compression has limits without re-rendering

---

## Custom Batch Builder — Architecture Detail

### Conceptual Model

```
repeating_pdfs: [Path, Path, ..., Path]  # N items, user-defined
unique_pdfs:    [Path, Path, ..., Path]  # M items

for i, unique_pdf in enumerate(unique_pdfs):
    parts = repeating_pdfs + [unique_pdf]
    output_name = sanitise(unique_pdf.stem) + '_merged.pdf'
    merge_pdfs(parts, output_dir / output_name)
    progress_callback(current=i+1, total=M, current_file=output_name)
```

### Why This Is Correct

- Output count = `len(unique_pdfs)` — never `len(repeating_pdfs)`
- Order of repeating PDFs is exactly the user-defined order
- Replacing one repeating slot does not affect other slots
- The batch function is entirely data-driven — no hard-coded slot counts

### Progress

Each iteration calls `progress_callback` which updates the in-memory `JobState`.
The frontend polls every 500ms. The UI shows:

```
Generating 100 PDFs...

 68 / 100  ████████████████░░░░░░░  68%

Current file:  Student069_merged.pdf
Completed:     68    Failed: 0    Remaining: 32
```

---

## Data Flow: Standard Merge

```
User selects files
       │
       ▼
POST /api/merge/upload
  body: multipart, files[]
       │
       ▼
Save to temp/<job_id>/
       │
       ▼
POST /api/merge/run
  body: { job_id, file_order[] }
       │
       ▼
pdf/merge.merge_pdfs()
       │
       ▼
output/<job_id>/merged.pdf
       │
       ▼
GET /api/output/<job_id>/download
       │
       ▼
Browser downloads file
```

---

## Data Flow: Custom Batch

```
User configures repeating PDFs (slots)
User adds unique PDFs
User clicks Generate
       │
       ▼
POST /api/batch/start
  body: {
    repeating: [{ slot_id, file_id }, ...],
    unique: [{ file_id }, ...]
  }
       │
       ▼
Backend creates job_id, starts background thread
Returns { job_id }
       │
       ▼
Frontend starts polling GET /api/jobs/<job_id>/status
       │
       ▼
Background thread runs batch_merge()
  - updates JobState after each PDF
       │
       ▼
When done: status='done', result_path set
       │
       ▼
Frontend shows completion + Download ZIP button
       │
       ▼
GET /api/output/<job_id>/zip → downloads batch_<job_id>.zip
```

---

## Security Considerations

- All file access is limited to `temp/` and `output/` under project root
- No path traversal: all user-supplied filenames are sanitised
- No shell execution: all operations are pure Python
- No network calls: entirely local
- Uploaded files are validated (magic bytes) before processing

---

## Error Handling Policy

| Layer | Behaviour |
|---|---|
| PDF operation error | Caught, logged to console, returned as `{ error: "friendly message" }` |
| Invalid input file | Detected before processing, returns 400 with message |
| Missing job | Returns 404 |
| Batch partial failure | Continues remaining files, records failed item |
| Fatal backend error | Returns 500 with generic message; detail in server log |

Python tracebacks never appear in the browser UI.
The server log (stdout) contains full diagnostic information.

---

## Performance Targets

| Scenario | Target |
|---|---|
| Merge 5 × 10-page PDFs | < 2 seconds |
| Batch 100 unique × 3 repeating | Depends on PDF size; show progress |
| Split 50-page PDF into singles | < 5 seconds |
| PDF → 20 images | < 10 seconds |
| UI responsiveness | No blocking of UI thread |

Background thread is used for batch operations.
Flask `threaded=True` allows concurrent status polling.

---

## Configuration (`config.py`)

```python
HOST = '127.0.0.1'
PORT = 5000
DEBUG = False   # Set True for development
MAX_UPLOAD_SIZE = 512 * 1024 * 1024   # 512 MB per file
TEMP_DIR = BASE_DIR / 'temp'
OUTPUT_DIR = BASE_DIR / 'output'
JOB_TTL_SECONDS = 3600  # Clean jobs older than 1 hour
POLL_INTERVAL_MS = 500  # Frontend polling interval
```

---

## Decisions and Rationale

| Decision | Reasoning |
|---|---|
| Flask over FastAPI | Simpler, synchronous, widely understood, sufficient for local tool |
| No TypeScript | Keeps frontend maintainable without a build step |
| No React/Vue | Avoids build toolchain for a local utility |
| In-memory job state | Single-user local tool; no persistence needed across restarts |
| pypdf as primary | Pure Python, well-maintained, MIT license |
| pikepdf for security/repair | Best-in-class for encryption/corrupt PDF handling |
| pypdfium2 for rendering | No system dependency (poppler), pure Python wheels |
| img2pdf for images→PDF | Lossless, fast, no quality degradation |
| reportlab for stamp PDFs | Industry standard for PDF generation |
| Polling over WebSocket | Simpler; 500ms latency acceptable for local file ops |

---

## Limitations (documented honestly)

| Limitation | Status |
|---|---|
| PDF compression is limited to image re-encoding | Known; true re-rendering not implemented |
| Very large PDFs (>500MB) may cause memory pressure | Known; no streaming implemented yet |
| Page thumbnail rendering requires pypdfium2 | Fallback: no thumbnail if import fails |
| Crop via MediaBox may affect some PDF viewers | Known pypdf limitation |
| Multi-user concurrent batch jobs | Not supported; single-user tool |

