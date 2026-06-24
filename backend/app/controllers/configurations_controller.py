"""
ConfigurationsController — Manages the tenant's ERP configurations.
Stage 10: Multiple ERP Configurations

Endpoints:
  GET    /configurations/list       -> all active configurations + module summaries
  DELETE /configurations/{config_id} -> delete the configuration, its data, and its tables
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete, text

from app.config.database import get_db, engine
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.module import AvailableModule
from app.models.configuration import Configuration, ConfigModuleMap
from app.models.dynamic_record import DynamicRecord, AIAnalysisLog
from app.services.schema_generator import SchemaGenerator, slugify
from app.services.self_healing_engine import SelfHealingEngine
from app.schemas.schema import ManualModuleRequest, ManualModuleResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/configurations", tags=["Configurations"])

_schema_gen = SchemaGenerator(engine)

# Frontend field type -> backend type understood by SchemaGenerator
_FRONTEND_TYPE_MAP: dict[str, str] = {
    "text":             "string",
    "textarea":         "text",
    "number":           "decimal",
    "currency":         "decimal",
    "date":             "date",
    "phone":            "string",
    "email":            "string",
    "enum":             "string",
    "gender":           "string",
    "tc_kimlik":        "string",
    "number_with_unit": "string",
}


# ---------------------------------------------------------------------------
# GET /configurations/list
# ---------------------------------------------------------------------------

@router.get(
    "/list",
    summary="All active configurations for the tenant",
    description=(
        "Returns the approved, active configurations belonging to the logged-in user's tenant, "
        "together with module summaries. Ordered by creation time. "
        "If config_name is missing, it is auto-generated in the form 'ERP-N'."
    ),
)
async def list_configurations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """JWT protected — returns only the active configurations belonging to the tenant."""
    result = await db.execute(
        select(Configuration)
        .where(
            Configuration.tenant_id == current_user.tenant_id,
            Configuration.is_active == True,
        )
        .order_by(Configuration.created_at.asc())
    )
    configs = result.scalars().all()

    output = []
    for i, config in enumerate(configs):
        map_result = await db.execute(
            select(ConfigModuleMap, AvailableModule)
            .join(AvailableModule, ConfigModuleMap.module_id == AvailableModule.module_id)
            .where(
                ConfigModuleMap.config_id == config.config_id,
                ConfigModuleMap.is_enabled == True,
            )
        )
        rows = map_result.all()
        modules = [
            {
                "module_name": av_module.module_name,
                "display_name": map_obj.display_name or av_module.module_name,
            }
            for map_obj, av_module in rows
        ]
        output.append({
            "config_id":           config.config_id,
            "config_name":         config.config_name or f"ERP-{i + 1}",
            "status":              config.status,
            "ai_confidence_score": config.ai_confidence_score,
            "created_at":          config.created_at.isoformat(),
            "module_count":        len(modules),
            "modules":             modules,
        })

    logger.info(
        "Configurations listed. tenant_id=%s count=%d",
        current_user.tenant_id,
        len(output),
    )
    return output


# ---------------------------------------------------------------------------
# DELETE /configurations/{config_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an ERP configuration",
    description=(
        "Deletes the specified configuration and all of its data:\n"
        "1. DYNAMIC_RECORD records\n"
        "2. Dynamic physical tables (DROP TABLE)\n"
        "3. AI_ANALYSIS_LOG records\n"
        "4. CONFIG_MODULE_MAP records\n"
        "5. CONFIGURATION record\n\n"
        "Tenant isolation is enforced."
    ),
)
async def delete_configuration(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """JWT protected — can only delete a configuration belonging to the caller's own tenant."""

    # 1. Tenant isolation: verify the configuration belongs to this tenant
    config_result = await db.execute(
        select(Configuration).where(
            Configuration.config_id == config_id,
            Configuration.tenant_id == current_user.tenant_id,
        )
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found or access not authorized",
        )

    # 2. Load the module mappings for this config (for table names)
    map_result = await db.execute(
        select(ConfigModuleMap).where(ConfigModuleMap.config_id == config_id)
    )
    mappings = map_result.scalars().all()
    map_ids = [m.map_id for m in mappings]

    # 3. DROP the dynamic physical tables (DDL, separate connection)
    #    Table names are stored in custom_schema_json["table_name"].
    #    "dyn_" prefix security check: injection protection.
    table_names = [
        m.custom_schema_json["table_name"]
        for m in mappings
        if m.custom_schema_json and m.custom_schema_json.get("table_name", "").startswith("dyn_")
    ]
    if table_names:
        try:
            async with engine.begin() as conn:
                for tbl in table_names:
                    await conn.execute(text(f"DROP TABLE IF EXISTS {tbl} CASCADE"))
                    logger.info("Dynamic table dropped: %s", tbl)
        except Exception as exc:
            # DDL error is not critical; still attempt ORM cleanup
            logger.warning("Error dropping dynamic table (continuing): %s", exc)
            await SelfHealingEngine(engine).report_failure(
                stage="DELETE",
                error=exc,
                config_id=config_id,
                context=f"tables={table_names}",
            )

    # 4. Delete DYNAMIC_RECORD records
    if map_ids:
        await db.execute(
            sql_delete(DynamicRecord).where(DynamicRecord.map_id.in_(map_ids))
        )

    # 5. Delete AI_ANALYSIS_LOG records
    await db.execute(
        sql_delete(AIAnalysisLog).where(AIAnalysisLog.config_id == config_id)
    )

    # 6. Delete CONFIG_MODULE_MAP records
    await db.execute(
        sql_delete(ConfigModuleMap).where(ConfigModuleMap.config_id == config_id)
    )

    # 7. Delete CONFIGURATION record
    await db.delete(config)
    await db.commit()

    logger.info(
        "Configuration deleted. config_id=%d tenant_id=%s tables=%s",
        config_id,
        current_user.tenant_id,
        table_names,
    )


# ---------------------------------------------------------------------------
# POST /configurations/{config_id}/modules/manual
# ---------------------------------------------------------------------------

@router.post(
    "/{config_id}/modules/manual",
    response_model=ManualModuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a manual module to an existing ERP",
    description=(
        "Adds a new module to the tenant's selected configuration:\n"
        "1. The module name is slugified\n"
        "2. A record is found or created in AVAILABLE_MODULE\n"
        "3. A physical table is created in PostgreSQL (CREATE TABLE IF NOT EXISTS, atomic)\n"
        "4. A CONFIG_MODULE_MAP record is created\n\n"
        "Tenant isolation is enforced."
    ),
)
async def create_manual_module(
    config_id: int,
    request: ManualModuleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ManualModuleResponse:
    """JWT protected — a module can only be added to a configuration belonging to the tenant."""

    # 1. Load the configuration + verify tenant isolation
    config_result = await db.execute(
        select(Configuration).where(
            Configuration.config_id == config_id,
            Configuration.tenant_id == current_user.tenant_id,
        )
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found or access not authorized",
        )

    # 2. Slugify the module name
    module_slug = slugify(request.module_name) or slugify(request.display_name) or "module"

    # 3a. Duplicate check — does a module with this slug already exist in this config?
    dup_result = await db.execute(
        select(ConfigModuleMap)
        .join(AvailableModule, ConfigModuleMap.module_id == AvailableModule.module_id)
        .where(
            ConfigModuleMap.config_id == config_id,
            AvailableModule.module_name == module_slug,
        )
    )
    if dup_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A module named '{request.display_name}' already exists in this configuration.",
        )

    # 3b. Find or create the AVAILABLE_MODULE record
    mod_result = await db.execute(
        select(AvailableModule).where(AvailableModule.module_name == module_slug)
    )
    av_module = mod_result.scalar_one_or_none()
    if not av_module:
        av_module = AvailableModule(
            module_name=module_slug,
            base_schema_json={"display_name": request.display_name},
            is_system_default=False,
        )
        db.add(av_module)
        await db.flush()

    # 4. Normalize field definitions (slugify + type conversion)
    seen_names: set[str] = set()
    fields: list[dict] = []
    for f in request.fields:
        raw_name = f.name.strip() or "field"
        field_slug = slugify(raw_name) or "field"
        base = field_slug
        counter = 1
        while field_slug in seen_names:
            field_slug = f"{base}_{counter}"
            counter += 1
        seen_names.add(field_slug)

        backend_type = _FRONTEND_TYPE_MAP.get(f.type, "string")
        field_dict: dict = {
            "name":       field_slug,
            "type":       backend_type,
            "input_type": f.type,     # Original frontend type — for SmartInput type detection
            "required":   f.required,
            "label":      f.name,
        }
        if f.enum_values:
            field_dict["enum_values"] = f.enum_values
        if f.unit:
            field_dict["unit"] = f.unit
        if f.default_currency:
            field_dict["default_currency"] = f.default_currency
        fields.append(field_dict)

    # 5. Atomic DDL transaction — existing SchemaGenerator pattern
    try:
        table_map = await _schema_gen.apply_schemas(
            tenant_id=current_user.tenant_id,
            modules=[{"module_name": module_slug, "fields": fields}],
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DDL error: {exc}",
        ) from exc

    table_name = table_map[module_slug]

    # 6. Create the CONFIG_MODULE_MAP record
    custom_schema: dict = {
        "display_name": request.display_name,
        "fields":       fields,
        "table_name":   table_name,
    }
    if request.description:
        custom_schema["description"] = request.description

    map_entry = ConfigModuleMap(
        config_id=config.config_id,
        module_id=av_module.module_id,
        custom_schema_json=custom_schema,
        display_name=request.display_name,
        is_enabled=True,
    )
    db.add(map_entry)

    try:
        await db.commit()
        await db.refresh(map_entry)
    except Exception as exc:
        logger.error("ORM commit error, dropping DDL table: %s", exc)
        await SelfHealingEngine(engine).report_failure(
            stage="DDL",
            error=exc,
            config_id=config_id,
            context=f"module={module_slug} orm_commit_failure",
        )
        await _schema_gen.drop_tenant_tables(
            tenant_id=current_user.tenant_id,
            module_names=[module_slug],
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Commit error: {exc}",
        ) from exc

    logger.info(
        "Manual module added. config_id=%d module=%s map_id=%d table=%s",
        config_id, module_slug, map_entry.map_id, table_name,
    )

    return ManualModuleResponse(
        map_id=map_entry.map_id,
        module_id=av_module.module_id,
        module_name=module_slug,
        display_name=request.display_name,
        message=f"Module '{request.display_name}' created successfully.",
    )
