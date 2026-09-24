from pathlib import Path
"""
pdf/pages.py — Page-level operations engine.

Handles PDF inspection, high-performance page thumbnail rendering via pypdfium2,
and page manipulations (reorder, rotate, delete, duplicate, extract) via pypdf.
"""

import io

from typing import List, Dict, Any, Optional
from pypdf import PdfReader, PdfWriter
import pypdfium2 as pdfium


class PdfPageError(Exception):
    """Custom exception raised for PDF page operations."""
    pass


def get_pdf_pages_info(pdf_path: Path) -> Dict[str, Any]:
    """
    Inspect a PDF and return its page count and per-page dimensions.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        Dict with 'page_count' and list of 'pages' metadata.
    """
    if not pdf_path.exists():
        raise PdfPageError(f"File not found: {pdf_path.name}")

    try:
        reader = PdfReader(str(pdf_path))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise PdfPageError(f"PDF is encrypted: {pdf_path.name}")

        page_count = len(reader.pages)
        pages_info = []

        for idx, page in enumerate(reader.pages):
            box = page.mediabox
            width = float(box.width)
            height = float(box.height)
            rotation = page.rotation or 0
            pages_info.append({
                "index": idx,
                "page_number": idx + 1,
                "width": round(width, 1),
                "height": round(height, 1),
                "rotation": int(rotation),
            })

        return {
            "filename": pdf_path.name,
            "page_count": page_count,
            "pages": pages_info,
        }
    except Exception as e:
        raise PdfPageError(f"Failed to inspect PDF '{pdf_path.name}': {str(e)}")


def render_page_thumbnail(pdf_path: Path, page_index: int, max_dim: int = 280) -> bytes:
    """
    Render a single PDF page to JPEG image bytes for preview.

    Args:
        pdf_path: Path to the PDF file.
        page_index: 0-based page index.
        max_dim: Maximum width or height of the generated thumbnail.

    Returns:
        JPEG image bytes.
    """
    if not pdf_path.exists():
        raise PdfPageError(f"File not found: {pdf_path.name}")

    try:
        doc = pdfium.PdfDocument(str(pdf_path))
        if page_index < 0 or page_index >= len(doc):
            raise PdfPageError(f"Page index {page_index} out of range (0..{len(doc)-1})")

        page = doc.get_page(page_index)
        w, h = page.get_size()
        scale = min(max_dim / max(w, 1), max_dim / max(h, 1), 2.0)

        pil_img = page.render(scale=scale).to_pil()
        # Convert RGBA to RGB for JPEG encoding
        if pil_img.mode in ("RGBA", "LA", "P"):
            rgb_img = pil_img.convert("RGB")
        else:
            rgb_img = pil_img

        buf = io.BytesIO()
        rgb_img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except PdfPageError:
        raise
    except Exception as e:
        raise PdfPageError(f"Failed to render thumbnail for page {page_index}: {str(e)}")


def reorganize_pdf(
    input_path: Path,
    output_path: Path,
    page_specs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Reorganize, rotate, duplicate, or extract pages from an input PDF.

    Args:
        input_path: Path to source PDF.
        output_path: Path to destination PDF.
        page_specs: List of page instructions in order.
            Each item is a dict:
                - "index": int (0-based source page index)
                - "rotation": int (additional rotation in degrees: 0, 90, 180, 270)

    Returns:
        Dict with total_pages, file_size, output_path.
    """
    if not input_path.exists():
        raise PdfPageError(f"Source file not found: {input_path.name}")

    if not page_specs:
        raise PdfPageError("At least one page must be included in the output.")

    try:
        reader = PdfReader(str(input_path))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise PdfPageError(f"PDF is encrypted: {input_path.name}")

        num_source_pages = len(reader.pages)
        writer = PdfWriter()

        import copy
        for spec in page_specs:
            idx = spec.get("index")
            if idx is None or idx < 0 or idx >= num_source_pages:
                raise PdfPageError(f"Invalid page index {idx}. Source document has {num_source_pages} pages.")

            # Make a shallow copy so multiple references with different rotations don't collide
            page = copy.copy(reader.pages[idx])
            extra_rotation = int(spec.get("rotation", 0)) % 360

            if extra_rotation != 0:
                page.rotate(extra_rotation)

            writer.add_page(page)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f_out:
            writer.write(f_out)

        return {
            "output_path": output_path,
            "total_pages": len(page_specs),
            "file_size": output_path.stat().st_size,
        }
    except PdfPageError:
        raise
    except Exception as e:
        raise PdfPageError(f"Failed to reorganize PDF: {str(e)}")
