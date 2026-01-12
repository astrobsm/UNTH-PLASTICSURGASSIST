# Google Cloud SQL Setup for Plastic Surgeon Assistant

## Overview
Your app is fully compatible with Google Cloud SQL (PostgreSQL). This guide will help you set it up.

## Step 1: Create Google Cloud SQL Instance

### 1.1 Create PostgreSQL Instance
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **SQL** (or search for "Cloud SQL")
3. Click **CREATE INSTANCE**
4. Select **PostgreSQL**
5. Configure your instance:
   - **Instance ID**: `plasticsurg-db` (or your preferred name)
   - **Password**: Set a strong password for the `postgres` user
   - **Database Version**: PostgreSQL 15 or later
   - **Region**: Choose closest to your users (e.g., `us-central1`)
   - **Zonal availability**: Single zone (for cost savings) or Multiple zones (for high availability)

### 1.2 Configure Instance Settings

**Machine Configuration** (Shared core is cheapest):
- **Preset**: Shared core → 1 vCPU, 0.614 GB RAM
- **Storage**: 10 GB SSD (auto-increase enabled)

**Connections**:
- Enable **Public IP**
- Add authorized networks:
  - **Name**: `Vercel`
  - **Network**: `0.0.0.0/0` (allows Vercel to connect)
  - ⚠️ For better security, use Cloud SQL Proxy or VPC (advanced)

**Data Protection**:
- Enable automated backups
- Set backup window during low-traffic hours

Click **CREATE INSTANCE** (takes 5-10 minutes)

## Step 2: Create Database and User

### 2.1 Connect via Cloud Shell or Client

**Option A: Cloud Shell (Easiest)**
```bash
# From Google Cloud Console, click "Cloud Shell" button
gcloud sql connect plasticsurg-db --user=postgres
# Enter password when prompted
```

**Option B: Local psql client**
```bash
psql "host=YOUR_PUBLIC_IP port=5432 dbname=postgres user=postgres sslmode=require"
```

### 2.2 Create Database
```sql
-- Create database
CREATE DATABASE plasticsurg_db;

-- Create application user (more secure than using postgres)
CREATE USER plasticsurg_user WITH PASSWORD 'YourSecurePassword123!';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE plasticsurg_db TO plasticsurg_user;

-- Connect to the new database
\c plasticsurg_db

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO plasticsurg_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO plasticsurg_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO plasticsurg_user;

-- Exit
\q
```

## Step 3: Get Connection Details

### 3.1 Find Your Instance Details
In Google Cloud Console → SQL → Your Instance:
- **Public IP Address**: `34.XXX.XXX.XXX` (copy this)
- **Connection name**: `project-id:region:instance-id`

### 3.2 Build Connection String

**Standard Format (Public IP)**:
```
postgresql://plasticsurg_user:YourSecurePassword123!@34.XXX.XXX.XXX:5432/plasticsurg_db?sslmode=require
```

**Template**:
```
postgresql://[USERNAME]:[PASSWORD]@[PUBLIC_IP]:5432/[DATABASE_NAME]?sslmode=require
```

**Example**:
```
postgresql://plasticsurg_user:MyPass2024!@34.123.45.67:5432/plasticsurg_db?sslmode=require
```

## Step 4: Initialize Database Schema

### 4.1 Set Environment Variable Locally
```powershell
# Windows PowerShell
$env:DATABASE_URL = "postgresql://plasticsurg_user:YourPass@34.XXX.XXX.XXX:5432/plasticsurg_db?sslmode=require"

# Generate JWT Secret
$env:JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Initialize database tables and create admin user
node api/init-db.js
```

You should see:
```
✅ Database initialized successfully
✅ Tables created
✅ Admin user created
   Username: admin
   Password: Admin@123!
```

## Step 5: Configure Vercel

### 5.1 Add Environment Variables
Go to [Vercel Dashboard](https://vercel.com) → Your Project → Settings → Environment Variables

Add these variables for **Production**, **Preview**, and **Development**:

**DATABASE_URL**:
```
postgresql://plasticsurg_user:YourPassword@34.XXX.XXX.XXX:5432/plasticsurg_db?sslmode=require
```

**JWT_SECRET** (generate with):
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**INIT_ADMIN_SECRET** (optional):
```
unth-admin-2026
```

### 5.2 Redeploy
1. Go to **Deployments** tab
2. Click **...** on latest deployment
3. Select **Redeploy**
4. Wait for deployment to complete

## Step 6: Test Connection

### 6.1 Test Health Endpoint
```bash
curl https://plasticsurgassisstant.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-12T...",
  "database": "connected"
}
```

### 6.2 Test Login
1. Go to https://plasticsurgassisstant.vercel.app
2. Login with:
   - **Username**: `admin`
   - **Password**: `Admin@123!`
3. Change password immediately after first login

## Cost Optimization Tips

### Free Tier / Low Cost Options

**Shared Core Instance** (Cheapest):
- 1 vCPU shared
- 0.614 GB RAM
- 10 GB storage
- **Cost**: ~$9/month

**Micro Instance** (Better performance):
- 1 vCPU dedicated
- 1.7 GB RAM
- 10 GB storage
- **Cost**: ~$25/month

### Cost-Saving Tips:
1. **Stop when not in use**: Stop instance during non-business hours
2. **Use shared core**: For development/testing
3. **Set storage limits**: Prevent auto-increase surprises
4. **Monitor usage**: Set up billing alerts
5. **Backup retention**: Keep only necessary backups (7 days)

### Alternative: Cloud Run + Cloud SQL Proxy
For even better integration with Vercel, consider using Cloud SQL Proxy (advanced setup).

## Security Best Practices

### 1. Network Security
```sql
-- Create read-only user for analytics
CREATE USER readonly_user WITH PASSWORD 'ReadOnlyPass123!';
GRANT CONNECT ON DATABASE plasticsurg_db TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
```

### 2. Restrict IP Access (Better than 0.0.0.0/0)
If you know your Vercel deployment IPs:
- Remove `0.0.0.0/0`
- Add specific Vercel IP ranges

### 3. SSL/TLS
Always use `sslmode=require` in connection string

### 4. Password Rotation
Change database password regularly:
```sql
ALTER USER plasticsurg_user WITH PASSWORD 'NewPassword123!';
```

Then update `DATABASE_URL` in Vercel.

## Monitoring & Maintenance

### Enable Query Insights
1. Go to Cloud SQL instance
2. Click **Query Insights**
3. Enable query insights for performance monitoring

### Set Up Alerts
1. Go to **Monitoring** → **Alerting**
2. Create alerts for:
   - High CPU usage (>80%)
   - Storage nearly full (>80%)
   - Connection limit reached
   - Failed connections

### Backup Verification
Test your backups periodically:
```bash
# Create on-demand backup
gcloud sql backups create --instance=plasticsurg-db

# List backups
gcloud sql backups list --instance=plasticsurg-db
```

## Troubleshooting

### Connection Timeout
**Problem**: Can't connect from Vercel
**Solutions**:
- Verify Public IP is enabled
- Check authorized networks includes `0.0.0.0/0`
- Verify password is correct (no special chars that need escaping)
- Ensure SSL mode is set: `?sslmode=require`

### "Too Many Connections"
**Problem**: Max connections exceeded
**Solutions**:
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Terminate idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < now() - interval '5 minutes';
```

Or increase max_connections in Cloud SQL flags.

### Slow Queries
**Problem**: Database performance degraded
**Solutions**:
- Enable Query Insights in Cloud SQL
- Add indexes to frequently queried columns
- Upgrade instance type

## Migration from Existing Database

If you're moving from another database:

### 1. Export from Current Database
```bash
pg_dump -h old-host -U old-user -d old-db > backup.sql
```

### 2. Import to Google Cloud SQL
```bash
# Upload to Cloud Storage first
gsutil cp backup.sql gs://your-bucket/

# Import via Cloud SQL
gcloud sql import sql plasticsurg-db gs://your-bucket/backup.sql --database=plasticsurg_db
```

Or use `psql`:
```bash
psql "postgresql://user:pass@34.XXX.XXX.XXX:5432/plasticsurg_db?sslmode=require" < backup.sql
```

## Quick Setup Commands

```powershell
# 1. Set variables
$DB_HOST = "34.XXX.XXX.XXX"  # Your Cloud SQL public IP
$DB_USER = "plasticsurg_user"
$DB_PASS = "YourSecurePassword123!"
$DB_NAME = "plasticsurg_db"

# 2. Build connection string
$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"

# 3. Generate JWT secret
$JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Initialize database
$env:DATABASE_URL = $DATABASE_URL
$env:JWT_SECRET = $JWT_SECRET
node api/init-db.js

# 5. Display for Vercel
Write-Host "`n=== Add these to Vercel Environment Variables ===`n"
Write-Host "DATABASE_URL=$DATABASE_URL"
Write-Host "JWT_SECRET=$JWT_SECRET"
```

## Support & Resources

- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Cloud SQL Pricing Calculator](https://cloud.google.com/products/calculator)
- [PostgreSQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)
- [Vercel + Cloud SQL Guide](https://vercel.com/guides/using-databases-with-vercel)

## Next Steps

✅ Create Cloud SQL instance  
✅ Create database and user  
✅ Get connection string  
✅ Initialize schema locally  
✅ Add environment variables to Vercel  
✅ Redeploy and test  
✅ Change default admin password  
✅ Set up monitoring and backups
