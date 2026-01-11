# JWT_SECRET Environment Variable Setup

## Overview
JWT_SECRET is a critical environment variable required for secure JSON Web Token generation and validation. This guide covers setup for production deployment on Vercel.

## Security Requirements
- **Minimum Length**: 32 characters (256 bits)
- **Randomness**: Use cryptographically secure random generation
- **Uniqueness**: Never reuse across environments
- **Confidentiality**: Never commit to version control

## Generate Secure JWT_SECRET

### Method 1: OpenSSL (Recommended)
```bash
openssl rand -base64 32
```

### Method 2: Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Method 3: PowerShell (Windows)
```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

### Method 4: Online Generator (Less Secure)
Use only if you don't have access to the above methods:
- https://generate-secret.vercel.app/32
- https://www.random.org/strings/ (Length: 32, Unique)

## Setup on Vercel

### Via Vercel Dashboard (Recommended)

1. **Navigate to Project Settings**:
   - Go to: https://vercel.com/sylvia4douglas-gmailcoms-projects/plasticsurg_assisstant/settings/environment-variables
   - Or: Dashboard → Your Project → Settings → Environment Variables

2. **Add New Environment Variable**:
   - Click **"Add New"** button
   - **Key**: `JWT_SECRET`
   - **Value**: Paste generated secret (from step above)
   - **Environment**: Select **"Production"**
   - **Optional**: Also add to "Preview" and "Development" if needed
   - Click **"Save"**

3. **Redeploy Application**:
   - Option A: Git push (triggers automatic deployment)
   - Option B: Manual redeploy from Deployments tab
   - **Important**: Environment variable changes require redeployment

### Via Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Add JWT_SECRET to production
vercel env add JWT_SECRET production
# When prompted, paste your generated secret

# Add to preview (optional)
vercel env add JWT_SECRET preview

# Add to development (optional)
vercel env add JWT_SECRET development

# List all environment variables
vercel env ls

# Redeploy to production
vercel --prod
```

### Via Vercel API

```bash
curl -X POST "https://api.vercel.com/v10/projects/{PROJECT_ID}/env" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "JWT_SECRET",
    "value": "YOUR_GENERATED_SECRET_HERE",
    "type": "encrypted",
    "target": ["production"]
  }'
```

## Verification

### Check Environment Variable

```bash
# Via Vercel CLI
vercel env pull .env.local
cat .env.local | grep JWT_SECRET
```

### Test in Application

Create temporary verification endpoint (remove after testing):

```typescript
// api/verify-jwt.js
export default function handler(req, res) {
  const hasJWT = !!process.env.JWT_SECRET;
  const length = process.env.JWT_SECRET?.length || 0;
  
  res.json({
    configured: hasJWT,
    length: length,
    secure: length >= 32
  });
}
```

Access: `https://your-app.vercel.app/api/verify-jwt`

Expected response:
```json
{
  "configured": true,
  "length": 44,
  "secure": true
}
```

## Security Best Practices

### ✅ DO:
- Generate JWT_SECRET using cryptographically secure methods
- Use different secrets for production, preview, and development
- Rotate JWT_SECRET periodically (every 90 days recommended)
- Store backups securely (password manager, encrypted vault)
- Limit access to production environment variables
- Use encrypted environment variable type in Vercel

### ❌ DON'T:
- Never commit JWT_SECRET to Git
- Don't use predictable values (company name, "password", etc.)
- Don't share secrets via email or chat
- Don't reuse secrets across projects
- Don't log JWT_SECRET in application code
- Don't expose in client-side code

## Troubleshooting

### Error: "JWT_SECRET is not defined"

**Symptoms**: Authentication fails, 500 errors on login

**Solutions**:
1. Verify environment variable is set in Vercel dashboard
2. Check spelling: `JWT_SECRET` (case-sensitive)
3. Redeploy application after setting variable
4. Clear build cache: Dashboard → Settings → Clear Build Cache

### Error: "Invalid token signature"

**Symptoms**: Users logged out unexpectedly, token validation fails

**Cause**: JWT_SECRET was changed after tokens were issued

**Solutions**:
1. Users must log in again (tokens invalidated)
2. Implement token refresh mechanism
3. Add JWT_SECRET rotation strategy

### Environment Variable Not Applied

**Symptoms**: Old behavior persists after setting variable

**Solutions**:
1. Wait for deployment to complete (check Deployments tab)
2. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Clear application cache and cookies
4. Verify correct environment (Production vs Preview)

## Rotation Strategy

Periodically rotate JWT_SECRET for enhanced security:

1. **Generate New Secret**:
   ```bash
   openssl rand -base64 32 > new-secret.txt
   ```

2. **Add as JWT_SECRET_NEW**:
   - Add new variable in Vercel dashboard
   - Keep old JWT_SECRET active

3. **Update Backend to Accept Both**:
   ```typescript
   const secrets = [
     process.env.JWT_SECRET,
     process.env.JWT_SECRET_NEW
   ];
   
   // Try validating with both secrets
   for (const secret of secrets) {
     try {
       const decoded = jwt.verify(token, secret);
       return decoded;
     } catch (err) {
       continue;
     }
   }
   ```

4. **Issue New Tokens with JWT_SECRET_NEW**:
   ```typescript
   const token = jwt.sign(payload, process.env.JWT_SECRET_NEW);
   ```

5. **After Grace Period (7 days)**:
   - Rename JWT_SECRET_NEW → JWT_SECRET
   - Remove old JWT_SECRET
   - Update token generation code

## Project-Specific Configuration

### Current Setup
- **Project**: plasticsurg_assisstant
- **Owner**: sylvia4douglas-gmailcoms-projects
- **Production URL**: https://plasticsurgassisstant-m9p55qrgt.vercel.app
- **Backend**: api/ folder (serverless functions)
- **Auth Files**: api/auth.js, api/users.js

### Required Files to Check After Setup
1. `api/auth.js` - JWT generation on login
2. `api/users.js` - Token validation middleware
3. `src/api/api.ts` - Frontend API client

### Verification Checklist
- [ ] JWT_SECRET set in Vercel dashboard
- [ ] Environment is "Production"
- [ ] Application redeployed
- [ ] Login functionality tested
- [ ] Token validation working
- [ ] Protected routes accessible
- [ ] Logout functionality working

## Support

If issues persist:
1. Check Vercel deployment logs: Dashboard → Deployments → [Latest] → Function Logs
2. Review backend errors: api/auth.js error handling
3. Verify JWT library version: `npm list jsonwebtoken`
4. Contact support: support@vercel.com

## References
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- JWT Best Practices: https://jwt.io/introduction
- Cryptographic Standards: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-132.pdf
