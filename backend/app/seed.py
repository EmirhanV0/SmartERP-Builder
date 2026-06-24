
"""
Seed data — loads default ERP modules into the AVAILABLE_MODULE table.
Idempotent: ON CONFLICT DO NOTHING — can be re-run safely.
"""
import asyncio
import logging
import os

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Default ERP modules and their base schemas
MODULES = [
    {
        "module_name": "inventory",
        "display_tr": "Stok Yönetimi",
        "base_schema_json": {
            "display_name": "Stok Yönetimi",
            "fields": [
                {"name": "product_name", "type": "string", "required": True, "label": "Ürün Adı"},
                {"name": "sku", "type": "string", "required": True, "label": "Stok Kodu"},
                {"name": "quantity", "type": "integer", "required": True, "label": "Miktar"},
                {"name": "unit_price", "type": "decimal", "required": True, "label": "Birim Fiyat"},
                {"name": "location", "type": "string", "required": False, "label": "Depo Konumu"},
                {"name": "min_stock", "type": "integer", "required": False, "label": "Minimum Stok"},
            ],
        },
    },
    {
        "module_name": "billing",
        "display_tr": "Faturalandırma",
        "base_schema_json": {
            "display_name": "Faturalandırma",
            "fields": [
                {"name": "invoice_no", "type": "string", "required": True, "label": "Fatura No"},
                {"name": "customer_name", "type": "string", "required": True, "label": "Müşteri Adı"},
                {"name": "amount", "type": "decimal", "required": True, "label": "Tutar"},
                {"name": "tax_rate", "type": "decimal", "required": True, "label": "KDV Oranı"},
                {"name": "due_date", "type": "date", "required": True, "label": "Son Ödeme Tarihi"},
                {"name": "status", "type": "string", "required": True, "label": "Durum"},
            ],
        },
    },
    {
        "module_name": "hr",
        "display_tr": "İnsan Kaynakları",
        "base_schema_json": {
            "display_name": "İnsan Kaynakları",
            "fields": [
                {"name": "employee_name", "type": "string", "required": True, "label": "Çalışan Adı"},
                {"name": "department", "type": "string", "required": True, "label": "Departman"},
                {"name": "position", "type": "string", "required": True, "label": "Pozisyon"},
                {"name": "salary", "type": "decimal", "required": False, "label": "Maaş"},
                {"name": "start_date", "type": "date", "required": True, "label": "İşe Başlama"},
                {"name": "status", "type": "string", "required": True, "label": "Durum"},
            ],
        },
    },
    {
        "module_name": "sales",
        "display_tr": "Satış",
        "base_schema_json": {
            "display_name": "Satış",
            "fields": [
                {"name": "order_no", "type": "string", "required": True, "label": "Sipariş No"},
                {"name": "customer_name", "type": "string", "required": True, "label": "Müşteri"},
                {"name": "product_name", "type": "string", "required": True, "label": "Ürün"},
                {"name": "quantity", "type": "integer", "required": True, "label": "Adet"},
                {"name": "unit_price", "type": "decimal", "required": True, "label": "Birim Fiyat"},
                {"name": "total", "type": "decimal", "required": True, "label": "Toplam"},
                {"name": "order_date", "type": "date", "required": True, "label": "Sipariş Tarihi"},
            ],
        },
    },
    {
        "module_name": "production",
        "display_tr": "Üretim",
        "base_schema_json": {
            "display_name": "Üretim",
            "fields": [
                {"name": "work_order", "type": "string", "required": True, "label": "İş Emri No"},
                {"name": "product_name", "type": "string", "required": True, "label": "Ürün"},
                {"name": "quantity", "type": "integer", "required": True, "label": "Üretim Miktarı"},
                {"name": "start_date", "type": "date", "required": True, "label": "Başlangıç"},
                {"name": "end_date", "type": "date", "required": False, "label": "Bitiş"},
                {"name": "status", "type": "string", "required": True, "label": "Durum"},
            ],
        },
    },
    {
        "module_name": "purchasing",
        "display_tr": "Satın Alma",
        "base_schema_json": {
            "display_name": "Satın Alma",
            "fields": [
                {"name": "po_number", "type": "string", "required": True, "label": "Satın Alma No"},
                {"name": "supplier_name", "type": "string", "required": True, "label": "Tedarikçi"},
                {"name": "item_name", "type": "string", "required": True, "label": "Ürün/Hizmet"},
                {"name": "quantity", "type": "integer", "required": True, "label": "Miktar"},
                {"name": "unit_price", "type": "decimal", "required": True, "label": "Birim Fiyat"},
                {"name": "delivery_date", "type": "date", "required": False, "label": "Teslimat Tarihi"},
            ],
        },
    },
    {
        "module_name": "crm",
        "display_tr": "Müşteri İlişkileri",
        "base_schema_json": {
            "display_name": "Müşteri İlişkileri",
            "fields": [
                {"name": "customer_name", "type": "string", "required": True, "label": "Müşteri Adı"},
                {"name": "email", "type": "string", "required": False, "label": "E-posta"},
                {"name": "phone", "type": "string", "required": False, "label": "Telefon"},
                {"name": "company", "type": "string", "required": False, "label": "Şirket"},
                {"name": "status", "type": "string", "required": True, "label": "Durum"},
                {"name": "notes", "type": "text", "required": False, "label": "Notlar"},
            ],
        },
    },
    {
        "module_name": "accounting",
        "display_tr": "Muhasebe",
        "base_schema_json": {
            "display_name": "Muhasebe",
            "fields": [
                {"name": "transaction_no", "type": "string", "required": True, "label": "İşlem No"},
                {"name": "account_name", "type": "string", "required": True, "label": "Hesap Adı"},
                {"name": "transaction_type", "type": "string", "required": True, "label": "İşlem Türü"},
                {"name": "amount", "type": "decimal", "required": True, "label": "Tutar"},
                {"name": "transaction_date", "type": "date", "required": True, "label": "İşlem Tarihi"},
                {"name": "description", "type": "text", "required": False, "label": "Açıklama"},
            ],
        },
    },
    {
        "module_name": "warehouse",
        "display_tr": "Depo Yönetimi",
        "base_schema_json": {
            "display_name": "Depo Yönetimi",
            "fields": [
                {"name": "warehouse_name", "type": "string", "required": True, "label": "Depo Adı"},
                {"name": "location", "type": "string", "required": True, "label": "Konum"},
                {"name": "item_name", "type": "string", "required": True, "label": "Ürün/Malzeme"},
                {"name": "quantity", "type": "integer", "required": True, "label": "Miktar"},
                {"name": "unit", "type": "string", "required": False, "label": "Birim"},
                {"name": "last_updated", "type": "date", "required": False, "label": "Son Güncelleme"},
            ],
        },
    },
    {
        "module_name": "project",
        "display_tr": "Proje Yönetimi",
        "base_schema_json": {
            "display_name": "Proje Yönetimi",
            "fields": [
                {"name": "project_name", "type": "string", "required": True, "label": "Proje Adı"},
                {"name": "manager", "type": "string", "required": True, "label": "Proje Yöneticisi"},
                {"name": "start_date", "type": "date", "required": True, "label": "Başlangıç"},
                {"name": "end_date", "type": "date", "required": False, "label": "Bitiş"},
                {"name": "budget", "type": "decimal", "required": False, "label": "Bütçe"},
                {"name": "status", "type": "string", "required": True, "label": "Durum"},
            ],
        },
    },
]


async def run_seed() -> None:
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://smarterp:smarterp123@postgres:5432/smarterp_db",
    )
    engine = create_async_engine(database_url, echo=False)

    async with engine.begin() as conn:
        for module in MODULES:
            import json
            schema_json = json.dumps(module["base_schema_json"], ensure_ascii=False)
            await conn.execute(
                text(
                    """
                    INSERT INTO available_module (module_name, base_schema_json, is_system_default)
                    VALUES (:name, cast(:schema as jsonb), true)
                    ON CONFLICT (module_name) DO NOTHING
                    """
                ),
                {"name": module["module_name"], "schema": schema_json},
            )
            logger.info(f"Module loaded: {module['module_name']} ({module['display_tr']})")

    await engine.dispose()
    logger.info("Seed complete — %d module(s) loaded.", len(MODULES))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    asyncio.run(run_seed())
