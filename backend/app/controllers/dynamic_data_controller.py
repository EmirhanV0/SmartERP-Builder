"""
DynamicDataController — Dynamic module CRUD endpoints.
Data is stored in the DYNAMIC_RECORD table as JSONB.
Stage 5: Dynamic Schema Generation

Endpoints:
  GET    /modules/{map_id}/schema                     -> Module schema info
  GET    /modules/{map_id}/records                    -> Record list (full-text search supported)
  POST   /modules/{map_id}/records                    -> Create new record
  GET    /modules/{map_id}/records/{record_id}        -> Single record
  PUT    /modules/{map_id}/records/{record_id}        -> Update record
  DELETE /modules/{map_id}/records/{record_id}        -> Delete record
  GET    /modules/list                                -> All modules belonging to the user's tenant
"""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.module import AvailableModule
from app.models.configuration import Configuration, ConfigModuleMap
from app.schemas.schema import (
    RecordCreateRequest,
    RecordUpdateRequest,
    RecordResponse,
    RecordListResponse,
    ModuleSchemaInfo,
)
from app.services.api_generator import APIGenerator
from app.services.schema_generator import build_table_name

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/modules", tags=["Dynamic Module CRUD"])

_api_gen = APIGenerator()


# ---------------------------------------------------------------------------
# Helper: load module schema by map_id + verify tenant
# ---------------------------------------------------------------------------

async def _resolve_map(
    map_id: int,
    tenant_id,
    db: AsyncSession,
    require_enabled: bool = True,
) -> tuple[ConfigModuleMap, list[dict]]:
    """
    Loads the ConfigModuleMap and verifies tenant isolation.
    Returns the module's schema fields.

    Raises:
        HTTPException 404: if not found or access not authorized
        HTTPException 403: if the module is disabled (require_enabled=True)
    """
    result = await db.execute(
        select(ConfigModuleMap)
        .join(Configuration, ConfigModuleMap.config_id == Configuration.config_id)
        .where(
            ConfigModuleMap.map_id == map_id,
            Configuration.tenant_id == tenant_id,
        )
    )
    map_obj = result.scalar_one_or_none()

    if not map_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found or access not authorized",
        )

    if require_enabled and not map_obj.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This module has been disabled",
        )

    # Schema: custom_schema_json["fields"] > AvailableModule.base_schema_json["fields"]
    schema = map_obj.custom_schema_json or {}
    fields = schema.get("fields", [])

    if not fields:
        mod_result = await db.execute(
            select(AvailableModule).where(AvailableModule.module_id == map_obj.module_id)
        )
        av_module = mod_result.scalar_one_or_none()
        if av_module:
            fields = av_module.base_schema_json.get("fields", [])

    return map_obj, fields


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/list",
    summary="Active modules for the tenant",
    description=(
        "Lists the approved, active modules belonging to the logged-in user's tenant.\n"
        "If `config_id` is given, only that configuration's modules are returned; "
        "otherwise modules from all active configurations are returned."
    ),
)
async def list_modules(
    config_id: Optional[int] = Query(default=None, description="Configuration ID filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """JWT protected."""
    query = (
        select(ConfigModuleMap, Configuration, AvailableModule)
        .join(Configuration, ConfigModuleMap.config_id == Configuration.config_id)
        .join(AvailableModule, ConfigModuleMap.module_id == AvailableModule.module_id)
        .where(
            Configuration.tenant_id == current_user.tenant_id,
            Configuration.is_active == True,
            ConfigModuleMap.is_enabled == True,
        )
    )
    if config_id is not None:
        query = query.where(ConfigModuleMap.config_id == config_id)

    result = await db.execute(query)
    rows = result.all()

    modules = []
    for map_obj, config, av_module in rows:
        schema = map_obj.custom_schema_json or {}
        modules.append({
            "map_id":       map_obj.map_id,
            "module_id":    map_obj.module_id,
            "module_name":  av_module.module_name,
            "display_name": map_obj.display_name,
            "table_name":   schema.get("table_name", ""),
            "config_id":    config.config_id,
            "field_count":  len(schema.get("fields", [])),
        })

    return modules


@router.get(
    "/{map_id}/schema",
    response_model=ModuleSchemaInfo,
    summary="Module schema info",
    description="Returns the schema definition (fields, table name) for the given map_id.",
)
async def get_module_schema(
    map_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ModuleSchemaInfo:
    """JWT protected."""
    map_obj, fields = await _resolve_map(map_id, current_user.tenant_id, db, require_enabled=False)
    schema = map_obj.custom_schema_json or {}
    table  = schema.get("table_name") or build_table_name(current_user.tenant_id, "unknown")

    # Get module name from AvailableModule
    mod_result = await db.execute(
        select(AvailableModule).where(AvailableModule.module_id == map_obj.module_id)
    )
    av_module = mod_result.scalar_one_or_none()
    module_name = av_module.module_name if av_module else "unknown"

    return ModuleSchemaInfo(
        map_id=map_id,
        module_id=map_obj.module_id,
        module_name=module_name,
        display_name=map_obj.display_name or module_name.title(),
        table_name=table,
        fields=fields,
        is_enabled=map_obj.is_enabled,
        config_id=map_obj.config_id,
    )


@router.get(
    "/{map_id}/records",
    response_model=RecordListResponse,
    summary="List module records",
    description=(
        "Returns records belonging to map_id.\n"
        "If the `search` parameter is given, TSVECTOR full-text search is applied."
    ),
)
async def list_records(
    map_id: int,
    limit:  int = Query(default=50, ge=1, le=200, description="Records per page"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    search: Optional[str] = Query(default=None, description="Full-text search term"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecordListResponse:
    """JWT protected."""
    map_obj, _ = await _resolve_map(map_id, current_user.tenant_id, db)

    records = await _api_gen.list_records(map_id, db, limit=limit, offset=offset, search=search)
    total   = await _api_gen.count_records(map_id, db)

    return RecordListResponse(
        total=total,
        limit=limit,
        offset=offset,
        records=[RecordResponse.model_validate(r) for r in records],
    )


@router.post(
    "/{map_id}/records",
    response_model=RecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new record",
    description=(
        "Submits data conforming to the module's schema; required fields are validated.\n"
        "Data is written to the `DYNAMIC_RECORD.data_payload` JSONB field."
    ),
)
async def create_record(
    map_id: int,
    body: RecordCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecordResponse:
    """JWT protected."""
    _, fields = await _resolve_map(map_id, current_user.tenant_id, db)

    try:
        record = await _api_gen.create_record(
            map_id=map_id,
            data=body.data,
            created_by=current_user.user_id,
            schema_fields=fields,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return RecordResponse.model_validate(record)


@router.get(
    "/{map_id}/records/{record_id}",
    response_model=RecordResponse,
    summary="Get single record",
)
async def get_record(
    map_id: int,
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecordResponse:
    """JWT protected."""
    await _resolve_map(map_id, current_user.tenant_id, db)

    record = await _api_gen.get_record(record_id, map_id, db)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record not found: {record_id}",
        )
    return RecordResponse.model_validate(record)


@router.put(
    "/{map_id}/records/{record_id}",
    response_model=RecordResponse,
    summary="Update record",
    description="Fully replaces data_payload with new data (full replacement, not PATCH).",
)
async def update_record(
    map_id: int,
    record_id: uuid.UUID,
    body: RecordUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecordResponse:
    """JWT protected."""
    _, fields = await _resolve_map(map_id, current_user.tenant_id, db)

    try:
        record = await _api_gen.update_record(
            record_id=record_id,
            map_id=map_id,
            data=body.data,
            schema_fields=fields,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(exc) else status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return RecordResponse.model_validate(record)


@router.delete(
    "/{map_id}/records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete record",
)
async def delete_record(
    map_id: int,
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """JWT protected."""
    await _resolve_map(map_id, current_user.tenant_id, db)

    deleted = await _api_gen.delete_record(record_id, map_id, db)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record not found: {record_id}",
        )
