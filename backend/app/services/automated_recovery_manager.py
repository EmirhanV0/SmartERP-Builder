"""
AutomatedRecoveryManager — Classifies the error signature and produces a recovery action.
Pure Python logic; no DB dependency, always returns a string.
"""

# PostgreSQL SQLSTATE code -> recovery action
_SQLSTATE_MAP: dict[str, str] = {
    "23505": "auto_fix_identifier",   # unique_violation
    "42P07": "auto_fix_identifier",   # duplicate_table
    "42701": "auto_fix_identifier",   # duplicate_column (reserved-name collision)
    "40001": "retry_fallback_prompt", # serialization_failure
    "40P01": "retry_fallback_prompt", # deadlock_detected
    "57014": "manual_escalation",     # query_canceled
    "53300": "manual_escalation",     # too_many_connections
}

# HTTP status code (if present in the string) -> recovery action
_HTTP_MAP: dict[str, str] = {
    "429": "retry_fallback_prompt",   # Gemini rate limit
    "503": "retry_fallback_prompt",   # temporary service error
    "500": "manual_escalation",       # server error
    "403": "manual_escalation",       # auth error (API key)
}

# JSON parsing keywords
_JSON_KEYWORDS = (
    "JSONDecodeError",
    "json.decode",
    "Expecting value",
    "Invalid JSON",
    "json_decode",
)

# Stage-based fallback (if no pattern matches)
_STAGE_FALLBACK: dict[str, str] = {
    "DDL":    "rollback",
    "DELETE": "manual_escalation",
    "AI":     "retry_fallback_prompt",
}


class AutomatedRecoveryManager:
    """
    Returns the appropriate recovery action given an error signature and the failed stage.
    Classification priority: SQLSTATE -> HTTP code -> JSON parse -> stage fallback -> manual.
    """

    def classify(self, error_signature: str, stage: str) -> str:
        sig = str(error_signature)

        for code, action in _SQLSTATE_MAP.items():
            if code in sig:
                return action

        for code, action in _HTTP_MAP.items():
            if code in sig:
                return action

        sig_lower = sig.lower()
        for kw in _JSON_KEYWORDS:
            if kw.lower() in sig_lower:
                return "retry_fallback_prompt"

        return _STAGE_FALLBACK.get(stage, "manual_escalation")
