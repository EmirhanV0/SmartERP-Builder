"""
APIGenerator — CRUD operations on the DYNAMIC_RECORD table.
Data is stored in the JSONB data_payload; search_vector is updated for full-text search.
Stage 5: Dynamic Schema Generation
"""
import uuid
import logging
from typing import Any, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dynamic_record import DynamicRecord

logger = logging.getLogger(__name__)


class APIGenerator:
    """Provides dynamic CRUD over the DYNAMIC_RECORD table."""

    # -----------------------------------------------------------------------
    # Helper methods
    # -----------------------------------------------------------------------

    def _text_fields(self, schema_fields: list[dict]) -> list[str]:
        """Extracts text-type field names from the schema (for full-text search)."""
        return [
            f["name"]
            for f in schema_fields
            if f.get("type") in ("string", "text")
        ]

    def _validate(self, data: dict, schema_fields: list[dict]) -> None:
        """
        Checks the presence of required fields.
        Raises: ValueError — missing required field
        """
        for field in schema_fields:
            if field.get("required") and field["name"] not in data:
                raise ValueError(
                    f"Required field missing: '{field['name']}' "
                    f"({field.get('label') or field['name']})"
                )

    def _build_search_text(self, data: dict, schema_fields: list[dict]) -> str:
        """Builds combined text for TSVECTOR."""
        parts = [
            str(data[f])
            for f in self._text_fields(schema_fields)
            if f in data and data[f]
        ]
        return " ".join(parts)

    async def _update_search_vector(
        self,
        record_id: uuid.UUID,
        search_text: str,
        db: AsyncSession,
    ) -> None:
        """Updates the TSVECTOR column via raw SQL."""
        if search_text.strip():
            await db.execute(
                text(
                    "UPDATE dynamic_record "
                    "SET search_vector = to_tsvector('simple', :sv) "
                    "WHERE record_id = :rid"
                ),
                {"sv": search_text, "rid": str(record_id)},
            )

    # -----------------------------------------------------------------------
    # CRUD
    # -----------------------------------------------------------------------

    async def create_record(
        self,
        map_id: int,
        data: dict[str, Any],
        created_by: uuid.UUID,
        schema_fields: list[dict],
        db: AsyncSession,
    ) -> DynamicRecord:
        """
        Creates a new record.
        - Validates required fields
        - Writes to JSONB data_payload
        - Updates the TSVECTOR search_vector
        """
        self._validate(data, schema_fields)

        record = DynamicRecord(
            map_id=map_id,
            created_by=created_by,
            data_payload=data,
        )
        db.add(record)
        await db.flush()  # obtain the record_id PK

        await self._update_search_vector(
            record.record_id,
            self._build_search_text(data, schema_fields),
            db,
        )

        await db.commit()
        await db.refresh(record)
        logger.info("Record created. record_id=%s map_id=%d", record.record_id, map_id)
        return record

    async def list_records(
        self,
        map_id: int,
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
        search: Optional[str] = None,
    ) -> list[DynamicRecord]:
        """
        Returns non-deleted records belonging to map_id.
        If the search parameter is provided, full-text search is applied.
        """
        if search:
            # Parameterized query — safe against SQL injection
            result = await db.execute(
                select(DynamicRecord)
                .where(
                    DynamicRecord.map_id == map_id,
                    DynamicRecord.is_deleted == False,
                    DynamicRecord.search_vector.op("@@")(
                        text("plainto_tsquery('simple', :q)").bindparams(q=search)
                    ),
                )
                .order_by(DynamicRecord.created_at.desc())
                .limit(limit)
                .offset(offset),
            )
        else:
            result = await db.execute(
                select(DynamicRecord)
                .where(
                    DynamicRecord.map_id == map_id,
                    DynamicRecord.is_deleted == False,
                )
                .order_by(DynamicRecord.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        return list(result.scalars().all())

    async def count_records(self, map_id: int, db: AsyncSession) -> int:
        """Returns the total count of non-deleted records belonging to map_id."""
        result = await db.execute(
            text(
                "SELECT COUNT(*) FROM dynamic_record "
                "WHERE map_id = :mid AND is_deleted = false"
            ),
            {"mid": map_id},
        )
        return result.scalar() or 0

    async def get_record(
        self,
        record_id: uuid.UUID,
        map_id: int,
        db: AsyncSession,
    ) -> Optional[DynamicRecord]:
        """Fetches a single non-deleted record; isolated by map_id."""
        result = await db.execute(
            select(DynamicRecord).where(
                DynamicRecord.record_id == record_id,
                DynamicRecord.map_id == map_id,
                DynamicRecord.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()

    async def update_record(
        self,
        record_id: uuid.UUID,
        map_id: int,
        data: dict[str, Any],
        schema_fields: list[dict],
        db: AsyncSession,
    ) -> DynamicRecord:
        """Updates data_payload and refreshes search_vector."""
        record = await self.get_record(record_id, map_id, db)
        if not record:
            raise ValueError(f"Record not found: {record_id}")

        self._validate(data, schema_fields)

        record.data_payload = data
        await db.flush()

        # Update both search_vector and updated_at
        sv_text = self._build_search_text(data, schema_fields)
        if sv_text.strip():
            await db.execute(
                text(
                    "UPDATE dynamic_record "
                    "SET search_vector = to_tsvector('simple', :sv), "
                    "    updated_at = NOW() "
                    "WHERE record_id = :rid"
                ),
                {"sv": sv_text, "rid": str(record_id)},
            )
        else:
            await db.execute(
                text(
                    "UPDATE dynamic_record SET updated_at = NOW() WHERE record_id = :rid"
                ),
                {"rid": str(record_id)},
            )

        await db.commit()
        await db.refresh(record)
        logger.info("Record updated. record_id=%s", record_id)
        return record

    async def delete_record(
        self,
        record_id: uuid.UUID,
        map_id: int,
        db: AsyncSession,
    ) -> bool:
        """Soft delete: sets is_deleted=true, no physical deletion. Returns False if not found."""
        record = await self.get_record(record_id, map_id, db)
        if not record:
            return False
        record.is_deleted = True
        await db.execute(
            text("UPDATE dynamic_record SET is_deleted = true, updated_at = NOW() WHERE record_id = :rid"),
            {"rid": str(record_id)},
        )
        await db.commit()
        logger.info("Record soft-deleted. record_id=%s", record_id)
        return True
