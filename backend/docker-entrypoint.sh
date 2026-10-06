#!/bin/sh
set -e

python manage.py migrate --noinput

if [ "$SEED_DEMO" = "true" ]; then
  python manage.py seed_demo
fi

exec "$@"
