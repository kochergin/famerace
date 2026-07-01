#!/bin/sh
# One-time fetch of Prisma engine binaries with curl (more resilient than the
# built-in downloader behind restrictive proxies). Idempotent.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINES="$ROOT/node_modules/@prisma/engines"
QUERY="$ENGINES/libquery_engine-debian-openssl-3.0.x.so.node"
SCHEMA="$ENGINES/schema-engine-debian-openssl-3.0.x"
[ -f "$QUERY" ] && [ -f "$SCHEMA" ] && { echo "prisma engines: already present"; exit 0; }

VERSION="$(node -e "console.log(require('@prisma/engines-version').enginesVersion)")"
BASE="https://binaries.prisma.sh/all_commits/$VERSION/debian-openssl-3.0.x"
mkdir -p "$ENGINES"

fetch() {
  url="$1"; out="$2"; i=1
  while [ "$i" -le 8 ]; do
    if curl -fSL --retry 3 --retry-all-errors -o "$out.gz" "$url" 2>/dev/null; then
      gunzip -f "$out.gz"; return 0
    fi
    echo "retry $url ($i)"; sleep $((i * 2)); i=$((i + 1))
  done
  echo "failed to download $url" >&2; exit 1
}

fetch "$BASE/libquery_engine.so.node.gz" "$QUERY"
fetch "$BASE/schema-engine.gz" "$SCHEMA"
chmod +x "$SCHEMA"
echo "prisma engines: downloaded for $VERSION"
