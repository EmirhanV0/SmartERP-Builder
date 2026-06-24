"""
Pydantic schemas — Prompt / AI Analysis endpoints
Stage 4: AI Integration
"""
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    """POST /prompt/analyze request."""
    text: str = Field(
        min_length=10,
        description="Natural language business description (at least 10 characters)",
        examples=["I want to track my furniture stock and supplier payments"],
    )
    sector: str = Field(
        min_length=2,
        description="Sector code (e.g.: retail, manufacturing, furniture, services)",
        examples=["furniture"],
    )


class ClarifyRequest(BaseModel):
    """POST /prompt/analyze/clarify request — re-analysis with clarification answers."""
    original_text: str = Field(description="Original business description")
    sector: str = Field(description="Sector code")
    answers: dict[str, str] = Field(
        description="Clarification question → user answer mapping",
        examples=[{"How many different warehouses do you have?": "We have 3 warehouses: Istanbul, Ankara, and Izmir"}],
    )


# ---------------------------------------------------------------------------
# Response component schemas
# ---------------------------------------------------------------------------

class ModuleProposal(BaseModel):
    """Details of a recommended ERP module."""
    module_name: str
    display_name: str
    module_id: int
    module_schema: dict[str, Any] = Field(alias="schema", default_factory=dict)
    ai_suggested: bool = Field(
        description="True -> directly recommended by AI | False -> added from sector benchmark"
    )

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SchemaProposal(BaseModel):
    """
    Full schema proposal returned when confidence >= 0.85.
    Awaits user approval.
    """
    entities: list[str]
    fields: dict[str, list[str]]
    relationships: list[str]
    recommended_modules: list[ModuleProposal]
    confidence_score: float
    status: str = "ready_for_approval"
    suggested_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Main response schema
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    """
    Response for the POST /prompt/analyze and /prompt/analyze/clarify endpoints.

    - status == "needs_clarification" -> ambiguity_questions filled, schema_proposal None
    - status == "ready_for_approval"  -> schema_proposal filled, ambiguity_questions None/empty
    """
    status: str = Field(
        description="'ready_for_approval' or 'needs_clarification'",
    )
    confidence_score: float
    raw_input: str
    sanitized_input: str

    # When ambiguous (confidence < 0.85)
    ambiguity_questions: Optional[list[str]] = None

    # When approved (confidence >= 0.85)
    schema_proposal: Optional[SchemaProposal] = None

    # DB references
    log_id: Optional[int] = None
    config_id: Optional[int] = None
