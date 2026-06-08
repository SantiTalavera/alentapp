#!/bin/sh
set -e

echo "Iniciando servidor..."
exec node dist/app.js
