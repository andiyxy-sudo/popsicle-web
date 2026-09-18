#!/usr/bin/env sh
# Local pre-push check, identical to Vercel's type step. Run: sh scripts/typecheck.sh
set -e
npx tsc --noEmit && echo "typecheck: clean"
