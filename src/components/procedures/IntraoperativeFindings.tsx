import React, { useState } from 'react';
import { procedureService, IntraoperativeFindings } from '../../services/procedureService';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  addFooter
} from '../../utils/pdfUtils';

interface IntraoperativeFindingsFormProps {
  patientId: string;
  procedureId: string;
  onComplete: (findingsId: string) => void;
}

export const IntraoperativeFindingsForm: React.FC<IntraoperativeFindingsFormProps> = ({
  patientId,
  procedureId,
  onComplete
}) => {
  const [findings, setFindings] = useState<Partial<IntraoperativeFindings>>({
    patient_id: patientId,
    procedure_id: procedureId,
    procedure_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    surgical_approach: '',
    anesthesia_type: 'general',
    anesthesia_details: '',
    surgical_findings: '',
    procedure_steps: [],
    complications: [],
    blood_loss: 0,
    transfusions: [],
    surgical_materials: [],
    implants_used: [],
    specimens_collected: [],
    intraoperative_imaging: [],
    intraoperative_photos: [], // Add photos array
    position: '',
    surgical_team: {
      primary_surgeon: '',
      assistant_surgeon: '',
      anesthesiologist: '',
      circulating_nurse: '',
      scrub_nurse: ''
    },
    notes: ''
  });

  const [currentSection, setCurrentSection] = useState('basic_info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]); // Store photo files

  const handleInputChange = (field: string, value: any) => {
    setFindings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (section: string, field: string, value: any) => {
    setFindings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof IntraoperativeFindings],
        [field]: value
      }
    }));
  };

  const handleArrayFieldChange = (field: string, value: string, type: 'string' | 'object' = 'string') => {
    if (type === 'string') {
      const items = value.split('\n').map(item => item.trim()).filter(Boolean);
      handleInputChange(field, items);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles(prev => [...prev, ...files]);

    // Convert files to base64 for storage
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photoData = {
          filename: file.name,
          data: reader.result as string,
          timestamp: new Date().toISOString(),
          size: file.size,
          type: file.type
        };
        setFindings(prev => ({
          ...prev,
          intraoperative_photos: [...(prev.intraoperative_photos || []), photoData]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setFindings(prev => ({
      ...prev,
      intraoperative_photos: (prev.intraoperative_photos || []).filter((_, i) => i !== index)
    }));
  };

  const generatePostoperativeNote = () => {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 0;
    
    // Helper to sanitize text
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    // Header - UNTH Branding
    doc.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.sectionHeader);
    doc.text('ITUKU-OZALLA, ENUGU', pageWidth / 2, 22, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.subHeader);
    doc.text('Department of Plastic & Reconstructive Surgery', pageWidth / 2, 29, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.title);
    doc.setFont('times', 'bold');
    doc.text('POSTOPERATIVE CARE PLAN & MANAGEMENT', pageWidth / 2, 38, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.text('Generated: ' + new Date().toLocaleDateString('en-NG'), pageWidth / 2, 45, { align: 'center' });

    yPosition = 60;
    doc.setTextColor(0, 0, 0);

    // Patient & Procedure Information
    doc.setFillColor(243, 244, 246);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFontSize(PDF_FONT_SIZES.subHeader);
    doc.setFont('times', 'bold');
    doc.text('PATIENT & PROCEDURE INFORMATION', PDF_MARGINS.left, yPosition + 6);
    yPosition += 12;

    doc.setFontSize(PDF_FONT_SIZES.small);
    doc.setFont('times', 'normal');
    const patientInfo = [
      'Patient ID: ' + clean(patientId),
      'Procedure ID: ' + clean(procedureId),
      'Procedure Date: ' + clean(findings.procedure_date) || 'N/A',
      'Procedure Time: ' + (clean(findings.start_time) || 'N/A') + ' - ' + (clean(findings.end_time) || 'N/A'),
      'Surgical Approach: ' + clean(findings.surgical_approach) || 'N/A',
      'Anesthesia Type: ' + clean(findings.anesthesia_type) || 'General',
      'Primary Surgeon: ' + clean(findings.surgical_team?.primary_surgeon) || 'N/A',
      'Assistant Surgeon: ' + clean(findings.surgical_team?.assistant_surgeon) || 'N/A',
      'Anesthesiologist: ' + clean(findings.surgical_team?.anesthesiologist) || 'N/A'
    ];
    
    patientInfo.forEach(info => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(info, 15, yPosition);
      yPosition += 5;
    });
    yPosition += 5;

    // Operative Summary
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('📋 OPERATIVE SUMMARY', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    
    if (findings.surgical_findings) {
      doc.setFont('times', 'bold');
      doc.text('Surgical Findings:', 15, yPosition);
      yPosition += 5;
      doc.setFont('times', 'normal');
      const findingsLines = doc.splitTextToSize(findings.surgical_findings, pageWidth - 30);
      findingsLines.forEach((line: string) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 15, yPosition);
        yPosition += 4.5;
      });
      yPosition += 5;
    }

    if (findings.procedure_steps && findings.procedure_steps.length > 0) {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFont('times', 'bold');
      doc.text('Procedure Steps:', 15, yPosition);
      yPosition += 5;
      doc.setFont('times', 'normal');
      findings.procedure_steps.forEach((step, index) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        const stepText = `${index + 1}. ${step}`;
        const stepLines = doc.splitTextToSize(stepText, pageWidth - 30);
        stepLines.forEach((line: string) => {
          doc.text(line, 15, yPosition);
          yPosition += 4.5;
        });
      });
      yPosition += 5;
    }

    if (findings.blood_loss !== undefined && findings.blood_loss > 0) {
      doc.setFont('times', 'bold');
      doc.text(`Estimated Blood Loss: ${findings.blood_loss} ml`, 15, yPosition);
      yPosition += 6;
    }

    if (findings.complications && findings.complications.length > 0) {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFont('times', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('⚠️ Intraoperative Complications:', 15, yPosition);
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
      doc.setFont('times', 'normal');
      findings.complications.forEach(complication => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        const compLines = doc.splitTextToSize(`• ${complication}`, pageWidth - 30);
        compLines.forEach((line: string) => {
          doc.text(line, 15, yPosition);
          yPosition += 4.5;
        });
      });
      yPosition += 5;
    }

    // POSTOPERATIVE CARE PLAN
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(14, 159, 110); // Green
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('🏥 COMPREHENSIVE POSTOPERATIVE CARE PLAN', 15, yPosition + 6);
    yPosition += 14;
    doc.setTextColor(0, 0, 0);

    // Immediate Postoperative Orders
    doc.setFillColor(254, 243, 199); // Light yellow
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text('⏱️ IMMEDIATE POSTOPERATIVE ORDERS (0-24 Hours)', 15, yPosition + 6);
    yPosition += 12;

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const immediateOrders = [
      '✓ Transfer to Post-Anesthesia Care Unit (PACU) / Recovery Room',
      '✓ Continuous monitoring: Vital signs every 15 minutes × 1 hour, then every 30 minutes × 2 hours, then hourly',
      '✓ Monitor: Blood pressure, heart rate, respiratory rate, SpO2, temperature, pain score, consciousness level',
      '✓ Keep patient NPO (nil per os) until fully awake and bowel sounds present',
      '✓ Head of bed elevated 30-45 degrees (unless contraindicated)',
      '✓ Oxygen supplementation as needed to maintain SpO2 >95%',
      '✓ Monitor surgical site for bleeding, swelling, hematoma formation',
      '✓ Check dressing and drains (if placed) - document output',
      '✓ Assess neurovascular status distal to surgical site',
      '✓ Urinary output monitoring (catheter if prolonged surgery)'
    ];

    immediateOrders.forEach(order => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      const lines = doc.splitTextToSize(order, pageWidth - 30);
      lines.forEach((line: string) => {
        doc.text(line, 15, yPosition);
        yPosition += 4.5;
      });
    });
    yPosition += 8;

    // MEDICATIONS SECTION
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(220, 38, 38); // Red
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('💊 POSTOPERATIVE MEDICATIONS', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    // 1. Intravenous Fluids
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('1️⃣ INTRAVENOUS FLUIDS', 15, yPosition);
    yPosition += 6;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const ivFluids = [
      '💧 Maintenance Fluids:',
      '   • Normal Saline 0.9% or Ringer\'s Lactate',
      '   • Rate: 80-100 ml/hour (adjust based on patient weight and urine output)',
      '   • Add 5% Dextrose if NPO >4 hours to prevent hypoglycemia',
      '',
      '💧 Fluid Balance Goals:',
      '   • Urine output: >0.5 ml/kg/hour (minimum 30 ml/hour)',
      '   • Maintain euvolemia - avoid both dehydration and fluid overload',
      '   • Monitor intake/output chart strictly',
      '   • Daily weight monitoring',
      '',
      '💧 Electrolyte Supplementation (as needed):',
      '   • Potassium Chloride 20-40 mEq/L (if K+ <3.5 mEq/L)',
      '   • Magnesium Sulfate 1-2g IV (if Mg <1.5 mg/dL)',
      '   • Calcium Gluconate 1g IV slowly (if symptomatic hypocalcemia)'
    ];

    ivFluids.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 6;

    // 2. Antibiotics
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(147, 51, 234);
    doc.text('2️⃣ ANTIBIOTICS (Prophylaxis & Treatment)', 15, yPosition);
    yPosition += 6;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const antibiotics = [
      '🦠 First-Line Regimen (Clean/Clean-Contaminated Surgery):',
      '   • Ceftriaxone 1-2g IV every 12-24 hours',
      '   • OR Cefazolin 1-2g IV every 8 hours',
      '   • Duration: 24-48 hours postoperatively (single dose may suffice for clean cases)',
      '',
      '🦠 Extended Spectrum (Contaminated Surgery or High Risk):',
      '   • Ceftriaxone 2g IV every 12 hours',
      '   • PLUS Metronidazole 500mg IV every 8 hours (for anaerobic coverage)',
      '   • OR Piperacillin-Tazobactam 4.5g IV every 8 hours',
      '   • Duration: 3-5 days or until clinical improvement',
      '',
      '🦠 Penicillin Allergy Alternative:',
      '   • Clindamycin 600-900mg IV every 8 hours',
      '   • PLUS Gentamicin 5mg/kg IV every 24 hours (monitor renal function)',
      '   • OR Ciprofloxacin 400mg IV every 12 hours',
      '',
      '🦠 Antibiotic Stewardship:',
      '   • Re-evaluate daily - discontinue if no signs of infection',
      '   • Culture-driven therapy if infection suspected',
      '   • Monitor for side effects and Clostridioides difficile infection'
    ];

    antibiotics.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 6;

    // 3. Analgesics
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(249, 115, 22);
    doc.text('3️⃣ ANALGESICS (Multimodal Pain Management)', 15, yPosition);
    yPosition += 6;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const analgesics = [
      '💉 Opioid Analgesics (for moderate-severe pain):',
      '   • Tramadol 50-100mg IV/IM every 6-8 hours PRN (max 400mg/day)',
      '   • OR Morphine 5-10mg IV/IM every 4-6 hours PRN (titrate to effect)',
      '   • OR Pethidine 50-100mg IV/IM every 4-6 hours PRN',
      '   • Monitor: Respiratory rate, sedation, nausea/vomiting',
      '   • Transition to oral formulations as soon as patient tolerates PO',
      '',
      '💊 Non-Opioid Analgesics:',
      '   • Paracetamol (Acetaminophen) 1g IV every 6 hours (max 4g/day)',
      '   • Continue even if opioids used (opioid-sparing effect)',
      '   • Safe, effective baseline analgesia',
      '',
      '💊 Adjuvant Analgesia:',
      '   • Local anesthetic infiltration at surgical site (long-acting)',
      '   • Regional blocks if applicable (nerve blocks, wound catheters)',
      '',
      '📊 Pain Assessment:',
      '   • Use numeric pain scale (0-10) or visual analog scale',
      '   • Assess pain at rest and with movement',
      '   • Target pain score: <4/10 at rest, <6/10 with movement',
      '   • Document pain scores every 4 hours minimum'
    ];

    analgesics.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 6;

    // 4. Anti-inflammatory Agents
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(14, 159, 110);
    doc.text('4️⃣ ANTI-INFLAMMATORY AGENTS', 15, yPosition);
    yPosition += 6;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const antiInflammatory = [
      '🔥 NSAIDs (Use with caution - assess bleeding risk):',
      '   • Diclofenac 75mg IM every 12 hours (if no contraindications)',
      '   • OR Ketorolac 30mg IV every 6 hours (max 5 days)',
      '   • Contraindications: Active bleeding, renal impairment, peptic ulcer disease',
      '   • Monitor: Renal function, GI symptoms, bleeding',
      '',
      '🔥 Corticosteroids (if indicated - for swelling/inflammation):',
      '   • Dexamethasone 4-8mg IV once (intraoperative or immediate postop)',
      '   • Reduces postoperative nausea, pain, and swelling',
      '   • Use judiciously - may impair wound healing if prolonged',
      '',
      '🛡️ Gastroprotection (if NSAIDs used):',
      '   • Omeprazole 40mg IV/PO daily',
      '   • OR Ranitidine 50mg IV every 8 hours'
    ];

    antiInflammatory.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 6;

    // 5. Vitamins & Minerals
    if (yPosition > pageHeight - 70) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(234, 179, 8);
    doc.text('5️⃣ VITAMINS & MINERALS (Wound Healing & Recovery)', 15, yPosition);
    yPosition += 6;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const vitamins = [
      '💊 Essential Vitamins:',
      '   • Vitamin C (Ascorbic Acid) 500-1000mg PO/IV daily',
      '     - Essential for collagen synthesis and wound healing',
      '   • Vitamin A 10,000-25,000 IU PO daily',
      '     - Promotes epithelialization, immune function',
      '   • Vitamin E 400 IU PO daily (optional)',
      '     - Antioxidant, may reduce scarring',
      '   • Vitamin D3 1000-2000 IU PO daily',
      '     - Bone health, immune function, wound healing',
      '',
      '💊 B-Complex Vitamins:',
      '   • Vitamin B Complex (B1, B6, B12) 1-2 tablets PO daily',
      '     - Energy metabolism, nerve function, red blood cell production',
      '   • OR B-Complex IV infusion (especially if malnourished/NPO)',
      '',
      '💊 Essential Minerals:',
      '   • Zinc Sulfate 220mg (50mg elemental zinc) PO daily',
      '     - Critical for wound healing, immune function, protein synthesis',
      '   • Iron supplementation (if anemic):',
      '     - Ferrous Sulfate 325mg PO 2-3 times daily',
      '     - OR Iron Sucrose 100-200mg IV (if unable to tolerate oral)',
      '   • Calcium Carbonate 500-1000mg PO daily (if needed)',
      '     - Bone health, muscle function',
      '',
      '💊 Multivitamin:',
      '   • Comprehensive multivitamin 1 tablet PO daily',
      '   • Ensures baseline micronutrient requirements met',
      '',
      '⚠️ Monitoring:',
      '   • Baseline and periodic serum levels if high-dose supplementation',
      '   • Adjust doses based on nutritional status and lab results'
    ];

    vitamins.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 6;

    // 6. Additional Medications
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('6️⃣ ADDITIONAL MEDICATIONS', 15, yPosition);
    yPosition += 6;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const additionalMeds = [
      '🤢 Antiemetics (for nausea/vomiting):',
      '   • Ondansetron 4-8mg IV every 8 hours PRN',
      '   • Metoclopramide 10mg IV every 8 hours PRN',
      '   • Promethazine 12.5-25mg IV/IM every 4-6 hours PRN',
      '',
      '💩 Laxatives (prevent constipation, especially with opioids):',
      '   • Bisacodyl 10mg PO/PR daily PRN',
      '   • Lactulose 15-30ml PO twice daily PRN',
      '   • Docusate Sodium 100mg PO twice daily',
      '',
      '🩸 DVT Prophylaxis (thromboprophylaxis):',
      '   • Enoxaparin 40mg SC daily (start 12-24 hours postop if no bleeding)',
      '   • OR Heparin 5000 units SC every 8-12 hours',
      '   • Continue until patient fully mobile or as per protocol',
      '   • Add mechanical prophylaxis: Sequential compression devices (SCDs)',
      '',
      '😴 Sedation/Anxiolysis (if needed):',
      '   • Diazepam 5-10mg PO/IV at bedtime PRN',
      '   • Use sparingly, monitor for respiratory depression',
      '',
      '🩹 Wound Care:',
      '   • Topical antibiotic ointment (if indicated)',
      '   • Silver sulfadiazine cream for burn/graft sites',
      '   • Hydrogel dressings for moist wound healing'
    ];

    additionalMeds.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 8;

    // NURSING CARE & MONITORING
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(14, 159, 110);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('👩‍�-️ NURSING CARE & MONITORING', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const nursingCare = [
      '✅ Vital Signs Monitoring:',
      '   • Every 15 min × 1 hour → Every 30 min × 2 hours → Hourly × 24 hours → Every 4 hours',
      '   • Record: BP, HR, RR, SpO2, Temperature, Pain Score, Consciousness Level',
      '',
      '✅ Wound Care:',
      '   • Inspect surgical site every shift for: bleeding, swelling, redness, discharge',
      '   • Keep dressing clean, dry, and intact for first 24-48 hours',
      '   • Change dressing as per protocol or if soiled/saturated',
      '   • Document wound appearance (color, approximation, drainage)',
      '',
      '✅ Drain Management (if applicable):',
      '   • Monitor and record drain output every 4-8 hours',
      '   • Note color and consistency of drainage',
      '   • Maintain suction if prescribed',
      '   • Remove when output <30ml/24 hours (or per surgeon order)',
      '',
      '✅ Fluid Balance:',
      '   • Strict intake/output charting',
      '   • Monitor urine output (target >30ml/hour or 0.5ml/kg/hour)',
      '   • Daily weight',
      '',
      '✅ Respiratory Care:',
      '   • Encourage deep breathing exercises every 2 hours',
      '   • Incentive spirometry if applicable',
      '   • Early mobilization to prevent atelectasis',
      '',
      '✅ Nutrition:',
      '   • Start clear liquids when awake and bowel sounds present',
      '   • Advance diet as tolerated: Clear liquids → Full liquids → Soft diet → Regular diet',
      '   • Monitor for nausea, vomiting, abdominal distension',
      '',
      '✅ Mobilization:',
      '   • Sit in chair within 6-12 hours if stable',
      '   • Ambulate within 24 hours unless contraindicated',
      '   • Gradually increase activity as tolerated'
    ];

    nursingCare.forEach(line => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 15, yPosition);
      yPosition += 4.5;
    });
    yPosition += 8;

    // DISCHARGE CRITERIA
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(59, 130, 246);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('🏠 DISCHARGE CRITERIA', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const dischargeCriteria = [
      '✓ Vital signs stable and within normal limits',
      '✓ Pain adequately controlled with oral medications',
      '✓ No signs of active bleeding or hematoma',
      '✓ No fever (temperature <38°C)',
      '✓ Tolerating oral diet and fluids',
      '✓ Passing urine (if catheter removed)',
      '✓ Ambulating independently or with minimal assistance',
      '✓ Wound healing appropriately, no signs of infection',
      '✓ Patient/family educated on wound care, medications, warning signs',
      '✓ Follow-up appointment scheduled',
      '✓ Prescriptions provided for home medications',
      '✓ Transportation arranged'
    ];

    dischargeCriteria.forEach(criterion => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(criterion, 15, yPosition);
      yPosition += 5;
    });
    yPosition += 8;

    // WARNING SIGNS
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(220, 38, 38);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('⚠️ WARNING SIGNS - SEEK IMMEDIATE MEDICAL ATTENTION', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const warningSigns = [
      '🚨 Fever >38.5°C or chills',
      '🚨 Severe or worsening pain not relieved by medications',
      '🚨 Excessive bleeding or hematoma formation at surgical site',
      '🚨 Wound dehiscence (opening of surgical incision)',
      '🚨 Signs of infection: Redness, warmth, swelling, purulent discharge, foul odor',
      '🚨 Difficulty breathing, chest pain',
      '🚨 Leg pain, swelling, redness (DVT signs)',
      '🚨 Nausea/vomiting preventing oral intake',
      '🚨 No urine output for >8 hours',
      '🚨 Altered mental status, confusion, severe drowsiness'
    ];

    warningSigns.forEach(sign => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(sign, 15, yPosition);
      yPosition += 5;
    });
    yPosition += 8;

    // FOLLOW-UP
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(147, 51, 234);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.text('📅 FOLLOW-UP PLAN', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const followUp = [
      '📍 Wound Check: 3-5 days post-discharge (or as instructed)',
      '📍 Suture/Staple Removal: 7-14 days (depending on location)',
      '📍 Surgeon Follow-up: 2 weeks post-operatively',
      '📍 Long-term Follow-up: As scheduled by surgeon',
      '',
      '📞 Contact Information:',
      '   • PLASTIC AND RECONSTRUCTIVE SURGERY UNIT Clinic: [Phone Number]',
      '   • Emergency: [Emergency Number]',
      '   • After-hours: [On-call Number]'
    ];

    followUp.forEach(item => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(item, 15, yPosition);
      yPosition += 5;
    });

    // Add professional footer with page numbers and timestamp
    addFooter(doc);

    // Save PDF
    const fileName = `UNTH_PostopNote_${procedureId}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Thermal 80mm postoperative note
  const generateThermalPostoperativeNote = async () => {
    const { jsPDF } = await import('jspdf');
    const thermalWidth = 80;
    const m = 3;
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    let estHeight = 200;
    estHeight += (findings.operative_findings?.length || 0) * 0.12;
    estHeight += (findings.postoperative_instructions?.length || 0) * 0.12;
    estHeight = Math.max(estHeight, 250);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
    let y = m;

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('POSTOP CARE PLAN', thermalWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('times', 'normal');
    doc.text('UNTH Plastic Surgery', thermalWidth / 2, y, { align: 'center' });
    y += 4;
    doc.line(m, y, thermalWidth - m, y);
    y += 3;

    doc.setFontSize(9);
    doc.text('Patient ID: ' + clean(patientId), m, y); y += 3.5;
    doc.text('Procedure: ' + clean(procedureId), m, y); y += 3.5;
    doc.text('Date: ' + (clean(findings.procedure_date) || new Date().toLocaleDateString()), m, y); y += 3.5;
    doc.text('Surgeon: ' + clean(findings.surgical_team?.primary_surgeon), m, y); y += 4;
    doc.line(m, y, thermalWidth - m, y);
    y += 3;

    const addThermalSection = (title: string, content: string | undefined) => {
      if (!content) return;
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text(title, m, y); y += 4;
      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      const lines = doc.splitTextToSize(clean(content), thermalWidth - m * 2);
      lines.forEach((line: string) => { doc.text(line, m, y); y += 3.5; });
      y += 2;
    };

    addThermalSection('APPROACH', findings.surgical_approach);
    addThermalSection('ANESTHESIA', findings.anesthesia_type);
    addThermalSection('FINDINGS', findings.operative_findings);
    addThermalSection('WOUND CLOSURE', findings.wound_closure_details);
    addThermalSection('DRAINS', findings.drains_placed);
    addThermalSection('EST. BLOOD LOSS', findings.estimated_blood_loss);
    addThermalSection('POSTOP INSTRUCTIONS', findings.postoperative_instructions);

    if (findings.specimens_sent) {
      addThermalSection('SPECIMENS', findings.specimens_sent);
    }

    doc.save(`PostopNote_Thermal_${procedureId}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const submitFindings = async () => {
    setIsSubmitting(true);
    try {
      const findingsId = await procedureService.createIntraoperativeFindings(findings as IntraoperativeFindings);
      onComplete(findingsId);
    } catch (error) {
      console.error('Failed to save intraoperative findings:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Basic Procedure Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Procedure Date
          </label>
          <input
            type="date"
            value={findings.procedure_date || ''}
            onChange={(e) => handleInputChange('procedure_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            title="Procedure date"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Time
          </label>
          <input
            type="time"
            value={findings.start_time || ''}
            onChange={(e) => handleInputChange('start_time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            title="Procedure start time"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Time
          </label>
          <input
            type="time"
            value={findings.end_time || ''}
            onChange={(e) => handleInputChange('end_time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            title="Procedure end time"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient Position
          </label>
          <select
            value={findings.position || ''}
            onChange={(e) => handleInputChange('position', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            title="Select patient position"
          >
            <option value="">Select Position</option>
            <option value="supine">Supine</option>
            <option value="prone">Prone</option>
            <option value="lateral">Lateral</option>
            <option value="fowler">Fowler's</option>
            <option value="trendelenburg">Trendelenburg</option>
            <option value="lithotomy">Lithotomy</option>
            <option value="sitting">Sitting</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Anesthesia Type
          </label>
          <select
            value={findings.anesthesia_type || 'general'}
            onChange={(e) => handleInputChange('anesthesia_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            title="Select anesthesia type"
          >
            <option value="general">General Anesthesia</option>
            <option value="regional">Regional Anesthesia</option>
            <option value="local">Local Anesthesia</option>
            <option value="sedation">Conscious Sedation</option>
            <option value="combined">Combined Technique</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Blood Loss (mL)
          </label>
          <input
            type="number"
            value={findings.blood_loss || ''}
            onChange={(e) => handleInputChange('blood_loss', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Surgical Approach
          </label>
          <textarea
            value={findings.surgical_approach || ''}
            onChange={(e) => handleInputChange('surgical_approach', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the surgical approach, incision type, access method..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Anesthesia Details
          </label>
          <textarea
            value={findings.anesthesia_details || ''}
            onChange={(e) => handleInputChange('anesthesia_details', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Anesthetic agents, monitoring, special techniques..."
          />
        </div>
      </div>
    </div>
  );

  const renderSurgicalTeam = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Surgical Team</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Surgeon
          </label>
          <input
            type="text"
            value={findings.surgical_team?.primary_surgeon || ''}
            onChange={(e) => handleNestedInputChange('surgical_team', 'primary_surgeon', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter surgeon name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assistant Surgeon
          </label>
          <input
            type="text"
            value={findings.surgical_team?.assistant_surgeon || ''}
            onChange={(e) => handleNestedInputChange('surgical_team', 'assistant_surgeon', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter assistant surgeon name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Anesthesiologist
          </label>
          <input
            type="text"
            value={findings.surgical_team?.anesthesiologist || ''}
            onChange={(e) => handleNestedInputChange('surgical_team', 'anesthesiologist', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter anesthesiologist name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Circulating Nurse
          </label>
          <input
            type="text"
            value={findings.surgical_team?.circulating_nurse || ''}
            onChange={(e) => handleNestedInputChange('surgical_team', 'circulating_nurse', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter circulating nurse name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scrub Nurse
          </label>
          <input
            type="text"
            value={findings.surgical_team?.scrub_nurse || ''}
            onChange={(e) => handleNestedInputChange('surgical_team', 'scrub_nurse', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter scrub nurse name"
          />
        </div>
      </div>
    </div>
  );

  const renderFindings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Surgical Findings & Procedure</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Surgical Findings
        </label>
        <textarea
          value={findings.surgical_findings || ''}
          onChange={(e) => handleInputChange('surgical_findings', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Describe key intraoperative findings, tissue appearance, pathology observed..."
        />
      </div>

      {/* Intraoperative Photographs Upload */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
        <div className="flex items-center mb-4">
          <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <label className="block text-lg font-semibold text-gray-900">
            Intraoperative Photographs
          </label>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Upload multiple photographs documenting surgical findings, procedure steps, and final results. 
          Supported formats: JPEG, PNG (Max 10MB per photo)
        </p>

        <div className="mb-4">
          <label className="flex items-center justify-center w-full px-4 py-6 bg-white border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all">
            <div className="flex flex-col items-center">
              <svg className="h-12 w-12 text-blue-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Click to upload photos</span>
              <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
            </div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/jpg"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Photo Preview Grid */}
        {photoFiles.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-semibold text-gray-700 mb-3">
              Uploaded Photos ({photoFiles.length})
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photoFiles.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Intraoperative photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center">
                    <button
                      onClick={() => removePhoto(index)}
                      className="opacity-0 group-hover:opacity-100 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition-all"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-600 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {photoFiles.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 italic">No photos uploaded yet</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Procedure Steps (One per line)
        </label>
        <textarea
          value={findings.procedure_steps?.join('\n') || ''}
          onChange={(e) => handleArrayFieldChange('procedure_steps', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder={`Step 1: Incision and exposure
Step 2: Dissection and identification
Step 3: Main procedure...`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Complications (One per line, if any)
        </label>
        <textarea
          value={findings.complications?.join('\n') || ''}
          onChange={(e) => handleArrayFieldChange('complications', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="List any intraoperative complications or unexpected events..."
        />
      </div>
    </div>
  );

  const renderMaterials = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Materials & Specimens</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Surgical Materials Used (One per line)
          </label>
          <textarea
            value={findings.surgical_materials?.join('\n') || ''}
            onChange={(e) => handleArrayFieldChange('surgical_materials', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder={`Sutures: 3-0 Vicryl
Mesh: Polypropylene 15x10cm
Drains: 10Fr Blake...`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Implants Used (One per line)
          </label>
          <textarea
            value={findings.implants_used?.join('\n') || ''}
            onChange={(e) => handleArrayFieldChange('implants_used', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder={`Breast implant: Silicone 450cc
Serial number: ABC123456...`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transfusions Given (One per line)
          </label>
          <textarea
            value={findings.transfusions?.join('\n') || ''}
            onChange={(e) => handleArrayFieldChange('transfusions', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder={`PRBC: 2 units
FFP: 1 unit...`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specimens Collected (One per line)
          </label>
          <textarea
            value={findings.specimens_collected?.join('\n') || ''}
            onChange={(e) => handleArrayFieldChange('specimens_collected', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder={`Tissue biopsy: Left breast mass
Lymph node: Sentinel node...`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Intraoperative Imaging (One per line)
        </label>
        <textarea
          value={findings.intraoperative_imaging?.join('\n') || ''}
          onChange={(e) => handleArrayFieldChange('intraoperative_imaging', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder={`Fluoroscopy: Implant position confirmed
X-ray: Hardware placement verified...`}
        />
      </div>
    </div>
  );

  const renderNotes = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Additional Notes</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Operative Notes
        </label>
        <textarea
          value={findings.notes || ''}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Any additional relevant information, special considerations, patient tolerance, communication with family, etc..."
        />
      </div>

      {/* AI-Powered Postoperative Note Generator */}
      <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-2xl">
              🤖
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-gray-900 mb-2">
              Postoperative Care Plan
            </h4>
            <p className="text-sm text-gray-700 mb-4">
              Generate a comprehensive, intelligent postoperative note and care plan based on the intraoperative findings. 
              Includes detailed medication protocols (IV fluids, antibiotics, analgesics, anti-inflammatory agents, vitamins/minerals), 
              nursing care instructions, monitoring parameters, discharge criteria, and follow-up plan.
            </p>
            <div className="bg-white rounded-md p-3 mb-4 border border-green-200">
              <p className="text-xs text-gray-600 mb-2"><strong>This comprehensive document will include:</strong></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-500">💧</span>
                  <span>Intravenous Fluids & Electrolytes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-purple-500">🦠</span>
                  <span>Antibiotic Prophylaxis & Treatment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-orange-500">💉</span>
                  <span>Multimodal Pain Management</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">🔥</span>
                  <span>Anti-inflammatory Agents & NSAIDs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-500">💊</span>
                  <span>Vitamins & Minerals for Healing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">👩‍�-️</span>
                  <span>Nursing Care & Monitoring Protocols</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">🏠</span>
                  <span>Discharge Criteria & Instructions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-red-500">⚠️</span>
                  <span>Warning Signs & Emergency Contact</span>
                </div>
              </div>
            </div>
            <button
              onClick={generatePostoperativeNote}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
            >
              <span className="text-xl">🤖</span>
              <span>Generate Postoperative Note & Care Plan (PDF)</span>
              <span className="text-xl">📄</span>
            </button>
            <button
              onClick={generateThermalPostoperativeNote}
              className="w-full mt-2 bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-all duration-200 shadow-sm flex items-center justify-center space-x-2"
              title="Thermal Print (80mm)"
            >
              <span>Thermal Print (80mm)</span>
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              ⚡ Powered by evidence-based clinical protocols | Customized to your surgical findings
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const sections = [
    { id: 'basic_info', name: 'Basic Info', icon: '📋' },
    { id: 'surgical_team', name: 'Surgical Team', icon: '👥' },
    { id: 'findings', name: 'Findings & Procedure', icon: '🔍' },
    { id: 'materials', name: 'Materials & Specimens', icon: '🧰' },
    { id: 'notes', name: 'Additional Notes', icon: '📝' }
  ];

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'basic_info':
        return renderBasicInfo();
      case 'surgical_team':
        return renderSurgicalTeam();
      case 'findings':
        return renderFindings();
      case 'materials':
        return renderMaterials();
      case 'notes':
        return renderNotes();
      default:
        return renderBasicInfo();
    }
  };

  const calculateDuration = () => {
    if (findings.start_time && findings.end_time) {
      const start = new Date(`2000-01-01T${findings.start_time}`);
      const end = new Date(`2000-01-01T${findings.end_time}`);
      const diff = (end.getTime() - start.getTime()) / (1000 * 60); // minutes
      if (diff > 0) {
        const hours = Math.floor(diff / 60);
        const minutes = Math.floor(diff % 60);
        return `${hours}h ${minutes}m`;
      }
    }
    return 'Not calculated';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Intraoperative Findings</h2>
            <p className="text-gray-600 mt-1">Comprehensive surgical procedure documentation</p>
          </div>
          
          <div className="text-right text-sm text-gray-500">
            <div>Duration: {calculateDuration()}</div>
            <div>Date: {findings.procedure_date}</div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {renderCurrentSection()}

        <div className="mt-8 flex justify-between">
          <button
            onClick={() => {
              const currentIndex = sections.findIndex(s => s.id === currentSection);
              if (currentIndex > 0) {
                setCurrentSection(sections[currentIndex - 1].id);
              }
            }}
            disabled={sections.findIndex(s => s.id === currentSection) === 0}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Section
          </button>
          
          {sections.findIndex(s => s.id === currentSection) === sections.length - 1 ? (
            <button
              onClick={submitFindings}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving Findings...' : 'Complete Documentation'}
            </button>
          ) : (
            <button
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === currentSection);
                if (currentIndex < sections.length - 1) {
                  setCurrentSection(sections[currentIndex + 1].id);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next Section
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
