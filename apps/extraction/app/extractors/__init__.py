"""
PDF extraction pipeline.

Cascading fallback: PyMuPDF (native text) → pdfplumber (layouts/tables)
→ Mistral OCR (scanned/image PDFs).
"""

import logging

import httpx

from .pymupdf import extract_with_pymupdf
from .pdfplumber import extract_with_pdfplumber
from .mistral_ocr import extract_with_mistral_ocr

logger = logging.getLogger(__name__)


async def download_file(file_url: str) -> bytes:
    """Fetch a file's bytes over HTTP."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(file_url)
        resp.raise_for_status()
        return resp.content


async def extract_pdf(pdf_bytes: bytes) -> dict:
    """Run the cascading extraction pipeline against a PDF byte string."""
    result = extract_with_pymupdf(pdf_bytes)
    if result:
        logger.info("Extraction succeeded with PyMuPDF")
        return result

    result = extract_with_pdfplumber(pdf_bytes)
    if result:
        logger.info("Extraction succeeded with pdfplumber")
        return result

    result = await extract_with_mistral_ocr(pdf_bytes)
    if result:
        logger.info("Extraction succeeded with Mistral OCR")
        return result

    raise ValueError("All extraction methods failed — file may be corrupt or empty")


__all__ = [
    "download_file",
    "extract_pdf",
    "extract_with_pymupdf",
    "extract_with_pdfplumber",
    "extract_with_mistral_ocr",
]
