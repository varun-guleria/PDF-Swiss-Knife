"""
test_pages.py — Unit and API tests for Page Organization Engine (Milestone 4).
"""

import io
import time
import pytest
from pathlib import Path
import sys
from pypdf import PdfWriter, PdfReader

backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app import create_app
from pdf.pages import get_pdf_pages_info, render_page_thumbnail, reorganize_pdf, PdfPageError


def _create_sample_multipage_pdf(page_count: int = 3) -> bytes:
    """Create a sample multi-page PDF."""
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=400)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def sample_pdf(tmp_path):
    path = tmp_path / "sample.pdf"
    path.write_bytes(_create_sample_multipage_pdf(4))
    return path


def test_get_pdf_pages_info(sample_pdf):
    info = get_pdf_pages_info(sample_pdf)
    assert info["page_count"] == 4
    assert len(info["pages"]) == 4
    assert info["pages"][0]["width"] == 300.0
    assert info["pages"][0]["height"] == 400.0


def test_render_page_thumbnail(sample_pdf):
    thumb_bytes = render_page_thumbnail(sample_pdf, 0, max_dim=200)
    assert len(thumb_bytes) > 0
    # JPEG header check
    assert thumb_bytes[:2] == b"\xff\xd8"


def test_reorganize_pdf(sample_pdf, tmp_path):
    out_path = tmp_path / "reorganized.pdf"
    # Reorder [3, 0], duplicate page 0, rotate page 3 by 90 degrees
    specs = [
        {"index": 3, "rotation": 90},
        {"index": 0, "rotation": 0},
        {"index": 0, "rotation": 180},
    ]
    res = reorganize_pdf(sample_pdf, out_path, specs)
    assert res["total_pages"] == 3
    assert out_path.exists()

    reader = PdfReader(str(out_path))
    assert len(reader.pages) == 3
    assert reader.pages[0].rotation == 90
    assert reader.pages[1].rotation == 0
    assert reader.pages[2].rotation == 180


def test_pages_api_full_flow(client):
    # 1. Inspect
    pdf_bytes = _create_sample_multipage_pdf(3)
    res = client.post(
        "/api/pages/inspect",
        data={"file": (io.BytesIO(pdf_bytes), "test_doc.pdf")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 200
    info = res.get_json()
    assert "doc_id" in info
    doc_id = info["doc_id"]
    assert info["page_count"] == 3

    # 2. Thumbnail
    thumb_res = client.get(f"/api/pages/{doc_id}/thumbnail/0")
    assert thumb_res.status_code == 200
    assert thumb_res.mimetype == "image/jpeg"
    assert len(thumb_res.data) > 0

    # 3. Reorganize
    reorg_data = {
        "doc_id": doc_id,
        "output_name": "reordered.pdf",
        "page_specs": [
            {"index": 2, "rotation": 90},
            {"index": 1, "rotation": 0},
        ],
    }
    reorg_res = client.post("/api/pages/reorganize", json=reorg_data)
    assert reorg_res.status_code == 202
    job_data = reorg_res.get_json()
    job_id = job_data["job_id"]

    # Poll status
    deadline = time.time() + 5.0
    status_data = None
    while time.time() < deadline:
        st = client.get(f"/api/jobs/{job_id}/status").get_json()
        if st["status"] in ("done", "error"):
            status_data = st
            break
        time.sleep(0.1)

    assert status_data is not None
    assert status_data["status"] == "done"

    # 4. Download
    dl_res = client.get(f"/api/output/{job_id}/download/reordered.pdf")
    assert dl_res.status_code == 200
    reader = PdfReader(io.BytesIO(dl_res.data))
    assert len(reader.pages) == 2
    assert reader.pages[0].rotation == 90
