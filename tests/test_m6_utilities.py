"""
test_m6_utilities.py — Unit and integration tests for Milestone 6 PDF utilities:
- Split PDF (singles, every N, ranges)
- PDF ↔ Image conversion
- Optimize (compress, repair, info)
- Security (protect, unprotect)
- Edit (watermark, page numbers, header/footer)
"""

import io
import sys
import time
from pathlib import Path
import pytest
from PIL import Image
from pypdf import PdfWriter, PdfReader

# Add backend directory to sys.path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app import create_app
from pdf.split import split_into_singles, split_every_n, split_by_ranges, parse_page_ranges, PdfSplitError
from pdf.convert import pdf_to_images, images_to_pdf, PdfConvertError
from pdf.optimize import compress_pdf, repair_pdf, get_pdf_info, PdfOptimizeError
from pdf.security import protect_pdf, unprotect_pdf, PdfSecurityError
from pdf.edit import add_watermark, add_page_numbers, add_header_footer, crop_pdf, PdfEditError


def _create_sample_pdf(page_count: int = 1) -> bytes:
    """Generate a minimal valid PDF with the requested number of blank pages."""
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=300)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _create_sample_image(width=100, height=100, color="red") -> bytes:
    """Generate a minimal valid PNG image."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def sample_pdf_3pages(tmp_path):
    p = tmp_path / "doc_3pages.pdf"
    p.write_bytes(_create_sample_pdf(3))
    return p


@pytest.fixture
def sample_pdf_5pages(tmp_path):
    p = tmp_path / "doc_5pages.pdf"
    p.write_bytes(_create_sample_pdf(5))
    return p


# ─── Split Tests ─────────────────────────────────────────────────────────────

def test_split_into_singles(sample_pdf_3pages, tmp_path):
    out_dir = tmp_path / "split_singles"
    res = split_into_singles(sample_pdf_3pages, out_dir)
    assert res["total"] == 3
    assert len(res["output_files"]) == 3
    for fn in res["output_files"]:
        assert (out_dir / fn).exists()
        reader = PdfReader(str(out_dir / fn))
        assert len(reader.pages) == 1


def test_split_every_n(sample_pdf_5pages, tmp_path):
    out_dir = tmp_path / "split_n"
    res = split_every_n(sample_pdf_5pages, 2, out_dir)
    assert res["total"] == 3  # 2 + 2 + 1
    assert len(res["output_files"]) == 3
    # Check page counts of chunks
    assert len(PdfReader(str(out_dir / res["output_files"][0])).pages) == 2
    assert len(PdfReader(str(out_dir / res["output_files"][1])).pages) == 2
    assert len(PdfReader(str(out_dir / res["output_files"][2])).pages) == 1


def test_split_by_ranges(sample_pdf_5pages, tmp_path):
    out_dir = tmp_path / "split_ranges"
    res = split_by_ranges(sample_pdf_5pages, "1-2, 3-5", out_dir)
    assert res["total"] == 2
    assert len(PdfReader(str(out_dir / res["output_files"][0])).pages) == 2
    assert len(PdfReader(str(out_dir / res["output_files"][1])).pages) == 3


def test_parse_page_ranges_errors():
    with pytest.raises(PdfSplitError):
        parse_page_ranges("10-20", 5)  # Out of bounds
    with pytest.raises(PdfSplitError):
        parse_page_ranges("5-2", 5)   # Inverted range
    with pytest.raises(PdfSplitError):
        parse_page_ranges("abc", 5)   # Invalid number


def test_split_api_route(client):
    pdf_bytes = _create_sample_pdf(3)
    data = {
        "file": (io.BytesIO(pdf_bytes), "sample.pdf"),
        "mode": "singles",
    }
    resp = client.post("/api/split/run", data=data, content_type="multipart/form-data")
    assert resp.status_code == 202
    job_id = resp.get_json()["job_id"]
    assert job_id

    # Wait for completion
    time.sleep(0.3)
    status_resp = client.get(f"/api/jobs/{job_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.get_json()["status"] in ("running", "done")


# ─── Convert Tests ───────────────────────────────────────────────────────────

def test_pdf_to_images(sample_pdf_3pages, tmp_path):
    out_dir = tmp_path / "pdf_images"
    res = pdf_to_images(sample_pdf_3pages, out_dir, fmt="png", dpi=100)
    assert res["total"] == 3
    assert len(res["output_files"]) == 3
    for fn in res["output_files"]:
        p = out_dir / fn
        assert p.exists()
        img = Image.open(p)
        assert img.format == "PNG"


def test_images_to_pdf(tmp_path):
    img1 = tmp_path / "img1.png"
    img2 = tmp_path / "img2.png"
    img1.write_bytes(_create_sample_image(150, 150, "blue"))
    img2.write_bytes(_create_sample_image(150, 150, "green"))

    out_pdf = tmp_path / "from_images.pdf"
    res = images_to_pdf([img1, img2], out_pdf)
    assert res["total_pages"] == 2
    assert out_pdf.exists()
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 2


def test_convert_api_routes(client):
    # PDF to images
    pdf_bytes = _create_sample_pdf(2)
    resp = client.post(
        "/api/convert/to-images",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "format": "png", "dpi": "100"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202

    # Images to PDF
    img_bytes = _create_sample_image(100, 100, "red")
    resp = client.post(
        "/api/convert/to-pdf",
        data={"files": [(io.BytesIO(img_bytes), "image1.png")]},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202


# ─── Optimize Tests ──────────────────────────────────────────────────────────

def test_compress_pdf(sample_pdf_3pages, tmp_path):
    out_pdf = tmp_path / "compressed.pdf"
    res = compress_pdf(sample_pdf_3pages, out_pdf, image_quality=50)
    assert out_pdf.exists()
    assert res["total_pages"] == 3


def test_repair_pdf(sample_pdf_3pages, tmp_path):
    out_pdf = tmp_path / "repaired.pdf"
    res = repair_pdf(sample_pdf_3pages, out_pdf)
    assert out_pdf.exists()
    assert res["total_pages"] == 3


def test_get_pdf_info(sample_pdf_3pages):
    info = get_pdf_info(sample_pdf_3pages)
    assert info["page_count"] == 3
    assert info["is_encrypted"] is False
    assert len(info["pages"]) == 3
    assert info["pages"][0]["width_pt"] == 300.0
    assert info["pages"][0]["height_pt"] == 300.0


def test_optimize_api_routes(client):
    pdf_bytes = _create_sample_pdf(2)

    # Compress
    resp = client.post(
        "/api/optimize/compress",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "quality": "50"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202

    # Repair
    resp = client.post(
        "/api/optimize/repair",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202

    # Info (synchronous)
    resp = client.post(
        "/api/optimize/info",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    info = resp.get_json()
    assert info["page_count"] == 2


# ─── Security Tests ──────────────────────────────────────────────────────────

def test_protect_and_unprotect_pdf(sample_pdf_3pages, tmp_path):
    protected_pdf = tmp_path / "protected.pdf"
    res_prot = protect_pdf(sample_pdf_3pages, protected_pdf, user_password="secretpassword")
    assert protected_pdf.exists()
    assert res_prot["total_pages"] == 3

    # Verify that reading without password detects encryption
    reader = PdfReader(str(protected_pdf))
    assert reader.is_encrypted

    # Unprotect with password
    unprotected_pdf = tmp_path / "unprotected.pdf"
    res_unprot = unprotect_pdf(protected_pdf, unprotected_pdf, password="secretpassword")
    assert unprotected_pdf.exists()
    assert res_unprot["total_pages"] == 3

    # Verify unprotected can be read directly
    reader_unprot = PdfReader(str(unprotected_pdf))
    assert len(reader_unprot.pages) == 3


def test_unprotect_wrong_password(sample_pdf_3pages, tmp_path):
    protected_pdf = tmp_path / "protected.pdf"
    protect_pdf(sample_pdf_3pages, protected_pdf, user_password="correctpassword")

    unprotected_pdf = tmp_path / "unprotected.pdf"
    with pytest.raises(PdfSecurityError):
        unprotect_pdf(protected_pdf, unprotected_pdf, password="wrongpassword")


def test_security_api_routes(client):
    pdf_bytes = _create_sample_pdf(2)

    resp = client.post(
        "/api/security/protect",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "user_password": "test"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202


# ─── Edit Tests ──────────────────────────────────────────────────────────────

def test_add_watermark(sample_pdf_3pages, tmp_path):
    out_pdf = tmp_path / "watermarked.pdf"
    res = add_watermark(sample_pdf_3pages, out_pdf, text="CONFIDENTIAL", opacity=0.2, font_size=40)
    assert out_pdf.exists()
    assert res["total_pages"] == 3
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 3


def test_add_page_numbers(sample_pdf_3pages, tmp_path):
    out_pdf = tmp_path / "numbered.pdf"
    res = add_page_numbers(sample_pdf_3pages, out_pdf, position="bottom-center", fmt="Page {n} of {total}")
    assert out_pdf.exists()
    assert res["total_pages"] == 3
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 3


def test_add_header_footer(sample_pdf_3pages, tmp_path):
    out_pdf = tmp_path / "header_footer.pdf"
    res = add_header_footer(sample_pdf_3pages, out_pdf,
                            header_left="Title", header_right="Confidential",
                            footer_center="Page {n}")
    assert out_pdf.exists()
    assert res["total_pages"] == 3
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 3


def test_crop_pdf(sample_pdf_3pages, tmp_path):
    out_pdf = tmp_path / "cropped.pdf"
    res = crop_pdf(sample_pdf_3pages, out_pdf, top=20, bottom=20, left=10, right=10, unit="pt")
    assert out_pdf.exists()
    assert res["total_pages"] == 3
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 3
    box = reader.pages[0].mediabox
    # Original was 300x300, trimmed 10 left + 10 right = 280 width, 20 top + 20 bottom = 260 height
    assert float(box.width) == 280.0
    assert float(box.height) == 260.0


def test_edit_api_routes(client):
    pdf_bytes = _create_sample_pdf(2)

    # Watermark
    resp = client.post(
        "/api/edit/watermark",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "text": "TEST"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202

    # Page Numbers
    resp = client.post(
        "/api/edit/page-numbers",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "format": "{n}"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202

    # Header & Footer
    resp = client.post(
        "/api/edit/header-footer",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "footer_center": "{n}/{total}"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202

    # Crop
    resp = client.post(
        "/api/edit/crop",
        data={"file": (io.BytesIO(pdf_bytes), "doc.pdf"), "top": "10", "unit": "pt"},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 202
