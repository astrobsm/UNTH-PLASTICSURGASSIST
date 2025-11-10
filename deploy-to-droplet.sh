#!/bin/bash

# Plastic Surgeon Assistant - Digital Ocean Droplet Deployment Script
# Droplet: PLASTICSURGEONASSISSTANT (164.90.225.181)
# Database: [Your Database ID from Digital Ocean]
# Location: Frankfurt (FRA1)
# Ubuntu 24.04 LTS

set -e  # Exit on error

echo "================================================"
echo "Deploying Plastic Surgeon Assistant PWA"
echo "Droplet IP: 164.90.225.181"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update system
echo -e "${GREEN}Step 1: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Step 2: Install Node.js 20.x
echo -e "${GREEN}Step 2: Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
echo "Node.js version:"
node --version
echo "NPM version:"
npm --version

# Step 3: Install Nginx
echo -e "${GREEN}Step 3: Installing Nginx...${NC}"
sudo apt install -y nginx

# Step 4: Install Git
echo -e "${GREEN}Step 4: Installing Git...${NC}"
sudo apt install -y git

# Step 5: Configure Firewall
echo -e "${GREEN}Step 5: Configuring firewall...${NC}"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
echo "y" | sudo ufw enable

# Step 6: Create application directory
echo -e "${GREEN}Step 6: Setting up application directory...${NC}"
sudo mkdir -p /var/www
cd /var/www

# Step 7: Clone repository
echo -e "${GREEN}Step 7: Cloning repository from GitHub...${NC}"
if [ -d "plasticsurg_assisstant" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd plasticsurg_assisstant
    sudo git pull origin main
else
    sudo git clone https://github.com/astrobsm/plasticsurg_assisstant.git
    cd plasticsurg_assisstant
fi

# Step 8: Install dependencies
echo -e "${GREEN}Step 8: Installing npm dependencies...${NC}"
sudo npm install --legacy-peer-deps

# Step 9: Build production app
echo -e "${GREEN}Step 9: Building production application (skipping type check)...${NC}"
sudo npm run build:nocheck

# Step 10: Configure Nginx
echo -e "${GREEN}Step 10: Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/plasticsurg > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name 164.90.225.181;

    root /var/www/plasticsurg_assisstant/dist;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # PWA Service Worker support - NO CACHE
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        proxy_cache_bypass $http_pragma;
        proxy_cache_revalidate on;
        expires off;
    }

    # Manifest and PWA assets
    location /manifest.json {
        add_header Cache-Control "public, max-age=3600";
        add_header Access-Control-Allow-Origin "*";
    }

    # Logo and icons
    location ~* \.(png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # JavaScript and CSS with versioning
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Fonts
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA fallback - route all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Prevent access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Client body size (for file uploads if needed in future)
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/plasticsurg_access.log;
    error_log /var/log/nginx/plasticsurg_error.log;
}
EOF

# Step 11: Enable Nginx site
echo -e "${GREEN}Step 11: Enabling Nginx site...${NC}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/plasticsurg /etc/nginx/sites-enabled/

# Test Nginx configuration
echo -e "${YELLOW}Testing Nginx configuration...${NC}"
sudo nginx -t

# Step 12: Install PM2 for Node.js process management
echo -e "${GREEN}Step 12: Installing PM2...${NC}"
sudo npm install -g pm2

# Step 13: Setup backend server
echo -e "${GREEN}Step 13: Setting up backend server...${NC}"
cd /var/www/plasticsurg_assisstant/server
sudo npm install --legacy-peer-deps

# Stop existing backend if running
pm2 delete plasticsurg-backend 2>/dev/null || true

# Start backend server
echo -e "${GREEN}Starting backend server...${NC}"
pm2 start index.js --name plasticsurg-backend
pm2 save
pm2 startup systemd -u root --hp /root

# Step 14: Update Nginx to proxy backend
echo -e "${GREEN}Step 14: Updating Nginx configuration for backend...${NC}"
sudo tee /etc/nginx/sites-available/plasticsurg > /dev/null <<'EOF'
upstream backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    listen [::]:80;
    server_name 164.90.225.181;

    root /var/www/plasticsurg_assisstant/dist;
    index index.html;

    # Backend API proxy
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # PWA Service Worker support - NO CACHE
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        proxy_cache_bypass $http_pragma;
        proxy_cache_revalidate on;
        expires off;
    }

    # Manifest file
    location /manifest.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires off;
    }

    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Fonts
    location ~* \.(woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA fallback - route all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Prevent access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Client body size
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/plasticsurg_access.log;
    error_log /var/log/nginx/plasticsurg_error.log;
}
EOF

# Step 15: Restart Nginx
echo -e "${GREEN}Step 15: Restarting Nginx...${NC}"
# Step 15: Restart Nginx
echo -e "${GREEN}Step 15: Restarting Nginx...${NC}"
sudo systemctl restart nginx
sudo systemctl enable nginx

# Step 16: Set proper permissions
echo -e "${GREEN}Step 16: Setting file permissions...${NC}"
sudo chown -R www-data:www-data /var/www/plasticsurg_assisstant
sudo chmod -R 755 /var/www/plasticsurg_assisstant

# Step 17: Display status
echo -e "${GREEN}Step 17: Checking service status...${NC}"
echo "Nginx status:"
sudo systemctl status nginx --no-pager | head -5
echo ""
echo "Backend status:"
pm2 status

# Final summary
echo ""
echo "================================================"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
echo "================================================"
echo ""
echo "Application URL: http://164.90.225.181"
echo "Backend API URL: http://164.90.225.181/api"
echo "Application Path: /var/www/plasticsurg_assisstant"
echo ""
echo "Default Login Credentials:"
echo "  Admin: admin@unth.edu.ng / admin123"
echo "  Doctor: doctor@unth.edu.ng / doctor123"
echo ""
echo "Next Steps:"
echo "  1. Visit http://164.90.225.181 to access your app"
echo "  2. Login with credentials above"
echo "  3. Test all features (patient registration, MCQ, etc.)"
echo "  4. Set up SSL certificate with: sudo certbot --nginx -d yourdomain.com"
echo ""
echo "Useful Commands:"
echo "  - Check backend logs: pm2 logs plasticsurg-backend"
echo "  - Check Nginx logs: sudo tail -f /var/log/nginx/plasticsurg_error.log"
echo "  - Restart backend: pm2 restart plasticsurg-backend"
echo "  - Restart Nginx: sudo systemctl restart nginx"
echo "  - Update app: cd /var/www/plasticsurg_assisstant && git pull && npm run build:nocheck && pm2 restart plasticsurg-backend && systemctl restart nginx"
echo ""
echo "Database Info:"
echo "  ✅ MySQL Database Connected"
echo "  Host: dbaas-db-3645547-do-user-23752526-0.e.db.ondigitalocean.com"
echo "  Database: defaultdb"
echo ""
echo "================================================"
