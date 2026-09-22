"""
pdf/security.py — PDF protection and password management engine.

  - protect_pdf: Add password encryption and permission restrictions.
  - unprotect_pdf: Remove password protection from a PDF.
"""

from pathlib import Path
from typing import Dict, Any, Optional


class PdfSecurityError(Exception):
    """Raised when a security operation fails."""
    pass


def protect_pdf(
    input_path: Path,
    output_path: Path,
    user_password: str = "",
    owner_password: str = "",
    allow_printing: bool = True,
    allow_copying: bool = False,
) -> Dict[str, Any]:
    """
    Encrypt a PDF with password protection.

    Args:
        input_path: Source PDF.
        output_path: Destination PDF.
        user_password: Password required to open the PDF (empty = no open password).
        owner_password: Password for full permissions (if empty, same as user_password).
        allow_printing: Whether printing is allowed.
        allow_copying: Whether text/image copying is allowed.

    Returns:
        Dict with output_path, total_pages, file_size.
    """
    if not input_path.exists():
        raise PdfSecurityError(f"File not found: {input_path.name}")

    if not user_password and not owner_password:
        raise PdfSecurityError("At least one password (user or owner) is required.")

    try:
        import pikepdf

        pdf = pikepdf.open(str(input_path))

        permissions = pikepdf.Permissions(
            print_lowres=allow_printing,
            print_highres=allow_printing,
            extract=allow_copying,
            modify_annotation=False,
            modify_assembly=False,
            modify_form=False,
            modify_other=False,
            accessibility=True,
        )

        owner_pw = owner_password or user_password
        user_pw = user_password

        encryption = pikepdf.Encryption(
            owner=owner_pw,
            user=user_pw,
            allow=permissions,
            aes=True,
            R=6,
        )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        pdf.save(str(output_path), encryption=encryption)
        total_pages = len(pdf.pages)
        pdf.close()

        return {
            "output_path": output_path,
            "total_pages": total_pages,
            "file_size": output_path.stat().st_size,
        }

    except ImportError:
        # Fallback: pypdf encryption
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        writer.encrypt(
            user_password=user_password,
            owner_password=owner_password or user_password,
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            writer.write(f)
        return {
            "output_path": output_path,
            "total_pages": len(reader.pages),
            "file_size": output_path.stat().st_size,
        }
    except PdfSecurityError:
        raise
    except Exception as e:
        raise PdfSecurityError(f"Protection failed: {e}")


def unprotect_pdf(
    input_path: Path,
    output_path: Path,
    password: str = "",
) -> Dict[str, Any]:
    """
    Remove password protection from a PDF.

    Args:
        input_path: Source encrypted PDF.
        output_path: Destination unprotected PDF.
        password: Password to decrypt (try empty string first).

    Returns:
        Dict with output_path, total_pages, file_size.
    """
    if not input_path.exists():
        raise PdfSecurityError(f"File not found: {input_path.name}")

    try:
        import pikepdf

        try:
            pdf = pikepdf.open(str(input_path), password=password)
        except pikepdf._core.PasswordError:
            raise PdfSecurityError(
                "Incorrect password. Please provide the correct password to unlock this PDF."
            )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        pdf.save(str(output_path))
        total_pages = len(pdf.pages)
        pdf.close()

        return {
            "output_path": output_path,
            "total_pages": total_pages,
            "file_size": output_path.stat().st_size,
        }

    except ImportError:
        # Fallback: pypdf
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        if reader.is_encrypted:
            result = reader.decrypt(password)
            if not result:
                raise PdfSecurityError("Incorrect password.")

        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            writer.write(f)
        return {
            "output_path": output_path,
            "total_pages": len(reader.pages),
            "file_size": output_path.stat().st_size,
        }
    except PdfSecurityError:
        raise
    except Exception as e:
        raise PdfSecurityError(f"Failed to remove protection: {e}")
