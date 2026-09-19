#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
fi
case "${1:-}" in
  --prepared) docker compose up --no-build --pull never --wait ;;
  '') docker compose up --build --wait ;;
  *) echo 'Использование: bash scripts/demo.sh [--prepared]' >&2; exit 2 ;;
esac
echo 'Откройте http://127.0.0.1:8000 — преподаватель и ученик в разных вкладках.'
echo 'Без ключа проверка по эталонам. Для живого AI заполните OPENROUTER_API_KEY в .env.'
