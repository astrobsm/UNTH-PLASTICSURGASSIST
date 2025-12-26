# Plastic Surgeon Assistant PWA

A Progressive Web App for plastic surgery clinical workflows, designed for interns and resident doctors.

## 🏥 Overview

This PWA provides comprehensive support for patient care workflows in plastic & reconstructive surgery including:
- Patient management and treatment plans
- Prescription management
- Wound care protocols  
- Surgical consumables lists
- Safety checklists and pre-op workflow
- Lab ordering and results
- Educational content and assessments
- Offline-capable functionality

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone and navigate to the project
cd plastic-surgeon-assistant

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Demo Login
- **Email**: Any valid email
- **Password**: Use `consultant` or `intern` for different role demos

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Green #0E9F6E, Red #DC2626 palette)
- **PWA**: Workbox + Service Worker
- **State**: Zustand + React Query
- **Offline**: IndexedDB (Dexie)
- **Icons**: Lucide React
- **Routing**: React Router v6

## 📱 PWA Features

- **Installable**: Add to home screen on mobile/desktop
- **Offline-first**: Works without internet connection
- **Background sync**: Queues actions when offline
- **Push notifications**: Clinical reminders and alerts
- **Responsive**: Mobile-first design

## 👥 User Roles

- **Super Admin**: System administration
- **Consultant**: Approve plans, sign checklists, supervise
- **Registrar**: Create plans, supervise interns
- **Intern**: Primary end-user, create notes, follow protocols
- **Nursing**: View schedules, consumables, tasks
- **Laboratory**: Receive requests, upload results
- **Pharmacy**: Consumable requests and availability

## 🔧 Development

### Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview build locally
npm run lint         # ESLint check
npm run lint:fix     # Fix ESLint issues
npm run format       # Prettier formatting
npm run type-check   # TypeScript checking
npm run test         # Unit tests (Vitest)
npm run e2e          # E2E tests (Playwright)
```

### Project Structure
```
src/
├── components/      # Reusable UI components
├── pages/          # Route-based page components
├── store/          # Zustand state management
├── types/          # TypeScript definitions
├── utils/          # Helper functions
└── styles/         # Global styles and Tailwind config
```

## 🔒 Security & Compliance

- Role-based access control (RBAC)
- JWT authentication with refresh tokens  
- Audit logging for all clinical actions
- Data encryption at rest and in transit
- HIPAA compliance considerations
- Secure offline data storage

## 🏗️ Deployment

### Quick Deploy to Vercel + Supabase (Recommended - Free)

1. **Set up Supabase Database:**
   - Create account at [supabase.com](https://supabase.com)
   - Create new project, save the database password
   - Get connection string: Settings → Database → URI → Transaction pooler

2. **Deploy to Vercel:**
   - Connect GitHub repo at [vercel.com](https://vercel.com)
   - Add environment variables:
     - `DATABASE_URL`: Your Supabase connection string
     - `JWT_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     - `INIT_SECRET`: `plasticsurg2024`
     - `NODE_ENV`: `production`
   - Deploy!

3. **Initialize Database:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/init-db \
     -H "x-init-secret: plasticsurg2024"
   ```

4. **Login:**
   - Default: `admin` / `admin123`
   - **Change password immediately after first login!**

📖 **Full Guide**: See [SUPABASE_VERCEL_DEPLOYMENT.md](./SUPABASE_VERCEL_DEPLOYMENT.md)

### Production Build (Self-Hosted)
```bash
npm run build
```

### Environment Variables
```env
# Required for Vercel deployment
DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres
JWT_SECRET=your-64-char-secret
INIT_SECRET=your-init-secret
NODE_ENV=production

# Optional
VITE_OPENAI_API_KEY=sk-your-key
```

### Hosting Options
- **Recommended**: Vercel + Supabase (both free tier)
- **Alternatives**: Vercel + Neon, Railway, or Vercel Postgres
- **Self-hosted**: Nginx + PostgreSQL with HTTPS

## 📋 Clinical Workflows

### Core Features Implemented
- ✅ Authentication with role-based access
- ✅ Dashboard with activity overview
- ✅ Basic navigation and routing
- ✅ PWA manifest and service worker
- ✅ Offline-ready architecture
- ✅ **Surgery Booking & Scheduling System** (Enhanced)

### Planned Features (MVP)
- 🔄 Patient record management
- 🔄 Treatment plan builder with timeline
- 🔄 Prescription composer with drug checks
- 🔄 WHO-style safety checklists
- 🔄 Lab ordering and result tracking
- 🔄 Educational modules and MCQ tests
- 🔄 Consumables shopping list generator

---

## 🏥 Surgery Booking System

### Overview
The **Surgery Booking Form** is a comprehensive scheduling tool designed for plastic surgery departments. It captures all essential pre-operative information, ensures surgical team coordination, and enforces safety protocols through validation rules.

### Key Features
- ✅ **11 Essential Fields** for complete surgical documentation
- ✅ **Auto-population** of patient demographics from database
- ✅ **Validation Rules** to ensure procedural completeness
- ✅ **Team Management** for multi-surgeon procedures
- ✅ **Safety Remarks** checklist for theater preparation
- ✅ **Visual Display** with color-coded team and remarks badges
- ✅ **WCAG AA Accessibility** compliance

---

### Required Fields

| # | Field Name | Type | Required | Auto-Populated | Description |
|---|------------|------|----------|----------------|-------------|
| 1 | **Patient Selection** | Dropdown | ✅ | - | Select from registered patients |
| 2 | **PT-Number** | Text | ✅ | ✅ | Patient hospital number |
| 3 | **Age** | Number | - | ✅ | Calculated from DOB |
| 4 | **Gender** | Select/Text | - | ✅ | Patient sex |
| 5 | **Indication** | Textarea | ✅ | - | Surgical indication/diagnosis |
| 6 | **Ward** | Text | - | ✅ | Patient current ward |
| 7 | **Procedure Name** | Text | ✅ | - | Name of surgical procedure |
| 8 | **Anaesthesia Type** | Select | ✅ | - | General, Regional, Local, Sedation |
| 9 | **Remarks Checklist** | Checkboxes | - | - | Pre-operative requirements (see below) |
| 10 | **Date** | Date | ✅ | ✅ | Surgery date (defaults to current) |
| 11 | **Team of Surgeons** | Dynamic List | - | - | Surgical team members |

---

### Remarks Checklist Options

The following pre-operative requirements can be flagged during booking:

- ☑️ **Crossmatch Blood** - Blood typing and cross-matching required
- ☑️ **Use Diathermy** - Electrosurgical unit needed
- ☑️ **Need Tourniquet** - Limb tourniquet required
- ☑️ **Need Dermatome** - Skin grafting equipment
- ☑️ **Need Montrel Mattress** - Specialized positioning
- ☑️ **Need Stirrup** - Lithotomy positioning equipment
- ☑️ **Need Armored ETT** - Reinforced endotracheal tube

**Purpose**: Ensures theatre staff prepare necessary equipment and resources before surgery.

---

### Validation Rules

The booking form enforces the following validation to ensure completeness:

#### Core Validation (Standard)
- ✅ Patient must be selected
- ✅ Procedure name required
- ✅ At least one surgeon in team (primary surgeon)

#### Enhanced Validation (Safety Protocol)
- ✅ **At least ONE of the following must be satisfied:**
  - **Option A**: At least 1 remark selected from checklist, OR
  - **Option B**: At least 2 surgeons in the team

**Rationale**: Complex procedures requiring multiple surgeons typically have higher resource needs. Solo surgeon procedures should explicitly flag equipment requirements via remarks.

#### Validation Messages
- ❌ **"Patient, procedure and a primary surgeon are required."** - Missing core fields
- ⚠️ **"Add a remark or at least two surgeons."** - Enhanced validation not met

---

### How to Book Surgery

#### Step 1: Access Scheduling
1. Navigate to **Scheduling** page
2. Select **Surgery** tab
3. Click **"Book Surgery"** button

#### Step 2: Select Patient
**Option A: From Database**
1. Choose patient from dropdown list
2. Patient demographics auto-populate:
   - PT-Number
   - Patient Name
   - Age (calculated)
   - Gender
   - Ward

**Option B: Manual Entry**
1. Check "Enter patient details manually"
2. Fill in patient information manually
3. Useful when patient not yet registered

#### Step 3: Fill Procedure Details
1. **Indication**: Enter surgical indication/diagnosis (required)
2. **Procedure Name**: Specify the operation (required)
3. **Anaesthesia Type**: Select from dropdown (required)
4. **Date**: Confirm or change surgery date

#### Step 4: Add Remarks (Optional)
- Tick all applicable equipment/resource requirements
- At least 1 remark required if only 1 surgeon

#### Step 5: Build Surgical Team
1. Enter surgeon name in text field
2. Click **"Add"** button
3. First surgeon becomes **Primary Surgeon** automatically
4. Add additional surgeons as needed
5. Remove surgeons by clicking "Remove" button
6. **Validation**: Minimum 2 surgeons required if no remarks selected

#### Step 6: Advanced Options (Optional)
Expand "Advanced Scheduling Fields" for:
- **Start Time**: Theatre start time
- **Duration**: Estimated procedure length (minutes)
- **Theatre Number**: Specific theatre allocation

#### Step 7: Submit Booking
1. Verify all required fields completed
2. Check validation status:
   - ✅ Green submit button = Valid
   - ❌ Disabled button + messages = Invalid
3. Click **"Book Surgery"**
4. Booking appears in surgery list immediately

---

### Surgery List Display

Each booked surgery displays:

**Standard Information**:
- Procedure name
- Theatre number and start time
- Urgency level (color-coded)
- Patient name
- Primary surgeon
- Duration
- Anaesthesia type
- Pre-op checklist status
- Surgery status badge

**Enhanced Display (New)**:
- **Team of Surgeons**: Color-coded badges
  - 🟢 **Green badge**: Primary surgeon
  - ⚪ **Gray badge**: Assistant surgeons
  - Shows "(Primary)" label for clarity
  
- **Remarks**: Blue badges for each selected requirement
  - 🔵 Equipment/resource flags
  - Helps theatre staff prepare in advance

---

### Manual Entry Mode

**Use Cases**:
- Patient not yet registered in system
- Emergency procedures
- External patient referrals
- New admissions

**How to Enable**:
1. Check "Enter patient details manually" checkbox
2. All demographic fields become editable
3. Fill required information manually
4. Proceed with booking as normal

**Note**: Consider registering the patient in the Patients page for complete record-keeping.

---

### Accessibility Features

The surgery booking form is fully accessible:
- ♿ WCAG AA compliant
- 🏷️ All inputs properly labeled
- ⌨️ Keyboard navigation supported
- 📱 Mobile responsive design
- 🔊 Screen reader compatible
- 🎨 High contrast color scheme

---

### Best Practices

#### For Solo Surgeon Procedures
- ✅ Always select at least 1 remark
- ✅ Specify equipment needs clearly
- ✅ Indicate special positioning requirements

#### For Multi-Surgeon Procedures
- ✅ Add all team members before submitting
- ✅ Verify primary surgeon is correct
- ✅ Add remarks for complex equipment needs
- ✅ Coordinate with team members before booking

#### General Guidelines
- 📋 Review patient details carefully before submitting
- 🕐 Book surgeries as early as possible for planning
- 📝 Use clear, specific procedure names
- 🔍 Double-check indication and ward information
- 👥 Ensure all surgeons are aware of their assignment

---

### Troubleshooting

**Problem**: "Unable to select patient"
- **Solution**: Ensure patients are registered in the system. Use `/add-test-patients.html` for test data or check "manual entry" mode.

**Problem**: "Submit button disabled"
- **Solution**: Check validation messages:
  - Ensure patient, procedure, and surgeon are filled
  - Add at least 1 remark OR 2+ surgeons

**Problem**: "Patient demographics not auto-populating"
- **Solution**: Verify patient has complete profile (DOB, gender, ward). Use manual entry as fallback.

**Problem**: "Cannot remove primary surgeon"
- **Solution**: The primary surgeon (first added) can be removed. A new primary will be auto-assigned to the next surgeon in the list.

---

### Database Schema

The surgery booking creates a record in `surgery_bookings` table with:

```typescript
interface SurgeryBooking {
  id: string;
  date: Date;
  patient_id: string;
  patient_name: string;
  hospital_number?: string;        // PT-Number
  patient_age?: number;            // Calculated age
  patient_gender?: string;         // Sex
  indication?: string;             // Surgical indication
  ward?: string;                   // Patient ward
  procedure_name: string;
  anaesthesia_type: 'general' | 'regional' | 'local' | 'sedation';
  remarks?: string[];              // Array of selected remarks
  surgeon_team?: string[];         // Array of surgeon names
  primary_surgeon: string;
  // ... additional fields
}
```

**Note**: New fields (`hospital_number`, `patient_age`, `patient_gender`, `indication`, `ward`, `remarks`, `surgeon_team`) are optional to maintain backward compatibility.

## � Topic Management System

The Topic Management System enables automated weekly delivery of AI-generated educational content integrated with MCQ assessments.

### Features
- **Topic Upload**: Single or bulk upload of educational topics
- **AI Content Generation**: WHO-based comprehensive study materials
- **Weekly Automation**: Serial topic delivery every Monday
- **Notification System**: Automatic alerts for new content
- **MCQ Integration**: Performance tracking by cadre (intern/registrar/consultant)

### Access
- Navigate to **Topic Management** in sidebar
- Available to Consultants and Super Admins only
- Four main tabs: Topics, Upload, Schedule, Generated Content

### Topic Upload
**Single Upload:**
- Title, Category, Difficulty Level (required)
- Description, Keywords (optional)
- Target Levels: Intern, Registrar, Consultant (select at least one)
- Estimated Study Time (default: 60 minutes)

**Bulk Upload Format:**
```
Title | Category | Difficulty | Target Levels (comma-separated)

Example:
Diabetic Foot Care | wound_care | intermediate | intern,registrar
Microvascular Free Flaps | microsurgery | advanced | registrar,consultant
```

**Categories:**
- plastic_surgery, reconstructive, aesthetic, burn_care
- hand_surgery, craniofacial, microsurgery, wound_care

### AI Content Generation

When you click **Generate Content** on a topic:
1. AI fetches WHO guidelines and international publications
2. Generates comprehensive study material (500-800 words)
3. Creates learning objectives, key takeaways, clinical pearls
4. Develops 2-3 realistic case studies
5. Compiles WHO/international references
6. Schedules MCQ test generation
7. Sends notifications to target users

**Generated Content Includes:**
- Comprehensive overview with WHO guidelines
- 5-7 measurable learning objectives
- 8-10 key takeaways for clinical practice
- 6-8 clinical pearls (expert tips, common pitfalls)
- 2-3 case studies with teaching points
- WHO reference citations with URLs

### Weekly Automation

**Schedule:**
- Topics auto-scheduled for next available Monday
- Content generated and published weekly
- Notifications sent to all users in target levels
- MCQ tests scheduled for following Tuesday 9:00 AM

**Process:**
Every Monday, the system:
1. Checks scheduled topics for the week
2. Generates AI content with WHO integration
3. Publishes study materials
4. Sends push notifications to users
5. Triggers MCQ generation (25 questions)
6. Schedules Tuesday test availability

### Performance Tracking

**User Progress:**
- Completion percentage per topic
- Time spent reading (tracked in seconds)
- MCQ test scores
- Notes and annotations

**Cadre Analytics:**
```
- Total users by cadre
- Average MCQ scores
- Completion rates
- Top performers
- Weak areas identification
```

**MCQ Integration:**
- 25 clinical scenario questions per level
- 4 marks each (100 marks total)
- 10-minute test duration
- Based on weekly content
- Automatic grading and feedback

### Usage Guide

**For Administrators:**
1. Upload topics (single or bulk)
2. Generate content for each topic
3. Review AI-generated materials
4. Monitor weekly schedule
5. Track user engagement

**For All Users:**
1. Receive Monday notifications for new content
2. Read AI-generated study materials
3. Review WHO references and case studies
4. Take scheduled MCQ test on Tuesday
5. View performance and weak areas

### Troubleshooting

**Topic Upload Fails:**
- Ensure all required fields filled
- Select at least one target level
- Use valid category
- Check title is unique

**Content Generation Fails:**
- Verify OpenAI API key configured
- Check topic exists and is active
- Review error logs
- Fallback template content will be used

**Notifications Not Received:**
- Grant notification permissions in browser
- Check user role matches target levels
- Verify notification service running
- Check service worker active

**MCQ Not Generated:**
- Ensure weekly content was created first
- Check MCQ generation service logs
- Verify topic has sufficient content
- Contact administrator if persists

### Database Schema
```typescript
educational_topics {
  id, title, category, description, targetLevels[],
  keywords[], difficulty, estimatedStudyTime,
  uploadedBy, uploadedAt, status, weeklyContentGenerated
}

weekly_contents {
  id, topicId, weekNumber, year, content,
  references[], learningObjectives[], keyTakeaways[],
  clinicalPearls[], caseStudies[], generatedAt,
  publishedAt, viewCount, targetLevels[]
}

topic_schedules {
  id, topicId, scheduledWeek, status,
  notificationsSent, targetLevels[], createdAt
}

user_progress {
  id, userId, topicId, weeklyContentId, readAt,
  completionPercentage, timeSpent, mcqTestTaken,
  mcqScore, notes
}
```

**See TOPIC_MANAGEMENT_GUIDE.md for comprehensive documentation.**

## �🔔 Notifications

- **In-app**: Real-time notifications for tasks
- **Push**: Web Push API for critical alerts
- **SMS**: Optional SMS for urgent notifications (Phase 2)
- **Email**: Daily summaries and reports

## 📊 Analytics & KPIs

- Daily active users by role
- Treatment plans created and completed
- Checklist completion rates before surgery
- Educational module engagement
- System usage patterns and optimization

## 🚨 Important Notes

### Medical Disclaimer
This application is designed to assist medical professionals but should not replace clinical judgment. Always follow institutional protocols and consult supervisors for patient care decisions.

### Data Privacy
- Patient data is stored securely with encryption
- Audit trails maintained for regulatory compliance  
- Follows hospital data governance policies
- Regular security assessments recommended

### Support & Maintenance
- Regular dependency updates
- Security patches and vulnerability assessments
- Clinical workflow validation with medical staff
- User feedback integration and feature requests

## 📞 Support

For technical issues, feature requests, or clinical workflow questions:
- Create GitHub issues for bugs/features
- Contact hospital IT for deployment assistance
- Engage clinical governance for workflow approval

---

**Version**: 0.1.0  
**Last Updated**: November 2025  
**License**: Private/Institutional Use