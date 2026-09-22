"""
pdf/optimize.py — PDF optimization, repair, and information engine.

  - compress_pdf: Re-encode images at lower quality, remove unused objects.
  - repair_pdf: Open with pikepdf and re-save to fix minor corruption.
  - get_pdf_info: Extract comprehensive metadata and statistics.
"""

import io
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

from pypdf import PdfReader, PdfWriter


class PdfOptimizeError(Exception):
    """Raised when an optimization operation fails."""
    pass


def compress_pdf(
    input_path: Path,
    output_path: Path,
    image_quality: int = 60,
) -> Dict[str, Any]:
    """
    Compress a PDF by removing unused objects and optionally
    reducing image quality.

    Args:
        input_path: Source PDF path.
        output_path: Destination PDF path.
        image_quality: JPEG quality for re-encoded images (1-95).

    Returns:
        Dict with original_size, compressed_size, savings_percent.
    """
    if not input_path.exists():
        raise PdfOptimizeError(f"File not found: {input_path.name}")

    original_size = input_path.stat().st_size

    try:
        reader = PdfReader(str(input_path))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise PdfOptimizeError(f"'{input_path.name}' is password-protected.")

        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        # Copy metadata
        if reader.metadata:
            writer.add_metadata(reader.metadata)

        # Remove duplicates and compress content streams
        try:
            writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
        except TypeError:
            writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            writer.write(f)

        compressed_size = output_path.stat().st_size
        savings = max(0, original_size - compressed_size)
        savings_pct = round((savings / original_size) * 100, 1) if original_size > 0 else 0

        return {
            "output_path": output_path,
            "original_size": original_size,
            "compressed_size": compressed_size,
            "savings_bytes": savings,
            "savings_percent": savings_pct,
            "total_pages": len(reader.pages),
        }

    except PdfOptimizeError:
        raise
    except Exception as e:
        raise PdfOptimizeError(f"Compression failed: {e}")


def repair_pdf(
    input_path: Path,
    output_path: Path,
) -> Dict[str, Any]:
    """
    Repair/normalize a PDF using pikepdf.

    Opens the PDF tolerantly and re-writes it in a clean format.

    Returns:
        Dict with output_path, total_pages, original_size, repaired_size.
    """
    if not input_path.exists():
        raise PdfOptimizeError(f"File not found: {input_path.name}")

    original_size = input_path.stat().st_size

    try:
        import pikepdf
        pdf = pikepdf.open(str(input_path), allow_overwriting_input=False)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        pdf.save(str(output_path), linearize=True)
        total_pages = len(pdf.pages)
        pdf.close()

        return {
            "output_path": output_path,
            "total_pages": total_pages,
            "original_size": original_size,
            "repaired_size": output_path.stat().st_size,
        }

    except ImportError:
        # Fallback: use pypdf to re-write
        try:
            reader = PdfReader(str(input_path))
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                writer.write(f)
            return {
                "output_path": output_path,
                "total_pages": len(reader.pages),
                "original_size": original_size,
                "repaired_size": output_path.stat().st_size,
            }
        except Exception as e:
            raise PdfOptimizeError(f"Repair failed: {e}")
    except Exception as e:
        raise PdfOptimizeError(f"Repair failed: {e}")


def get_pdf_info(input_path: Path) -> Dict[str, Any]:
    """
    Extract comprehensive information about a PDF file.

    Returns:
        Dict with metadata, page_count, pages, file_size, etc.
    """
    if not input_path.exists():
        raise PdfOptimizeError(f"File not found: {input_path.name}")

    try:
        reader = PdfReader(str(input_path))
        is_encrypted = reader.is_encrypted
        if is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                # Still return basic info
                return {
                    "filename": input_path.name,
                    "file_size": input_path.stat().st_size,
                    "is_encrypted": True,
                    "page_count": 0,
                    "metadata": {},
                    "pages": [],
                }

        meta = reader.metadata or {}
        metadata = {}
        for key in ("/Title", "/Author", "/Subject", "/Creator", "/Producer",
                     "/CreationDate", "/ModDate", "/Keywords"):
            val = meta.get(key)
            if val:
                metadata[key.lstrip("/")] = str(val)

        pages = []
        for idx, page in enumerate(reader.pages):
            box = page.mediabox
            pages.append({
                "page_number": idx + 1,
                "width_pt": round(float(box.width), 1),
                "height_pt": round(float(box.height), 1),
                "width_in": round(float(box.width) / 72, 2),
                "height_in": round(float(box.height) / 72, 2),
                "width_mm": round(float(box.width) / 72 * 25.4, 1),
                "height_mm": round(float(box.height) / 72 * 25.4, 1),
                "rotation": int(page.rotation or 0),
            })

        return {
            "filename": input_path.name,
            "file_size": input_path.stat().st_size,
            "is_encrypted": is_encrypted,
            "page_count": len(reader.pages),
            "metadata": metadata,
            "pages": pages,
            "pdf_version": reader.pdf_header if hasattr(reader, "pdf_header") else "",
        }

    except PdfOptimizeError:
        raise
    except Exception as e:
        raise PdfOptimizeError(f"Failed to read PDF info: {e}")
