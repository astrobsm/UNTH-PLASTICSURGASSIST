# Deploying Plastic Surgeon Assistant to Vercel with Supabase

This guide walks you through deploying the app to Vercel (free tier) with Supabase PostgreSQL database (free tier).

## Prerequisites

- GitHub account with your repository pushed
- Vercel account (free tier)
- Supabase account (free tier)

---

## Step 1: Set Up Supabase Database (Free Tier)

### 1.1 Create Supabase Account & Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** and sign up with GitHub
3. Click **"New project"**
4. Fill in project details:
   - **Organization**: Select your org or create one
   - **Project name**: `plasticsurg-assistant`
   - **Database Password**: Generate or create a strong password (**SAVE THIS!**)
   - **Region**: Choose closest to your users
5. Click **"Create new project"** (wait 1-2 minutes for setup)

### 1.2 Get Database Connection String

1. In your Supabase project dashboard, go to **Settings** (gear icon) → **Database**
2. Scroll down to **"Connection string"**
3. Click the **"URI"** tab
4. Select **"Transaction pooler"** (recommended for serverless/Vercel)
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the password you created in step 1.1

> **Important**: Use the **Transaction pooler** connection (port `6543`) for Vercel serverless functions. This handles connection pooling automatically.

---

## Step 2: Deploy to Vercel

### 2.1 Connect Repository to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel auto-detects the Vite framework

### 2.2 Configure Build Settings

The `vercel.json` is already configured. Verify these settings:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 2.3 Add Environment Variables

Before deploying, add these environment variables in Vercel:

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Your Supabase connection string | From Step 1.2 |
| `JWT_SECRET` | A secure 64-character string | See below to generate |
| `INIT_SECRET` | `plasticsurg2024` | For database initialization |
| `NODE_ENV` | `production` | Production environment flag |
| `VITE_OPENAI_API_KEY` | Your OpenAI API key (optional) | For AI features |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (2-3 minutes)
3. Your app will be live at `https://your-project.vercel.app`

---

## Step 3: Initialize the Database

After deployment, you need to create the database tables.

### Option A: Using curl (Recommended)

```bash
curl -X POST https://your-project.vercel.app/api/init-db \
  -H "Content-Type: application/json" \
  -H "x-init-secret: plasticsurg2024"
```

### Option B: Using the browser

Visit: `https://your-project.vercel.app/api/init-db` and use a REST client extension to send a POST request with header `x-init-secret: plasticsurg2024`

### Option C: Using PowerShell

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/init-db" `
  -Method POST `
  -Headers @{"x-init-secret" = "plasticsurg2024"; "Content-Type" = "application/json"}
```

Expected response:
```json
{
  "success": true,
  "message": "Database initialized successfully",
  "timestamp": "2024-12-25T..."
}
```

---

## Step 4: Verify Deployment

### 4.1 Check API Health

Visit: `https://your-project.vercel.app/api/health`

You should see:
```json
{
  "status": "healthy",
  "message": "Plastic Surgeon Assistant API",
  "database": {
    "connected": true,
    "message": "Database connected"
  }
}
```

### 4.2 Test Login

1. Go to `https://your-project.vercel.app`
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. **IMPORTANT**: Change the admin password immediately after first login!

---

## Step 5: Post-Deployment Security

### 5.1 Change Default Password

1. Login as admin
2. Go to Settings → Change Password
3. Set a strong password

### 5.2 Update INIT_SECRET

In Vercel environment variables, change `INIT_SECRET` to a new value to prevent unauthorized database reinitialization.

### 5.3 Enable Supabase RLS (Optional but Recommended)

For additional security, enable Row Level Security in Supabase:

1. Go to Supabase Dashboard → Database → Tables
2. Click on each table
3. Enable RLS (Row Level Security)
4. Create appropriate policies

---

## Supabase Free Tier Limits

| Resource | Free Tier Limit |
|----------|-----------------|
| Database size | 500 MB |
| Bandwidth | 5 GB/month |
| API requests | Unlimited |
| Direct connections | 60 |
| Pooled connections | 200 |
| Storage | 1 GB |

These limits are sufficient for small to medium deployments.

---

## Vercel Free Tier Limits

| Resource | Free Tier Limit |
|----------|-----------------|
| Deployments | Unlimited |
| Bandwidth | 100 GB/month |
| Serverless Function Execution | 100 GB-Hours/month |
| Build Time | 6000 minutes/month |
| Concurrent Builds | 1 |

---

## Troubleshooting

### "DATABASE_URL not set" Error

- Verify environment variable is added in Vercel
- Check for typos in the connection string
- Ensure you're using the pooler connection (port 6543)
- Redeploy after adding environment variables

### "Connection timeout" or "Too many connections"

- Use the **Transaction pooler** URL (port 6543), not direct connection
- Reduce `max` pool size in db.js if issues persist
- Check Supabase dashboard for connection usage

### "SSL connection required" Error

The app is configured for SSL. If you see this error:
- Ensure your DATABASE_URL uses SSL (Supabase URLs include this by default)
- Check that `sslmode=require` is NOT in the pooler URL (pooler handles SSL)

### Tables Not Created

1. Check the /api/init-db response for errors
2. Verify DATABASE_URL is correct
3. Check Supabase logs: Dashboard → Logs → Postgres logs

### Login Not Working

1. Verify database tables exist (check Supabase Table Editor)
2. Ensure users table has the admin user
3. Check browser console for errors

---

## Environment Variables Summary

```env
# Required
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
JWT_SECRET=<64-char-random-string>
INIT_SECRET=<your-secret>
NODE_ENV=production

# Optional
VITE_OPENAI_API_KEY=sk-...
```

---

## Quick Commands Reference

```bash
# Initialize database
curl -X POST https://YOUR-APP.vercel.app/api/init-db \
  -H "x-init-secret: YOUR_INIT_SECRET"

# Check health
curl https://YOUR-APP.vercel.app/api/health

# Quick health (no DB check)
curl https://YOUR-APP.vercel.app/api/health?quick=true

# List API endpoints
curl https://YOUR-APP.vercel.app/api
```

---

## Custom Domain (Optional)

1. In Vercel, go to your project → **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Vercel automatically provisions SSL certificate

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **App Issues**: Check browser console and Vercel function logs
