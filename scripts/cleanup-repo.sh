#!/usr/bin/env sh
# One-time repo cleanup (v11.77). Run from the repo root, review `git status`, commit.
#   sh scripts/cleanup-repo.sh
set -e
# 1. duplicate middleware: Next reads the root proxy.ts, app/proxy.ts is ignored
git rm --quiet --ignore-unmatch app/proxy.ts || true
# 2. empty leftover folders from an earlier shell mishap (untracked, so plain rm)
rm -rf '{components' 'app/{login,dashboard,accounts,account,integrations,settings,ask,auth' 2>/dev/null || true
rmdir app/account app/accounts app/settings app/integrations 2>/dev/null || true
# kept on purpose: app/dashboard (redirect to /pulse for old links), app/login, app/auth (real routes)
echo "done. review: git status"
