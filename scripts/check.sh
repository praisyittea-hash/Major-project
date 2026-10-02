#!/usr/bin/env bash
set -euo pipefail
npm test
npm run lint
npm run build
git diff --check
git status --short
if git ls-files --cached | rg "(^|/)\.env$|(^|/)\.env\.(local|production|development)$"; then echo "Secret environment file is tracked"; exit 1; fi
git diff --stat
