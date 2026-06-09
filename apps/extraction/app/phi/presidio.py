"""
Presidio NLP-based PHI detector.

Falls back to a noop (empty result list) when Presidio or its spaCy model
cannot be loaded — callers should still hit the regex layer in that case.
"""

import logging

logger = logging.getLogger(__name__)

try:
    from presidio_analyzer import AnalyzerEngine
    from presidio_analyzer.nlp_engine import NlpEngineProvider

    _nlp_config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
    }
    _nlp_engine = NlpEngineProvider(nlp_configuration=_nlp_config).create_engine()
    _analyzer = AnalyzerEngine(nlp_engine=_nlp_engine, supported_languages=["en"])
    PRESIDIO_AVAILABLE = True
    logger.info("Presidio analyzer loaded successfully")
except Exception as e:
    _analyzer = None
    PRESIDIO_AVAILABLE = False
    logger.warning("Presidio not available, using regex-only fallback: %s", e)


PHI_ENTITIES = [
    "PERSON",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "DATE_TIME",
    "LOCATION",
    "US_SSN",
    "US_DRIVER_LICENSE",
    "CREDIT_CARD",
    "IP_ADDRESS",
    "NRP",
    "MEDICAL_LICENSE",
    "US_PASSPORT",
]

MEDICAL_WHITELIST = {
    "ldl cholesterol", "hdl cholesterol", "total cholesterol",
    "hemoglobin", "hba1c", "hemoglobin a1c", "glycated hemoglobin",
    "fasting glucose", "random glucose", "blood sugar",
    "creatinine", "bilirubin", "albumin", "ferritin",
    "triglycerides", "platelets", "hematocrit",
    "sodium", "potassium", "calcium", "iron",
    "vitamin d", "vitamin b12", "uric acid",
    "amylase", "lipase", "alkaline phosphatase",
    "tsh", "free t4", "t3", "t4",
    "alt", "ast", "sgpt", "sgot", "alp",
    "wbc", "rbc", "esr", "crp", "egfr",
    "complete blood count", "lipid panel", "liver function",
    "renal panel", "thyroid panel", "metabolic panel",
    "blood urea nitrogen", "bun",
}


def _is_whitelisted(text: str) -> bool:
    return text.lower().strip() in MEDICAL_WHITELIST


def _is_pure_number(text: str) -> bool:
    cleaned = text.strip()
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


class PHIEntity:
    """A detected PHI entity in text."""

    def __init__(
        self,
        entity_type: str,
        start: int,
        end: int,
        text: str,
        score: float,
        source: str,
    ):
        self.entity_type = entity_type
        self.start = start
        self.end = end
        self.text = text
        self.score = score
        self.source = source

    def to_dict(self) -> dict:
        return {
            "entity_type": self.entity_type,
            "start": self.start,
            "end": self.end,
            "text": self.text,
            "score": self.score,
            "source": self.source,
        }


def detect_with_presidio(text: str) -> list[PHIEntity]:
    """Detect PHI using Presidio. Returns [] when Presidio is unavailable."""
    if not PRESIDIO_AVAILABLE or _analyzer is None:
        return []

    try:
        results = _analyzer.analyze(
            text=text,
            language="en",
            entities=PHI_ENTITIES,
            score_threshold=0.4,
        )
    except Exception as e:
        logger.error("Presidio detection failed: %s", e)
        return []

    entities: list[PHIEntity] = []
    for r in results:
        detected_text = text[r.start:r.end]
        if _is_whitelisted(detected_text):
            logger.debug("Skipping whitelisted medical term: '%s'", detected_text)
            continue
        if _is_pure_number(detected_text):
            logger.debug("Skipping pure numeric value: '%s'", detected_text)
            continue
        entities.append(
            PHIEntity(
                entity_type=r.entity_type,
                start=r.start,
                end=r.end,
                text=detected_text,
                score=r.score,
                source="presidio",
            )
        )

    logger.info("Presidio detected %d PHI entities", len(entities))
    return entities
