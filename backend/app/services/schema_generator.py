"""
SchemaGenerator — Generates DDL from a JSON blueprint and executes it in an atomic transaction.
Stage 5: Dynamic Schema Generation
"""
import re
import uuid
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.services.self_healing_engine import SelfHealingEngine

logger = logging.getLogger(__name__)

# Field type -> PostgreSQL type
_TYPE_MAP: dict[str, str] = {
    "string":   "VARCHAR(500)",
    "text":     "TEXT",
    "integer":  "INTEGER",
    "decimal":  "NUMERIC(15,2)",
    "float":    "DOUBLE PRECISION",
    "date":     "DATE",
    "datetime": "TIMESTAMPTZ",
    "boolean":  "BOOLEAN",
    "json":     "JSONB",
    "uuid":     "UUID",
}


def _safe(value: str, max_len: int = 30) -> str:
    """Safe PostgreSQL identifier: only a-z, 0-9, _ — max_len characters."""
    return re.sub(r"[^a-z0-9_]", "_", value.lower())[:max_len]


# System columns added to every dyn_* table — AI/user fields must never shadow
# them, otherwise CREATE TABLE fails with SQLSTATE 42701 (duplicate_column)
RESERVED_COLUMNS = {
    "id", "tenant_id", "map_id", "created_by",
    "created_at", "updated_at", "search_vector",
}


def _resolve_field_collisions(module_name: str, fields: list[dict[str, Any]]) -> None:
    """
    Renames field names that collide with RESERVED_COLUMNS or with each other.

    Mutates the field dicts IN PLACE on purpose: both controllers store these
    exact dict objects into custom_schema_json after apply_schemas() succeeds,
    so the rename automatically propagates to the form schema — data_payload
    keys stay aligned with the physical column names without extra sync code.
    The human-facing "label" key is left untouched.
    """
    seen: set[str] = set()
    for field in fields:
        name = _safe(field.get("name", "col"), 50)
        if name in RESERVED_COLUMNS:
            renamed = f"{name}_field"
            logger.info(
                "Reserved column collision: '%s' renamed to '%s' in module %s",
                name, renamed, module_name,
            )
            name = renamed
        if name in seen:
            base = name
            counter = 2
            while name in seen:
                name = f"{base}_{counter}"
                counter += 1
            logger.info(
                "Duplicate field slug: '%s' renamed to '%s' in module %s",
                base, name, module_name,
            )
        seen.add(name)
        field["name"] = name


_TR_MAP = str.maketrans("çğışöüÇĞİŞÖÜ", "cgisoucgisou")


def slugify(text: str) -> str:
    """Converts Turkish text into a PostgreSQL-safe identifier.

    E.g.: "Tıbbi Kayıt" -> "tibbi_kayit", "Sporcu" -> "sporcu"
    """
    return _safe(text.translate(_TR_MAP), 50)


def build_table_name(tenant_id: uuid.UUID, module_name: str) -> str:
    """
    Tenant-isolated table name: dyn_{tenant_hex12}_{module_name}
    Example: dyn_59f5cd840aee_inventory  (under the PostgreSQL 63-char limit)
    """
    prefix = str(tenant_id).replace("-", "")[:12]
    return f"dyn_{prefix}_{_safe(module_name, 20)}"


def build_ddl_statements(
    tenant_id: uuid.UUID,
    module_name: str,
    fields: list[dict[str, Any]],
) -> tuple[list[str], str]:
    """
    Generates DDL statements (CREATE TABLE + CREATE INDEX) from a JSON field list.

    Returns:
        (statements, table_name)
    """
    table = build_table_name(tenant_id, module_name)
    # PostgreSQL index names are limited to 63 chars
    short = table[:40]

    # Rename reserved/duplicate field names before generating column defs
    # (mutates `fields` in place so custom_schema_json picks up the renames)
    _resolve_field_collisions(module_name, fields)

    # Fixed infrastructure columns
    col_defs = [
        "    id            BIGSERIAL PRIMARY KEY",
        "    tenant_id     UUID         NOT NULL",
        "    map_id        BIGINT       NOT NULL",
        "    created_by    UUID",
        "    created_at    TIMESTAMPTZ  DEFAULT NOW()",
        "    updated_at    TIMESTAMPTZ  DEFAULT NOW()",
        "    search_vector TSVECTOR",
    ]

    text_fields: list[str] = []

    for field in fields:
        # Name is already sanitized + de-collided by _resolve_field_collisions;
        # re-running _safe here could truncate and break the schema/payload match
        col_name = field["name"]
        pg_type  = _TYPE_MAP.get(field.get("type", "string"), "TEXT")
        col_defs.append(f"    {col_name} {pg_type}")

        if field.get("type") in ("string", "text"):
            text_fields.append(col_name)

    cols_sql = ",\n".join(col_defs)
    stmts: list[str] = [
        f"CREATE TABLE IF NOT EXISTS {table} (\n{cols_sql}\n)"
    ]

    # tenant_id and map_id indexes
    stmts.append(
        f"CREATE INDEX IF NOT EXISTS idx_{short}_tid ON {table}(tenant_id)"
    )
    stmts.append(
        f"CREATE INDEX IF NOT EXISTS idx_{short}_mid ON {table}(map_id)"
    )
    # TSVECTOR GIN index for full-text search
    if text_fields:
        stmts.append(
            f"CREATE INDEX IF NOT EXISTS idx_{short}_fts "
            f"ON {table} USING GIN(search_vector)"
        )

    return stmts, table


class SchemaGenerator:
    """
    Generates DDL from a JSON blueprint and applies it to PostgreSQL in a single atomic transaction.
    In PostgreSQL, DDL operations can be rolled back via transactions (unlike MySQL).
    """

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def apply_schemas(
        self,
        tenant_id: uuid.UUID,
        modules: list[dict[str, Any]],
    ) -> dict[str, str]:
        """
        Creates a physical DDL table for each module.
        All CREATE TABLE + CREATE INDEX statements run in a single atomic transaction.

        Args:
            tenant_id: Tenant UUID
            modules: [{"module_name": str, "fields": [{"name", "type", ...}]}]

        Returns:
            {module_name: table_name} — names of the created tables

        Raises:
            RuntimeError: DDL error — the transaction is automatically rolled back
        """
        table_map: dict[str, str] = {}
        all_stmts: list[str] = []

        for module in modules:
            module_name = module["module_name"]
            fields      = module.get("fields", [])
            stmts, table = build_ddl_statements(tenant_id, module_name, fields)
            table_map[module_name] = table
            all_stmts.extend(stmts)

        # Atomic DDL: either all succeed or none do
        try:
            async with self._engine.begin() as conn:
                for stmt in all_stmts:
                    logger.debug("DDL: %s", stmt[:100])
                    await conn.execute(text(stmt))
        except Exception as exc:
            logger.error("DDL transaction error — ROLLBACK: %s", exc)
            await SelfHealingEngine(self._engine).report_failure(
                stage="DDL",
                error=exc,
                config_id=None,
                context=f"tenant={tenant_id} modules={[m['module_name'] for m in modules]}",
            )
            raise RuntimeError(f"DDL error: {exc}") from exc

        logger.info(
            "DDL transaction COMMIT. %d tables: %s",
            len(table_map),
            list(table_map.values()),
        )
        return table_map

    async def drop_tenant_tables(
        self,
        tenant_id: uuid.UUID,
        module_names: list[str],
    ) -> None:
        """Drops the tenant's module tables (for error rollback / testing)."""
        async with self._engine.begin() as conn:
            for name in module_names:
                table = build_table_name(tenant_id, name)
                await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                logger.info("Table dropped: %s", table)
