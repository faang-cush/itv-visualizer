#!/usr/bin/env bash
#
# One-shot provisioning for the Interview Visualizer site, via the GitHub CLI.
# Idempotent: safe to re-run. Does everything on the GitHub side WITHOUT the UI:
#   - creates the public repo (if missing) and pushes `main`
#   - writes the root CNAME file (the generator ships it into every deploy)
#   - sets Pages "Source" to GitHub Actions
#   - sets the custom domain
#   - enables "Enforce HTTPS" (best-effort; the cert can take a while the first time)
#
# Prereqs (one-time):
#   1. Install the GitHub CLI:  https://cli.github.com
#   2. Authenticate:            gh auth login
#
# Usage:
#   DOMAIN=www.yourname.tech ./scripts/setup.sh
#   DOMAIN=viz.yourname.tech REPO=interview-visualizer ./scripts/setup.sh
#
set -euo pipefail

# ---- config (override via environment) -------------------------------------
REPO="${REPO:-interview-visualizer}"
DOMAIN="${DOMAIN:-}"
VISIBILITY="${VISIBILITY:-public}"   # public is required for free Actions + Pages
BRANCH="main"

# ---- preflight -------------------------------------------------------------
command -v gh >/dev/null 2>&1 || { echo "ERROR: gh (GitHub CLI) is not installed — https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1   || { echo "ERROR: not authenticated. Run: gh auth login"; exit 1; }
[ -n "$DOMAIN" ] || { echo "ERROR: set DOMAIN, e.g.  DOMAIN=www.yourname.tech ./scripts/setup.sh"; exit 1; }

cd "$(dirname "$0")/.."   # repo root
OWNER="$(gh api user --jq .login)"
SLUG="$OWNER/$REPO"
echo "==> Owner: $OWNER   Repo: $SLUG   Domain: $DOMAIN"

# ---- 1. CNAME file (baked into the build by scripts/generate.js) -----------
if [ ! -f CNAME ] || [ "$(tr -d '[:space:]' < CNAME)" != "$DOMAIN" ]; then
  echo "$DOMAIN" > CNAME
  echo "==> Wrote CNAME ($DOMAIN)"
fi

# ---- 2. commit any pending changes -----------------------------------------
git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "Configure custom domain: $DOMAIN"
  echo "==> Committed pending changes"
fi

# ---- 3. create repo (if missing) + push ------------------------------------
if gh repo view "$SLUG" >/dev/null 2>&1; then
  echo "==> Repo exists; ensuring remote + pushing"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$SLUG.git"
  git push -u origin "$BRANCH"
else
  echo "==> Creating $VISIBILITY repo and pushing"
  gh repo create "$SLUG" --"$VISIBILITY" --source=. --remote=origin --push
fi

# ---- 4. Pages: Source = GitHub Actions -------------------------------------
echo "==> Configuring Pages (build_type=workflow)"
if gh api "repos/$SLUG/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$SLUG/pages" -f build_type=workflow >/dev/null
else
  gh api -X POST "repos/$SLUG/pages" -f build_type=workflow >/dev/null
fi

# ---- 5. custom domain ------------------------------------------------------
echo "==> Setting custom domain: $DOMAIN"
gh api -X PUT "repos/$SLUG/pages" -f cname="$DOMAIN" -f build_type=workflow >/dev/null

# ---- 6. enforce HTTPS (best-effort; cert may not be ready yet) --------------
echo "==> Attempting to enable Enforce HTTPS"
if gh api -X PUT "repos/$SLUG/pages" -F https_enforced=true >/dev/null 2>&1; then
  echo "    HTTPS enforced."
else
  echo "    Cert not ready yet — re-run later or enable later with:"
  echo "      gh api -X PUT repos/$SLUG/pages -F https_enforced=true"
fi

cat <<EOF

Done.
  - Actions build:   https://github.com/$SLUG/actions
  - Temp URL:        https://$OWNER.github.io/$REPO/   (until DNS resolves)
  - Final URL:       https://$DOMAIN

Last manual step (DNS, one time, at get.tech):
  Add a CNAME record →  Host: ${DOMAIN%%.*}   Value: $OWNER.github.io
EOF
