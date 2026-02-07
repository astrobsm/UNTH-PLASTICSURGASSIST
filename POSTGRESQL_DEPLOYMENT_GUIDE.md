# PostgreSQL Database Deployment Guide
## Supabase PostgreSQL Integration

This guide will help you set up a robust PostgreSQL database for the Plastic Surgeon Assistant application using Supabase and deploy to Vercel.

---

## 📋 Table of Contents

1. [Supabase Database Setup](#step-1-supabase-database-setup)
2. [Configure Vercel Environment](#step-2-configure-vercel-environment)
3. [Initialize Database Schema](#step-3-initialize-schema)
4. [Test Integration](#step-4-test-integration)
5. [Troubleshooting](#troubleshooting)

---

## Step 1: Supabase Database Setup

### 1.1 Database Connection Details

Your Supabase PostgreSQL database is hosted at:

**Connection String:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.mgblgewvpzcaimqaeqcp.supabase.co:5432/postgres
```

**Connection Parameters:**
- **Host**: `db.mgblgewvpzcaimqaeqcp.supabase.co`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `[Your Supabase database password]`
- **Database**: `postgres`
- **SSL Mode**: Required

### 1.2 Find Your Password

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** → **Database**
4. Your database password is shown (or you can reset it)

---

## Step 2: Configure Vercel Environment

### 2.1 Set Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your project: **plasticsurgassisstant**
3. Click **Settings** → **Environment Variables**
4. Add the following variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.mgblgewvpzcaimqaeqcp.supabase.co:5432/postgres` | Production |
| `JWT_SECRET` | `[Your secure random string]` | Production |

### 2.2 Generate JWT Secret

Run this command to generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3: Initialize Schema

### 3.1 Using Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Create a new query and paste the contents of `server/db/schema.sql`
5. Click **Run** to execute

### 3.2 Initialize Seed Data

After schema is created:
1. Create a new query in SQL Editor
2. Paste the contents of `server/db/seed.sql`
3. Click **Run** to execute

### 3.3 Verify Tables

Check that tables were created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables include:
- `users`
- `patients`
- `treatment_plans`
- `treatment_plan_steps`
- `lab_investigations`
- `prescriptions`
- `surgery_bookings`
- And more...

---

## Step 4: Test Integration

### 4.1 Test API Health

```bash
curl https://plasticsurgassisstant.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 4.2 Test Authentication

```bash
curl -X POST https://plasticsurgassisstant.vercel.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@unth.edu.ng","password":"Admin@123"}'
```

### 4.3 Default Credentials

After running seed.sql, you can login with:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@unth.edu.ng | Admin@123 |
| Consultant | doctor@unth.edu.ng | Doctor@123 |

**⚠️ Change these passwords immediately after first login!**

---

## Troubleshooting

### Cannot Connect to Database

1. **Check DATABASE_URL format:**
   ```
   postgresql://postgres:[PASSWORD]@db.mgblgewvpzcaimqaeqcp.supabase.co:5432/postgres
   ```

2. **Verify password has no special characters that need encoding:**
   - Replace `@` with `%40`
   - Replace `#` with `%23`
   - Replace `?` with `%3F`

3. **Check Supabase project is running:**
   - Go to Supabase Dashboard
   - Verify project status is "Active"

### Tables Not Created

1. Check for SQL errors in Supabase SQL Editor
2. Verify you're running queries in the correct database
3. Check the `public` schema is selected

### Authentication Fails

1. Verify JWT_SECRET is set in Vercel
2. Check DATABASE_URL is correct
3. Verify seed.sql was run to create default users

---

## Database Architecture

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Authentication and user profiles |
| `patients` | Patient demographics and medical records |
| `treatment_plans` | Treatment planning and protocols |
| `treatment_plan_steps` | Individual steps in treatment plans |
| `lab_investigations` | Laboratory test orders and results |
| `surgery_bookings` | Scheduled surgeries |
| `prescriptions` | Medication orders |
| `surgical_checklists` | WHO-style safety checklists |
| `audit_logs` | Compliance and activity tracking |

### Security Features

- **SSL/TLS**: All connections encrypted
- **Row Level Security**: Available via Supabase policies
- **Connection Pooling**: Handled by Supabase automatically
- **Automatic Backups**: Daily backups included

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Status**: ✅ Ready for Deployment  
**Database**: PostgreSQL 15 (Supabase)  
**Backend**: Vercel Serverless Functions  
**Connection**: Direct Connection (port 5432)
