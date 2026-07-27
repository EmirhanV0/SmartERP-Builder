# SmartERP Builder
AI-powered ERP system generator. Users describe their business in natural language; Google Gemini analyzes the description and generates a custom ERP schema (modules + fields). After user approval, the system dynamically provisions database tables and provides a ready-to-use multi-tenant ERP with full CRUD, an admin panel, and a self-healing diagnostics layer.

## Architecture
- **Backend:** FastAPI + PostgreSQL (SQLAlchemy async + asyncpg), Alembic migrations, JWT auth
- **Frontend:** React 18 + Vite + TailwindCSS, Recharts
- **AI:** Google Gemini 2.5 Flash
- **Self-Healing layer:** SelfHealingEngine + AutomatedRecoveryManager + DiagnosticLogger
- **Containerization:** Docker + docker-compose

## Prerequisites
- Docker Desktop (includes Docker Compose)
- A Google Gemini API key — free tier at https://aistudio.google.com/apikey

## Setup

1. **Create your environment file**
   Copy `.env.example` to `.env`:

   ```
   copy .env.example .env        # Windows
   cp .env.example .env          # macOS/Linux
   ```

2. **Edit `.env` and set:**
   - `GEMINI_API_KEY` — your Google Gemini API key (from https://aistudio.google.com)
   - `ADMIN_EMAILS` — the email you will register as admin (e.g. your-email@example.com)
   - `SECRET_KEY` — a random secret, generate with:

     ```
     python -c "import secrets; print(secrets.token_hex(32))"
     ```
   - You may keep the default PostgreSQL credentials for local use.

3. **Build and start**

   ```
   docker-compose up --build
   ```

   Database migrations run automatically on backend startup.

4. **Access**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API docs (Swagger): http://localhost:8000/docs

## First Use

1. Open http://localhost:3000 and click **Register**
2. Register using the email you set in `ADMIN_EMAILS` — this account gets admin access. Any other email registers as a regular user.
3. Log in and describe your business in natural language to generate your first ERP.

## Optional: Seed Demo Data

Populate the system with realistic sample records:

```
docker-compose exec backend python scripts/seed_demo_records.py --fresh
```

Generate sample diagnostic incidents (visible in the admin Diagnostics panel):

```
docker-compose exec backend python scripts/gen_incidents.py
```

## Notes
- Gemini free tier allows 20 requests/day. Enable billing on your Google AI Studio project for heavier use.
- No API key? Set `GEMINI_MOCK=true` in `.env` to run with mock AI responses.

## Project Structure

```
backend/    FastAPI application (controllers, services, models, migrations)
frontend/   React application (pages, components, design system)
docker-compose.yml
.env.example
```

---
Graduation project — Halic University, Computer Engineering.
