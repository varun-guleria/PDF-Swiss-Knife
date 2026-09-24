"""
pdf/edit.py — PDF editing operations engine.

  - add_watermark: Overlay text/diagonal watermark on every page.
  - add_page_numbers: Stamp page numbers on every page.
  - add_header_footer: Stamp header and/or footer text on every page.
"""

import io

from typing import Dict, Any, Optional

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from pathlib import Path


class PdfEditError(Exception):
    """Raised when an edit operation fails."""
    pass


def _open_reader(pdf_path: Path) -> PdfReader:
    if not pdf_path.exists():
        raise PdfEditError(f"File not found: {pdf_path.name}")
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as e:
        raise PdfEditError(f"Cannot read '{pdf_path.name}': {e}")
    if reader.is_encrypted:
        try:
            if not reader.decrypt(""):
                raise PdfEditError(f"'{pdf_path.name}' is password-protected.")
        except PdfEditError:
            raise
        except Exception:
            raise PdfEditError(f"'{pdf_path.name}' is password-protected.")
    return reader


def _create_stamp(width: float, height: float, draw_fn) -> bytes:
    """Create a single-page PDF stamp of given size using a draw function."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    draw_fn(c, width, height)
    c.save()
    return buf.getvalue()


def add_watermark(
    input_path: Path,
    output_path: Path,
    text: str = "DRAFT",
    opacity: float = 0.15,
    font_size: int = 60,
    color: str = "#888888",
    rotation: int = 45,
) -> Dict[str, Any]:
    """
    Add a diagonal text watermark to every page.

    Args:
        text: Watermark text.
        opacity: 0.0 (invisible) to 1.0 (fully opaque).
        font_size: Text size in points.
        color: Hex color string (e.g. '#FF0000').
        rotation: Rotation angle in degrees.
    """
    reader = _open_reader(input_path)
    writer = PdfWriter()

    # Parse hex color
    try:
        r = int(color[1:3], 16) / 255
        g = int(color[3:5], 16) / 255
        b = int(color[5:7], 16) / 255
    except (ValueError, IndexError):
        r, g, b = 0.5, 0.5, 0.5

    for page in reader.pages:
        box = page.mediabox
        w, h = float(box.width), float(box.height)

        def draw(c, w, h, text=text, opacity=opacity, font_size=font_size,
                 r=r, g=g, b=b, rotation=rotation):
            c.saveState()
            c.setFillColor(Color(r, g, b, alpha=opacity))
            c.setFont("Helvetica-Bold", font_size)
            c.translate(w / 2, h / 2)
            c.rotate(rotation)
            c.drawCentredString(0, 0, text)
            c.restoreState()

        stamp_bytes = _create_stamp(w, h, draw)
        stamp_reader = PdfReader(io.BytesIO(stamp_bytes))
        page.merge_page(stamp_reader.pages[0])
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        writer.write(f)

    return {
        "output_path": output_path,
        "total_pages": len(reader.pages),
        "file_size": output_path.stat().st_size,
    }


def add_page_numbers(
    input_path: Path,
    output_path: Path,
    position: str = "bottom-center",
    start_number: int = 1,
    font_size: int = 11,
    fmt: str = "{n}",
) -> Dict[str, Any]:
    """
    Add page numbers to every page.

    Args:
        position: One of 'bottom-left', 'bottom-center', 'bottom-right',
                  'top-left', 'top-center', 'top-right'.
        start_number: Starting page number.
        font_size: Text size in points.
        fmt: Format string. Use {n} for page number, {total} for total pages.
    """
    reader = _open_reader(input_path)
    total_pages = len(reader.pages)
    writer = PdfWriter()

    for idx, page in enumerate(reader.pages):
        box = page.mediabox
        w, h = float(box.width), float(box.height)
        page_num = start_number + idx

        label = fmt.replace("{n}", str(page_num)).replace("{total}", str(total_pages))

        def draw(c, w, h, label=label, position=position, font_size=font_size):
            c.saveState()
            c.setFont("Helvetica", font_size)
            c.setFillColor(Color(0.3, 0.3, 0.3, alpha=0.9))
            margin = 36  # 0.5 inch

            if "bottom" in position:
                y = margin
            else:
                y = h - margin

            if "left" in position:
                c.drawString(margin, y, label)
            elif "right" in position:
                c.drawRightString(w - margin, y, label)
            else:
                c.drawCentredString(w / 2, y, label)
            c.restoreState()

        stamp_bytes = _create_stamp(w, h, draw)
        stamp_reader = PdfReader(io.BytesIO(stamp_bytes))
        page.merge_page(stamp_reader.pages[0])
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        writer.write(f)

    return {
        "output_path": output_path,
        "total_pages": total_pages,
        "file_size": output_path.stat().st_size,
    }


def add_header_footer(
    input_path: Path,
    output_path: Path,
    header_left: str = "",
    header_center: str = "",
    header_right: str = "",
    footer_left: str = "",
    footer_center: str = "",
    footer_right: str = "",
    font_size: int = 9,
) -> Dict[str, Any]:
    """
    Add header and/or footer text to every page.

    Text can include {n} for page number and {total} for total pages.
    """
    reader = _open_reader(input_path)
    total_pages = len(reader.pages)
    writer = PdfWriter()

    for idx, page in enumerate(reader.pages):
        box = page.mediabox
        w, h = float(box.width), float(box.height)
        page_num = idx + 1

        def make_text(tmpl, n=page_num, total=total_pages):
            return tmpl.replace("{n}", str(n)).replace("{total}", str(total))

        hl = make_text(header_left)
        hc = make_text(header_center)
        hr = make_text(header_right)
        fl = make_text(footer_left)
        fc = make_text(footer_center)
        fr = make_text(footer_right)

        def draw(c, w, h, hl=hl, hc=hc, hr=hr, fl=fl, fc=fc, fr=fr, font_size=font_size):
            c.saveState()
            c.setFont("Helvetica", font_size)
            c.setFillColor(Color(0.3, 0.3, 0.3, alpha=0.9))
            margin = 36
            header_y = h - margin
            footer_y = margin

            if hl: c.drawString(margin, header_y, hl)
            if hc: c.drawCentredString(w / 2, header_y, hc)
            if hr: c.drawRightString(w - margin, header_y, hr)
            if fl: c.drawString(margin, footer_y, fl)
            if fc: c.drawCentredString(w / 2, footer_y, fc)
            if fr: c.drawRightString(w - margin, footer_y, fr)
            c.restoreState()

        stamp_bytes = _create_stamp(w, h, draw)
        stamp_reader = PdfReader(io.BytesIO(stamp_bytes))
        page.merge_page(stamp_reader.pages[0])
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        writer.write(f)

    return {
        "output_path": output_path,
        "total_pages": total_pages,
        "file_size": output_path.stat().st_size,
    }


def crop_pdf(
    input_path: Path,
    output_path: Path,
    top: float = 0.0,
    bottom: float = 0.0,
    left: float = 0.0,
    right: float = 0.0,
    unit: str = "pt",
) -> Dict[str, Any]:
    """
    Crop margins from all pages of a PDF.

    Args:
        input_path: Source PDF.
        output_path: Destination PDF.
        top, bottom, left, right: Margin amounts to trim.
        unit: 'pt' (points), 'in' (inches), 'mm' (millimeters), or '%' (percentage).
    """
    reader = _open_reader(input_path)
    total_pages = len(reader.pages)
    writer = PdfWriter()

    for page in reader.pages:
        box = page.mediabox
        w = float(box.width)
        h = float(box.height)

        if unit == "in":
            scale = 72.0
            t_pts, b_pts, l_pts, r_pts = top * scale, bottom * scale, left * scale, right * scale
        elif unit == "mm":
            scale = 72.0 / 25.4
            t_pts, b_pts, l_pts, r_pts = top * scale, bottom * scale, left * scale, right * scale
        elif unit == "%":
            t_pts = (top / 100.0) * h
            b_pts = (bottom / 100.0) * h
            l_pts = (left / 100.0) * w
            r_pts = (right / 100.0) * w
        else:  # pt
            t_pts, b_pts, l_pts, r_pts = top, bottom, left, right

        new_ll_x = float(box.left) + l_pts
        new_ll_y = float(box.bottom) + b_pts
        new_ur_x = float(box.right) - r_pts
        new_ur_y = float(box.top) - t_pts

        if new_ll_x >= new_ur_x or new_ll_y >= new_ur_y:
            raise PdfEditError("Crop margins are too large; resulting page would have non-positive dimensions.")

        page.cropbox.lower_left = (new_ll_x, new_ll_y)
        page.cropbox.upper_right = (new_ur_x, new_ur_y)
        page.mediabox.lower_left = (new_ll_x, new_ll_y)
        page.mediabox.upper_right = (new_ur_x, new_ur_y)
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        writer.write(f)

    return {
        "output_path": output_path,
        "total_pages": total_pages,
        "file_size": output_path.stat().st_size,
    }
