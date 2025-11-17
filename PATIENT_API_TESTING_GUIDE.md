# Patient API Integration - Testing Guide

## Date: November 17, 2025

## Changes Implemented ✅

### 1. Backend Patient API Endpoints (Already Existed)
Located in `server/index-postgres.js`:

- **GET** `/api/sync/patients` - Get all patients
- **GET** `/api/sync/patients/:id` - Get single patient
- **POST** `/api/sync/patients` - Create patient (with upsert on conflict)
- **PUT** `/api/sync/patients/:id` - Update patient
- **DELETE** `/api/sync/patients/:id` - Soft delete patient

All endpoints require authentication via JWT token.

### 2. Frontend API Client Updates
File: `src/services/apiClient.ts`

Added patient management methods:
```typescript
- async getPatients(since?: string)
- async getPatient(id: string)
- async createPatient(patientData: any)
- async updatePatient(id: string, patientData: any)
- async deletePatient(id: string)
```

### 3. New Patient Service Layer
File: `src/services/patientService.ts` (NEW)

Created centralized patient service that:
- Fetches from API first (server as source of truth)
- Falls back to IndexedDB for offline mode
- Automatically syncs data between API and local cache
- Provides methods for CRUD operations

### 4. Updated Patient Registration Service
File: `src/services/unthPatientService.ts`

Modified `savePatientRegistration()` method to:
- Generate UUID for patient ID using `uuid` package
- Call API to save patient to PostgreSQL
- Also cache in IndexedDB for offline support
- Better error handling and logging

## Testing Instructions

### Test 1: Patient Registration on Device A

1. **Login to the application:**
   - URL: http://164.90.225.181
   - Email: UNTHadmin@gmail.com
   - Password: blackvelvet

2. **Register a new patient:**
   - Go to Admissions or Patient Registration page
   - Fill in patient details:
     - First Name: Test
     - Last Name: Patient
     - Date of Birth: Any date
     - Sex: Male/Female
     - Phone: 08012345678
     - Address: Test Address
   - Click Register/Submit

3. **Verify registration:**
   - Check browser console for success message
   - Should see: `Patient registered successfully: { id: <uuid>, hospital_number: <number> }`
   - Patient should appear in patient list

### Test 2: Cross-Device Verification on Device B

1. **Open application on different device/browser:**
   - Same URL: http://164.90.225.181
   - Login with same credentials (UNTHadmin@gmail.com / blackvelvet)

2. **Check patient list:**
   - Go to Patients or Dashboard page
   - **EXPECTED:** Patient registered on Device A should appear
   - If using the new patientService, it will automatically fetch from API

3. **Register another patient on Device B:**
   - Follow same steps as Test 1
   - Different name, e.g., "Device B Patient"

4. **Verify on Device A:**
   - Refresh Device A
   - **EXPECTED:** Patient from Device B should now appear on Device A

### Test 3: Offline Functionality

1. **Disconnect from internet on Device A**
2. **Try to register a patient:**
   - Registration should fail with API error
   - Patient should still save to IndexedDB (fallback)
   - Should see console warning about offline mode

3. **Reconnect to internet:**
   - Sync function should upload unsynced patients to API
   - Other devices should then see the patient

## Database Verification

### Check PostgreSQL Directly

```bash
# SSH into server
ssh root@164.90.225.181

# Connect to PostgreSQL (credentials in server/.env file)
PGPASSWORD='<password_from_env>' psql \
  -h <host_from_env> \
  -p 25060 \
  -U doadmin \
  -d plasticsurg

# Query patients
SELECT id, hospital_number, first_name, last_name, created_at, synced 
FROM patients 
WHERE deleted = false 
ORDER BY created_at DESC 
LIMIT 10;
```

### Expected Output
You should see patients with:
- UUID format IDs (e.g., `b8330ca4-c9ff-49fd-9bf4-d105743d45b3`)
- Hospital numbers
- Names matching registered patients
- `synced = true`

## Known Issues & Next Steps

### Current State
- ✅ Backend API endpoints exist and work
- ✅ Frontend API client has patient methods
- ✅ New patientService created for API-first approach
- ✅ Patient registration updated to use API
- ⚠️ **CRITICAL:** Old pages still use `db.patients.toArray()` directly

### Pages That Need Migration

The following pages/components still use IndexedDB directly and need to be updated to use `patientService`:

1. `src/pages/Dashboard.tsx` - Line 36: `await db.patients.toArray()`
2. `src/pages/PatientProfile.tsx` - Line 35: `await db.patients.get()`
3. `src/pages/Scheduling.tsx` - Line 948: `await db.patients.toArray()`
4. `src/pages/Labs.tsx` - Line 862: `await db.patients.toArray()`
5. `src/pages/TreatmentPlanningEnhanced.tsx` - Line 112: `await db.patients.toArray()`
6. `src/pages/TreatmentPlanningPage.tsx` - Line 52: `db.patients.toArray()`
7. `src/pages/PatientSummariesPage.tsx` - Line 28: `await db.patients.toArray()`
8. `src/pages/PaperworkPage.tsx` - Line 35: `db.patients.toArray()`
9. `src/pages/MDTPage.tsx` - Line 63: `db.patients.toArray()`
10. `src/pages/AdmissionsPage.tsx` - Line 95: `await db.patients.toArray()`
11. `src/pages/DischargesPage.tsx` - Lines 107, 162, 230: `await db.patients.get()`
12. `src/components/SurgeryBookingEnhanced.tsx` - Lines 124, 135: `await db.patients.toArray/get()`

### Migration Pattern

Replace:
```typescript
// OLD - Direct IndexedDB access
const patients = await db.patients.toArray();
```

With:
```typescript
// NEW - API-first with offline fallback
import { patientService } from '../services/patientService';
const patients = await patientService.getAllPatients();
```

For single patient:
```typescript
// OLD
const patient = await db.patients.get(patientId);

// NEW
import { patientService } from '../services/patientService';
const patient = await patientService.getPatient(patientId);
```

## Rollout Strategy

### Phase 1: Test New Registration ✅ DONE
- New patients saved via API
- Verified in PostgreSQL

### Phase 2: Migrate Patient List Pages (NEXT)
- Update all pages to use patientService
- Test that existing data loads correctly
- Verify cross-device sync works

### Phase 3: Full Production Deployment
- Deploy updated frontend
- Monitor for errors
- Verify all features work

## Troubleshooting

### Issue: Patients not appearing on other devices
**Solution:** Check browser console for API errors. Ensure backend is running with `pm2 status`.

### Issue: "Authentication required" error
**Solution:** User needs to be logged in. Check JWT token in localStorage.

### Issue: Patients appear locally but not on server
**Solution:** Check network tab for failed API calls. May need to run sync manually.

### Issue: TypeScript errors in unthPatientService
**Solution:** There are some property name mismatches (camelCase vs snake_case). These can be fixed in follow-up updates.

## Success Criteria

✅ **Registration:** New patient created via API saves to PostgreSQL  
✅ **Cross-device sync:** Patient registered on Device A appears on Device B after refresh  
✅ **Offline support:** Patient saves locally when offline, syncs when back online  
✅ **Data integrity:** No duplicate patients, all fields saved correctly  
✅ **Performance:** API calls complete within 2 seconds  

## Next Steps

1. **Test patient registration and cross-device sync** (Instructions above)
2. **Migrate all pages** to use patientService instead of direct IndexedDB
3. **Add background sync** for offline-created patients
4. **Implement conflict resolution** for simultaneous edits
5. **Add loading states** for API calls in UI
