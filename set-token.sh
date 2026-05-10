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
read -r -s RAW_TOKEN
echo

# Strip any whitespace, control chars, or stray pasted characters.
SANITIZED=$(printf '%s' "$RAW_TOKEN" | tr -d '[:space:]')

# Trim anything before the recognized GitHub token prefixes. This handles a
# common copy-paste glitch where one extra letter sneaks in front.
if [[ "$SANITIZED" == *ghp_* ]]; then
  GITHUB_TOKEN="ghp_${SANITIZED#*ghp_}"
elif [[ "$SANITIZED" == *github_pat_* ]]; then
  GITHUB_TOKEN="github_pat_${SANITIZED#*github_pat_}"
else
  GITHUB_TOKEN="$SANITIZED"
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[set-token] No token entered. Aborting." >&2
  exit 1
fi

LEN=${#GITHUB_TOKEN}
PREFIX="${GITHUB_TOKEN:0:4}"

case "$PREFIX" in
  ghp_)
    echo "[set-token] looks like a classic PAT (length=${LEN}). Saving."
    ;;
  gith)
    echo "[set-token] looks like a fine-grained PAT (length=${LEN}). Saving."
    ;;
  *)
    echo "[set-token] WARNING: token does not start with 'ghp_' or 'github_pat_'."
    echo "[set-token] prefix=${PREFIX} length=${LEN}"
    echo "[set-token] aborting; please re-run and paste only the token value."
    exit 1
    ;;
esac

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
echo "[set-token] verifying token with GitHub ..."
echo

bash "$PROJECT_DIR/verify-token.sh"
