#!/bin/bash
# Sanitized deployment helper script
# NOTE: This script intentionally does NOT contain secrets. Create a .env file on the server with required secrets before running.

set -euo pipefail

echo "Step 1: Ensure .env exists on the server and contains DATABASE_URL, JWT_SECRET, and PORT"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Please create a .env file containing:"
  echo "  DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
  echo "  JWT_SECRET=your_secret_key_here"
  echo "  PORT=3001"
  exit 1
fi

echo "Installing dependencies..."
npm install --production

# Example PM2 restart (commented out - adjust on server)
# pm2 stop plasticsurg-backend || true
# pm2 start server/index-postgres.js --name plasticsurg-backend

echo "Deployment helper completed. Configure PM2/Nginx on the droplet as appropriate."
