# Vercel Environment Variables Setup

## Issue
The backend APIs are returning 500 errors because required environment variables are not configured in Vercel.

## Required Environment Variables

You need to set these in your Vercel project settings:

### 1. DATABASE_URL (Required)
Your PostgreSQL database connection string.

**Format**: `postgresql://username:password@host:port/database?sslmode=require`

**Example (Supabase)**:
```
postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Example (Neon)**:
```
postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 2. JWT_SECRET (Required)
A secret key for signing JWT tokens.

**Generate a secure random string**:
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Example**:
```
aB3xK9mN2pQ5vW8zL4cF7jH1rT6yU0iE9oS3dG8hJ2kM5nP7qR4tV1wX6yZ0
```

### 3. OPENAI_API_KEY (Optional - for AI features)
Your OpenAI API key for AI-powered features.

**Example**:
```
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. INIT_ADMIN_SECRET (Optional - for first-time admin approval)
Secret code for approving the first admin user.

**Example**:
```
unth-admin-2026
```

## How to Set Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Select your project: **plasticsurgassisstant**
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Name: `DATABASE_URL`
   - Value: `your_connection_string`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**
5. Repeat for `JWT_SECRET`, `OPENAI_API_KEY`, etc.
6. After adding all variables, trigger a new deployment:
   - Go to **Deployments** tab
   - Click **...** menu on the latest deployment
   - Select **Redeploy**

### Option 2: Via Vercel CLI

```powershell
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project (run in project directory)
vercel link

# Add environment variables
vercel env add DATABASE_URL production
# Paste your connection string when prompted

vercel env add JWT_SECRET production
# Paste your JWT secret when prompted

vercel env add OPENAI_API_KEY production
# Paste your OpenAI key when prompted

# Deploy with new environment variables
vercel --prod
```

## Database Setup Checklist

Before setting DATABASE_URL, ensure your PostgreSQL database has:

### 1. Database Created
- Database name (e.g., `plasticsurg_db`)
- User with full permissions

### 2. Schema Initialized
Run the initialization script:

```powershell
# Set your local DATABASE_URL for initialization
$env:DATABASE_URL = "postgresql://user:pass@host:port/database"

# Run initialization (creates tables and admin user)
node api/init-db.js
```

### 3. Test Connection
After setting environment variables in Vercel:

```bash
# Test the health endpoint
curl https://plasticsurgassisstant.vercel.app/api/health

# Should return:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

## Default Admin Credentials

After database initialization, login with:
- **Username**: `admin`
- **Password**: `Admin@123!`

⚠️ **IMPORTANT**: Change the admin password immediately after first login!

## Troubleshooting

### 500 Error on /api/auth
- **Cause**: DATABASE_URL not set or invalid
- **Fix**: Add DATABASE_URL in Vercel environment variables and redeploy

### "JWT_SECRET not configured"
- **Cause**: JWT_SECRET environment variable missing
- **Fix**: Add JWT_SECRET in Vercel environment variables

### Connection timeout
- **Cause**: Database not accessible or wrong connection string
- **Fix**: 
  - Check if database allows connections from Vercel IPs (0.0.0.0/0)
  - Verify SSL mode is correct
  - Test connection string locally first

### Database tables don't exist
- **Cause**: Schema not initialized
- **Fix**: Run `node api/init-db.js` with DATABASE_URL set

## Quick Setup Script

```powershell
# 1. Generate JWT Secret
$JWT_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "JWT_SECRET: $JWT_SECRET"

# 2. Set database URL (replace with your actual connection string)
$DATABASE_URL = "postgresql://user:pass@host:port/database"

# 3. Initialize database locally
$env:DATABASE_URL = $DATABASE_URL
$env:JWT_SECRET = $JWT_SECRET
node api/init-db.js

# 4. Now add these to Vercel dashboard:
Write-Host "`nAdd these to Vercel Environment Variables:"
Write-Host "DATABASE_URL=$DATABASE_URL"
Write-Host "JWT_SECRET=$JWT_SECRET"
```

## Next Steps

1. ✅ Set DATABASE_URL in Vercel
2. ✅ Set JWT_SECRET in Vercel  
3. ✅ Initialize database schema (run init-db.js)
4. ✅ Redeploy in Vercel
5. ✅ Test login at https://plasticsurgassisstant.vercel.app
6. ✅ Change default admin password

## Support

If you continue to experience issues, check:
- Vercel deployment logs: `vercel logs`
- Browser console for detailed error messages
- Verify all environment variables are set for "Production" environment
