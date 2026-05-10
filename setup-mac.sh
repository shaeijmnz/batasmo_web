#!/usr/bin/env bash
# BatasMo macOS first-time setup helper.
# Run this in the Mac's built-in Terminal app (not inside the Cursor terminal),
# from the project folder:
#   cd ~/Documents/batasmo_web
#   bash setup-mac.sh
#
# This is idempotent: safe to re-run.

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

log()  { printf "\033[1;36m[setup]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m  %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m    %s\n" "$*"; }

# 1) Xcode Command Line Tools (gives `git`, `make`, etc.)
if ! xcode-select -p >/dev/null 2>&1; then
  log "Installing Xcode Command Line Tools (a GUI dialog will appear; click Install and wait)..."
  xcode-select --install || true
  echo
  echo ">> Wait until the Xcode Command Line Tools install finishes, then re-run this script."
  exit 0
else
  ok "Xcode Command Line Tools already installed."
fi

# 2) Homebrew (package manager). Used to install Node cleanly.
if ! command -v brew >/dev/null 2>&1; then
  log "Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for current shell + future shells.
  if [[ -d /opt/homebrew/bin ]]; then
    BREW_PREFIX="/opt/homebrew"
  else
    BREW_PREFIX="/usr/local"
  fi
  eval "$(${BREW_PREFIX}/bin/brew shellenv)"
  if ! grep -q 'brew shellenv' "$HOME/.zprofile" 2>/dev/null; then
    echo "eval \"\$(${BREW_PREFIX}/bin/brew shellenv)\"" >> "$HOME/.zprofile"
  fi
else
  ok "Homebrew already installed."
fi

# 3) Node.js 20 (Create React App + the backend both work fine on Node 20).
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  log "Installing Node.js (LTS) via Homebrew..."
  brew install node
else
  ok "Node $(node --version) and npm $(npm --version) detected."
fi

# 4) Install project dependencies.
log "Installing root npm dependencies..."
npm install

log "Installing backend npm dependencies..."
( cd backend && npm install )

# 5) Make sure .env files exist (won't overwrite if you already filled them in).
if [[ ! -f .env ]]; then
  cp .env.example .env
  ok "Created .env from .env.example"
fi
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  ok "Created backend/.env from backend/.env.example"
fi

# 6) Initialize git and link to the existing GitHub repo (so Vercel keeps tracking).
if [[ ! -d .git ]]; then
  log "Initializing git repository..."
  git init
  git branch -M main
  git remote add origin https://github.com/shaeijmnz/batasmo_web.git
  log "Fetching from origin/main and snapping local files to match remote history..."
  git fetch origin
  # Keep your local files exactly as they are, but adopt the remote's commit history.
  git reset --soft origin/main
  ok "Git initialized. Run 'git status' to see your changes."
else
  ok ".git already present."
fi

echo
ok "Setup complete!"
echo
echo "Next:"
echo "  1) Open .env and backend/.env, paste your real keys (Gemini, Supabase, PayMongo, VideoSDK, etc.)."
echo "  2) Start the app:    npm run start:all"
echo "     - Frontend: http://localhost:3000"
echo "     - Backend:  http://localhost:4000/health"
echo "  3) When ready to push to GitHub (and trigger Vercel):"
echo "     git add ."
echo "     git commit -m \"your message\""
echo "     git push origin main"
