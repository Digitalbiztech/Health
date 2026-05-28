"""Mistral OCR fallback — handles scanned/image-based PDFs."""

import base64
import logging
import os

import httpx

logger = logging.getLogger(__name__)

MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"
MISTRAL_OCR_MODEL = "mistral-ocr-latest"


async def extract_with_mistral_ocr(pdf_bytes: bytes) -> dict | None:
    """Send the PDF to Mistral OCR and parse its markdown response."""
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.error("MISTRAL_API_KEY not set — cannot use Mistral OCR fallback")
        return None

    encoded = base64.b64encode(pdf_bytes).decode("utf-8")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                MISTRAL_OCR_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MISTRAL_OCR_MODEL,
                    "document": {
                        "type": "document_url",
                        "document_url": f"data:application/pdf;base64,{encoded}",
                    },
                },
            )
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.error("Mistral OCR extraction failed: %s", e)
        return None

    pages: list[dict] = []
    full_text = ""

    for i, page in enumerate(payload.get("pages", [])):
        text = page.get("markdown", "").strip()
        pages.append({"page": i + 1, "text": text})
        full_text += text + "\n"

    stripped = full_text.strip()
    if not stripped:
        return None

    return {
        "text": stripped,
        "method": "mistral_ocr",
        "confidence": 0.75,
        "page_count": len(pages),
        "pages": pages,
        "metadata": {"model": MISTRAL_OCR_MODEL},
    }
