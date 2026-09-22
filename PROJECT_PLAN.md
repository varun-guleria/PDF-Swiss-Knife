# PDF Swiss-Knife — Project Plan

## Product Overview

A polished, local-first PDF manipulation workspace with a browser-based frontend
and a Python-powered backend. All processing happens on the user's machine.
No cloud uploads. No external dependencies beyond installed Python packages.

The application targets desktop productivity users who need reliable, repeatable
PDF operations — particularly teams who generate large batches of personalised
PDF documents.

---

## Product Scope

### Standard PDF Utilities

| Feature | Section |
|---|---|
| Merge PDFs | ORGANIZE |
| Split PDF | ORGANIZE |
| Organize Pages | ORGANIZE |
| Extract Pages | ORGANIZE |
| Rotate Pages | EDIT |
| Crop Pages | EDIT |
| Watermark | EDIT |
| Page Numbers | EDIT |
| Header / Footer | EDIT |
| PDF → Images | CONVERT |
| Images → PDF | CONVERT |
| Compress PDF | OPTIMIZE |
| Repair / Normalize | OPTIMIZE |
| PDF Information | OPTIMIZE |
| Protect PDF | SECURITY |
| Remove Protection | SECURITY |

### Distinctive Feature: Custom Batch PDF Builder

Users define:
- N repeating PDFs (cover, instructions, terms, etc.) — **dynamically configurable, not hard-coded**
- M unique PDFs (individual certificates, letters, etc.)

Output: M merged PDFs, each consisting of:
`Repeating PDF 1 + Repeating PDF 2 + ... + Repeating PDF N + Unique PDF i`

The number of repeating PDF slots is controlled entirely by the user via `[-]  N  [+]` controls.

---

## Technology Stack

### Backend
- **Language:** Python 3.10+
- **Framework:** Flask (lightweight, well-understood, no overhead)
- **PDF Library:** `pypdf` (primary) + `pikepdf` (repair/encrypt) + `Pillow` (image ops) + `img2pdf` (images→PDF)
- **Packaging:** `requirements.txt` — no Docker, no virtualenv enforcement

### Frontend
- **Language:** HTML + CSS + plain JavaScript (ES2020+)
- **No framework** — vanilla JS with modular file organisation
- **No TypeScript** — kept simple and maintainable
- **Icons:** Lucide Icons (CDN, SVG-based, MIT license)
- **Fonts:** Inter (Google Fonts)

### Communication
- REST API over `localhost`
- JSON for control data
- `multipart/form-data` for file upload
- Polling (SSE or long-poll) for real-time job progress
- Backend serves frontend static files (no separate dev server required)

---

## Milestone Sequence

| # | Milestone | Key Goal |
|---|---|---|
| M0 | Planning + Architecture | Documents, structure, verified plan |
| M1 | Application Shell | Frontend + backend start, communicate |
| M2 | Design System | Tokens, light/dark/system theme, persisted |
| M3 | PDF Merge | First real PDF operation, tested |
| M4 | Page Organization Engine | Reusable page-level operations |
| M5 | Custom Batch Builder UI | Dynamic slots, unique PDFs |
| M6 | Batch Processing + Progress | Real backend jobs, real progress |
| M7 | ZIP Output + Results | Download, naming, cleanup |
| M8 | Split, Extract, Rotate, Delete | Additional tools (one at a time) |
| M9 | Convert, Watermark, Numbers, Header | Additional tools |
| M10 | Compress, Repair, Info, Protect | Additional tools |
| Final | Testing + Visual QA + Docs | Full verification pass |

---

## Constraints and Principles

1. **Local-first** — no cloud upload of user files
2. **Incremental** — each milestone verified before advancing
3. **Honest progress tracking** — PROJECT_PROGRESS.md is always accurate
4. **No hallucinated features** — unimplemented = NOT IMPLEMENTED
5. **Desktop-quality UI** — clean, compact, professional (not "AI-generated")
6. **Maintainable code** — clear structure, comments where needed
7. **Safe temp file handling** — temp dirs cleaned after jobs
8. **Useful error messages** — no raw Python tracebacks to UI

---

## PDF Library Strategy

| Operation | Library |
|---|---|
| Merge, split, extract, rotate, reorder | `pypdf` |
| Encrypt / decrypt / permissions | `pikepdf` |
| Repair / normalize corrupt PDFs | `pikepdf` |
| Compress (image downsampling) | `Pillow` + `pypdf` |
| PDF → Images | `pypdf` + `Pillow` (via `pdf2image` / `pypdfium2`) |
| Images → PDF | `img2pdf` |
| Watermark (text overlay) | `pypdf` + `reportlab` |
| Page numbers / header / footer | `reportlab` (generate stamp page) + `pypdf` |
| Crop (media box adjustment) | `pypdf` |
| Metadata read/write | `pypdf` |

**Primary strategy:** `pypdf` handles most operations. Specialist libraries are
imported only for the specific features that require them. This avoids heavy
startup overhead and keeps the backend lean.

---

## Output and Temp File Strategy

- Temp directory: `temp/<job_id>/` — created per job, cleaned on completion or failure
- Output directory: `output/<job_id>/` — retained until user downloads or clears
- Naming: output files preserve meaningful input names where possible
  - Batch: `{unique_filename_stem}_merged.pdf`
  - ZIP: `batch_{job_id}.zip`
- Filename sanitisation: strip Windows-illegal characters (`\ / : * ? " < > |`)
- Max filename length: 200 characters (truncated, not rejected)

---

## Progress Reporting Strategy

- Each backend job receives a `job_id` (UUID)
- Job state stored in memory dict (sufficient for local single-user app)
- Frontend polls `GET /api/jobs/{job_id}/status` every 500ms during processing
- Status response: `{status, current, total, current_file, completed, failed, errors}`
- On completion: status becomes `done` — frontend stops polling
- On error: status becomes `error` — frontend displays message

---

## Testing Strategy

- Backend: `pytest` unit tests for each PDF operation
- Frontend: manual verification + browser console inspection
- Integration: curl / Python requests against running backend
- Batch builder: explicit tests for 1, 2, 5 repeating PDFs × multiple unique PDFs
- Edge cases: invalid PDF, empty input, duplicate filenames, illegal characters

---

## Project Directory Structure

```
f:\PDF Swiss-Knife\
├── frontend/
│   ├── index.html          # Single-page app shell
│   ├── css/
│   │   ├── tokens.css      # Design tokens (colours, spacing, typography)
│   │   ├── base.css        # Reset + base element styles
│   │   ├── layout.css      # App shell layout
│   │   ├── components.css  # Reusable components
│   │   └── tools.css       # Tool-specific styles
│   ├── js/
│   │   ├── app.js          # App init, routing, theme
│   │   ├── api.js          # Backend communication layer
│   │   ├── utils.js        # Shared utilities
│   │   ├── components/     # Reusable UI components
│   │   │   ├── dropzone.js
│   │   │   ├── fileRow.js
│   │   │   ├── progress.js
│   │   │   └── dialog.js
│   │   └── tools/          # One file per tool
│   │       ├── merge.js
│   │       ├── split.js
│   │       ├── batch.js
│   │       └── ...
│   └── assets/
│       └── logo.svg
│
├── backend/
│   ├── app.py              # Flask app + route registration
│   ├── config.py           # Configuration (paths, limits)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── merge.py
│   │   ├── split.py
│   │   ├── batch.py
│   │   ├── pages.py
│   │   ├── convert.py
│   │   ├── edit.py
│   │   ├── optimize.py
│   │   ├── security.py
│   │   └── jobs.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── job_manager.py  # In-memory job state
│   │   └── file_manager.py # Temp/output file management
│   └── pdf/
│       ├── __init__.py
│       ├── merge.py
│       ├── split.py
│       ├── batch.py
│       ├── pages.py
│       ├── convert.py
│       ├── edit.py
│       ├── optimize.py
│       └── security.py
│
├── tests/
│   ├── fixtures/           # Sample PDFs for testing
│   ├── test_merge.py
│   ├── test_split.py
│   ├── test_batch.py
│   ├── test_pages.py
│   └── test_edge_cases.py
│
├── temp/                   # Runtime temp files (gitignored)
├── output/                 # Generated outputs (gitignored)
│
├── PROJECT_PLAN.md         # This file
├── PROJECT_PROGRESS.md     # Living progress tracker
├── ARCHITECTURE.md         # Technical architecture detail
├── README.md               # User-facing docs
└── requirements.txt        # Python dependencies
```

---

## Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `pypdf` cannot handle encrypted/corrupt PDF | Detect early, route to `pikepdf`, show user error |
| Large batch (100+ PDFs) takes long | Backend job with progress; frontend shows live status |
| Temp files accumulate | Per-job cleanup on success and failure |
| Windows filename collisions | Sanitise + deduplicate output filenames |
| Port conflict on localhost | Configurable port in `config.py` |
| Missing Python dependency | Clear error at startup with install instruction |

