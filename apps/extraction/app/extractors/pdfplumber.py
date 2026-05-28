"""pdfplumber fallback — better at tables and complex layouts."""

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)

MIN_TEXT_LENGTH = 50


def extract_with_pdfplumber(pdf_bytes: bytes) -> dict | None:
    """Extract text via pdfplumber. Returns None when output is too thin."""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)
            pages: list[dict] = []
            full_text = ""

            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or "").strip()
                pages.append({"page": i + 1, "text": text})
                full_text += text + "\n"
    except Exception as e:
        logger.warning("pdfplumber extraction failed: %s", e)
        return None

    stripped = full_text.strip()
    if len(stripped) < MIN_TEXT_LENGTH:
        logger.info("pdfplumber: insufficient text extracted (%d chars)", len(stripped))
        return None

    return {
        "text": stripped,
        "method": "pdfplumber",
        "confidence": 0.88,
        "page_count": page_count,
        "pages": pages,
        "metadata": {},
    }
