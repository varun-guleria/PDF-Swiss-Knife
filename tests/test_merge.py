"""
test_merge.py — Unit and integration tests for PDF Merge functionality (Milestone 3).
"""

import io
import sys
import time
from pathlib import Path
import pytest
from pypdf import PdfWriter, PdfReader

# Add backend directory to sys.path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app import create_app
from pdf.merge import merge_pdfs, PdfMergeError


def _create_sample_pdf(page_count: int = 1) -> bytes:
    """Generate a minimal valid PDF in memory with the requested number of pages."""
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=300)
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
def sample_pdf_files(tmp_path):
    """Create two sample PDF files on disk for testing."""
    f1 = tmp_path / "doc1.pdf"
    f2 = tmp_path / "doc2.pdf"
    f3 = tmp_path / "doc3.pdf"

    f1.write_bytes(_create_sample_pdf(1))
    f2.write_bytes(_create_sample_pdf(2))
    f3.write_bytes(_create_sample_pdf(3))

    return [f1, f2, f3]


def test_merge_pdfs_success(sample_pdf_files, tmp_path):
    """Test merging 2 and 3 PDFs directly."""
    out_file = tmp_path / "output_merged.pdf"

    # Merge 2 files (1 page + 2 pages = 3 pages)
    res = merge_pdfs(sample_pdf_files[:2], out_file)
    assert res["total_pages"] == 3
    assert res["input_count"] == 2
    assert out_file.exists()

    reader = PdfReader(str(out_file))
    assert len(reader.pages) == 3

    # Merge 3 files (1 + 2 + 3 = 6 pages)
    out_file_2 = tmp_path / "output_merged_3.pdf"
    res2 = merge_pdfs(sample_pdf_files, out_file_2)
    assert res2["total_pages"] == 6
    assert res2["input_count"] == 3


def test_merge_progress_callback(sample_pdf_files, tmp_path):
    """Test that progress callback is invoked for each file."""
    out_file = tmp_path / "progress_test.pdf"
    calls = []

    def on_progress(current, total, filename):
        calls.append((current, total, filename))

    merge_pdfs(sample_pdf_files, out_file, progress_callback=on_progress)
    assert len(calls) == 3
    assert calls[0] == (1, 3, "doc1.pdf")
    assert calls[1] == (2, 3, "doc2.pdf")
    assert calls[2] == (3, 3, "doc3.pdf")


def test_merge_fewer_than_two_files_raises(sample_pdf_files, tmp_path):
    """Merging fewer than 2 files must raise PdfMergeError."""
    out_file = tmp_path / "invalid.pdf"
    with pytest.raises(PdfMergeError, match="At least 2 PDF files"):
        merge_pdfs(sample_pdf_files[:1], out_file)


def test_merge_missing_file_raises(sample_pdf_files, tmp_path):
    """Missing input file must raise PdfMergeError."""
    out_file = tmp_path / "invalid.pdf"
    missing = tmp_path / "does_not_exist.pdf"
    with pytest.raises(PdfMergeError, match="does not exist"):
        merge_pdfs([sample_pdf_files[0], missing], out_file)


def test_api_merge_validation(client):
    """POST /api/merge/run with fewer than 2 files returns 400."""
    res = client.post("/api/merge/run", data={})
    assert res.status_code == 400

    # 1 file returns 400
    res = client.post(
        "/api/merge/run",
        data={"files": (io.BytesIO(_create_sample_pdf(1)), "doc1.pdf")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400


def test_api_merge_full_flow(client):
    """POST /api/merge/run successfully executes job and serves download."""
    data = {
        "output_name": "custom_merged.pdf",
        "files": [
            (io.BytesIO(_create_sample_pdf(2)), "part1.pdf"),
            (io.BytesIO(_create_sample_pdf(3)), "part2.pdf"),
        ],
    }
    res = client.post("/api/merge/run", data=data, content_type="multipart/form-data")
    assert res.status_code == 202
    json_data = res.get_json()
    assert "job_id" in json_data
    job_id = json_data["job_id"]

    # Poll status until done (with timeout)
    deadline = time.time() + 5.0
    status_data = None
    while time.time() < deadline:
        st_res = client.get(f"/api/jobs/{job_id}/status")
        assert st_res.status_code == 200
        status_data = st_res.get_json()
        if status_data["status"] in ("done", "error"):
            break
        time.sleep(0.1)

    assert status_data is not None
    assert status_data["status"] == "done", f"Job failed with message: {status_data.get('message')}"

    # List outputs
    list_res = client.get(f"/api/output/{job_id}/list")
    assert list_res.status_code == 200
    files = list_res.get_json()["files"]
    assert len(files) == 1
    assert files[0]["name"] == "custom_merged.pdf"

    # Download output
    dl_res = client.get(f"/api/output/{job_id}/download/custom_merged.pdf")
    assert dl_res.status_code == 200
    assert len(dl_res.data) > 0

    # Verify merged PDF validity
    merged_reader = PdfReader(io.BytesIO(dl_res.data))
    assert len(merged_reader.pages) == 5
