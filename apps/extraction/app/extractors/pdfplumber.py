"""pdfplumber fallback — better at tables and complex layouts."""

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)

MIN_TEXT_LENGTH = 50


def _tables_to_text(tables: list) -> str:
    """Convert pdfplumber table rows into plain text lines.

    Each table is a list of rows, and each row is a list of cell values.
    Cells are joined with double-space and rows with newlines.
    """
    lines: list[str] = []
    for table in tables:
        for row in table:
            if not row:
                continue
            # Filter out None cells and strip whitespace
            cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
            if cells:
                lines.append("  ".join(cells))
    return "\n".join(lines)


def extract_with_pdfplumber(pdf_bytes: bytes) -> dict | None:
    """Extract text via pdfplumber using both text and table extraction.

    For each page:
      1. ``extract_text()`` — standard text extraction.
      2. ``extract_tables()`` — structured table extraction for tabular lab data.

    Table rows are appended to the page text to ensure biomarkers in
    table structures are not missed.

    Returns None when output is too thin.
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)
            pages: list[dict] = []
            full_text = ""

            for i, page in enumerate(pdf.pages):
                # Standard text extraction
                text = (page.extract_text() or "").strip()

                # Table extraction — captures data in structured table cells
                try:
                    tables = page.extract_tables() or []
                    table_text = _tables_to_text(tables)
                    if table_text:
                        text = text + "\n" + table_text if text else table_text
                except Exception as te:
                    logger.debug("pdfplumber table extraction failed on page %d: %s", i + 1, te)

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

