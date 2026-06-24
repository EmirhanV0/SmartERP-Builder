#!/bin/bash
set -e

echo "=== SmartERP Builder Backend ==="

# Wait until PostgreSQL is ready (docker-compose healthcheck already waits,
# but we double-check with psycopg2 for extra safety)
echo "Checking PostgreSQL connection..."
until python -c "
import psycopg2, os, sys
url = os.environ.get('SYNC_DATABASE_URL', '').replace('postgresql+psycopg2://', 'postgresql://')
try:
    psycopg2.connect(url)
    print('PostgreSQL ready.')
except Exception as e:
    print(f'Waiting: {e}')
    sys.exit(1)
"; do
    echo "Waiting 5 seconds..."
    sleep 5
done

# Alembic migration
echo "Running Alembic migration..."
alembic upgrade head
echo "Migration complete."

# Seed data
echo "Loading seed data..."
python -m app.seed
echo "Seed complete."

# Start Uvicorn
echo "Starting backend — http://0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
