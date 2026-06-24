"""
Demo data seed script — fills the admin tenant's active ERP modules with
realistic records for presentations. No AI calls; pure PostgreSQL INSERTs.

Records are written to the central DYNAMIC_RECORD table (same path as the
record create endpoint): JSONB data_payload with string values,
{name}_currency / {name}_unit companion keys, and a search_vector built with
to_tsvector('simple', ...) from string/text-typed fields so records show up
in Command Palette search.

Every seeded payload carries a "_seed": true marker. --fresh (default) deletes
ONLY marker'd records before re-seeding; user-entered records are never touched.

Usage:
    docker-compose exec backend python scripts/seed_demo_records.py --fresh
    docker-compose exec backend python scripts/seed_demo_records.py --append
"""
import argparse
import asyncio
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
]

RECORDS_PER_MODULE = (25, 40)
TODAY_MIN, TODAY_MAX = 2, 4  # guaranteed records dated today (across all modules)

# ---------------------------------------------------------------------------
# Value pools (English, realistic)
# Note: Turkish lookup KEYS elsewhere (kan_grubu, hasta, müşteri...) must stay
# — they match existing Turkish-named module fields; only VALUES are English.
# ---------------------------------------------------------------------------

# Split by gender so a record's gender field can match its person name
MALE_NAMES = [
    "James", "Michael", "Robert", "John", "David", "William", "Richard", "Thomas",
    "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Steven", "Andrew", "Joshua",
    "Kevin", "Brian", "George", "Edward", "Ryan", "Eric",
]
FEMALE_NAMES = [
    "Emily", "Olivia", "Emma", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia",
    "Sarah", "Jessica", "Jennifer", "Elizabeth", "Megan", "Hannah", "Grace", "Chloe",
    "Victoria", "Natalie", "Lauren", "Rachel", "Anna", "Claire",
]
FIRST_NAMES = MALE_NAMES + FEMALE_NAMES
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson",
    "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson",
    "Walker", "Hall", "Young", "King", "Wright", "Scott", "Green", "Baker",
]
COMPANY_NAMES = [
    "Atlas Supply Co.", "Meridian Logistics Ltd.", "Coastal Medical Inc.",
    "Northgate Trading Co.", "Capital Distribution LLC", "Eastfield Textiles Inc.",
    "Pacific Foods Corp.", "Bridgepoint Technologies Ltd.", "Summit Chemicals Inc.",
    "Crestline Packaging Ltd.", "Ironwood Construction Co.", "Lakeside Plastics Inc.",
]
PRODUCT_NAMES = [
    "Bone-Shaped Dog Toy", "Fluffy Cat Ball", "Interactive Feeding Bowl",
    "Rope Tug Toy", "Plush Mouse Set", "Rubber Ball", "Scratching Post",
    "Smart Treat Ball", "Squeaky Duck Toy", "Natural Chew Stick",
    "Colorful Frisbee", "Mini Tunnel Set", "Soft Pet Bed", "Pet Carrier Bag",
    "Automatic Water Fountain", "Dental Chew Ring",
]
CITIES = [
    "New York", "Chicago", "Los Angeles", "Houston", "Boston", "Seattle",
    "Denver", "Atlanta", "Miami", "Dallas", "Portland", "Phoenix",
]
DISTRICTS = ["Downtown", "Riverside", "Lakeview", "Hillcrest", "Westside", "Midtown", "Oakwood", "Brookfield"]
STREETS = ["Maple", "Oak", "Cedar", "Elm", "Washington", "Lincoln", "Park", "Madison"]
INSURERS = ["Allianz", "AXA", "MetLife", "Prudential", "Zurich", "AIG", "Generali"]
CATEGORIES = ["Standard", "Premium", "Economy", "Professional", "Industrial", "Classic", "New Season"]
SENTENCES = [
    "Processed with priority at the customer's request.",
    "No issues were found during inspection.",
    "Delivery was completed as scheduled.",
    "Will be reviewed again at the next visit.",
    "Stock level is low, reorder is recommended.",
    "Payment details were shared with accounting.",
    "Appointment reminder was made by phone.",
    "Documents were received in full.",
    "Follow-up was assigned to the responsible staff member.",
    "Overall condition is stable, routine check is sufficient.",
]

# Mirrors frontend detectInputType.js ENUM_OPTIONS (records must look the same)
ENUM_OPTIONS = {
    "kan_grubu": ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"],
    "cinsiyet": ["Male", "Female", "Other"],
    "durum": ["Active", "Inactive", "Pending"],
    "odeme_durumu": ["Paid", "Pending", "Cancelled"],
    "oncelik": ["Low", "Medium", "High"],
    "status": ["Active", "Inactive", "Pending"],
    "blood_type": ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"],
    "blood_group": ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"],
    "priority": ["Low", "Medium", "High"],
    "payment_status": ["Paid", "Pending", "Cancelled"],
    "payment_state": ["Paid", "Pending", "Cancelled"],
    "order_status": ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
    "claim_status": ["Pending", "Approved", "Rejected"],
    "approval_status": ["Pending", "Approved", "Rejected"],
    "appointment_status": ["Scheduled", "Completed", "Cancelled", "No-Show"],
}

PERSON_MODULE_HINTS = (
    "patient", "customer", "employee", "client", "user", "doctor", "person",
    "hasta", "müşteri", "musteri", "personel", "sporcu", "kullanıcı", "kullanici",
)
COMPANY_MODULE_HINTS = ("supplier", "vendor", "tedarikçi", "tedarikci", "company", "firma")

NUMBER_WITH_UNIT_RULES = [
    # (name fragments, default unit, value range)
    (("height", "boy", "uzunluk"), "cm", (140, 200)),
    (("weight", "kilo", "agirlik", "ağırlık"), "kg", (3, 120)),
    (("dosage", "dozaj", "doz"), "mg", (5, 1000)),
    (("volume", "hacim"), "ml", (50, 1000)),
    (("distance", "mesafe"), "km", (1, 500)),
    (("duration", "sure", "süre", "iyilesme"), "min", (10, 180)),
]

TR_ASCII = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


def _enum_lookup(slug: str):
    if slug in ENUM_OPTIONS:
        return ENUM_OPTIONS[slug]
    for key, opts in ENUM_OPTIONS.items():
        if key in slug or slug in key:
            return opts
    return None


def detect_kind(field: dict) -> tuple[str, dict]:
    """
    Python port of frontend detectInputType.js: resolves the effective input
    kind for a field from explicit metadata first, then name heuristics.
    Returns (kind, extras) where extras may carry options/unit/currency/range.
    """
    name = (field.get("name") or "").lower().replace(" ", "_")
    ftype = field.get("type") or "string"
    input_type = field.get("input_type") or ""
    enum_values = field.get("enum_values")

    if isinstance(enum_values, str):
        try:
            enum_values = json.loads(enum_values)
        except (ValueError, TypeError):
            enum_values = None
    if enum_values and isinstance(enum_values, list):
        return "enum", {"options": enum_values}

    # Explicit manual-module input types win over name heuristics
    if input_type == "enum":
        return "enum", {"options": _enum_lookup(name) or ["Active", "Inactive", "Pending"]}
    if input_type == "currency":
        return "currency", {"currency": field.get("default_currency") or "USD"}
    if input_type == "number_with_unit":
        unit = field.get("unit")
        for frags, default_unit, rng in NUMBER_WITH_UNIT_RULES:
            if any(f in name for f in frags):
                return "number_with_unit", {"unit": unit or default_unit, "range": rng}
        return "number_with_unit", {"unit": unit or "pcs", "range": (1, 500)}
    if input_type in ("date", "textarea", "phone", "email", "gender", "tc_kimlik"):
        return input_type, {}
    if input_type == "number":
        return "number", {}

    # --- Name heuristics (same priority order as detectInputType.js) ---
    if name in ("cinsiyet", "gender", "sex") or "gender" in name:
        return "gender", {}
    if "tc_kimlik" in name or "tc_no" in name or "kimlik_no" in name or "identity" in name:
        return "tc_kimlik", {}
    if (ftype in ("date", "datetime") or "tarih" in name or "date" in name
            or "dogum" in name or "doğum" in name or "birth" in name):
        return "date", {"birth": "dogum" in name or "doğum" in name or "birth" in name}
    if "telefon" in name or "phone" in name or "gsm" in name or "contact" in name or name == "tel":
        return "phone", {}
    if "email" in name or "e_posta" in name or "eposta" in name or "mail" in name:
        return "email", {}
    if any(k in name for k in ("tutar", "fiyat", "ucret", "maas")) or name == "butce":
        return "currency", {"currency": "USD"}
    if any(k in name for k in ("price", "amount", "salary", "toplam", "cost", "fee")):
        return "currency", {"currency": "USD"}
    for frags, default_unit, rng in NUMBER_WITH_UNIT_RULES:
        if any(f in name for f in frags):
            return "number_with_unit", {"unit": default_unit, "range": rng}
    opts = _enum_lookup(name)
    if opts:
        return "enum", {"options": opts}
    if (ftype in ("integer", "number", "decimal", "float")
            or any(k in name for k in ("miktar", "quantity", "sayi", "yas", "age", "stok", "stock", "count", "adet"))):
        return "number", {"decimal": ftype in ("decimal", "float")}
    if (ftype == "text" or any(k in name for k in (
            "not", "aciklama", "açıklama", "description", "tedavi", "plan",
            "klinik", "yorum", "detay", "comment", "instruction", "address", "adres"))):
        # address handled separately below; textarea for the rest
        if "address" in name or "adres" in name:
            return "address", {}
        return "textarea", {}
    return "text", {}


# ---------------------------------------------------------------------------
# Per-record value generation
# ---------------------------------------------------------------------------

class RecordContext:
    """Keeps a consistent person identity within one record (name ↔ email ↔ gender)."""

    def __init__(self):
        self.first = None
        self.last = None
        self.gender = None

    def person(self) -> tuple[str, str]:
        if self.first is None:
            self.gender = random.choice(["Male", "Female"])
            pool = MALE_NAMES if self.gender == "Male" else FEMALE_NAMES
            self.first = random.choice(pool)
            self.last = random.choice(LAST_NAMES)
        return self.first, self.last

    def gender_value(self) -> str:
        self.person()  # ensure the identity exists so name and gender agree
        return self.gender


def _module_flavor(display_name: str) -> str:
    n = (display_name or "").lower()
    if any(h in n for h in COMPANY_MODULE_HINTS):
        return "company"
    if any(h in n for h in PERSON_MODULE_HINTS):
        return "person"
    return "thing"


def generate_value(field: dict, kind: str, extras: dict, ctx: RecordContext, flavor: str):
    """Generates a realistic string value for one field. May return extra companion keys."""
    name = (field.get("name") or "").lower()

    if kind == "enum":
        return random.choice(extras["options"]), {}
    if kind == "gender":
        return ctx.gender_value(), {}
    if kind == "tc_kimlik":
        return "1" + "".join(str(random.randint(0, 9)) for _ in range(10)), {}
    if kind == "date":
        if extras.get("birth"):
            days_ago = random.randint(18 * 365, 70 * 365)
        else:
            days_ago = random.randint(0, 180)  # within the last 6 months
        return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"), {}
    if kind == "phone":
        return ("+1 (555) {}-{:04d}".format(
            random.randint(200, 999), random.randint(0, 9999))), {}
    if kind == "email":
        first, last = ctx.person()
        return f"{first}.{last}".lower().translate(TR_ASCII) + "@example.com", {}
    if kind == "currency":
        amount = random.randint(100, 50000)
        currency = extras.get("currency") or "USD"
        if currency == "TRY" or random.random() > 0.8:  # USD/EUR weighted
            currency = random.choice(["USD", "USD", "EUR"])
        return str(amount), {f"{field['name']}_currency": currency}
    if kind == "number_with_unit":
        lo, hi = extras.get("range", (1, 500))
        return str(random.randint(lo, hi)), {f"{field['name']}_unit": extras.get("unit", "adet")}
    if kind == "number":
        if "yas" in name or "age" in name:
            value = random.randint(18, 75)
        elif any(k in name for k in ("quantity", "miktar", "stok", "stock", "adet", "count")):
            value = random.randint(1, 500)
        else:
            value = random.randint(1, 1000)
        if extras.get("decimal"):
            return f"{value}.{random.randint(0, 99):02d}", {}
        return str(value), {}
    if kind == "textarea":
        n = random.randint(1, 2)
        return " ".join(random.sample(SENTENCES, n)), {}
    if kind == "address":
        return "{} {} {}, {}, {}".format(
            random.randint(1, 999), random.choice(STREETS),
            random.choice(["St", "Ave", "Blvd", "Dr"]),
            random.choice(DISTRICTS), random.choice(CITIES)), {}

    # kind == "text": pick by field-name semantics
    if name in ("first_name", "ad", "isim"):
        return ctx.person()[0], {}
    if name in ("last_name", "soyad", "soyisim", "surname"):
        return ctx.person()[1], {}
    if any(k in name for k in ("hasta", "musteri", "müşteri", "personel", "customer", "patient",
                               "employee", "client", "doctor", "sporcu")) and ("name" in name or "ad" in name):
        first, last = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
        return f"{first} {last}", {}
    if name in ("name", "full_name", "adi", "ad_soyad") or name.endswith("_name"):
        if flavor == "person":
            first, last = ctx.person()
            return f"{first} {last}", {}
        if flavor == "company" or "supplier" in name or "company" in name or "firma" in name:
            return random.choice(COMPANY_NAMES), {}
        return random.choice(PRODUCT_NAMES), {}
    if "city" in name or "sehir" in name or "şehir" in name:
        return random.choice(CITIES), {}
    if "insurance" in name or "sigorta" in name:
        if "number" in name or "no" in name:
            return f"POL-{random.randint(100000, 999999)}", {}
        return random.choice(INSURERS), {}
    if "category" in name or "kategori" in name:
        return random.choice(CATEGORIES), {}
    if name == "sku" or "barcode" in name or "barkod" in name:
        return f"SKU-{random.randint(10000, 99999)}", {}
    if name == "id" or name.endswith("_id") or "_no" in name or "number" in name:
        return str(random.randint(1000, 999999)), {}
    if "unit" in name or "birim" in name:
        return random.choice(["pcs", "box", "pack", "kg", "lt"]), {}
    # generic short text fallback
    return random.choice(SENTENCES), {}


# ---------------------------------------------------------------------------
# created_at distribution: 30 days, weekday-heavy, ~30% in the last 7 days
# ---------------------------------------------------------------------------

def random_created_at(now: datetime) -> datetime:
    day_offsets = list(range(30))
    weights = []
    for d in day_offsets:
        day = now - timedelta(days=d)
        w = 3.0 if day.weekday() < 5 else 1.0  # weekdays busier than weekends
        if d < 7:
            w *= 1.4  # boost the last 7 days to ~30% of all records
        weights.append(w)
    offset = random.choices(day_offsets, weights=weights, k=1)[0]
    day = now - timedelta(days=offset)
    if offset == 0:
        # today: never in the future
        start = day.replace(hour=8, minute=0, second=0, microsecond=0)
        if start >= now:
            start = now - timedelta(hours=1)
        seconds = random.randint(0, max(int((now - start).total_seconds()), 60))
        return start + timedelta(seconds=seconds)
    return day.replace(
        hour=random.randint(8, 18), minute=random.randint(0, 59),
        second=random.randint(0, 59), microsecond=0,
    )


def make_today_timestamp(now: datetime) -> datetime:
    start = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if start >= now:
        start = now - timedelta(hours=1)
    return start + timedelta(seconds=random.randint(0, max(int((now - start).total_seconds()), 60)))


# ---------------------------------------------------------------------------
# Main seed flow
# ---------------------------------------------------------------------------

async def seed(fresh: bool) -> None:
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable is not defined.")
        sys.exit(1)
    if not ADMIN_EMAILS:
        print("ERROR: ADMIN_EMAILS environment variable is not defined.")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL, echo=False)
    now = datetime.now(timezone.utc)
    errors: list[str] = []

    async with engine.connect() as conn:
        # --- 1. Resolve the admin user and tenant ---
        result = await conn.execute(
            text("SELECT user_id, tenant_id, email FROM users WHERE LOWER(email) = ANY(:emails) LIMIT 1"),
            {"emails": ADMIN_EMAILS},
        )
        admin = result.first()
        if not admin:
            print(f"ERROR: no user found for ADMIN_EMAILS={ADMIN_EMAILS}")
            sys.exit(1)
        admin_id, tenant_id, admin_email = admin
        print(f"Admin: {admin_email} (tenant {tenant_id})")

        # --- 2. Load active configurations and enabled modules ---
        result = await conn.execute(
            text("""
                SELECT c.config_id, COALESCE(c.config_name, 'Config #' || c.config_id),
                       m.map_id, m.display_name, m.custom_schema_json
                FROM configuration c
                JOIN config_module_map m ON m.config_id = c.config_id
                WHERE c.tenant_id = :tid AND c.is_active = true AND m.is_enabled = true
                ORDER BY c.config_id, m.map_id
            """),
            {"tid": str(tenant_id)},
        )
        modules = result.fetchall()
        if not modules:
            print("No active modules found — nothing to seed.")
            return

    map_ids = [row[2] for row in modules]

    # --- 3. Fresh mode: remove previous seed records (marker'd only) ---
    if fresh:
        async with engine.begin() as conn:
            result = await conn.execute(
                text("""
                    DELETE FROM dynamic_record
                    WHERE map_id = ANY(:maps) AND data_payload->>'_seed' = 'true'
                """),
                {"maps": map_ids},
            )
            print(f"--fresh: removed {result.rowcount} previous seed record(s). "
                  f"User-entered records untouched.")

    # --- 4. Generate all records in memory ---
    generated = []  # (config_name, display_name, map_id, payload, search_text, created_at)
    plan = []       # per-module summary rows
    for config_id, config_name, map_id, display_name, schema_json in modules:
        try:
            schema = schema_json if isinstance(schema_json, dict) else json.loads(schema_json or "{}")
            fields = schema.get("fields", [])
            if not fields:
                errors.append(f"map_id={map_id} ({display_name}): no fields in schema, skipped")
                continue
            flavor = _module_flavor(display_name)
            text_field_names = [f["name"] for f in fields if f.get("type") in ("string", "text")]
            count = random.randint(*RECORDS_PER_MODULE)
            for _ in range(count):
                ctx = RecordContext()
                payload = {"_seed": True}
                for field in fields:
                    kind, extras = detect_kind(field)
                    value, companions = generate_value(field, kind, extras, ctx, flavor)
                    payload[field["name"]] = value
                    payload.update(companions)
                search_text = " ".join(
                    str(payload[n]) for n in text_field_names if payload.get(n)
                )
                generated.append(
                    [config_name, display_name, map_id, payload, search_text, random_created_at(now)]
                )
            plan.append((config_name, display_name, map_id, count))
        except Exception as exc:  # defensive: one bad module must not stop the rest
            errors.append(f"map_id={map_id} ({display_name}): generation failed — {exc}")

    # --- 5. Guarantee 2-4 records dated today ---
    today = now.date()
    today_records = [g for g in generated if g[5].date() == today]
    target_today = random.randint(TODAY_MIN, TODAY_MAX)
    if len(today_records) < target_today:
        for g in random.sample(
            [g for g in generated if g[5].date() != today],
            min(target_today - len(today_records), len(generated)),
        ):
            g[5] = make_today_timestamp(now)

    # --- 6. Insert per module (own transaction each, defensive) ---
    inserted_per_map: dict[int, int] = {}
    for config_name, display_name, map_id, count in plan:
        rows = [g for g in generated if g[2] == map_id]
        try:
            async with engine.begin() as conn:
                for _, _, _, payload, search_text, created_at in rows:
                    await conn.execute(
                        text("""
                            INSERT INTO dynamic_record
                                (record_id, map_id, created_by, data_payload,
                                 search_vector, is_deleted, created_at, updated_at)
                            VALUES
                                (:rid, :mid, :uid, CAST(:payload AS jsonb),
                                 to_tsvector('simple', :sv), false, :ts, :ts)
                        """),
                        {
                            "rid": str(uuid.uuid4()),
                            "mid": map_id,
                            "uid": str(admin_id),
                            "payload": json.dumps(payload, ensure_ascii=False),
                            "sv": search_text,
                            "ts": created_at,
                        },
                    )
            inserted_per_map[map_id] = len(rows)
        except Exception as exc:
            errors.append(f"map_id={map_id} ({display_name}): insert failed — {exc}")

    await engine.dispose()

    # --- 7. Summary ---
    print("\n=== Seed summary ===")
    total = 0
    current_config = None
    for config_name, display_name, map_id, _ in plan:
        n = inserted_per_map.get(map_id, 0)
        total += n
        if config_name != current_config:
            print(f"\n{config_name}")
            current_config = config_name
        dates = [g[5] for g in generated if g[2] == map_id]
        if dates and n:
            print(f"  {display_name:<24} {n:>3} records  "
                  f"({min(dates).date()} → {max(dates).date()})")
        else:
            print(f"  {display_name:<24}   0 records (insert failed)")
    last7 = sum(1 for g in generated if g[2] in inserted_per_map and (now - g[5]).days < 7)
    today_n = sum(1 for g in generated if g[2] in inserted_per_map and g[5].date() == today)
    print(f"\nTotal inserted: {total}")
    print(f"Last 7 days:    {last7} ({(100 * last7 // max(total, 1))}%)")
    print(f"Today:          {today_n}")
    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed demo records into the admin tenant's modules.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--fresh", action="store_true", default=True,
                       help="Delete previous seed records first, then re-seed (default)")
    group.add_argument("--append", dest="fresh", action="store_false",
                       help="Keep existing seed records, only add new ones")
    args = parser.parse_args()
    asyncio.run(seed(fresh=args.fresh))
