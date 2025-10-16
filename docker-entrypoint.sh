#!/bin/sh
set -e

echo "🔍 Checking database connection..."
echo "Running database migrations..."

npx prisma migrate deploy

echo "✅ Migrations complete. Starting application..."
exec "$@"
