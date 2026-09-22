"""
tests/test_batch.py — Tests for Milestone 5: Custom Batch PDF Builder.

Tests cover:
  1. batch_merge engine — correct output count, page counts, partial failure
  2. POST /api/batch/start API route — job creation, progress, completion
  3. ZIP download of batch results
"""

import io
import os
import sys
import time
import shutil
import zipfile
import tempfile
import pytest
from pathlib import Path

# ─── Path setup ──────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from pypdf import PdfWriter, PdfReader

from pdf.batch import batch_merge, PdfBatchError


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_pdf(path: Path, num_pages: int = 1, text: str = "page"):
    """Create a minimal valid PDF with the given number of pages."""
    writer = PdfWriter()
    for i in range(num_pages):
        # Add a blank page (letter size)
        writer.add_blank_page(width=612, height=792)
    with open(path, "wb") as f:
        writer.write(f)
    return path


# ─── Engine Unit Tests ───────────────────────────────────────────────────────

class TestBatchMergeEngine:
    """Tests for pdf/batch.py batch_merge()."""

    def setup_method(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="psk_batch_test_"))

    def teardown_method(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_basic_batch(self):
        """2 repeating (2 pages each) + 3 unique (1 page each) → 3 outputs, each 5 pages."""
        rep1 = make_pdf(self.tmp / "rep1.pdf", num_pages=2)
        rep2 = make_pdf(self.tmp / "rep2.pdf", num_pages=2)
        u1 = make_pdf(self.tmp / "student_A.pdf", num_pages=1)
        u2 = make_pdf(self.tmp / "student_B.pdf", num_pages=1)
        u3 = make_pdf(self.tmp / "student_C.pdf", num_pages=1)

        out_dir = self.tmp / "output"
        result = batch_merge([rep1, rep2], [u1, u2, u3], out_dir)

        assert result["total"] == 3
        assert result["completed"] == 3
        assert result["failed"] == 0
        assert len(result["errors"]) == 0
        assert len(result["output_files"]) == 3

        # Each output should have 2+2+1 = 5 pages
        for fname in result["output_files"]:
            reader = PdfReader(str(out_dir / fname))
            assert len(reader.pages) == 5, f"{fname} should have 5 pages"

    def test_single_repeating_single_unique(self):
        """1 repeating (3 pages) + 1 unique (2 pages) → 1 output with 5 pages."""
        rep = make_pdf(self.tmp / "cover.pdf", num_pages=3)
        uniq = make_pdf(self.tmp / "data.pdf", num_pages=2)

        out_dir = self.tmp / "output"
        result = batch_merge([rep], [uniq], out_dir)

        assert result["total"] == 1
        assert result["completed"] == 1
        assert len(result["output_files"]) == 1

        reader = PdfReader(str(out_dir / result["output_files"][0]))
        assert len(reader.pages) == 5

    def test_output_naming(self):
        """Output files are named <unique_stem>_merged.pdf."""
        rep = make_pdf(self.tmp / "rep.pdf", num_pages=1)
        u1 = make_pdf(self.tmp / "Alice_Report.pdf", num_pages=1)
        u2 = make_pdf(self.tmp / "Bob_Report.pdf", num_pages=1)

        out_dir = self.tmp / "output"
        result = batch_merge([rep], [u1, u2], out_dir)

        assert "Alice_Report_merged.pdf" in result["output_files"]
        assert "Bob_Report_merged.pdf" in result["output_files"]

    def test_partial_failure(self):
        """Corrupt unique file → other outputs still generated."""
        rep = make_pdf(self.tmp / "rep.pdf", num_pages=1)
        good = make_pdf(self.tmp / "good.pdf", num_pages=1)

        # Create a corrupt PDF
        bad = self.tmp / "bad.pdf"
        bad.write_text("NOT A PDF")

        out_dir = self.tmp / "output"
        result = batch_merge([rep], [good, bad], out_dir)

        assert result["total"] == 2
        assert result["completed"] == 1
        assert result["failed"] == 1
        assert len(result["errors"]) == 1
        assert result["errors"][0]["filename"] == "bad.pdf"

    def test_no_repeating_raises(self):
        """Empty repeating list → PdfBatchError."""
        uniq = make_pdf(self.tmp / "u.pdf", num_pages=1)
        with pytest.raises(PdfBatchError, match="repeating"):
            batch_merge([], [uniq], self.tmp / "out")

    def test_no_unique_raises(self):
        """Empty unique list → PdfBatchError."""
        rep = make_pdf(self.tmp / "r.pdf", num_pages=1)
        with pytest.raises(PdfBatchError, match="unique"):
            batch_merge([rep], [], self.tmp / "out")

    def test_progress_callback(self):
        """Progress callback is called once per unique file."""
        rep = make_pdf(self.tmp / "rep.pdf", num_pages=1)
        u1 = make_pdf(self.tmp / "u1.pdf", num_pages=1)
        u2 = make_pdf(self.tmp / "u2.pdf", num_pages=1)

        calls = []
        def on_progress(current, total, filename):
            calls.append((current, total, filename))

        batch_merge([rep], [u1, u2], self.tmp / "out", progress_callback=on_progress)

        assert len(calls) == 2
        assert calls[0] == (1, 2, "u1_merged.pdf")
        assert calls[1] == (2, 2, "u2_merged.pdf")


# ─── API Integration Tests ──────────────────────────────────────────────────

class TestBatchApi:
    """Tests against the Flask app's /api/batch/start endpoint."""

    @pytest.fixture(autouse=True)
    def setup_app(self):
        from app import create_app
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _make_pdf_bytes(self, num_pages=1):
        """Generate a minimal PDF as bytes."""
        writer = PdfWriter()
        for _ in range(num_pages):
            writer.add_blank_page(width=612, height=792)
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)
        return buf.read()

    def test_batch_start_returns_202(self):
        """POST /api/batch/start with valid files returns 202 with job_id."""
        rep_bytes = self._make_pdf_bytes(2)
        uniq_bytes = self._make_pdf_bytes(1)

        data = {
            "repeating_files": [
                (io.BytesIO(rep_bytes), "cover.pdf"),
            ],
            "unique_files": [
                (io.BytesIO(uniq_bytes), "student1.pdf"),
                (io.BytesIO(uniq_bytes), "student2.pdf"),
            ],
        }

        response = self.client.post(
            "/api/batch/start",
            data=data,
            content_type="multipart/form-data",
        )

        assert response.status_code == 202
        body = response.get_json()
        assert "job_id" in body
        assert body["repeating_count"] == 1
        assert body["unique_count"] == 2
        assert body["output_count"] == 2

    def test_batch_missing_repeating(self):
        """POST without repeating files returns 400."""
        uniq_bytes = self._make_pdf_bytes(1)
        data = {
            "unique_files": [
                (io.BytesIO(uniq_bytes), "student.pdf"),
            ],
        }
        response = self.client.post(
            "/api/batch/start",
            data=data,
            content_type="multipart/form-data",
        )
        assert response.status_code == 400

    def test_batch_missing_unique(self):
        """POST without unique files returns 400."""
        rep_bytes = self._make_pdf_bytes(1)
        data = {
            "repeating_files": [
                (io.BytesIO(rep_bytes), "cover.pdf"),
            ],
        }
        response = self.client.post(
            "/api/batch/start",
            data=data,
            content_type="multipart/form-data",
        )
        assert response.status_code == 400

    def test_batch_job_completes(self):
        """Full lifecycle: start → poll until done → verify outputs."""
        rep_bytes = self._make_pdf_bytes(2)
        uniq_bytes = self._make_pdf_bytes(1)

        data = {
            "repeating_files": [
                (io.BytesIO(rep_bytes), "cover.pdf"),
            ],
            "unique_files": [
                (io.BytesIO(uniq_bytes), "alpha.pdf"),
                (io.BytesIO(uniq_bytes), "beta.pdf"),
            ],
        }

        # Start the batch
        start_resp = self.client.post(
            "/api/batch/start",
            data=data,
            content_type="multipart/form-data",
        )
        job_id = start_resp.get_json()["job_id"]

        # Poll until done (max 10 seconds)
        deadline = time.time() + 10
        status = None
        while time.time() < deadline:
            poll_resp = self.client.get(f"/api/jobs/{job_id}/status")
            status = poll_resp.get_json()
            if status["status"] in ("done", "error"):
                break
            time.sleep(0.2)

        assert status is not None
        assert status["status"] == "done"
        assert status["completed"] == 2

        # Verify output file list
        list_resp = self.client.get(f"/api/output/{job_id}/list")
        files = list_resp.get_json()["files"]
        assert len(files) == 2
        names = [f["name"] for f in files]
        assert any("alpha" in n for n in names)
        assert any("beta" in n for n in names)

    def test_batch_zip_download(self):
        """After batch completion, ZIP download works."""
        rep_bytes = self._make_pdf_bytes(1)
        uniq_bytes = self._make_pdf_bytes(1)

        data = {
            "repeating_files": [
                (io.BytesIO(rep_bytes), "rep.pdf"),
            ],
            "unique_files": [
                (io.BytesIO(uniq_bytes), "doc1.pdf"),
                (io.BytesIO(uniq_bytes), "doc2.pdf"),
            ],
        }

        start_resp = self.client.post(
            "/api/batch/start",
            data=data,
            content_type="multipart/form-data",
        )
        job_id = start_resp.get_json()["job_id"]

        # Wait for completion
        deadline = time.time() + 10
        while time.time() < deadline:
            poll = self.client.get(f"/api/jobs/{job_id}/status").get_json()
            if poll["status"] in ("done", "error"):
                break
            time.sleep(0.2)

        # Download ZIP
        zip_resp = self.client.get(f"/api/output/{job_id}/zip")
        assert zip_resp.status_code == 200
        assert zip_resp.content_type == "application/zip"

        # Verify ZIP contents
        zip_buf = io.BytesIO(zip_resp.data)
        with zipfile.ZipFile(zip_buf) as zf:
            names = zf.namelist()
            assert len(names) == 2
