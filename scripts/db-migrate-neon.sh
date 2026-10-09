#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${DIRECT_DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$DIRECT_DATABASE_URL"
elif [[ -n "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$(node scripts/neon-direct-url.mjs)"
else
  echo "Set DIRECT_DATABASE_URL (Neon direct, no -pooler) or DATABASE_URL (pooled OK — we convert)."
  exit 1
fi

echo "Running prisma migrate deploy against ${DATABASE_URL/@*/@***} ..."
npx prisma migrate deploy

echo "Done. Optional: ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed"
