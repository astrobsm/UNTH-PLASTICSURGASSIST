# PDF Document Standards - Plastic Surgery Assistant

## Overview

This document defines the MANDATORY standards for all PDF document generation in the Plastic Surgery Assistant application. These standards ensure professional, cross-platform compatible documents suitable for medical and legal use.

## Last Updated
- **Date**: $(date)
- **Files Modified**: 12 files
- **Central Configuration**: `src/utils/pdfUtils.ts`

---

## MANDATORY GLOBAL RULES

### 1. FONTS

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Document Title | Helvetica | 16pt | Bold |
| Section Headers | Helvetica | 14pt | Bold |
| Sub-headers | Helvetica | 12pt | Bold |
| Body Text | Helvetica | **11pt minimum** | Normal |
| Table Content | Helvetica | **10pt minimum** | Normal |
| Footnotes/Captions | Helvetica | **9pt minimum** | Normal |
| Page Footer | Helvetica | 9pt | Normal |

**Why Helvetica?**
- Built-in to jsPDF (no embedding required)
- Cross-platform compatible (Windows, macOS, iOS, Android)
- Professional appearance for medical documents
- Renders identically across all devices

### 2. COLORS

| Element | Color | Hex Code |
|---------|-------|----------|
| **Document Background** | WHITE | #FFFFFF |
| **Body Text** | BLACK | #000000 |
| Primary Accent | Clinical Green | #0E9F6E |
| Alert/Danger | Red | #DC2626 |
| Warning | Orange | #D97706 |
| Borders/Lines | Gray | #646464 |

**Rules:**
- ✅ White background ALWAYS
- ✅ Black text for all body content
- ✅ Colors for accents/headers only (limited use)
- ❌ NO dark mode
- ❌ NO colored backgrounds for content
- ❌ NO low-contrast text

### 3. PAGE LAYOUT

| Property | Value |
|----------|-------|
| Format | A4 (210mm × 297mm) |
| Top Margin | 25mm |
| Bottom Margin | 25mm |
| Left Margin | 20mm |
| Right Margin | 20mm |
| Content Width | 170mm |
| Content Height | 247mm |

**Rules:**
- ❌ NO edge-to-edge printing
- ✅ Header space reserved (top 25mm)
- ✅ Footer space reserved (bottom 25mm)

### 4. INSTITUTION BRANDING

All medical documents include:
```
UNIVERSITY OF NIGERIA TEACHING HOSPITAL
Plastic and Reconstructive Surgery Unit
Enugu, Nigeria
```

### 5. FOOTER REQUIREMENTS

Every PDF page MUST include:
- Left: Department/Custom text
- Center: Page number (e.g., "Page 1 of 3")
- Right: Generation timestamp

---

## FILES UPDATED

### Core Configuration
- `src/utils/pdfUtils.ts` - Central PDF configuration and utilities

### Services (Backend PDF Generation)
1. `src/services/admissionDischargeService.ts` - Discharge summaries
2. `src/services/dischargeService.ts` - Discharge documents
3. `src/services/transfusionPdfService.ts` - Blood transfusion orders/charts
4. `src/services/schedulingService.ts` - Operation lists
5. `src/services/mcqGenerationService.ts` - Study materials

### Pages (Frontend PDF Generation)
6. `src/pages/PatientSummariesPage.tsx` - Patient summaries
7. `src/pages/PaperworkPage.tsx` - General paperwork
8. `src/pages/ShoppingList.tsx` - Surgical shopping lists
9. `src/pages/PatientEducation.tsx` - Patient education materials

### Components (Frontend PDF Generation)
10. `src/components/DischargeDocumentsPreview.tsx` - Discharge previews
11. `src/components/PatientRegistrationForm.tsx` - Patient registration PDFs
12. `src/components/procedures/IntraoperativeFindings.tsx` - Operative reports
13. `src/components/procedures/WoundCareAssessment.tsx` - Wound care reports

---

## AVAILABLE UTILITIES

### Core Functions

```typescript
import {
  createPDF,           // Creates configured jsPDF instance
  addPDFHeader,        // Adds institution header + title
  addSectionHeader,    // Adds section headers
  addBodyText,         // Adds wrapped body text
  addBulletList,       // Adds bullet point lists
  addWarningBox,       // Adds red warning boxes
  addInfoBox,          // Adds green info boxes
  addSimpleTable,      // Creates tables with headers
  addSeparator,        // Adds horizontal line
  addFooter,           // Adds page numbers + timestamp
  addTwoColumnText,    // Two-column layout
  addLabeledField,     // Label: Value format
  createPageBreakHandler, // Page break management
  needsNewPage,        // Check if new page needed
  addNewPage           // Add new page
} from '../utils/pdfUtils';

// Text utilities
import {
  sanitizeTextForPDF,  // Clean text for PDF rendering
  formatDateForPDF,    // Format date (DD/MM/YYYY)
  formatDateTimeForPDF // Format datetime
} from '../utils/pdfUtils';

// Configuration constants
import {
  PDF_FONT_SIZES,      // Standard font sizes
  PDF_MARGINS,         // Standard margins
  PDF_PAGE,            // Page dimensions
  PDF_COLORS,          // Standard colors
  PDF_INSTITUTION      // Institution details
} from '../utils/pdfUtils';
```

### Example Usage

```typescript
const generateDocument = () => {
  // 1. Create PDF with standard configuration
  const pdf = createPDF();
  
  // 2. Add header with institution branding
  let yPos = addPDFHeader(pdf, 'DOCUMENT TITLE', 'Optional Subtitle');
  
  // 3. Add content sections
  yPos = addSectionHeader(pdf, 'Section Name', yPos);
  yPos = addBodyText(pdf, 'Body content here...', yPos);
  
  // 4. ALWAYS add footer before saving
  addFooter(pdf);
  
  // 5. Save
  pdf.save('document_name.pdf');
};
```

---

## CROSS-PLATFORM COMPATIBILITY

All PDFs are validated to render identically on:
- ✅ Windows 10/11 (Chrome, Edge, Firefox)
- ✅ macOS (Chrome, Safari, Firefox)
- ✅ iOS (Safari, Chrome)
- ✅ Android (Chrome, Samsung Browser)
- ✅ All standard printers

---

## MEDICAL/LEGAL COMPLIANCE

These standards ensure:
1. **Professional appearance** for legal validity
2. **Clear institution branding** for traceability
3. **Timestamped generation** for audit trails
4. **Page numbering** for document integrity
5. **WCAG AA contrast** for accessibility
6. **Print-ready format** for physical records

---

## CHANGE LOG

### Version 1.0 (Current)
- Standardized all 12 PDF-generating files
- Increased body text minimum to 11pt (was 10pt)
- Increased margins to 20mm minimum (was 15mm)
- Added standard footer to all documents
- Removed colored footer backgrounds
- Added institution header option
- Created `addSimpleTable` utility
- Added `PDF_PAGE` and `PDF_INSTITUTION` constants

---

## MAINTENANCE NOTES

When adding new PDF generation:
1. Import from `'../utils/pdfUtils'`
2. Use `createPDF()` to create the document
3. Use provided utilities for consistent styling
4. ALWAYS call `addFooter(pdf)` before saving
5. Use `sanitizeTextForPDF()` for all dynamic text
6. Test on multiple platforms before deployment
