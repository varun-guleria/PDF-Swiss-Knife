"""
pdf/merge.py — Core PDF merge engine.

Merges multiple PDF files in specified order into a single PDF document.
Uses pypdf for high performance and minimal memory usage.
"""


from typing import List, Callable, Optional, Dict, Any
from pathlib import Path
from pypdf import PdfReader, PdfWriter


class PdfMergeError(Exception):
    """Custom exception raised when PDF merge fails."""
    pass


def merge_pdfs(
    input_paths: List[Path],
    output_path: Path,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
) -> Dict[str, Any]:
    """
    Merge multiple PDF files into one.

    Args:
        input_paths: Ordered list of paths to input PDF files.
        output_path: Destination path for the merged PDF.
        progress_callback: Optional function(current_index, total_count, filename).

    Returns:
        Dict containing:
            - output_path: Path to the generated PDF
            - total_pages: Total number of pages in the merged document
            - file_size: Size in bytes of the generated file
            - input_count: Number of input files merged

    Raises:
        PdfMergeError: If fewer than 2 files provided, any file is missing,
                       encrypted with password, or corrupt.
    """
    if not input_paths or len(input_paths) < 2:
        raise PdfMergeError("At least 2 PDF files are required for merging.")

    total_files = len(input_paths)
    writer = PdfWriter()
    total_pages = 0

    for idx, file_path in enumerate(input_paths, start=1):
        if not file_path.exists():
            raise PdfMergeError(f"Input file does not exist: {file_path.name}")

        if progress_callback:
            progress_callback(idx, total_files, file_path.name)

        try:
            reader = PdfReader(str(file_path))
        except Exception as e:
            raise PdfMergeError(f"Failed to read '{file_path.name}': {str(e)}")

        if reader.is_encrypted:
            # Attempt to decrypt with empty password
            try:
                decrypted = reader.decrypt("")
                if not decrypted:
                    raise PdfMergeError(
                        f"File '{file_path.name}' is password-protected. "
                        "Please remove password protection before merging."
                    )
            except Exception:
                raise PdfMergeError(
                    f"File '{file_path.name}' is password-protected. "
                    "Please remove password protection before merging."
                )

        try:
            num_pages = len(reader.pages)
            for page in reader.pages:
                writer.add_page(page)
            total_pages += num_pages
        except Exception as e:
            raise PdfMergeError(f"Error processing pages in '{file_path.name}': {str(e)}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(output_path, "wb") as f_out:
            writer.write(f_out)
    except Exception as e:
        raise PdfMergeError(f"Failed to write merged output file: {str(e)}")

    return {
        "output_path": output_path,
        "total_pages": total_pages,
        "file_size": output_path.stat().st_size,
        "input_count": total_files,
    }
