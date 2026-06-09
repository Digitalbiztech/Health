"""Native PyMuPDF text extraction — fast path for well-formed PDFs."""

import logging

import fitz

logger = logging.getLogger(__name__)

MIN_TEXT_LENGTH = 50


def classify_pdf(pdf_bytes: bytes) -> str:
    """Classify a PDF as ``"text"`` or ``"image"`` based on extractable text.

    Opens the PDF with PyMuPDF, extracts text from all pages, and checks
    whether the total character count exceeds ``MIN_TEXT_LENGTH``.

    Returns ``"text"`` for PDFs with selectable/embedded text, or
    ``"image"`` for scanned/image-only PDFs that need OCR.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.warning("classify_pdf: failed to open document: %s", e)
        return "image"  # Assume image if we can't even open it

    try:
        total_chars = 0
        for page in doc:
            total_chars += len(page.get_text("text").strip())
    except Exception as e:
        logger.warning("classify_pdf: text extraction probe failed: %s", e)
        return "image"
    finally:
        doc.close()

    classification = "text" if total_chars >= MIN_TEXT_LENGTH else "image"
    logger.info(
        "PDF classification: %s (%d chars extracted)",
        classification,
        total_chars,
    )
    return classification


def extract_with_pymupdf(pdf_bytes: bytes) -> dict | None:
    """Extract text page-by-page via PyMuPDF. Returns None when output is too thin."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.warning("PyMuPDF failed to open document: %s", e)
        return None

    try:
        pages: list[dict] = []
        full_text = ""

        for i, page in enumerate(doc):
            text = page.get_text("text").strip()
            pages.append({"page": i + 1, "text": text})
            full_text += text + "\n"
    except Exception as e:
        logger.warning("PyMuPDF extraction failed: %s", e)
        return None
    finally:
        doc.close()

    stripped = full_text.strip()
    if len(stripped) < MIN_TEXT_LENGTH:
        logger.info("PyMuPDF: insufficient text extracted (%d chars)", len(stripped))
        return None

    return {
        "text": stripped,
        "method": "pymupdf",
        "confidence": 0.95,
        "page_count": len(pages),
        "pages": pages,
        "metadata": {},
    }

