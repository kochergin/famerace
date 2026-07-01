#!/bin/sh
# Prisma wrapper: pins the CLI to locally cached engine binaries so commands
# never re-download engines (flaky through restricted networks). The binaries
# are fetched once by scripts/fetch-prisma-engines.sh (or npm postinstall).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINES="$ROOT/node_modules/@prisma/engines"
export PRISMA_QUERY_ENGINE_LIBRARY="${PRISMA_QUERY_ENGINE_LIBRARY:-$ENGINES/libquery_engine-debian-openssl-3.0.x.so.node}"
export PRISMA_SCHEMA_ENGINE_BINARY="${PRISMA_SCHEMA_ENGINE_BINARY:-$ENGINES/schema-engine-debian-openssl-3.0.x}"
exec "$ROOT/node_modules/.bin/prisma" "$@"
