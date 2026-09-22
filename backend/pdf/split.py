"""
pdf/split.py — PDF Split engine.

Split a PDF into multiple parts by:
  - Page ranges (e.g. "1-3, 4-6, 7-10")
  - Every N pages
  - Into individual single pages
"""

from pathlib import Path
from typing import List, Dict, Any, Optional, Callable

from pypdf import PdfReader, PdfWriter


class PdfSplitError(Exception):
    """Raised when a split operation fails."""
    pass


def _open_reader(pdf_path: Path) -> PdfReader:
    """Open a PDF for reading, handling encryption."""
    if not pdf_path.exists():
        raise PdfSplitError(f"File not found: {pdf_path.name}")
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as e:
        raise PdfSplitError(f"Cannot read '{pdf_path.name}': {e}")
    if reader.is_encrypted:
        try:
            if not reader.decrypt(""):
                raise PdfSplitError(f"'{pdf_path.name}' is password-protected.")
        except PdfSplitError:
            raise
        except Exception:
            raise PdfSplitError(f"'{pdf_path.name}' is password-protected.")
    return reader


def parse_page_ranges(range_str: str, total_pages: int) -> List[List[int]]:
    """
    Parse a page range string like "1-3, 5, 8-10" into groups of 0-based indices.
    Each comma-separated token becomes one output PDF.
    """
    groups = []
    for part in range_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            tokens = part.split("-", 1)
            try:
                start = int(tokens[0].strip())
                end = int(tokens[1].strip())
            except ValueError:
                raise PdfSplitError(f"Invalid range: '{part}'")
            if start < 1 or end < 1 or start > total_pages or end > total_pages:
                raise PdfSplitError(f"Range {start}-{end} out of bounds (1-{total_pages})")
            if start > end:
                raise PdfSplitError(f"Invalid range: {start} > {end}")
            groups.append(list(range(start - 1, end)))
        else:
            try:
                page = int(part)
            except ValueError:
                raise PdfSplitError(f"Invalid page number: '{part}'")
            if page < 1 or page > total_pages:
                raise PdfSplitError(f"Page {page} out of bounds (1-{total_pages})")
            groups.append([page - 1])
    if not groups:
        raise PdfSplitError("No valid page ranges specified.")
    return groups


def split_by_ranges(
    input_path: Path,
    range_str: str,
    output_dir: Path,
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Split a PDF by custom page ranges."""
    reader = _open_reader(input_path)
    total_pages = len(reader.pages)
    groups = parse_page_ranges(range_str, total_pages)

    output_dir.mkdir(parents=True, exist_ok=True)
    stem = input_path.stem
    output_files = []

    for idx, page_indices in enumerate(groups, start=1):
        if progress_callback:
            progress_callback(idx, len(groups), f"Part {idx}")
        writer = PdfWriter()
        for pi in page_indices:
            writer.add_page(reader.pages[pi])
        out_name = f"{stem}_part{idx}.pdf"
        out_path = output_dir / out_name
        with open(out_path, "wb") as f:
            writer.write(f)
        output_files.append(out_name)

    return {
        "total": len(groups),
        "output_files": output_files,
    }


def split_every_n(
    input_path: Path,
    n: int,
    output_dir: Path,
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Split a PDF into chunks of N pages each."""
    if n < 1:
        raise PdfSplitError("Page count must be at least 1.")
    reader = _open_reader(input_path)
    total_pages = len(reader.pages)
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = input_path.stem
    output_files = []

    import math
    num_chunks = math.ceil(total_pages / n)

    for chunk_idx in range(num_chunks):
        part_num = chunk_idx + 1
        if progress_callback:
            progress_callback(part_num, num_chunks, f"Part {part_num}")
        writer = PdfWriter()
        start = chunk_idx * n
        end = min(start + n, total_pages)
        for pi in range(start, end):
            writer.add_page(reader.pages[pi])
        out_name = f"{stem}_part{part_num}.pdf"
        out_path = output_dir / out_name
        with open(out_path, "wb") as f:
            writer.write(f)
        output_files.append(out_name)

    return {
        "total": num_chunks,
        "output_files": output_files,
    }


def split_into_singles(
    input_path: Path,
    output_dir: Path,
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Split a PDF into one file per page."""
    reader = _open_reader(input_path)
    total_pages = len(reader.pages)
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = input_path.stem
    output_files = []

    for idx in range(total_pages):
        page_num = idx + 1
        if progress_callback:
            progress_callback(page_num, total_pages, f"Page {page_num}")
        writer = PdfWriter()
        writer.add_page(reader.pages[idx])
        out_name = f"{stem}_page{page_num}.pdf"
        out_path = output_dir / out_name
        with open(out_path, "wb") as f:
            writer.write(f)
        output_files.append(out_name)

    return {
        "total": total_pages,
        "output_files": output_files,
    }
