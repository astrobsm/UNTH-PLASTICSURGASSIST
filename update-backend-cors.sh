#!/bin/bash
# Update Digital Ocean backend to allow Vercel frontend

echo "🚀 Updating backend CORS configuration for Vercel..."

# SSH into Digital Ocean server
ssh root@164.90.225.181 << 'ENDSSH'
  cd /root/plasticsurg-backend
  
  # Backup current .env
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  
  # Add Vercel URL to environment variables
  if ! grep -q "FRONTEND_URL" .env; then
    echo "" >> .env
    echo "# Frontend URLs" >> .env
    echo "FRONTEND_URL=https://plasticsurgassisstant.vercel.app" >> .env
  else
    sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=https://plasticsurgassisstant.vercel.app|' .env
  fi
  
  if ! grep -q "PRODUCTION_URL" .env; then
    echo "PRODUCTION_URL=https://plasticsurgassisstant.vercel.app" >> .env
  else
    sed -i 's|PRODUCTION_URL=.*|PRODUCTION_URL=https://plasticsurgassisstant.vercel.app|' .env
  fi
  
  echo "✅ Environment variables updated"
  
  # Restart PM2 service
  pm2 restart plasticsurg-backend
  
  echo "✅ Backend restarted with new CORS configuration"
  
  # Show PM2 status
  pm2 status
  
  # Show last few log lines
  echo ""
  echo "📋 Recent logs:"
  pm2 logs plasticsurg-backend --lines 10 --nostream
ENDSSH

echo ""
echo "✅ Backend updated successfully!"
echo "🔗 Vercel frontend: https://plasticsurgassisstant.vercel.app"
echo "🔗 Backend API: http://164.90.225.181:3001/api"
echo ""
echo "⚠️  IMPORTANT: Configure HTTPS for production (see VERCEL_BACKEND_FIX.md)"
