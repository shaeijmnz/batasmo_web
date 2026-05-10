#!/usr/bin/env bash
# Updates .git-credentials with a new GitHub Personal Access Token.
# The token is read interactively (no echo) so it never lives in your
# shell history. Run from the project root: bash set-token.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

CRED_FILE="$PROJECT_DIR/.git-credentials"

echo
echo "Paste your GitHub Personal Access Token (input is hidden), then press Enter:"
read -r -s GITHUB_TOKEN
echo

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[set-token] No token entered. Aborting." >&2
  exit 1
fi

GITHUB_USERNAME="shaeijmnz"
GIT_AUTHOR_NAME="shaeijmnz"
GIT_AUTHOR_EMAIL="shaeijmnz@users.noreply.github.com"

cat > "$CRED_FILE" <<EOF
GITHUB_TOKEN=${GITHUB_TOKEN}
GITHUB_USERNAME=${GITHUB_USERNAME}
GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME}
GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL}
EOF

chmod 600 "$CRED_FILE"

echo "[set-token] saved $CRED_FILE (permissions 600)"
echo "[set-token] you can now run: bash quick-push.sh \"your commit message\""
