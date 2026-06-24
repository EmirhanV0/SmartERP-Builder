"""
BenchmarkEngine — Compares the AI recommendation against sector benchmarks
and matches it with modules in the AVAILABLE_MODULE table.
Stage 4: AI Integration
"""
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import AvailableModule

logger = logging.getLogger(__name__)

# Sector -> prioritized module list
_SECTOR_MODULES: dict[str, list[str]] = {
    "retail":        ["inventory", "billing", "sales", "crm"],
    "manufacturing": ["inventory", "production", "purchasing", "hr"],
    "construction":  ["purchasing", "hr", "billing", "production"],
    "food":          ["inventory", "production", "purchasing", "sales"],
    "services":      ["billing", "crm", "hr", "sales"],
    "technology":    ["billing", "hr", "crm", "sales"],
    "healthcare":    ["billing", "hr", "inventory", "crm"],
    "furniture":     ["inventory", "purchasing", "billing", "sales"],
    "wholesale":     ["inventory", "purchasing", "billing", "crm"],
    # General default
    "default":       ["inventory", "billing", "sales", "hr"],
}

# Module name -> Turkish display name (UI-facing, intentionally Turkish)
_DISPLAY_NAMES: dict[str, str] = {
    "inventory":  "Stok Yönetimi",
    "billing":    "Faturalandırma",
    "hr":         "İnsan Kaynakları",
    "sales":      "Satış",
    "production": "Üretim",
    "purchasing": "Satın Alma",
    "crm":        "Müşteri İlişkileri",
}


class BenchmarkEngine:
    """Service that matches and enriches AI recommendations with DB modules."""

    # Normalizes sector codes coming from the frontend to benchmark keys
    _SECTOR_ALIASES: dict[str, str] = {
        "service":   "services",
        "logistics": "wholesale",
        "education": "services",
        "finance":   "services",
        "other":     "default",
    }

    def get_sector_modules(self, sector_code: str) -> list[str]:
        """Returns the recommended module list for the given sector code."""
        normalized = self._SECTOR_ALIASES.get(sector_code.lower(), sector_code.lower())
        return _SECTOR_MODULES.get(normalized, _SECTOR_MODULES["default"])

    async def _fetch_available_modules(self, db: AsyncSession) -> dict[str, dict[str, Any]]:
        """Returns the AVAILABLE_MODULE table as a module_name -> details dict."""
        result = await db.execute(select(AvailableModule))
        modules = result.scalars().all()
        return {
            m.module_name: {
                "module_id": m.module_id,
                "module_name": m.module_name,
                "base_schema_json": m.base_schema_json or {},
                "is_system_default": m.is_system_default,
            }
            for m in modules
        }

    async def match_and_enrich(
        self,
        ai_recommended: list[str],
        sector_code: str,
        db: AsyncSession,
    ) -> list[dict[str, Any]]:
        """
        Matches AI recommendations with the modules in the DB; also adds sector-based modules.

        Returns:
            [
                {
                    module_name: str,
                    display_name: str,
                    module_id: int,
                    schema: dict,
                    ai_suggested: bool,   # True -> recommended by AI, False -> added from sector benchmark
                }
            ]
        """
        available = await self._fetch_available_modules(db)

        # AI recommendations -> only those that exist in the DB
        matched: list[str] = [name for name in ai_recommended if name in available]

        # Sector benchmark modules -> fill in what the AI missed
        sector_mods = self.get_sector_modules(sector_code)
        for mod in sector_mods:
            if mod not in matched and mod in available:
                matched.append(mod)

        # Add details for each module
        enriched: list[dict[str, Any]] = []
        for name in matched:
            mod = available[name]
            enriched.append(
                {
                    "module_name": name,
                    "display_name": _DISPLAY_NAMES.get(name, name.title()),
                    "module_id": mod["module_id"],
                    "schema": mod["base_schema_json"],
                    "ai_suggested": name in ai_recommended,
                }
            )

        logger.info(
            "Benchmark result. AI recommendation=%s | Matched+completed=%s",
            ai_recommended,
            [m["module_name"] for m in enriched],
        )
        return enriched
