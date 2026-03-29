#!/bin/zsh
# Thread backend startup — pulls secrets from Keychain

export GOOGLE_CLIENT_ID=$(security find-generic-password -s "OpenClaw" -a "GOOGLE_CLIENT_ID" -w)
export GOOGLE_CLIENT_SECRET=$(security find-generic-password -s "OpenClaw" -a "GOOGLE_CLIENT_SECRET" -w)
export OPENAI_API_KEY=$(security find-generic-password -s "OpenClaw" -a "OPENAI_API_KEY" -w)

# Run on 7777 locally. Tailscale exposes this as:
#   https://2004s-mac-mini.tail0be3ed.ts.net:3001
# (tailscale serve --https=3001 7777)
# IMPORTANT: register this redirect URI in Google Cloud Console:
#   https://2004s-mac-mini.tail0be3ed.ts.net:3001/auth/google/callback
export PORT="${PORT:-7777}"
export GOOGLE_REDIRECT_URI="${GOOGLE_REDIRECT_URI:-https://2004s-mac-mini.tail0be3ed.ts.net:3001/auth/google/callback}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://2004s-mac-mini.tail0be3ed.ts.net:10000}"

echo "Starting Thread backend on port $PORT (Tailscale: :3001)..."
/opt/homebrew/bin/node server.js
