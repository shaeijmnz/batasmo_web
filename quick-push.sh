#!/usr/bin/env bash
# Quick stage-all + commit + push helper that works WITHOUT a system `git`
# binary. Useful while you have not finished installing Xcode Command Line
# Tools yet. Once Xcode CLT (or Homebrew git) is installed, you can switch
# to the normal `git add`/`git commit`/`git push` workflow.
#
# Usage:
#   bash quick-push.sh "your commit message"
#
# First-time setup:
#   1) Create a Personal Access Token (classic) with `repo` scope at:
#        https://github.com/settings/tokens
#   2) Copy `.git-credentials.example` to `.git-credentials` and fill in:
#        GITHUB_TOKEN, GITHUB_USERNAME, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL
#      (`.git-credentials` is gitignored — it never reaches GitHub.)

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ -f "$PROJECT_DIR/.git-credentials" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.git-credentials"
  set +a
fi

if [[ -z "${1:-}" ]]; then
  echo "Usage: bash quick-push.sh \"your commit message\""
  exit 1
fi

MESSAGE="$*"

# Prefer the portable Node we bootstrapped, fall back to the system one.
if [[ -x "$PROJECT_DIR/.tools/node-v20.18.1-darwin-arm64/bin/node" ]]; then
  NODE_BIN="$PROJECT_DIR/.tools/node-v20.18.1-darwin-arm64/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "[quick-push] could not find node. Run setup-mac.sh first." >&2
  exit 1
fi

exec "$NODE_BIN" "$PROJECT_DIR/.tools/iso/push.cjs" "$MESSAGE"
