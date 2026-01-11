# Troubleshooting: Active Admissions Not Showing

## Issue
After deploying the cross-device sync fixes, the active admissions list appears empty in the Admission and Discharge Management page.

## Changes Made
I've added comprehensive logging to the `getActiveAdmissions()` method to help diagnose the issue.

## How to Debug

### Step 1: Deploy the Enhanced Logging
Try deploying to Vercel again (the network was unstable):
```powershell
vercel deploy --prod
```

### Step 2: Open Browser Console
1. Navigate to: https://plasticsurgassisstant.vercel.app
2. Open DevTools (F12)
3. Go to Console tab
4. Navigate to "Admission and Discharge Management"

### Step 3: Check Console Logs
You should see these logs when the page loads:
```
🔍 getActiveAdmissions: Starting...
📡 Attempting to fetch admissions from server...
📦 Server response: [...]
📥 Received X admissions from server
✅ Synced X admissions from server to local DB
💾 Fetching all admissions from local DB...
💾 Found X total admissions in local DB
📋 Sample admission: {...}
📊 Admission statuses: [...]
✅ Returning X active admissions
```

### Step 4: Identify the Problem

**If you see "⚠️ Could not fetch admissions from server":**
- The backend API might not be working
- Check Vercel environment variables (DATABASE_URL)
- Verify PostgreSQL connection

**If "Found 0 total admissions in local DB":**
- No admissions have been created yet
- Try creating a test admission using the "New Admission" tab

**If "Found X admissions but Returning 0 active admissions":**
- Check the "Admission statuses" log
- The status field might not be set to 'active'
- Admissions might have status 'admitted' instead of 'active'

## Potential Root Causes

### 1. Status Field Mismatch
The backend creates admissions with `status = 'admitted'` (line 100 in api/admissions.js):
```javascript
const { status = 'admitted' } = data;
```

But the frontend filters for `status === 'active'`:
```typescript
.filter(a => a.status === 'active')
```

**Solution:** Update the backend default to 'active' or update the filter to accept both.

### 2. No Database Connection
Vercel serverless functions might not have DATABASE_URL configured.

**Solution:** 
1. Go to Vercel Dashboard
2. Project Settings > Environment Variables
3. Add DATABASE_URL with your PostgreSQL connection string

### 3. No Test Data
The database might be empty.

**Solution:** Create a test admission through the UI.

## Quick Fixes

### Fix #1: Update Backend Default Status
In `api/admissions.js` line 100, change:
```javascript
const { status = 'admitted' } = data;
```
To:
```javascript
const { status = 'active' } = data;
```

### Fix #2: Update Frontend Filter
In `src/services/admissionDischargeService.ts`, change:
```typescript
.filter(a => a.status === 'active')
```
To:
```typescript
.filter(a => a.status === 'active' || a.status === 'admitted')
```

### Fix #3: Check Database Schema
Ensure the `admissions` table exists in PostgreSQL:
```sql
SELECT * FROM admissions;
```

## Testing Checklist
- [ ] Console shows server connection success
- [ ] Local DB has admission records
- [ ] Status field matches filter criteria
- [ ] Creating new admission works
- [ ] New admission appears in active list
- [ ] Cross-device sync works (laptop → phone)

## Next Steps
1. Deploy the changes (when network is stable)
2. Open browser console and check logs
3. Share the console logs if issue persists
4. Try creating a test admission
5. Verify the status field value in logs
