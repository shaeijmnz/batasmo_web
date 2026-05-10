#!/usr/bin/env bash
# Calls GitHub's /user endpoint with the saved token to verify it actually
# works. Reports the username + token prefix (NOT the full token).

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f .git-credentials ]]; then
  echo "[verify] .git-credentials is missing. Run: bash set-token.sh"
  exit 1
fi

set -a
# shellcheck disable=SC1091
. .git-credentials
set +a

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[verify] GITHUB_TOKEN is empty in .git-credentials. Run: bash set-token.sh"
  exit 1
fi

PREFIX="${GITHUB_TOKEN:0:4}"
LEN=${#GITHUB_TOKEN}
echo "[verify] saved username: ${GITHUB_USERNAME:-(not set)}"
echo "[verify] token prefix:   ${PREFIX}... (length=${LEN})"
echo

case "$PREFIX" in
  ghp_) echo "[verify] token type: classic PAT (good for git push)";;
  gith) echo "[verify] token type: fine-grained PAT (needs explicit Contents:Read+Write per repo)";;
  *)    echo "[verify] token type: unknown — paste might be wrong";;
esac
echo

echo "[verify] calling https://api.github.com/user ..."
RESPONSE=$(curl -sS -o /tmp/_gh_user.json -w "%{http_code}" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "User-Agent: batasmo-mac" \
  https://api.github.com/user || true)

echo "[verify] HTTP ${RESPONSE}"
if [[ "$RESPONSE" == "200" ]]; then
  LOGIN=$(grep -o '"login"[[:space:]]*:[[:space:]]*"[^"]*"' /tmp/_gh_user.json | head -n1 | sed -E 's/.*"login"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
  echo "[verify] token belongs to GitHub user: ${LOGIN}"
  echo
  if [[ -n "${GITHUB_USERNAME:-}" && "${GITHUB_USERNAME}" != "${LOGIN}" ]]; then
    echo "[verify] WARNING: token user (${LOGIN}) != saved username (${GITHUB_USERNAME})."
    echo "[verify] Run: bash set-token.sh, paste the same token again, no problem."
  else
    echo "[verify] OK — token is valid. You can run: bash quick-push.sh \"message\""
  fi
else
  echo "[verify] body:"
  cat /tmp/_gh_user.json
  echo
  echo
  echo "[verify] Token did NOT authenticate. Generate a new classic token at"
  echo "         https://github.com/settings/tokens/new"
  echo "         Tick the 'repo' scope, click Generate, copy the WHOLE 'ghp_...' value,"
  echo "         then run: bash set-token.sh"
fi

rm -f /tmp/_gh_user.json
