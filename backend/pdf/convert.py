"""
pdf/convert.py — PDF ↔ Image conversion engine.

  - pdf_to_images: Render each PDF page to an image file (PNG/JPEG).
  - images_to_pdf: Combine image files into a single PDF using img2pdf.
"""

import io

from typing import List, Dict, Any, Optional, Callable

import pypdfium2 as pdfium
from PIL import Image


class PdfConvertError(Exception):
    """Raised when conversion fails."""
    pass


def pdf_to_images(
    input_path: Path,
    output_dir: Path,
    fmt: str = "png",
    dpi: int = 150,
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Render every page of a PDF to image files.

    Args:
        input_path: Path to source PDF.
        output_dir: Directory for output images.
        fmt: 'png' or 'jpeg'.
        dpi: Render resolution (72–600).
        progress_callback: fn(current, total, filename).

    Returns:
        Dict with total, output_files list.
    """
    if not input_path.exists():
        raise PdfConvertError(f"File not found: {input_path.name}")

    fmt = fmt.lower()
    if fmt not in ("png", "jpeg", "jpg"):
        raise PdfConvertError(f"Unsupported format: {fmt}. Use 'png' or 'jpeg'.")
    if fmt == "jpg":
        fmt = "jpeg"
    ext = "png" if fmt == "png" else "jpg"

    dpi = max(72, min(dpi, 600))
    scale = dpi / 72.0

    output_dir.mkdir(parents=True, exist_ok=True)
    stem = input_path.stem

    try:
        doc = pdfium.PdfDocument(str(input_path))
    except Exception as e:
        raise PdfConvertError(f"Cannot open '{input_path.name}': {e}")

    total_pages = len(doc)
    output_files = []

    for idx in range(total_pages):
        page_num = idx + 1
        out_name = f"{stem}_page{page_num}.{ext}"

        if progress_callback:
            progress_callback(page_num, total_pages, out_name)

        try:
            page = doc.get_page(idx)
            pil_img = page.render(scale=scale).to_pil()

            if fmt == "jpeg" and pil_img.mode in ("RGBA", "LA", "P"):
                pil_img = pil_img.convert("RGB")

            out_path = output_dir / out_name
            save_kwargs = {"format": fmt.upper()}
            if fmt == "jpeg":
                save_kwargs["quality"] = 90
            pil_img.save(str(out_path), **save_kwargs)
            output_files.append(out_name)
        except Exception as e:
            raise PdfConvertError(f"Failed to render page {page_num}: {e}")

    return {
        "total": total_pages,
        "output_files": output_files,
    }


def images_to_pdf(
    input_paths: List[Path],
    output_path: Path,
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Combine image files into a single PDF.

    Uses img2pdf for lossless embedding when possible,
    falls back to Pillow for unsupported formats.

    Args:
        input_paths: Ordered list of image file paths.
        output_path: Destination PDF path.
        progress_callback: fn(current, total, filename).

    Returns:
        Dict with total_pages, file_size, output_path.
    """
    if not input_paths:
        raise PdfConvertError("At least one image is required.")

    # Validate all images exist and are readable
    for p in input_paths:
        if not p.exists():
            raise PdfConvertError(f"Image not found: {p.name}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import img2pdf

        image_bytes_list = []
        for idx, img_path in enumerate(input_paths, start=1):
            if progress_callback:
                progress_callback(idx, len(input_paths), img_path.name)
            # img2pdf needs bytes or file paths
            with open(img_path, "rb") as f:
                data = f.read()
            # Check if img2pdf can handle this format
            try:
                img2pdf.convert(data)  # dry-run test
                image_bytes_list.append(data)
            except Exception:
                # Fallback: convert to JPEG bytes via Pillow
                pil_img = Image.open(img_path).convert("RGB")
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG", quality=95)
                image_bytes_list.append(buf.getvalue())

        pdf_bytes = img2pdf.convert(image_bytes_list)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

    except ImportError:
        # Fallback: use Pillow directly
        images = []
        for idx, img_path in enumerate(input_paths, start=1):
            if progress_callback:
                progress_callback(idx, len(input_paths), img_path.name)
            img = Image.open(img_path).convert("RGB")
            images.append(img)

        if not images:
            raise PdfConvertError("No images could be loaded.")

        images[0].save(
            str(output_path), "PDF",
            save_all=True,
            append_images=images[1:],
            resolution=150,
        )

    return {
        "total_pages": len(input_paths),
        "file_size": output_path.stat().st_size,
        "output_path": output_path,
    }
