#!/bin/sh
set -e

echo "Ejecutando migraciones de Prisma..."
node node_modules/.bin/prisma migrate deploy --config prisma.config.ts

echo "Iniciando servidor..."
exec node dist/app.js
