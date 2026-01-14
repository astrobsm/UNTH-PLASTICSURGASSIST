# Speech-to-Text and OCR Integration Guide

## Overview

This implementation adds comprehensive speech-to-text dictation and OCR scanning capabilities across all medical documentation forms in the Plastic Surgery Assistant PWA.

## Components Created

### 1. Services

#### `src/services/speechToTextService.ts`
Speech-to-text service with medical terminology support:
- Web Speech API wrapper
- Medical terminology corrections (50+ terms)
- Medical abbreviation expansions (30+ abbreviations)
- Voice command processing (period, comma, new line, etc.)
- Continuous listening mode

```typescript
import { speechToTextService } from '../services/speechToTextService';

speechToTextService.startListening({
  continuous: true,
  interimResults: true,
  onResult: (result) => { /* handle transcript */ },
  onError: (error) => { /* handle error */ }
});
```

#### `src/services/ocrService.ts`
OCR service using Tesseract.js:
- Image preprocessing for better accuracy
- Lab report value extraction (CBC, LFT, RFT, lipid profile, etc.)
- Document type auto-detection
- Support for lab reports, imaging reports, prescriptions

```typescript
import { ocrService } from '../services/ocrService';

const result = await ocrService.extractText(imageFile, 'lab_report');
const labValues = ocrService.extractLabValues(result.text);
```

#### `src/services/aiTextEnhancementService.ts`
AI-powered text polishing:
- Context-aware formatting (operative notes, discharge summaries, etc.)
- Medical abbreviation standardization
- SOAP note formatting
- Works offline with local processing, enhanced with AI when available

```typescript
import { aiTextEnhancementService } from '../services/aiTextEnhancementService';

const result = await aiTextEnhancementService.enhanceText(text, {
  context: 'operative_notes'
});
```

### 2. React Components

#### `src/components/MedicalTextInput.tsx`
All-in-one medical text input component with:
- Voice dictation button (microphone icon)
- Document upload button (for OCR)
- Camera capture button
- AI text enhancement button
- Word count display
- Voice command help tooltip

```tsx
import { MedicalTextInput } from '../components/MedicalTextInput';

<MedicalTextInput
  value={notes}
  onChange={setNotes}
  label="Clinical Notes"
  placeholder="Type, dictate, or scan..."
  context="clinical_notes"
  rows={4}
  showWordCount
/>
```

#### `src/components/SpeechToTextInput.tsx`
Standalone speech-to-text textarea component.

#### `src/components/OCRScanner.tsx`
Standalone OCR scanner with preview and editing.

### 3. Backend API

#### `api/ai/enhance-text.js`
AI text enhancement endpoint using OpenAI GPT-4o-mini:
- Falls back to local processing if API unavailable
- Context-specific prompts for medical documentation

## Integration Points

### Forms Updated with MedicalTextInput

1. **WardRoundForm.tsx**
   - Patient Complaints
   - General Appearance
   - Wound Status
   - Drain Output
   - Mobility Status
   - Clinical Impression
   - Complications
   - Treatment Plan Changes
   - Dietary Modifications
   - Activity Orders
   - Nursing Instructions
   - Discharge Plan
   - Additional Notes
   - OCR Extracted Text

2. **AdmissionDischargePage.tsx** (import added)
3. **Procedures.tsx** (import added)

## Available Context Types

For `MedicalTextInput` and `aiTextEnhancementService`:

- `clinical_notes` - General clinical documentation
- `operative_notes` - Surgical procedure notes
- `discharge_summary` - Discharge documentation
- `progress_notes` - SOAP-formatted notes
- `consultation_notes` - Specialty consultations
- `wound_assessment` - Wound care documentation
- `prescription` - Medication orders
- `lab_interpretation` - Lab result interpretation
- `imaging_report` - Radiology reports
- `general` - General text formatting

## Document Types for OCR

- `lab_report` - Laboratory results
- `imaging_report` - X-ray, CT, MRI reports
- `prescription` - Medication prescriptions
- `handwritten_note` - Handwritten clinical notes
- `general` - General documents

## Voice Commands

When dictating, say:
- "period" or "full stop" → .
- "comma" → ,
- "new line" → ↵
- "new paragraph" → ↵↵
- "colon" → :
- "semicolon" → ;
- "question mark" → ?
- "exclamation mark" → !
- "open parenthesis" → (
- "close parenthesis" → )

## Lab Values Automatically Extracted

The OCR service can automatically extract and parse:
- Complete Blood Count (Hb, WBC, RBC, Platelets, MCV, MCH, MCHC)
- Renal Function (Creatinine, Urea, Na+, K+, Cl-, HCO3-)
- Liver Function (AST, ALT, ALP, Bilirubin, Albumin)
- Coagulation (PT, INR, APTT)
- Blood Glucose (FBS, RBS, HbA1c)
- Lipid Profile (Cholesterol, TG, HDL, LDL)
- Thyroid Function (TSH, T3, T4)
- Cardiac Markers (Troponin, BNP, CK)
- Blood Gas (PaO2, PaCO2, pH, Base Excess, Lactate)

## Browser Support

- **Speech Recognition**: Chrome, Edge, Safari (iOS 14.5+)
- **OCR**: All modern browsers
- **Camera Capture**: All browsers with camera permission

## Offline Capability

- Speech recognition requires internet
- OCR works offline (Tesseract.js runs locally)
- AI enhancement has local fallback for basic formatting
