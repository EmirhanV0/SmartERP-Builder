"""
Pydantic schemas — Schema approval and dynamic CRUD endpoints
Stage 5: Dynamic Schema Generation
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator


# ---------------------------------------------------------------------------
# Schema approval / editing
# ---------------------------------------------------------------------------

class FieldDefinition(BaseModel):
    """Module field definition."""
    name: str = Field(description="Field name (raw or slug; backend applies slugify)")
    type: str = Field(
        default="string",
        description="Data type: string | text | integer | decimal | float | date | datetime | boolean | json | uuid",
    )
    required: bool = Field(default=False, description="Is this field required?")
    label: str = Field(default="", description="Displayed field label")


class EntityActivation(BaseModel):
    """Module activation definition derived from an AI entity."""
    entity_name: str = Field(description="Entity name suggested by the AI (e.g. 'Athlete', 'Medical Record')")
    display_name: str = Field(description="Displayed module name")
    fields: list[FieldDefinition] = Field(default_factory=list, description="Field definitions")


class ModuleActivation(BaseModel):
    """Parameters for a single module to be approved (AVAILABLE_MODULE based, for backwards compatibility)."""
    module_id: int = Field(description="AVAILABLE_MODULE.module_id")
    display_name: Optional[str] = Field(
        default=None,
        description="Custom display name (taken from base schema if left empty)",
    )
    custom_fields: Optional[list[FieldDefinition]] = Field(
        default=None,
        description="Custom fields — if None, base_schema_json is used",
    )


class ApproveRequest(BaseModel):
    """POST /schema/approve request."""
    config_id: int = Field(description="Configuration.config_id (must be draft)")
    config_name: Optional[str] = Field(
        default=None,
        description="Meaningful name for the ERP configuration (e.g. 'Athlete Health ERP')",
    )
    entities: list[EntityActivation] = Field(
        default_factory=list,
        description="Modules derived from AI entities (new flow)",
    )
    modules: list[ModuleActivation] = Field(
        default_factory=list,
        description="AVAILABLE_MODULE based modules (for backwards compatibility)",
    )

    @model_validator(mode="after")
    def check_at_least_one(self) -> "ApproveRequest":
        if not self.entities and not self.modules:
            raise ValueError("At least one of entities or modules must be filled")
        return self


class ActivatedModule(BaseModel):
    """Summary information of an approved module."""
    module_id: int
    module_name: str
    display_name: str
    map_id: int
    table_name: str
    fields: list[dict[str, Any]]


class ApproveResponse(BaseModel):
    """POST /schema/approve response."""
    config_id: int
    config_name: Optional[str]
    status: str  # "approved"
    activated_modules: list[ActivatedModule]
    message: str


class EditRequest(BaseModel):
    """
    POST /schema/edit — Updates the custom_schema_json of an existing ConfigModuleMap.
    Does not create a table; used to update fields of already-approved configurations as well.
    """
    config_id: int
    module_id: int = Field(description="ID of the module to edit")
    display_name: Optional[str] = None
    custom_fields: list[FieldDefinition] = Field(description="New field definitions")


class EditResponse(BaseModel):
    """POST /schema/edit response."""
    config_id: int
    map_id: int
    module_name: str
    display_name: str
    custom_fields: list[dict[str, Any]]
    message: str


# ---------------------------------------------------------------------------
# Dynamic CRUD records
# ---------------------------------------------------------------------------

class RecordCreateRequest(BaseModel):
    """POST /modules/{map_id}/records request."""
    data: dict[str, Any] = Field(
        description="Record data — key-value pairs matching the module schema",
        examples=[{"product_name": "Oak Table", "sku": "TBL-001", "quantity": 50, "unit_price": 1200.0}],
    )


class RecordUpdateRequest(BaseModel):
    """PUT /modules/{map_id}/records/{record_id} request."""
    data: dict[str, Any] = Field(description="Updated record data")


class RecordResponse(BaseModel):
    """Single record response."""
    record_id: uuid.UUID
    map_id: int
    data_payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecordListResponse(BaseModel):
    """Record list response."""
    total: int
    limit: int
    offset: int
    records: list[RecordResponse]


class ModuleSchemaInfo(BaseModel):
    """GET /modules/{map_id}/schema — Module schema information."""
    map_id: int
    module_id: int
    module_name: str
    display_name: str
    table_name: str
    fields: list[dict[str, Any]]
    is_enabled: bool
    config_id: int


# ---------------------------------------------------------------------------
# Manual module creation (Fix-1 stage)
# ---------------------------------------------------------------------------

class ManualFieldDefinition(BaseModel):
    """Manual module creation — single field definition."""
    name: str = Field(description="Field name (will be slugified)")
    type: str = Field(
        default="text",
        description=(
            "Frontend field type: text | textarea | number | currency | date | "
            "phone | email | enum | gender | tc_kimlik | number_with_unit"
        ),
    )
    required: bool = Field(default=False)
    enum_values: Optional[list[str]] = Field(
        default=None, description="Enum options (required if type='enum')"
    )
    unit: Optional[str] = Field(
        default=None, description="Unit label (if type='number_with_unit')"
    )
    default_currency: Optional[str] = Field(
        default=None, description="Default currency (if type='currency', e.g. 'TRY')"
    )


class ManualModuleRequest(BaseModel):
    """POST /configurations/{config_id}/modules/manual request."""
    module_name: str = Field(description="Module name (will be slugified)")
    display_name: str = Field(description="Name displayed to the user")
    description: Optional[str] = Field(default=None, description="Optional description")
    fields: list[ManualFieldDefinition] = Field(description="Field definitions")

    @model_validator(mode="after")
    def check_fields(self) -> "ManualModuleRequest":
        if not self.fields:
            raise ValueError("At least 1 field is required")
        return self


class ManualModuleResponse(BaseModel):
    """POST /configurations/{config_id}/modules/manual response."""
    map_id: int
    module_id: int
    module_name: str
    display_name: str
    message: str
