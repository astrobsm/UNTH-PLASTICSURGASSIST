# Vercel Deployment Guide for Plastic Surgeon Assistant

This guide walks you through deploying the Plastic Surgeon Assistant PWA to Vercel with a free PostgreSQL database.

## Prerequisites

- GitHub account (repository already pushed)
- Vercel account (free tier works)
- Neon PostgreSQL account (free tier - recommended) OR Supabase/Railway

---

## Step 1: Set Up Free PostgreSQL Database (Neon - Recommended)

### Option A: Neon (Recommended - Best free tier)

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Click **"Create a project"**
4. Name: `plasticsurg-assistant`
5. Region: Choose closest to your users
6. Click **"Create project"**
7. Copy the connection string (starts with `postgresql://...`)

### Option B: Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Create new project
3. Go to **Settings → Database**
4. Copy the connection string under "Connection string" → "URI"

### Option C: Vercel Postgres (if you have Vercel Pro)

1. In Vercel dashboard, go to **Storage**
2. Create new Postgres database
3. Connection string is automatically added to environment

---

## Step 2: Deploy to Vercel

### Method 1: One-Click Deploy (Easiest)

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your GitHub repository: `astrobsm/UNTH-PLASTICSURGASSIST`
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **"Deploy"**

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
cd plasticsurg_assisstant
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: plasticsurg-assistant
# - Directory: ./
# - Override settings? No
```

---

## Step 3: Configure Environment Variables

In Vercel Dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add the following variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon/Supabase connection string | Production, Preview, Development |
| `JWT_SECRET` | A secure random string (32+ chars) | Production, Preview, Development |
| `INIT_SECRET` | `plasticsurg2024` (for DB init) | Production |
| `NODE_ENV` | `production` | Production |
| `VITE_OPENAI_API_KEY` | Your OpenAI API key (optional, for AI features) | Production |

### Generate Secure JWT_SECRET

Run this in terminal to generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4: Initialize Database

After deployment, initialize the database by making a POST request:

### Option 1: Using cURL

```bash
curl -X POST https://your-vercel-url.vercel.app/api/init-db \
  -H "Content-Type: application/json" \
  -H "x-init-secret: plasticsurg2024"
```

### Option 2: Using Browser Console

Open your deployed app and run in browser console:

```javascript
fetch('/api/init-db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-init-secret': 'plasticsurg2024'
  }
}).then(r => r.json()).then(console.log)
```

### Option 3: Test with the included HTML page

Visit: `https://your-vercel-url.vercel.app/init-db.html` (create this if needed)

---

## Step 5: Verify Deployment

1. **Health Check**: Visit `https://your-vercel-url.vercel.app/api/health`
   - Should return: `{"status":"ok","message":"Plastic Surgeon Assistant API is running"}`

2. **Login**: 
   - Username: `admin`
   - Password: `admin123`
   - ⚠️ **Change this password immediately after first login!**

3. **Test API**: Check browser console for any errors

---

## Project Structure for Vercel

```
plasticsurg_assisstant/
├── api/                    # Vercel Serverless Functions
│   ├── _lib/
│   │   ├── db.js          # Database connection
│   │   └── auth.js        # Authentication utilities
│   ├── auth.js            # Login/Register endpoints
│   ├── patients.js        # Patients CRUD
│   ├── users.js           # User management
│   ├── surgeries.js       # Surgery booking
│   ├── treatment-plans.js # Treatment plans
│   ├── admissions.js      # Admissions/Discharges
│   ├── lab-orders.js      # Lab orders
│   ├── prescriptions.js   # Prescriptions
│   ├── wound-care.js      # Wound care records
│   ├── health.js          # Health check
│   └── init-db.js         # Database initialization
├── src/                   # React Frontend (Vite)
├── public/                # Static assets
├── dist/                  # Build output (auto-generated)
├── vercel.json           # Vercel configuration
└── package.json          # Dependencies
```

---

## API Endpoints

All endpoints are available at `/api/*`:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth` | POST | Login |
| `/api/auth/register` | POST | Register new user |
| `/api/auth/me` | GET | Get current user |
| `/api/patients` | GET, POST | List/Create patients |
| `/api/patients/:id` | GET, PUT, DELETE | Patient CRUD |
| `/api/users` | GET, POST | User management |
| `/api/surgeries` | GET, POST | Surgery booking |
| `/api/treatment-plans` | GET, POST | Treatment plans |
| `/api/admissions` | GET, POST | Admissions |
| `/api/lab-orders` | GET, POST | Lab orders |
| `/api/prescriptions` | GET, POST | Prescriptions |
| `/api/wound-care` | GET, POST | Wound care |
| `/api/init-db` | POST | Initialize database |

---

## Troubleshooting

### "DATABASE_URL not set" Error
- Ensure you've added the `DATABASE_URL` environment variable in Vercel
- Redeploy after adding environment variables

### "Invalid credentials" Error
- Run the database initialization first (`/api/init-db`)
- Check if default admin was created

### CORS Errors
- The API is configured to accept all origins
- Check browser console for specific error messages

### Build Errors
- Ensure Node.js version is 20.x
- Run `npm install` locally to check for dependency issues

### Database Connection Errors
- Verify your connection string is correct
- For Neon: Ensure you're using the pooled connection URL
- Check if SSL is required (most cloud DBs require it)

---

## Updating the Deployment

### Automatic (Recommended)
Push to your GitHub repository - Vercel will auto-deploy:

```bash
git add .
git commit -m "Update description"
git push origin main
```

### Manual Redeploy
In Vercel Dashboard: **Deployments** → Click **"..."** → **"Redeploy"**

---

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. SSL certificate is automatically provisioned

---

## Free Tier Limits

### Vercel Free Tier
- 100GB bandwidth/month
- Serverless Function Execution: 100GB-Hours
- Unlimited deployments from personal repos

### Neon Free Tier
- 0.5 GB storage
- 1 project, 10 branches
- 100 hours compute/month
- Automatic scale-to-zero

### Supabase Free Tier
- 500 MB database storage
- 2 GB bandwidth
- 50,000 monthly active users

---

## Security Recommendations

1. **Change default admin password** immediately after deployment
2. **Use strong JWT_SECRET** (generated random string)
3. **Enable 2FA** on Vercel and database accounts
4. **Review user registrations** - new users require approval
5. **Monitor audit logs** for suspicious activity

---

## Support

For issues:
1. Check Vercel function logs in dashboard
2. Review browser console for frontend errors
3. Test API endpoints directly with cURL or Postman

Happy deploying! 🚀
