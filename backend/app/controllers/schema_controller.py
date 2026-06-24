"""
SchemaController — Schema approval, editing, and module management endpoints.
Stage 5: Dynamic Schema Generation

Endpoints:
  POST /schema/approve   -> Approve a SchemaProposal: create DDL tables + ConfigModuleMap records
  POST /schema/edit      -> Update an existing module's schema (Manual Override)
  GET  /schema/{config_id} -> Configuration detail + its modules
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.database import get_db, engine
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.module import AvailableModule
from app.models.configuration import Configuration, ConfigModuleMap
from app.schemas.schema import (
    ApproveRequest,
    ApproveResponse,
    ActivatedModule,
    EditRequest,
    EditResponse,
)
from app.services.schema_generator import SchemaGenerator, build_table_name, slugify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schema", tags=["Schema & Module Approval"])

_schema_gen = SchemaGenerator(engine)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

async def _load_config(
    config_id: int,
    tenant_id,
    db: AsyncSession,
) -> Configuration:
    """Loads the configuration; verifies tenant ownership."""
    result = await db.execute(
        select(Configuration).where(
            Configuration.config_id == config_id,
            Configuration.tenant_id == tenant_id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found or access not authorized",
        )
    return config


async def _load_available_module(module_id: int, db: AsyncSession) -> AvailableModule:
    """Loads the module from AVAILABLE_MODULE."""
    result = await db.execute(
        select(AvailableModule).where(AvailableModule.module_id == module_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module not found: module_id={module_id}",
        )
    return module


async def _find_or_create_module(
    module_slug: str,
    display_name: str,
    db: AsyncSession,
) -> AvailableModule:
    """
    Finds the AVAILABLE_MODULE record for a given slug; creates a new one if missing.
    Runtime modules are created with is_system_default=False.
    """
    result = await db.execute(
        select(AvailableModule).where(AvailableModule.module_name == module_slug)
    )
    av_module = result.scalar_one_or_none()
    if not av_module:
        av_module = AvailableModule(
            module_name=module_slug,
            base_schema_json={"display_name": display_name},
            is_system_default=False,
        )
        db.add(av_module)
        await db.flush()  # to obtain the module_id PK
    return av_module


def _resolve_fields(
    base_schema: dict,
    custom_fields_input,
) -> list[dict]:
    if custom_fields_input:
        return [f.model_dump() for f in custom_fields_input]
    return base_schema.get("fields", [])


def _resolve_display_name(display_name_input, base_schema: dict, module_name: str) -> str:
    if display_name_input:
        return display_name_input
    return base_schema.get("display_name", module_name.title())


def _normalize_entity_fields(raw_fields) -> list[dict]:
    """
    Normalizes the EntityActivation.fields list:
    - slugifies the name (Turkish -> PostgreSQL-safe)
    - keeps the original name as the label
    """
    normalized = []
    seen_names: set[str] = set()
    for f in raw_fields:
        raw_name = f.name or f.label or "field"
        field_slug = slugify(raw_name) or "field"
        # Avoid collisions: field1, field2, ...
        base = field_slug
        counter = 1
        while field_slug in seen_names:
            field_slug = f"{base}_{counter}"
            counter += 1
        seen_names.add(field_slug)
        normalized.append({
            "name":       field_slug,
            "type":       f.type or "string",
            "input_type": f.type or "string",  # Stored for frontend type detection
            "required":   f.required,
            "label":      f.label or raw_name,
        })
    return normalized


def _build_config_name(request_name: str | None) -> str:
    """Normalizes the config_name from the approve request; generates a date-based one if missing."""
    if request_name and request_name.strip():
        return request_name.strip()[:150]
    return datetime.now().strftime("ERP - %d %b %Y")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/approve",
    response_model=ApproveResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Approve a schema proposal",
    description=(
        "For the selected modules:\n"
        "1. Find/create AVAILABLE_MODULE for the AI entities in the `entities` list\n"
        "2. Creates physical tables in PostgreSQL (atomic DDL transaction)\n"
        "3. Creates `CONFIG_MODULE_MAP` records\n"
        "4. `CONFIGURATION.status` -> `approved`, `is_active` -> `True`, `config_name` is saved\n\n"
        "Backward compatibility: the `modules` list (AVAILABLE_MODULE-based) is also accepted.\n"
        "At least one of `entities` and `modules` must be non-empty."
    ),
)
async def approve_schema(
    request: ApproveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApproveResponse:
    """JWT protected — only the tenant owner can approve."""
    logger.info(
        "Schema approval request. config_id=%d user_id=%s entities=%d modules=%d",
        request.config_id,
        current_user.user_id,
        len(request.entities),
        len(request.modules),
    )

    # --- 1. Load the configuration ---
    config = await _load_config(request.config_id, current_user.tenant_id, db)

    if config.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This configuration has already been approved",
        )

    modules_for_ddl: list[dict] = []
    modules_meta: list[dict] = []

    # --- 2. New flow: AI entity-based modules ---
    for entity in request.entities:
        entity_slug = slugify(entity.entity_name) or slugify(entity.display_name) or "entity"
        display_name = entity.display_name or entity.entity_name

        # Find or create AVAILABLE_MODULE (flush to get module_id)
        av_module = await _find_or_create_module(entity_slug, display_name, db)

        fields = _normalize_entity_fields(entity.fields)

        modules_for_ddl.append({"module_name": entity_slug, "fields": fields})
        modules_meta.append({
            "module_id":      av_module.module_id,
            "module_name":    entity_slug,
            "display_name":   display_name,
            "resolved_schema": {"display_name": display_name, "fields": fields},
            "fields":         fields,
        })

    # --- 3. Backward compatibility: AVAILABLE_MODULE-based modules ---
    for activation in request.modules:
        av_module = await _load_available_module(activation.module_id, db)

        fields       = _resolve_fields(av_module.base_schema_json, activation.custom_fields)
        display_name = _resolve_display_name(
            activation.display_name, av_module.base_schema_json, av_module.module_name
        )
        resolved_schema = {"display_name": display_name, "fields": fields}

        modules_for_ddl.append({"module_name": av_module.module_name, "fields": fields})
        modules_meta.append({
            "module_id":      activation.module_id,
            "module_name":    av_module.module_name,
            "display_name":   display_name,
            "resolved_schema": resolved_schema,
            "fields":         fields,
        })

    # --- 4. Atomic DDL transaction ---
    try:
        table_map = await _schema_gen.apply_schemas(
            tenant_id=current_user.tenant_id,
            modules=modules_for_ddl,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DDL error: {exc}",
        ) from exc

    # --- 5. ORM records (if DDL succeeded) ---
    activated: list[ActivatedModule] = []

    try:
        for meta in modules_meta:
            table_name = table_map[meta["module_name"]]
            schema_with_table = {**meta["resolved_schema"], "table_name": table_name}

            map_entry = ConfigModuleMap(
                config_id=config.config_id,
                module_id=meta["module_id"],
                custom_schema_json=schema_with_table,
                display_name=meta["display_name"],
                is_enabled=True,
            )
            db.add(map_entry)
            await db.flush()

            activated.append(
                ActivatedModule(
                    module_id=meta["module_id"],
                    module_name=meta["module_name"],
                    display_name=meta["display_name"],
                    map_id=map_entry.map_id,
                    table_name=table_name,
                    fields=meta["fields"],
                )
            )

        # Update the configuration status
        config.status    = "approved"
        config.is_active = True
        config.config_name = _build_config_name(request.config_name)
        await db.commit()

    except Exception as exc:
        logger.error("ORM commit error, rolling back DDL tables: %s", exc)
        await _schema_gen.drop_tenant_tables(
            tenant_id=current_user.tenant_id,
            module_names=[m["module_name"] for m in modules_for_ddl],
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Commit error: {exc}",
        ) from exc

    logger.info(
        "Schema approved. config_id=%d config_name=%s %d module(s) activated",
        config.config_id,
        config.config_name,
        len(activated),
    )

    return ApproveResponse(
        config_id=config.config_id,
        config_name=config.config_name,
        status="approved",
        activated_modules=activated,
        message=f"{len(activated)} module(s) activated successfully and tables created.",
    )


@router.post(
    "/edit",
    response_model=EditResponse,
    summary="Manually edit a module schema (Manual Override)",
)
async def edit_schema(
    request: EditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EditResponse:
    """JWT protected — module schema editing."""
    config = await _load_config(request.config_id, current_user.tenant_id, db)

    result = await db.execute(
        select(ConfigModuleMap).where(
            ConfigModuleMap.config_id == config.config_id,
            ConfigModuleMap.module_id == request.module_id,
        )
    )
    map_entry = result.scalar_one_or_none()

    av_module = await _load_available_module(request.module_id, db)

    new_fields = [f.model_dump() for f in request.custom_fields]
    display_name = request.display_name or (
        map_entry.display_name if map_entry else av_module.module_name.title()
    )

    if map_entry:
        existing = map_entry.custom_schema_json or {}
        map_entry.custom_schema_json = {
            **existing,
            "display_name": display_name,
            "fields": new_fields,
        }
        map_entry.display_name = display_name
    else:
        table_name = build_table_name(current_user.tenant_id, av_module.module_name)
        map_entry = ConfigModuleMap(
            config_id=config.config_id,
            module_id=request.module_id,
            custom_schema_json={
                "display_name": display_name,
                "fields": new_fields,
                "table_name": table_name,
            },
            display_name=display_name,
            is_enabled=False,
        )
        db.add(map_entry)

    await db.commit()
    await db.refresh(map_entry)

    logger.info(
        "Schema updated. config_id=%d module_id=%d map_id=%s",
        config.config_id,
        request.module_id,
        map_entry.map_id,
    )

    return EditResponse(
        config_id=config.config_id,
        map_id=map_entry.map_id,
        module_name=av_module.module_name,
        display_name=display_name,
        custom_fields=new_fields,
        message="Module schema updated.",
    )


@router.get(
    "/{config_id}",
    summary="Configuration detail",
)
async def get_config_detail(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """JWT protected — configuration summary."""
    config = await _load_config(config_id, current_user.tenant_id, db)

    result = await db.execute(
        select(ConfigModuleMap).where(ConfigModuleMap.config_id == config_id)
    )
    mappings = result.scalars().all()

    modules = []
    for m in mappings:
        schema = m.custom_schema_json or {}
        modules.append({
            "map_id":       m.map_id,
            "module_id":    m.module_id,
            "display_name": m.display_name,
            "is_enabled":   m.is_enabled,
            "table_name":   schema.get("table_name", ""),
            "fields":       schema.get("fields", []),
        })

    return {
        "config_id":           config.config_id,
        "config_name":         config.config_name,
        "status":              config.status,
        "is_active":           config.is_active,
        "ai_confidence_score": config.ai_confidence_score,
        "created_at":          config.created_at.isoformat(),
        "modules":             modules,
    }
