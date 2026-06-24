"""
NLPProcessor — Sanitizes user text and analyzes it with the Gemini API.
Stage 4: AI Integration
"""
import re
import json
import asyncio
import logging
from typing import TYPE_CHECKING, Any

from app.config.settings import settings

if TYPE_CHECKING:
    from app.services.self_healing_engine import SelfHealingEngine

logger = logging.getLogger(__name__)

# No need for the Gemini SDK in mock mode
if not settings.gemini_mock:
    from google import genai as _genai
    from google.genai import types as _genai_types
    # 60s hard timeout (HttpOptions.timeout is in milliseconds) so a hung
    # Gemini request can never stall the API request indefinitely
    _client = _genai.Client(
        api_key=settings.gemini_api_key,
        http_options=_genai_types.HttpOptions(timeout=60_000),
    )
else:
    _client = None  # type: ignore

# --- Retry policy for transient Gemini failures ---
_MAX_ATTEMPTS = 3          # 1 initial call + 2 retries
_BACKOFF_SECONDS = (1, 3)  # wait before retry 1 / retry 2 (exponential)

# Permanent failure markers — retrying cannot help (bad request, invalid key)
_PERMANENT_MARKERS = (
    "400", "401", "403",
    "INVALID_ARGUMENT", "PERMISSION_DENIED", "API key",
)

# Transient failure markers — service overload, rate limit, DNS/connection blips
_TRANSIENT_MARKERS = (
    "503", "UNAVAILABLE",
    "429", "RESOURCE_EXHAUSTED",
    "[Errno -5]", "[Errno -3]", "getaddrinfo",
    "Connection refused", "Connection reset",
)


def _is_transient_error(exc: Exception) -> bool:
    """
    True if the error is worth retrying (503 overload, 429 rate limit,
    DNS/connection failures). Permanent errors and unknown errors return False.
    """
    sig = str(exc)
    # Permanent markers win: "400 INVALID_ARGUMENT ... API key not valid" must not retry
    if any(marker in sig for marker in _PERMANENT_MARKERS):
        return False
    if isinstance(exc, ConnectionError):
        return True
    return any(marker in sig for marker in _TRANSIENT_MARKERS)

# --- Gemini prompt template ---
_PROMPT_TEMPLATE = """\
CRITICAL OUTPUT LANGUAGE RULE:
Regardless of what language the user's business description is written in (Turkish, Spanish, German, etc.), you MUST generate ALL output in English ONLY. This includes:
- Entity names (e.g., "Patient" not "Hasta", "Appointment" not "Randevu", "Syringe" not "Şırınga")
- Field names (e.g., "product_name" not "Ürün Adı", "expiry_date" not "Son Kullanma Tarihi", "lot_number" not "Lot Numarası")
- suggested_name / ERP name (e.g., "Radiology Workflow Management" not "Radyoloji İş Akışı Yönetim Sistemi")
- display_name fields, enum values, relationship descriptions, ambiguity_questions
- ALL string values in the JSON response
The user may write in any language; you understand it perfectly but always respond in English. This is non-negotiable.

---

You are an ERP (Enterprise Resource Planning) expert.
Analyze the user's business description and determine which ERP modules and data entities are needed.

User Text: "{user_text}"
Sector: "{sector}"

Available ERP Modules:
- inventory   : Inventory Management
- billing     : Billing & Invoicing
- hr          : Human Resources
- sales       : Sales
- production  : Production & Manufacturing
- purchasing  : Purchasing
- crm         : Customer Relations

Entity name format: Use PascalCase (e.g., "Patient", "MedicalRecord", "BloodTest", "Product", "Invoice")
Field name format: Use snake_case lowercase (e.g., "first_name", "date_of_birth", "blood_type", "product_name", "unit_price")

Respond ONLY with the following JSON format — no other text:

{{
  "entities": ["EntityName1", "EntityName2"],
  "fields": {{
    "EntityName1": ["field_name_one", "field_name_two"],
    "EntityName2": ["field_name_one", "field_name_two"]
  }},
  "relationships": ["EntityA relates to EntityB: many-to-one"],
  "recommended_modules": ["inventory", "billing"],
  "confidence_score": 0.90,
  "ambiguity_questions": [],
  "suggested_name": "Short ERP Name in English"
}}

Rules:
1. confidence_score: 0.0–1.0. If the description is clear and sufficient, give 0.85 or above.
2. If the description is ambiguous, set confidence_score < 0.85 and fill ambiguity_questions with 2-4 short clarifying questions (in English). Still produce your best-guess entities, fields, relationships and recommended_modules even when ambiguous.
3. recommended_modules must only contain values from the list above.
4. entities: business objects the user mentioned (Product, Supplier, Invoice, Employee, Patient, etc.) — PascalCase, singular
5. fields: suggested data fields for each entity — snake_case, descriptive English names
6. relationships: relations between entities (e.g., "Invoice → Product: many-to-many via line items")
7. suggested_name: a concise 2–5 word English name for this ERP (e.g., "Sports Health ERP", "Textile Production ERP", "Auto Service Manager")
8. ALL output values must be in English regardless of the input language.
9. Do NOT generate fields named: id, created_at, updated_at, tenant_id, map_id, created_by, search_vector — these are system-managed columns added automatically. Use domain-specific names instead (e.g. "ticket_opened_at", "last_modified", "order_placed_at").

REMINDER: Output ALL JSON values in English language only, regardless of input language.\
"""


def _strip_markdown_fences(text: str) -> str:
    """Gemini sometimes wraps responses in ```json ... ``` fences; strips them."""
    text = text.strip()
    text = re.sub(r"^```[a-z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


def sanitize_text(text: str) -> str:
    """
    Sanitizes text against XSS and SQL injection.

    - Strips HTML tags
    - Replaces HTML entities with a space
    - Removes dangerous SQL keywords
    - Collapses multiple whitespace
    """
    # Strip HTML tags (XSS)
    text = re.sub(r"<[^>]+>", " ", text)
    # Strip HTML entities
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)

    # SQL injection — dangerous DDL/DML keywords
    sql_keywords = (
        r"\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE"
        r"|UNION|HAVING|CAST|CONVERT|DECLARE|FETCH|CURSOR|GRANT|REVOKE)\b"
    )
    text = re.sub(sql_keywords, " ", text, flags=re.IGNORECASE)

    # SQL comments and special characters
    text = re.sub(r"(--|;|/\*|\*/|xp_)", " ", text)

    # Collapse multiple whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


class NLPProcessor:
    """Sanitizes user text and analyzes it via the Gemini API."""

    def __init__(self) -> None:
        pass  # client is initialized at module level

    def sanitize(self, text: str) -> str:
        """Sanitizes text against XSS and SQL injection."""
        return sanitize_text(text)

    def _call_gemini(self, prompt: str) -> str:
        """Gemini API call (synchronous — runs in a thread pool)."""
        response = _client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        return response.text

    async def _call_gemini_with_retry(self, prompt: str) -> tuple[str, Exception | None]:
        """
        Calls Gemini with exponential backoff on transient errors
        (503 overload, 429 rate limit, DNS/connection failures).
        Permanent errors (invalid key, bad request) fail immediately.

        Returns:
            (response_text, first_transient_error) — the second element is None
            when the first attempt succeeded, otherwise the error that was
            recovered from (used for the auto_resolved diagnostic record).

        Raises:
            RuntimeError: permanent error, or all retry attempts exhausted.
                Carries `retry_count` and `retries_exhausted` attributes for
                the caller's diagnostic context.
        """
        first_error: Exception | None = None
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                # Run the synchronous SDK call in a thread without blocking the event loop
                raw_text = await asyncio.to_thread(self._call_gemini, prompt)
                return raw_text, first_error
            except Exception as exc:
                transient = _is_transient_error(exc)
                if not transient or attempt == _MAX_ATTEMPTS:
                    logger.error("Gemini API connection error: %s", exc)
                    err = RuntimeError(f"AI service connection error: {exc}")
                    err.retry_count = attempt
                    err.retries_exhausted = transient and attempt == _MAX_ATTEMPTS
                    raise err from exc
                if first_error is None:
                    first_error = exc
                wait = _BACKOFF_SECONDS[attempt - 1]
                logger.warning(
                    "Gemini transient error (attempt %d/%d), retrying in %ds: %.200s",
                    attempt, _MAX_ATTEMPTS, wait, exc,
                )
                # asyncio.sleep keeps the event loop free during the backoff wait
                await asyncio.sleep(wait)
        raise RuntimeError("unreachable")  # loop always returns or raises

    async def analyze(
        self,
        user_text: str,
        sector: str,
        healer: "SelfHealingEngine | None" = None,
    ) -> dict[str, Any]:
        """
        Sanitizes the text and sends it to the Gemini API; returns a structured dict.

        Args:
            healer: optional SelfHealingEngine — when a transient failure is
                recovered by retry, an `auto_resolved` diagnostic record is written.

        Raises:
            ValueError: Gemini JSON parse error
            RuntimeError: API connection error
        """
        # Mock mode — skip the real API call if GEMINI_MOCK=true
        if settings.gemini_mock:
            logger.info("MOCK MODE active — returning fake English analysis response. sector=%s", sector)
            return {
                "entities": ["Product", "Invoice"],
                "fields": {
                    "Product": ["product_name", "sku", "quantity", "unit_price", "category"],
                    "Invoice": ["invoice_number", "customer_name", "amount", "invoice_date", "status"],
                },
                "relationships": [
                    "Invoice → Product: many-to-many via line items",
                ],
                "recommended_modules": ["inventory", "billing"],
                "confidence_score": 0.92,
                "ambiguity_questions": [],
                "suggested_name": "Product & Invoice ERP",
            }

        sanitized = self.sanitize(user_text)
        prompt = _PROMPT_TEMPLATE.format(user_text=sanitized, sector=sector)

        logger.info("Sending request to Gemini API. sector=%s", sector)

        raw_text, transient_error = await self._call_gemini_with_retry(prompt)

        if transient_error is not None and healer is not None:
            # Visible self-healing proof: the transient failure was recovered by retry
            await healer.report_recovery(
                stage="AI",
                error=transient_error,
                context=f"sector={sector} model={settings.gemini_model} reason=transient_retry_succeeded",
            )

        clean_text = _strip_markdown_fences(raw_text)

        try:
            result: dict = json.loads(clean_text)
        except json.JSONDecodeError as first_parse_exc:
            # Gemini occasionally returns malformed JSON; one immediate retry
            # with the same prompt usually yields a well-formed response
            logger.warning(
                "Gemini returned malformed JSON, retrying once with the same prompt: %s",
                first_parse_exc,
            )
            raw_text, _ = await self._call_gemini_with_retry(prompt)
            clean_text = _strip_markdown_fences(raw_text)
            try:
                result = json.loads(clean_text)
            except json.JSONDecodeError as exc:
                logger.error("Gemini JSON parse error. Raw response: %s", raw_text[:500])
                raise ValueError(f"AI response is not valid JSON: {exc}") from exc
            if healer is not None:
                # The malformed response healed on retry — record it as auto-resolved
                await healer.report_recovery(
                    stage="AI",
                    error=first_parse_exc,
                    context=f"sector={sector} model={settings.gemini_model} reason=json_retry_succeeded",
                )

        # Ensure required fields are present
        result.setdefault("entities", [])
        result.setdefault("fields", {})
        result.setdefault("relationships", [])
        result.setdefault("recommended_modules", [])
        result.setdefault("confidence_score", 0.0)
        result.setdefault("ambiguity_questions", [])
        result.setdefault("suggested_name", None)

        logger.info(
            "Gemini analysis completed. confidence=%.2f, modules=%s",
            result["confidence_score"],
            result["recommended_modules"],
        )
        return result
