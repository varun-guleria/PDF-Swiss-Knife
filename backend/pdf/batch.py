"""
pdf/batch.py — Batch PDF merge engine.

For each unique PDF, merges all repeating PDFs (in order) followed by the
unique PDF into one output file.  Continues processing on per-file errors
and records failures for the caller.

Output count = len(unique_pdfs).
"""

from pathlib import Path
from typing import List, Callable, Optional, Dict, Any

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError


class PdfBatchError(Exception):
    """Raised for fatal batch-level errors (e.g. no inputs)."""
    pass


def _safe_read(pdf_path: Path) -> PdfReader:
    """Open a PDF, attempting empty-password decryption if encrypted."""
    reader = PdfReader(str(pdf_path))
    if reader.is_encrypted:
        try:
            if not reader.decrypt(""):
                raise PdfBatchError(
                    f"'{pdf_path.name}' is password-protected. "
                    "Remove protection before batch processing."
                )
        except Exception:
            raise PdfBatchError(
                f"'{pdf_path.name}' is password-protected. "
                "Remove protection before batch processing."
            )
    return reader


def batch_merge(
    repeating_paths: List[Path],
    unique_paths: List[Path],
    output_dir: Path,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
) -> Dict[str, Any]:
    """
    Generate one merged PDF per unique file.

    Each output = repeating_pdfs (in order) + one unique PDF.

    Args:
        repeating_paths: Ordered list of repeating PDF file paths.
        unique_paths:    List of unique PDF file paths (one output per entry).
        output_dir:      Directory for the generated output PDFs.
        progress_callback: Optional fn(current_index, total_count, filename).

    Returns:
        Dict with keys:
            output_dir   – Path
            total        – int
            completed    – int
            failed       – int
            errors       – list[dict]  (each: {filename, reason})
            output_files – list[str]   (basenames of successfully written files)

    Raises:
        PdfBatchError: If no repeating or no unique PDFs are provided, or
                       if a repeating PDF cannot be read (fatal).
    """
    if not repeating_paths:
        raise PdfBatchError("At least one repeating PDF is required.")
    if not unique_paths:
        raise PdfBatchError("At least one unique PDF is required.")

    # Validate all repeating PDFs exist
    for rp in repeating_paths:
        if not rp.exists():
            raise PdfBatchError(f"Repeating file does not exist: {rp.name}")

    # Pre-read repeating PDFs once — they are shared across all outputs.
    # If any repeating PDF is unreadable, it is a fatal error.
    repeating_readers: List[PdfReader] = []
    for rp in repeating_paths:
        try:
            repeating_readers.append(_safe_read(rp))
        except Exception as e:
            raise PdfBatchError(
                f"Cannot read repeating file '{rp.name}': {e}"
            )

    output_dir.mkdir(parents=True, exist_ok=True)

    total = len(unique_paths)
    completed = 0
    failed = 0
    errors: List[Dict[str, str]] = []
    output_files: List[str] = []

    for idx, unique_path in enumerate(unique_paths, start=1):
        # Derive output name from unique file stem
        out_name = unique_path.stem + "_merged.pdf"

        if progress_callback:
            progress_callback(idx, total, out_name)

        if not unique_path.exists():
            errors.append({"filename": unique_path.name, "reason": "File does not exist"})
            failed += 1
            continue

        try:
            unique_reader = _safe_read(unique_path)
        except Exception as e:
            errors.append({"filename": unique_path.name, "reason": str(e)})
            failed += 1
            continue

        try:
            writer = PdfWriter()

            # Add all repeating pages
            for reader in repeating_readers:
                for page in reader.pages:
                    writer.add_page(page)

            # Add unique pages
            for page in unique_reader.pages:
                writer.add_page(page)

            out_path = output_dir / out_name
            with open(out_path, "wb") as f_out:
                writer.write(f_out)

            output_files.append(out_name)
            completed += 1
        except Exception as e:
            errors.append({"filename": unique_path.name, "reason": str(e)})
            failed += 1

    return {
        "output_dir": output_dir,
        "total": total,
        "completed": completed,
        "failed": failed,
        "errors": errors,
        "output_files": output_files,
    }
