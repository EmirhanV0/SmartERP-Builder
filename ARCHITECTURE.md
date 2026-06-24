# SmartERP Builder — Architecture & Technical Documentation

## Overview
SmartERP Builder is an AI-powered, self-configuring ERP platform for small and medium-sized enterprises. Instead of manually selecting and wiring up modules, a user describes their business processes in natural language and selects a sector. The system sanitizes the input, sends it to a large language model (Google Gemini), and receives a structured proposal of entities, fields, relationships, and modules together with a confidence score. After the user reviews and approves the proposal, the platform dynamically provisions the corresponding database tables at runtime and exposes a ready-to-use, multi-tenant ERP with full CRUD, dashboards, an administrative panel, and a self-healing diagnostics layer.

## Technology Stack
- **Backend:** FastAPI (Python 3.11+), fully asynchronous (`async def`)
- **Database:** PostgreSQL 15+ with JSONB support
- **Persistence:** SQLAlchemy ORM (static tables) + raw SQL (runtime dynamic tables) + Alembic (migrations)
- **Authentication:** python-jose (JWT) + passlib/bcrypt
- **AI:** Google Gemini API (`gemini-2.5-flash`, configured via environment) using the `google-generativeai` SDK
- **Frontend:** React 18+ + Vite + TailwindCSS + Recharts
- **Validation:** Pydantic
- **Containerization:** Docker + Docker Compose

## System Architecture (4 Layers)
1. **Presentation Layer** — React + TailwindCSS (Login, Register, Describe, Preview, Dashboard, Admin, Profile)
2. **Controller Layer** — FastAPI routers (Auth, User, Configurations, Schema, Prompt, DynamicData, Admin)
3. **Service Layer** — NLPProcessor, SchemaGenerator, SelfHealingEngine, AutomatedRecoveryManager, DiagnosticLogger, BenchmarkEngine, APIGenerator, AuthService
4. **Persistence Layer** — PostgreSQL (8 static tables + runtime dynamic tables)

## Database Schema (8 Entities)
The platform uses 8 static tables managed through SQLAlchemy and Alembic. Tenant isolation is enforced through `tenant_id` foreign keys.

1. **TENANT_PROFILE** — `tenant_id` (UUID PK), `company_name`, `sector_code`, `subscription_plan`, `created_at`
2. **USER** — `user_id` (UUID PK), `tenant_id` (FK), `email` (UNIQUE), `full_name`, `role`, `created_at`
3. **AVAILABLE_MODULE** — `module_id` (INT PK), `module_name`, `base_schema_json` (JSONB), `is_system_default`
4. **CONFIGURATION** — `config_id` (BIGINT PK), `tenant_id` (FK), `config_name` (VARCHAR), `status`, `ai_confidence_score`, `is_active`, `created_at`
5. **CONFIG_MODULE_MAP** — `map_id` (BIGINT PK), `config_id` (FK), `module_id` (FK), `custom_schema_json` (JSONB), `display_name`, `is_enabled`
6. **DYNAMIC_RECORD** — `record_id` (UUID PK), `map_id` (FK), `created_by` (FK), `data_payload` (JSONB), `search_vector` (TSVECTOR), `is_deleted` (BOOL DEFAULT false), `created_at`, `updated_at`
7. **AI_ANALYSIS_LOG** — `log_id` (BIGINT PK), `config_id` (FK), `raw_input`, `sanitized_input`, `ambiguity_flag`, `timestamp`
8. **DIAGNOSTIC_LOG** — `diag_id` (BIGINT PK), `config_id` (FK, nullable), `failure_stage`, `error_signature` (TEXT), `recovery_action`, `recovery_status`, `occurred_at`

### Relationships
- A **tenant** owns many **users** and many **configurations**.
- A **configuration** maps to many **modules** through **CONFIG_MODULE_MAP**, each carrying a custom JSONB schema.
- Each map entry owns many **dynamic records**, whose actual business data lives in the `data_payload` JSONB column.
- **AI_ANALYSIS_LOG** and **DIAGNOSTIC_LOG** reference a configuration for auditing and recovery tracing.

### Database Conventions
- Static tables are defined as SQLAlchemy ORM models and versioned with Alembic migrations.
- Dynamic tables are created at runtime via raw SQL (`CREATE TABLE`), isolated per tenant.
- JSONB columns are indexed with GIN indexes; full-text search uses TSVECTOR columns.
- All DDL operations run inside atomic transactions (`BEGIN`/`COMMIT`/`ROLLBACK`).
- Records use soft deletion via `DYNAMIC_RECORD.is_deleted` — no physical deletes.

### Migrations
| #    | File            | Date       | Change                                                        |
|------|-----------------|------------|---------------------------------------------------------------|
| 0001 | initial_tables  | 2026-04-11 | 7 static tables + GIN/TSVECTOR indexes + seed data (10 modules)|
| 0002 | soft_delete     | 2026-05-03 | `dynamic_record.is_deleted` BOOL column                       |
| 0003 | config_name     | 2026-05-13 | `configuration.config_name` VARCHAR column                    |
| 0004 | diagnostic_log  | 2026-05-23 | `diagnostic_log` table (self-healing records)                 |

## Backend Architecture

### Services
- **NLPProcessor** — sanitizes user input (XSS and SQL-injection protection) before it reaches the AI model.
- **SchemaGenerator** — converts an approved JSON blueprint into DDL (`CREATE TABLE`, `CREATE INDEX`) and applies it.
- **SelfHealingEngine / AutomatedRecoveryManager / DiagnosticLogger** — the resilience layer (see below).
- **BenchmarkEngine** — performance measurement utilities.
- **APIGenerator** — dynamic CRUD endpoint logic for provisioned modules.
- **AuthService** — registration, login, password hashing/verification, and JWT issuance.

### Controllers
`auth_controller`, `user_controller`, `configurations_controller`, `schema_controller`, `prompt_controller`, `dynamic_data_controller`, `admin_controller`. Every endpoint validates its payload with a Pydantic schema and raises `HTTPException` with meaningful error messages. Logging uses Python's standard `logging` module.

### Middleware
- **auth** — decodes the `Authorization: Bearer <token>` header and resolves the current user.
- **cors** — permissive in development (to be restricted in production).
- **request_timing** — `BaseHTTPMiddleware` keeping a `deque(maxlen=1000)` over a 5-minute sliding window. It computes a pure-Python nearest-rank p95 latency (`get_p95()`) and a rolling request count (`get_request_count_5m()`). Application startup time is stored on `app.state.startup_time`.

### Authentication & Authorization
1. `POST /auth/register` — email + password + full_name → bcrypt hash → stored in USER.
2. `POST /auth/login` — verifies credentials → issues a JWT (python-jose).
3. Protected endpoints decode the bearer token to resolve the user.
4. Role assignment: users whose email is in the `ADMIN_EMAILS` list receive the `admin` role; all others are `user`.
5. `PATCH /users/me` updates the display name; `POST /users/me/change-password` verifies and re-hashes the password.

## Self-Healing Layer
The platform treats schema provisioning failures as recoverable events rather than fatal errors.

- **SelfHealingEngine** — the coordinator. `report_failure(stage, error, config_id)` classifies and logs a failure and **never raises an exception**, so the main request flow is never broken by the recovery path itself.
- **AutomatedRecoveryManager** — a pure-Python classifier that inspects a failure in priority order: SQLSTATE code → HTTP status code → JSON parse error → stage fallback. It selects a recovery action from: `auto_fix_identifier`, `retry_fallback_prompt`, `rollback`, or `manual_escalation`.
- **DiagnosticLogger** — performs a defensive asynchronous `INSERT` into `DIAGNOSTIC_LOG`. If the database write itself fails, the error is swallowed with a `logger.warning` so the main flow continues uninterrupted.

During dynamic schema application, DDL runs inside a transaction. On success it commits; on failure the SelfHealingEngine classifies the error, the DiagnosticLogger records it, and the transaction rolls back.

## AI Pipeline
1. The user enters a natural-language business description and selects a sector on the Describe page.
2. **NLPProcessor** sanitizes the text.
3. The sanitized text and `sector_code` are sent to the Gemini API (model read from `settings.gemini_model`).
4. Gemini returns structured JSON: `entities`, `fields`, `relationships`, `modules`, `confidence_score`, and `ambiguity_questions`.
5. **Clarification loop** — if `confidence_score < 0.85`, the ambiguity questions are presented to the user and a second Gemini call is made with the additional answers.
6. If `confidence_score >= 0.85`, a `SchemaProposal` is built and shown on the Preview page.
7. The user approves the proposal or toggles modules/entities (manual override).
8. **Dynamic provisioning** — `POST /configurations/{id}/approve` hands the approved blueprint to SchemaGenerator, which generates and applies the DDL transactionally. Business data is then stored as JSONB in `DYNAMIC_RECORD.data_payload`.

### Manual Module Addition
- `POST /configurations/{config_id}/modules/manual`
- Frontend field types are mapped to DDL types via an internal type map.
- It reuses the same `SchemaGenerator.apply_schemas()` + SelfHealingEngine path.
- Slug collisions return HTTP 409 (case-insensitive slug comparison).

## Frontend Structure

### Pages (routes)
- `/login` — sign in
- `/register` — sign up (TenantProfile + User created in a single step)
- `/setup/describe` — natural-language business description form + sector selection
- `/setup/preview` — AI analysis preview with approve/edit controls
- `/dashboard` — ERP dashboard (module list, record tables, multi-configuration selector, sparklines)
- `/admin` — administrative panel (admin role only, protected by a RequireAdmin guard)
- `/profile` — user profile (Account / Password / My ERPs / Statistics)

### Design System
A token-driven design system (`tokens.js`) backs reusable components (`GlassRoot`, `TopBar`, `Btn`, `Field`, and others), along with shared `Icon`, `Skeleton`, and `EmptyState` primitives. Smart input components (SmartInput, PhoneInput, EnumDropdown, CurrencyInput, GenderSelector, and standard text/date/email inputs) adapt the form UI to the detected field type. State is managed through React contexts (Auth, Theme, CommandPalette).

### Command Palette
Opened with `Ctrl+K` / `⌘K` via a global listener in the top bar. Its contents are scope-aware:
- **user** scope (Dashboard): MODULES / RECORDS / FIELDS / ACTIONS categories
- **admin** scope (Admin page): all admin sections + actions
- **profile** scope (Profile page): section navigation + actions

## API Endpoints

### Authentication & Users
- `POST /auth/register`
- `POST /auth/login`
- `PATCH /users/me`
- `POST /users/me/change-password`

### Configurations & Schema
- `POST /configurations/{id}/approve` — approve a proposal and provision dynamic tables
- `POST /configurations/{config_id}/modules/manual` — manually add a module
- Configuration and schema management endpoints for listing, creating, and toggling ERP configurations

### Dynamic Data
- Runtime CRUD endpoints for records stored in `DYNAMIC_RECORD` (per module/configuration), with soft deletion

### Admin (protected by `require_admin`)
- `GET /admin/health` — real-time uptime, p95 latency, database pool status, and memory usage (psutil)
- `GET /admin/analytics/sector-distribution` — sector distribution (donut chart)
- `GET /admin/analytics/top-tenants` — tenant leaderboard
- `GET /admin/analytics/confidence-distribution` — AI confidence histogram
- `GET /admin/diagnostics` — self-healing records from the last 7 days (global)
- `PATCH /admin/diagnostics/{id}/resolve` — mark a diagnostic record as manually resolved

## Seed Data (10 Modules)
Loaded into `AVAILABLE_MODULE` by migration 0001 and later additions:
`inventory`, `billing`, `hr`, `sales`, `production`, `purchasing`, `crm`, `accounting`, `warehouse`, `project`.

## Running the Project
```bash
# Build and start all services
docker-compose up --build

# Backend API docs:  http://localhost:8000/docs
# Frontend:          http://localhost:3000
# PostgreSQL:        localhost:5432

# Run migrations manually (also run automatically on backend startup)
docker-compose exec backend alembic upgrade head

# Seed diagnostic sample data
docker-compose exec backend python -m scripts.seed_diagnostics
```

---
Graduation project — Halic University, Computer Engineering.
