import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, AlertCircle, ArrowRight, Bell, Calendar, CheckCircle, ChevronDown, ChevronUp,
  Clock, ClipboardList, Download, FileText, Heart, Info, Loader2, Minus, Plus, Printer,
  RefreshCw, Ruler, Save, Search, Share2, Trash2, TrendingDown, TrendingUp, Upload, User, X
} from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { patientService } from '../services/patientService';
import { getCurrentUserName } from '../utils/getCurrentUser';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';

// ============================================
// TYPES & INTERFACES
// ============================================

interface Patient {
  id: string | number;
  hospital_number: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}

/** ISL (International Society of Lymphology) Stage */
type ISLStage = 0 | 1 | 2 | '2late' | 3;

/** Campisi Clinical Stage */
type CampisiStage = 'IA' | 'IB' | 'II' | 'IIIA' | 'IIIB' | 'IV' | 'V';

/** Lymphedema etiology */
type LymphedemaEtiology =
  | 'primary_congenital' | 'primary_praecox' | 'primary_tarda'
  | 'secondary_surgical' | 'secondary_radiation' | 'secondary_infection'
  | 'secondary_trauma' | 'secondary_filariasis' | 'secondary_malignancy'
  | 'secondary_obesity' | 'secondary_cvi' | 'secondary_other';

/** CDT Phase */
type CDTPhase = 'intensive' | 'maintenance';

/** Treatment timeline phase */
type TimelinePhase =
  | 'initial_assessment' | 'cdt_intensive' | 'cdt_transition' | 'cdt_maintenance'
  | 'surgical_evaluation' | 'preoperative' | 'surgical' | 'postoperative_acute'
  | 'postoperative_subacute' | 'postoperative_longterm';

/** Circumferential limb measurement */
interface LimbMeasurement {
  location: string;       // e.g. "hand", "wrist", "forearm_10cm", "forearm_20cm", etc.
  affected_cm: number;
  contralateral_cm: number;
  difference_cm: number;
  difference_pct: number;
}

/** Full assessment */
interface LymphedemaAssessment {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  assessment_date: Date;
  assessed_by: string;

  // History
  etiology: LymphedemaEtiology;
  affected_limb: 'left_upper' | 'right_upper' | 'left_lower' | 'right_lower' | 'bilateral_upper' | 'bilateral_lower' | 'genital' | 'head_neck';
  onset_date?: string;
  duration_months: number;
  prior_treatments: string[];
  comorbidities: string[];
  cancer_history: string;
  radiation_history: boolean;
  lymph_node_dissection: boolean;
  recurrent_cellulitis_episodes: number;

  // Examination
  limb_measurements: LimbMeasurement[];
  volume_affected_ml: number;
  volume_contralateral_ml: number;
  volume_difference_pct: number;
  skin_changes: string[];
  stemmer_sign: boolean;
  pitting: 'none' | 'mild' | 'moderate' | 'severe';
  fibrosis: 'none' | 'mild' | 'moderate' | 'severe';
  papillomatosis: boolean;
  lymphorrhea: boolean;
  fungal_infection: boolean;
  wounds_present: boolean;

  // Scoring & Staging
  isl_stage: ISLStage;
  campisi_stage: CampisiStage;
  lefs_score?: number;           // Lower Extremity Functional Scale (0-80)
  dash_score?: number;           // DASH score for upper limb (0-100)
  quality_of_life_score?: number; // LYMQOL (0-10)

  // Treatment Plan
  cdt_phase: CDTPhase;
  current_timeline_phase: TimelinePhase;
  treatment_plan: TreatmentPlanData;
  surgical_candidate: boolean;
  surgical_criteria_met: string[];
  surgical_criteria_not_met: string[];

  // Status
  status: 'active' | 'completed' | 'follow-up';
  notes: string;
  created_at: Date;
  updated_at: Date;
}

interface TreatmentPlanData {
  mld_frequency: string;
  bandaging_type: string;
  exercise_program: string[];
  skin_care_regimen: string[];
  compression_garment: string;
  compression_class: 'I' | 'II' | 'III' | 'IV';
  pneumatic_compression: boolean;
  surgical_procedure?: string;
  surgical_date?: string;
  follow_up_schedule: string[];
}

// ============================================
// CLINICAL REFERENCE DATA
// ============================================

const ISL_STAGES: Record<string, { name: string; description: string; criteria: string[]; color: string }> = {
  '0': {
    name: 'Stage 0 (Subclinical / Latent)',
    description: 'Impaired lymph transport, no visible swelling. May persist months/years before overt edema.',
    criteria: [
      'No clinically apparent edema',
      'Subtle changes in tissue fluid & composition',
      'May be detected by bioimpedance spectroscopy (BIS)',
      'Lymphoscintigraphy shows impaired transport',
      'Subjective heaviness or tightness may be present'
    ],
    color: 'bg-blue-50 border-blue-200 text-blue-800'
  },
  '1': {
    name: 'Stage I (Spontaneously Reversible)',
    description: 'Early accumulation of protein-rich fluid. Subsides with elevation. Pitting may occur.',
    criteria: [
      'Visible/palpable edema, protein-rich',
      'Pitting present',
      'Reduces with limb elevation (overnight)',
      'Stemmer sign may be negative',
      'No fibrosis yet',
      'Volume difference 10-20% compared to contralateral'
    ],
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  },
  '2': {
    name: 'Stage II (Spontaneously Irreversible)',
    description: 'Elevation alone rarely reduces swelling. Tissue fibrosis developing.',
    criteria: [
      'Swelling does NOT resolve with elevation alone',
      'Progressive tissue fibrosis',
      'Pitting may or may not be present',
      'Stemmer sign positive',
      'Volume difference 20-40%',
      'Skin thickening beginning',
      'Recurrent cellulitis risk increasing'
    ],
    color: 'bg-orange-50 border-orange-200 text-orange-800'
  },
  '2late': {
    name: 'Stage II (Late)',
    description: 'Advanced Stage II with non-pitting fibrotic tissue.',
    criteria: [
      'Non-pitting predominates',
      'Significant fibrosis present',
      'Elevation ineffective',
      'Volume difference >30%',
      'Frequent cellulitis episodes'
    ],
    color: 'bg-orange-100 border-orange-300 text-orange-900'
  },
  '3': {
    name: 'Stage III (Lymphostatic Elephantiasis)',
    description: 'Most advanced stage. Large volume increase with trophic skin changes.',
    criteria: [
      'Massive swelling (elephantiasis)',
      'Volume difference >40%',
      'Skin changes: papillomatosis, hyperkeratosis',
      'Deep skin folds with chronic moisture',
      'Recurrent cellulitis/lymphangitis',
      'Lymphorrhea (lymph fluid weeping)',
      'Fat deposition and fibrosis',
      'Significant functional impairment',
      'Stemmer sign strongly positive'
    ],
    color: 'bg-red-50 border-red-200 text-red-800'
  }
};

const CAMPISI_STAGES: Record<CampisiStage, { name: string; description: string }> = {
  'IA': { name: 'Stage IA', description: 'No edema despite presence of lymphatic abnormalities' },
  'IB': { name: 'Stage IB', description: 'Mild edema spontaneously reversible with elevation' },
  'II': { name: 'Stage II', description: 'Persistent edema that regresses only with treatment' },
  'IIIA': { name: 'Stage IIIA', description: 'Persistent progressive edema; recurrent lymphangitis' },
  'IIIB': { name: 'Stage IIIB', description: 'Persistent progressive edema; no lymphangitis' },
  'IV': { name: 'Stage IV', description: 'Fibrotic lymphedema with column limb' },
  'V': { name: 'Stage V', description: 'Elephantiasis with severe limb deformity' }
};

const SURGICAL_DEBULKING_CRITERIA = {
  absolute_indications: [
    'ISL Stage III (lymphostatic elephantiasis) with failed CDT > 6 months',
    'Recurrent severe cellulitis (≥3 episodes/year) despite CDT compliance',
    'Massive limb enlargement causing functional disability',
    'Lymphangiosarcoma (Stewart-Treves syndrome) — URGENT',
    'Genital lymphedema causing urinary/sexual dysfunction'
  ],
  relative_indications: [
    'ISL Stage II late with <50% volume reduction after 6 months CDT',
    'Volume difference >20% persisting despite compliant CDT × 12 months',
    'Progressive fibrosis limiting daily activities despite CDT',
    'Patient preference with informed consent after CDT optimization',
    'Recurrent cellulitis (1-2 episodes/year) despite maintenance CDT'
  ],
  contraindications: [
    'Active cancer/uncontrolled malignancy',
    'Active cellulitis or lymphangitis — must resolve first',
    'Uncontrolled cardiac failure or renal failure',
    'Morbid obesity (BMI > 40) — optimize first',
    'Non-compliant with CDT (unable to wear compression postoperatively)',
    'Untreated chronic venous insufficiency',
    'Poorly controlled diabetes (HbA1c > 8%)'
  ],
  surgical_procedures: [
    {
      name: 'Charles Procedure (Debulking / Excisional)',
      description: 'Radical excision of subcutaneous tissue and skin down to deep fascia, with split-thickness skin grafting.',
      indications: 'ISL Stage III, elephantiasis, severe fibrosis, massive limb',
      key_points: [
        'Full circumferential excision of affected tissue',
        'Preserve deep fascia and neurovascular bundles',
        'Split-thickness skin graft (STSG) from contralateral thigh',
        'Graft thickness 0.012-0.015 inches',
        'Circumferential compression dressing post-op',
        'Staged if >40cm limb circumference'
      ]
    },
    {
      name: 'Modified Homans Procedure',
      description: 'Staged excision of subcutaneous tissue through longitudinal incisions with flap advancement.',
      indications: 'ISL Stage II late / III with moderate fibrosis',
      key_points: [
        'Medial or lateral longitudinal incision approach',
        'Excision of subcutaneous tissue, preserve skin flaps',
        'Flap undermining and advancement',
        'Two-stage procedure (medial then lateral, 3-6 months apart)',
        'Drain placement (suction drain × 5-7 days)',
        'Less morbidity than Charles procedure'
      ]
    },
    {
      name: 'Suction-Assisted Lipectomy (SAL / Liposuction)',
      description: 'Power-assisted liposuction for non-pitting, predominantly fatty lymphedema.',
      indications: 'ISL Stage II with predominant fat deposition, minimal pitting',
      key_points: [
        'Best for non-pitting, adipose-predominant lymphedema',
        'Tourniquet use to minimize blood loss',
        'Circumferential approach with multiple ports',
        'Power-assisted or tumescent technique',
        'Immediate postoperative compression garment (24/7)',
        'Volume aspirated correlates with volume difference',
        'LIFELONG compression garment mandatory'
      ]
    },
    {
      name: 'Lymphovenous Anastomosis (LVA)',
      description: 'Supermicrosurgical anastomosis of lymphatic vessels to subdermal venules.',
      indications: 'ISL Stage I-II, early fibrosis, patent lymphatics on ICG',
      key_points: [
        'ICG lymphography pre-op to map functional lymphatics',
        'Supermicrosurgery (0.3-0.8mm vessels)',
        'Multiple anastomosis sites (3-5 per session)',
        'Minimal donor morbidity',
        'Can be combined with CDT',
        'Best outcomes in early-stage disease'
      ]
    },
    {
      name: 'Vascularized Lymph Node Transfer (VLNT)',
      description: 'Free tissue transfer of lymph nodes from donor site to affected limb.',
      indications: 'ISL Stage II-III, absent/damaged lymph nodes, failed LVA',
      key_points: [
        'Donor sites: groin, supraclavicular, submental, omental, jejunal',
        'Reverse lymphatic mapping to avoid donor site lymphedema',
        'Microsurgical free flap with lymph nodes',
        'Place in scar bed or axilla/groin of affected limb',
        'Can combine with DIEP flap in breast reconstruction',
        'CDT resumed after 6 weeks post-op'
      ]
    }
  ]
};

const CDT_PROTOCOL = {
  intensive_phase: {
    name: 'CDT Phase I — Intensive (Reductive) Phase',
    duration: '2-6 weeks (average 4 weeks)',
    goal: 'Maximum volume reduction. Typically 40-70% excess volume reduction expected.',
    frequency: 'Daily or 5 days/week clinical sessions',
    components: [
      {
        name: '1. Manual Lymphatic Drainage (MLD)',
        description: 'Gentle, rhythmic manual technique to redirect lymph flow through collateral pathways.',
        details: [
          'Duration: 45-60 minutes per session',
          'Technique: Vodder or Földi method',
          'Sequence: Proximal → distal (clear proximal pathways first)',
          'Start with unaffected quadrants, then affected quadrant',
          'Neck / trunk clearing before limb drainage',
          'Gentle pressure: 30-40 mmHg (just enough to move skin)',
          'Stationary circles, pump technique, scoop technique, rotary technique',
          'Frequency: Daily × 5 days/week for 2-6 weeks',
          'Contraindications: active infection, DVT, cardiac failure, active malignancy in drainage area'
        ]
      },
      {
        name: '2. Multi-Layer Short-Stretch Compression Bandaging',
        description: 'Layered bandaging system providing high working pressure and low resting pressure.',
        details: [
          'Applied IMMEDIATELY after each MLD session',
          'Worn 23 hours/day (removed only for next MLD)',
          'Layer 1: Tubular stockinette (Tubigrip)',
          'Layer 2: Soft foam padding (Artiflex / Cellona)',
          'Layer 3: Foam chips or channelled foam for fibrotic areas',
          'Layer 4: Short-stretch bandages (Comprilan or Rosidal K)',
          'Bandage width: 6cm for fingers/toes, 8cm for hand/foot, 10-12cm for limb',
          'Application: spiral / figure-of-8 technique',
          'Pressure gradient: highest distally (40-60 mmHg), lowest proximally',
          'Monitor: CRT, sensation, color, comfort every 4 hours initially',
          'Short-stretch = high working pressure during movement, low at rest'
        ]
      },
      {
        name: '3. Remedial / Decongestive Exercises',
        description: 'Active exercises performed while wearing compression bandages to enhance lymph transport.',
        details: [
          'Perform WITH compression bandages in place',
          'Duration: 15-20 minutes, 2-3 times daily',
          'Diaphragmatic breathing exercises (5 minutes)',
          'Active ROM of affected limb joints',
          'Gentle resistance exercises (Theraband)',
          'Walking / stationary cycling',
          'Aquatic exercises if available (hydrostatic pressure aids drainage)',
          'Avoid: heavy lifting, isometric exercises, overheating',
          'Upper limb: shoulder flexion/extension, elbow flex/extend, wrist circles, finger pumps',
          'Lower limb: ankle pumps, knee flexion/extension, hip flexion, walking'
        ]
      },
      {
        name: '4. Meticulous Skin Care',
        description: 'Protect skin integrity to prevent cellulitis, the most common complication.',
        details: [
          'Daily inspection of all skin folds and interdigital spaces',
          'Wash gently with pH-neutral soap (pH 5.5)',
          'Pat dry thoroughly — especially between toes/fingers and skin folds',
          'Apply low-pH moisturizer (urea 10% cream or petrolatum-based)',
          'Treat fungal infections aggressively (topical antifungals)',
          'Protect from cuts, burns, insect bites',
          'No blood draws, IVs, or BP measurements on affected limb',
          'Sunscreen on exposed affected limb',
          'Manage papillomatosis with keratolytic agents',
          'Immediate antibiotics for any signs of cellulitis (pen V or amoxicillin)'
        ]
      },
      {
        name: '5. Intermittent Pneumatic Compression (IPC) — Adjunct',
        description: 'Sequential pneumatic compression device as adjunct to MLD (not replacement).',
        details: [
          'Multi-chamber sequential device preferred',
          'Pressure: 30-60 mmHg (never exceed 60 mmHg)',
          'Duration: 30-60 minutes per session',
          'Frequency: 1-2 times daily during intensive phase',
          'ALWAYS precede with proximal trunk clearing (MLD)',
          'Contraindications: active infection, DVT, trunk edema without truncal drainage',
          'Use WITH bandaging, NOT as standalone'
        ]
      }
    ]
  },
  maintenance_phase: {
    name: 'CDT Phase II — Maintenance (Self-Management) Phase',
    duration: 'Lifelong',
    goal: 'Maintain and improve reductions achieved in Phase I. Self-management education.',
    frequency: 'Daily self-care with periodic clinical review',
    components: [
      {
        name: '1. Compression Garments',
        description: 'Transition from bandaging to fitted compression garments.',
        details: [
          'Fit within 1-2 weeks of completing Phase I (before volume rebounds)',
          'Flat-knit garments preferred for ISL Stage II+ (stiffer, better containment)',
          'Circular-knit acceptable for Stage I with regular limb shape',
          'Compression class: Class II (23-32 mmHg) for mild, Class III (34-46 mmHg) for moderate-severe',
          'Class IV (>49 mmHg) may be needed for elephantiasis',
          'Wear during ALL waking hours (minimum 12 hours)',
          'Remove only for sleeping and bathing',
          'Replace every 4-6 months (elasticity loss)',
          'Custom-made > off-the-shelf for irregular limb shapes',
          'Night-time bandaging or foam garments for patients with rapid rebound'
        ]
      },
      {
        name: '2. Self-MLD (Simple Lymphatic Drainage)',
        description: 'Patient-performed simplified lymphatic drainage technique.',
        details: [
          'Teach patient/caregiver modified Vodder technique',
          'Duration: 15-20 minutes daily',
          'Sequence: deep breathing → neck → trunk → affected limb (proximal → distal)',
          'Gentle, slow, rhythmic skin movements',
          'No oil/lotion (hands must grip skin slightly)',
          'Review technique at each follow-up visit'
        ]
      },
      {
        name: '3. Ongoing Exercise Program',
        description: 'Continue structured exercise with compression garments.',
        details: [
          'Continue exercises from Phase I while wearing garments',
          'Gradually progress resistance and duration',
          'Swimming / water aerobics excellent (natural compression from water)',
          'Walking 30 min/day minimum',
          'Avoid high-impact / repetitive strain activities',
          'Weight management: BMI goal < 30'
        ]
      },
      {
        name: '4. Ongoing Skin Care',
        description: 'Lifelong skin care regimen to prevent cellulitis.',
        details: [
          'Same regimen as Phase I — daily moisturizing & inspection',
          'Emergency antibiotic course available at home (standby prescription)',
          'Patient education: recognize early cellulitis signs',
          'Annual dermatology review if significant skin changes'
        ]
      },
      {
        name: '5. Psychosocial Support',
        description: 'Address psychological impact and body image concerns.',
        details: [
          'Screen for depression/anxiety at each visit',
          'Refer to support group',
          'Occupational therapy for functional adaptation',
          'Vocational rehabilitation if needed'
        ]
      }
    ]
  }
};

const TREATMENT_TIMELINE: Array<{
  phase: TimelinePhase;
  name: string;
  period: string;
  description: string;
  activities: string[];
  assessments: string[];
  milestones: string[];
}> = [
  {
    phase: 'initial_assessment',
    name: 'Phase 1: Initial Assessment & Workup',
    period: 'Week 0 (Day 1-3)',
    description: 'Comprehensive evaluation, staging, baseline measurements, and treatment planning.',
    activities: [
      'Complete history & physical examination',
      'Bilateral circumferential limb measurements (every 4cm from fixed bony landmark)',
      'Water volumetry or perometry if available',
      'Stemmer sign assessment',
      'Skin condition assessment (fibrosis, papillomatosis, wounds)',
      'Pain & functional assessment (LEFS/DASH, QoL)',
      'Blood work: FBC, U&E, LFT, albumin, TFT',
      'Duplex ultrasound: exclude DVT/CVI',
      'Lymphoscintigraphy if diagnosis unclear',
      'ICG lymphography if microsurgical candidate',
      'MRI/CT if malignancy suspected',
      'Photography: standardized clinical photos',
      'Screen for cellulitis/infection — treat first if present',
      'Weight, BMI, nutritional assessment'
    ],
    assessments: ['ISL staging', 'Campisi staging', 'Volume differential', 'LEFS/DASH', 'LYMQOL baseline'],
    milestones: ['Staging complete', 'Baseline measurements documented', 'Treatment plan formulated']
  },
  {
    phase: 'cdt_intensive',
    name: 'Phase 2: CDT Intensive Phase (Phase I)',
    period: 'Weeks 1-6 (typically 2-4 weeks)',
    description: 'Daily clinical MLD + multi-layer bandaging + exercise + skin care for maximum volume reduction.',
    activities: [
      'Daily MLD sessions (45-60 min) × 5 days/week',
      'Multi-layer short-stretch bandaging after each MLD',
      'Decongestive exercises 2-3× daily (with bandages on)',
      'Daily skin care routine established',
      'IPC 30-60 min daily if available',
      'Patient education: disease, self-care, compression',
      'Weekly circumferential measurements',
      'Weekly volume calculation & comparison',
      'Treat any intercurrent cellulitis immediately',
      'Nutritional optimization (protein intake, weight management)',
      'Gradual progression of exercise program'
    ],
    assessments: ['Weekly measurements', 'Volume reduction %', 'Skin condition', 'Compliance'],
    milestones: ['Target 40-70% excess volume reduction', 'Patient competent in self-bandaging', 'Skin condition improving']
  },
  {
    phase: 'cdt_transition',
    name: 'Phase 3: Transition to Maintenance',
    period: 'Weeks 5-8',
    description: 'Transition from clinical treatment to self-management. Garment fitting.',
    activities: [
      'Compression garment fitting (flat-knit for Stage II+)',
      'Teach self-MLD technique (verify competency)',
      'Teach self-bandaging for nighttime use',
      'Establish home exercise program',
      'Provide skin care kit / supplies',
      'Provide emergency antibiotic prescription (standby)',
      'Final measurements before garment fitting',
      'Schedule follow-up appointments',
      'If <50% reduction: extend intensive phase or consider surgery evaluation',
      'Provide written self-management plan'
    ],
    assessments: ['Pre-garment measurements', 'Self-care competency assessment', 'Volume plateau assessment'],
    milestones: ['Garment fitted', 'Self-care competency verified', 'Self-management plan documented']
  },
  {
    phase: 'cdt_maintenance',
    name: 'Phase 4: CDT Maintenance Phase (Lifelong)',
    period: 'Month 3 onwards — lifelong',
    description: 'Patient-directed daily self-management with periodic clinical review.',
    activities: [
      'Daily compression garment wear (all waking hours)',
      'Nighttime bandaging or night garment if rebound tendency',
      'Self-MLD 15-20 min daily',
      'Exercise program 30+ min daily',
      'Daily skin care & inspection',
      'Weight management (dietary counseling)',
      'Infection prevention & early treatment',
      'Psychosocial support / support group',
      'Garment replacement every 4-6 months'
    ],
    assessments: [
      'Month 3: full reassessment + measurements + new staging',
      'Month 6: reassessment — determine if surgical referral indicated',
      'Month 12: annual comprehensive review',
      'Ongoing: measurements every 3 months for first year, then 6-monthly'
    ],
    milestones: ['Volume maintained ±5% of Phase I result', 'No cellulitis episodes', 'Functional improvement maintained']
  },
  {
    phase: 'surgical_evaluation',
    name: 'Phase 5: Surgical Evaluation (If Indicated)',
    period: 'Month 6-12 (after ≥6 months CDT)',
    description: 'Assess candidacy for surgical intervention if CDT results suboptimal.',
    activities: [
      'Review CDT compliance record',
      'Repeat volumetric measurements — calculate CDT response rate',
      'Document persisting volume difference vs. contralateral',
      'Assess tissue composition: pitting vs. non-pitting vs. fibrotic',
      'ICG lymphography for microsurgical planning',
      'MRI lymphangiography if considering VLNT',
      'DEXA / CT for tissue composition if considering SAL',
      'Review cellulitis frequency and severity',
      'Functional assessment: can patient perform ADLs?',
      'Pre-operative optimization: BMI < 35, HbA1c < 7, cessation of smoking',
      'Informed consent with realistic expectations',
      'Determine surgical approach (see Surgical Procedures tab)'
    ],
    assessments: ['Volume differential after CDT', 'Tissue composition analysis', 'Lymphatic function imaging', 'Pre-op fitness'],
    milestones: ['Surgical candidacy determined', 'Procedure selected', 'Pre-op optimization complete']
  },
  {
    phase: 'preoperative',
    name: 'Phase 6: Pre-Operative Preparation',
    period: '2-4 weeks before surgery',
    description: 'Optimize patient for surgical intervention.',
    activities: [
      'CDT intensive phase boost (2 weeks to minimize limb volume)',
      'Pre-operative bloods: FBC, U&E, coag, G&S, albumin',
      'ECG + CXR if indicated',
      'Anaesthetic review',
      'Mark surgical sites / ICG mapping',
      'Compression garment pre-ordered for post-op (sized to target volume)',
      'Cellulitis prophylaxis: penicillin V 500mg BD × 2 weeks pre-op',
      'DVT prophylaxis plan',
      'Consent: discuss risks (wound complications, recurrence, donor site morbidity for VLNT)',
      'Photography: pre-operative standardized photos',
      'Teach post-op compression bandaging to patient/carer'
    ],
    assessments: ['Pre-op measurements', 'Pre-op staging', 'Anaesthetic risk'],
    milestones: ['Patient optimized for surgery', 'Consent completed', 'Post-op garments ready']
  },
  {
    phase: 'surgical',
    name: 'Phase 7: Surgical Procedure',
    period: 'Day 0',
    description: 'Operative debulking or reconstruction per selected procedure.',
    activities: [
      'General or regional anaesthesia as appropriate',
      'Prophylactic antibiotics: co-amoxiclav or cephalosporin',
      'Tourniquet for SAL (upper or lower limb)',
      'Procedure-specific technique (see Surgical Procedures)',
      'Drain placement (Redivac / Jackson-Pratt) for excisional procedures',
      'Immediate compression dressing / bandaging',
      'Limb elevation on pillows / Braun splint',
      'DVT prophylaxis (LMWH + TED stockings on contralateral)',
      'Measure drain output hourly × 6, then 4-hourly',
      'Fluid balance monitoring'
    ],
    assessments: ['Intra-op: volume excised/aspirated', 'Blood loss', 'Drain placement confirmation'],
    milestones: ['Procedure completed', 'Compression applied', 'Patient stable']
  },
  {
    phase: 'postoperative_acute',
    name: 'Phase 8: Post-Operative Acute Recovery',
    period: 'Days 1-14',
    description: 'Wound care, compression management, infection prevention, early mobilisation.',
    activities: [
      'Day 1: Neurovascular checks 4-hourly, drain output monitoring',
      'Day 1: Elevate limb above heart level',
      'Day 1-3: IV antibiotics → oral step-down',
      'Day 2: Begin gentle active ROM exercises in bed',
      'Day 3-5: Assisted mobilisation with compression',
      'Day 5: First dressing change (check wound, graft take for Charles)',
      'Day 5-7: Drain removal when output <30ml/24hr',
      'Day 7-10: Suture/staple review',
      'Day 10-14: Begin gentle MLD proximal to surgical site only',
      'Day 14: Wound review, remove remaining sutures',
      'Ongoing: DVT prophylaxis until fully mobile',
      'Ongoing: Cellulitis prophylaxis antibiotics × 2 weeks post-op',
      'Ongoing: Pain management (avoid dependent oedema from immobility)',
      'For STSG: graft check Day 5 — bolster removal, assess graft take %',
      'For SAL: compression garment 24/7 from Day 1'
    ],
    assessments: ['Daily neurovascular checks', 'Drain output', 'Wound condition', 'Graft take %', 'Pain score'],
    milestones: ['Drains removed', 'Wounds healing', 'Independent mobilisation', 'Discharge from inpatient care']
  },
  {
    phase: 'postoperative_subacute',
    name: 'Phase 9: Post-Operative Subacute Recovery',
    period: 'Weeks 2-12',
    description: 'Graduated return to CDT, scar management, functional rehabilitation.',
    activities: [
      'Week 2-4: Gentle MLD (avoiding incisions), progress to full MLD by week 4-6',
      'Week 2: Begin scar massage when wounds fully healed',
      'Week 3-4: Compression garment fitting (post-operative swelling resolved)',
      'Week 4: Resume bandaging at night if needed',
      'Week 4-6: Progressive exercise program with compression',
      'Week 6: Full CDT resumed including MLD over surgical area',
      'Week 6-8: Measure limb volumes — compare to pre-op',
      'Week 8: Assess need for garment adjustment (volume still changing)',
      'Week 8-12: Return to full activities',
      'For VLNT: no direct pressure on flap × 6 weeks, MLD start at week 6',
      'For SAL: compression 24/7 for 6 months, then daytime only lifelong',
      'Silicone scar sheets/gel for excisional wounds',
      'Photography at weeks 4, 8, 12'
    ],
    assessments: ['Fortnightly measurements weeks 2-8', 'Monthly measurements weeks 8-12', 'Functional reassessment', 'Scar assessment'],
    milestones: ['CDT fully resumed', 'Garment fitted', 'Volume improving/stable', 'Return to work/activities']
  },
  {
    phase: 'postoperative_longterm',
    name: 'Phase 10: Long-Term Post-Operative Monitoring',
    period: 'Month 3 — lifelong',
    description: 'Ongoing CDT maintenance with periodic clinical review. Monitor for recurrence.',
    activities: [
      'Continue lifelong compression garment (MANDATORY for SAL patients)',
      'Continue self-MLD daily',
      'Continue exercise program',
      'Continue skin care & infection prevention',
      'Garment replacement every 4-6 months',
      'Report any increase in limb size immediately',
      'Annual lymphoscintigraphy if physiologic procedure (LVA/VLNT)',
      'Long-term cellulitis prophylaxis if recurrent (penicillin V 250mg BD)',
      'Annual screening for recurrence of primary malignancy',
      'Revision surgery if needed (staged debulking for residual excess)'
    ],
    assessments: [
      'Month 3: reassessment & restaging',
      'Month 6: reassessment — compare to pre-op baseline',
      'Month 12: annual review (measurements, staging, QoL, photos)',
      'Yearly: comprehensive reassessment',
      'Ongoing: 3-monthly measurements for first 2 years, then 6-monthly'
    ],
    milestones: ['Volume reduction >50% maintained at 1 year', 'Cellulitis episodes reduced', 'QoL improved', 'Functional goals met']
  }
];

const SCORING_SYSTEMS = {
  lefs: {
    name: 'Lower Extremity Functional Scale (LEFS)',
    description: 'Validated 20-item questionnaire assessing lower limb function (0-80, higher = better).',
    items: [
      'Usual work/housework', 'Usual hobbies/sports', 'Getting in/out of bath',
      'Walking between rooms', 'Putting on shoes/socks', 'Squatting',
      'Lifting objects from floor', 'Light activities at home', 'Heavy activities at home',
      'Getting in/out of car', 'Walking 2 blocks', 'Walking 1 mile',
      'Going up/down 10 stairs', 'Standing 1 hour', 'Sitting 1 hour',
      'Running on even ground', 'Running on uneven ground', 'Sharp turns while running',
      'Hopping', 'Rolling over in bed'
    ],
    scoring: 'Each item: 0 (unable) to 4 (no difficulty). Total: 0-80. MCID = 9 points.'
  },
  dash: {
    name: 'DASH Score (Disabilities of Arm, Shoulder, Hand)',
    description: 'Validated 30-item questionnaire for upper limb disability (0-100, lower = better).',
    scoring: 'Score = [(sum of n responses / n) - 1] × 25. MCID = 10 points.'
  },
  lymqol: {
    name: 'LYMQOL (Lymphoedema Quality of Life)',
    description: 'Disease-specific QoL instrument covering function, appearance, symptoms, mood.',
    domains: ['Function (7 items)', 'Appearance (6 items)', 'Symptoms (5 items)', 'Mood (6 items)'],
    scoring: 'Each domain averaged 1-4. Overall QoL: 0-10 VAS. Lower scores = better QoL.'
  }
};

// Volume calculation from circumferential measurements (truncated cone formula)
function calculateVolumeFromMeasurements(measurements: LimbMeasurement[]): { affected: number; contralateral: number; difference_pct: number } {
  const interval = 4; // 4cm between measurement points
  let affVol = 0, conVol = 0;
  for (let i = 0; i < measurements.length - 1; i++) {
    const c1a = measurements[i].affected_cm;
    const c2a = measurements[i + 1].affected_cm;
    const c1c = measurements[i].contralateral_cm;
    const c2c = measurements[i + 1].contralateral_cm;
    // Truncated cone: V = h/(12π) × (C1² + C1×C2 + C2²)
    affVol += (interval / (12 * Math.PI)) * (c1a * c1a + c1a * c2a + c2a * c2a);
    conVol += (interval / (12 * Math.PI)) * (c1c * c1c + c1c * c2c + c2c * c2c);
  }
  const diff = conVol > 0 ? ((affVol - conVol) / conVol) * 100 : 0;
  return { affected: Math.round(affVol), contralateral: Math.round(conVol), difference_pct: Math.round(diff * 10) / 10 };
}

// Auto-stage based on clinical findings
function autoStageISL(data: {
  pitting: string; fibrosis: string; volume_diff_pct: number;
  elevation_reduces: boolean; papillomatosis: boolean; stemmer: boolean;
}): ISLStage {
  if (data.papillomatosis || data.volume_diff_pct > 40) return 3;
  if (data.fibrosis === 'severe' || (data.fibrosis === 'moderate' && data.volume_diff_pct > 30)) return '2late';
  if (!data.elevation_reduces || data.fibrosis !== 'none' || data.stemmer) return 2;
  if (data.volume_diff_pct > 10) return 1;
  return 0;
}

function autoCampisiStage(isl: ISLStage, recurrentCellulitis: boolean): CampisiStage {
  if (isl === 3) return 'V';
  if (isl === '2late') return 'IV';
  if (isl === 2) return recurrentCellulitis ? 'IIIA' : 'IIIB';
  if (isl === 1) return 'IB';
  return 'IA';
}

// ============================================
// MAIN COMPONENT
// ============================================

const LymphedemaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'protocol' | 'assessments' | 'new' | 'details' | 'timeline' | 'surgical'>('protocol');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  useOnSelectedPatient((p) => { setSelectedPatient(p as unknown as Patient); setActiveTab('new'); });
  const [assessments, setAssessments] = useState<LymphedemaAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<LymphedemaAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);

  // Consent upload state
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [consentPreview, setConsentPreview] = useState<string>('');
  const [consentUploaded, setConsentUploaded] = useState(false);
  const consentInputRef = useRef<HTMLInputElement>(null);

  // Treatment tracking state
  const [trackingEntries, setTrackingEntries] = useState<Array<{
    id: string; date: string; phase: string; activity: string;
    notes: string; measurements_taken: boolean; volume_change_pct: number;
    compliance: 'full' | 'partial' | 'missed'; next_due: string;
  }>>([]);
  const [showAddTracking, setShowAddTracking] = useState(false);
  const [trackingForm, setTrackingForm] = useState({
    phase: 'cdt_intensive', activity: '', notes: '',
    measurements_taken: false, volume_change_pct: 0,
    compliance: 'full' as 'full' | 'partial' | 'missed',
    next_due: ''
  });

  // Reminder state
  const [reminders, setReminders] = useState<Array<{
    id: string; title: string; message: string; date: string;
    time: string; sent: boolean; type: 'mld' | 'bandaging' | 'exercise' | 'garment' | 'followup' | 'medication' | 'custom';
  }>>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    type: 'mld' as 'mld' | 'bandaging' | 'exercise' | 'garment' | 'followup' | 'medication' | 'custom',
    title: '', message: '', date: '', time: '09:00'
  });

  // Form state for new assessment
  const [formData, setFormData] = useState({
    etiology: '' as LymphedemaEtiology | '',
    affected_limb: '' as LymphedemaAssessment['affected_limb'] | '',
    onset_date: '',
    duration_months: 0,
    prior_treatments: [] as string[],
    comorbidities: [] as string[],
    cancer_history: '',
    radiation_history: false,
    lymph_node_dissection: false,
    recurrent_cellulitis_episodes: 0,
    stemmer_sign: false,
    pitting: 'none' as LymphedemaAssessment['pitting'],
    fibrosis: 'none' as LymphedemaAssessment['fibrosis'],
    papillomatosis: false,
    lymphorrhea: false,
    fungal_infection: false,
    wounds_present: false,
    skin_changes: [] as string[],
    elevation_reduces: true,
    lefs_score: undefined as number | undefined,
    dash_score: undefined as number | undefined,
    quality_of_life_score: undefined as number | undefined,
    notes: '',
    compression_class: 'II' as TreatmentPlanData['compression_class'],
    pneumatic_compression: false
  });

  const [limbMeasurements, setLimbMeasurements] = useState<LimbMeasurement[]>([
    { location: 'Hand / Foot (metatarsals)', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: 'Wrist / Ankle', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '4cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '8cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '12cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '16cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '20cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '24cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '28cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '32cm proximal', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 },
    { location: '36cm proximal (thigh / upper arm)', affected_cm: 0, contralateral_cm: 0, difference_cm: 0, difference_pct: 0 }
  ]);

  // Load data
  useEffect(() => {
    loadPatients();
    loadAssessments();
  }, []);

  const loadPatients = async () => {
    try {
      const all = await patientService.getAllPatients();
      setPatients(all);
    } catch (e) { console.error('Error loading patients:', e); }
  };

  const loadAssessments = async () => {
    try {
      const records = await db.lymphedema_assessments.toArray();
      setAssessments(records as LymphedemaAssessment[]);
    } catch (e) { console.error('Error loading lymphedema assessments:', e); }
  };

  const filteredPatients = patients.filter(p => {
    const name = (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).trim().toLowerCase();
    const search = patientSearch.toLowerCase();
    return name.includes(search) || (p.hospital_number || '').toLowerCase().includes(search);
  });

  // Update measurement differences
  const updateMeasurement = (index: number, field: 'affected_cm' | 'contralateral_cm', value: number) => {
    setLimbMeasurements(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const diff = updated[index].affected_cm - updated[index].contralateral_cm;
      updated[index].difference_cm = Math.round(diff * 10) / 10;
      updated[index].difference_pct = updated[index].contralateral_cm > 0
        ? Math.round((diff / updated[index].contralateral_cm) * 1000) / 10
        : 0;
      return updated;
    });
  };

  // Computed staging
  const computedVolumes = calculateVolumeFromMeasurements(limbMeasurements);
  const computedISL = autoStageISL({
    pitting: formData.pitting,
    fibrosis: formData.fibrosis,
    volume_diff_pct: computedVolumes.difference_pct,
    elevation_reduces: formData.elevation_reduces,
    papillomatosis: formData.papillomatosis,
    stemmer: formData.stemmer_sign
  });
  const computedCampisi = autoCampisiStage(computedISL, formData.recurrent_cellulitis_episodes >= 3);

  // Evaluate surgical candidacy
  const evaluateSurgicalCriteria = useCallback(() => {
    const met: string[] = [];
    const notMet: string[] = [];

    if (computedISL === 3) met.push('ISL Stage III (elephantiasis)');
    else notMet.push('ISL Stage III not reached');

    if (formData.recurrent_cellulitis_episodes >= 3) met.push(`Recurrent cellulitis: ${formData.recurrent_cellulitis_episodes} episodes/year`);
    else notMet.push('Fewer than 3 cellulitis episodes/year');

    if (computedVolumes.difference_pct > 20) met.push(`Volume difference ${computedVolumes.difference_pct}% (>20%)`);
    else notMet.push(`Volume difference ${computedVolumes.difference_pct}% (<20%)`);

    if (formData.fibrosis === 'moderate' || formData.fibrosis === 'severe') met.push(`Tissue fibrosis: ${formData.fibrosis}`);
    else notMet.push('No significant fibrosis');

    if (formData.duration_months >= 6) met.push(`Duration ≥6 months (${formData.duration_months}m)`);
    else notMet.push(`Duration <6 months (${formData.duration_months}m)`);

    return { met, notMet, candidate: met.length >= 2 };
  }, [computedISL, computedVolumes, formData]);

  // ============================================
  // PATIENT EDUCATION PDF GENERATION
  // ============================================
  const generatePatientEducationPDF = (assessment: LymphedemaAssessment) => {
    const islInfo = ISL_STAGES[String(assessment.isl_stage)];
    const campisiInfo = CAMPISI_STAGES[assessment.campisi_stage];
    const patientName = assessment.patient_name;
    const hospitalNum = assessment.hospital_number;
    const date = new Date(assessment.assessment_date).toLocaleDateString();
    const tp = assessment.treatment_plan;
    const sc = { met: assessment.surgical_criteria_met, notMet: assessment.surgical_criteria_not_met, candidate: assessment.surgical_candidate };

    const timelineForStage = TREATMENT_TIMELINE.filter(t => {
      if (assessment.isl_stage === 0 || assessment.isl_stage === 1) return ['initial_assessment','cdt_intensive','cdt_transition','cdt_maintenance'].includes(t.phase);
      if (assessment.surgical_candidate) return true;
      return ['initial_assessment','cdt_intensive','cdt_transition','cdt_maintenance','surgical_evaluation'].includes(t.phase);
    });

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lymphedema Care Plan - ${patientName}</title>
<style>
@media print{body{margin:0;padding:10mm}@page{size:A4;margin:10mm}}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#222;line-height:1.5;max-width:210mm;margin:auto;padding:10mm}
.header{background:linear-gradient(135deg,#0E9F6E,#047857);color:#fff;padding:20px;border-radius:8px;margin-bottom:20px}
.header h1{margin:0;font-size:20pt}.header p{margin:4px 0;font-size:10pt;opacity:0.9}
.section{margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;padding:14px;break-inside:avoid}
.section h2{color:#0E9F6E;font-size:13pt;margin:0 0 8px;border-bottom:2px solid #0E9F6E;padding-bottom:4px}
.section h3{color:#374151;font-size:11pt;margin:10px 0 4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.stat{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px;text-align:center}
.stat .label{font-size:9pt;color:#666}.stat .value{font-size:14pt;font-weight:700;color:#0E9F6E}
.alert{background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px;margin:8px 0}
.danger{background:#fef2f2;border:1px solid #fca5a5}
table{width:100%;border-collapse:collapse;font-size:9pt;margin:8px 0}
th{background:#f3f4f6;text-align:left;padding:6px;border:1px solid #e5e7eb}
td{padding:6px;border:1px solid #e5e7eb}
.timeline-item{display:flex;gap:10px;margin:8px 0;padding:8px;background:#f9fafb;border-radius:6px;break-inside:avoid}
.timeline-num{width:24px;height:24px;border-radius:50%;background:#0E9F6E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10pt;font-weight:700;flex-shrink:0}
ul{margin:4px 0;padding-left:18px}li{margin:2px 0;font-size:10pt}
.consent-box{border:2px solid #374151;border-radius:8px;padding:16px;margin-top:20px;break-inside:avoid}
.consent-box h2{color:#374151}.sig-line{border-bottom:1px solid #000;width:200px;display:inline-block;margin:0 8px}
.footer{text-align:center;font-size:8pt;color:#9ca3af;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px}
.checklist{list-style:none;padding:0}.checklist li{padding:3px 0}.checklist li:before{content:"\\2610 ";font-size:12pt}
</style></head><body>
<div class="header">
  <h1>Lymphedema Patient Care Plan & Education</h1>
  <p><strong>Patient:</strong> ${patientName} &nbsp;|&nbsp; <strong>Hospital #:</strong> ${hospitalNum}</p>
  <p><strong>Assessment Date:</strong> ${date} &nbsp;|&nbsp; <strong>Assessed By:</strong> ${assessment.assessed_by}</p>
</div>

<div class="section">
  <h2>Your Diagnosis & Staging</h2>
  <p>You have been diagnosed with <strong>lymphedema</strong> — a condition where the lymphatic system cannot drain fluid properly, causing swelling in your ${assessment.affected_limb.replace(/_/g, ' ')}.</p>
  <div class="grid2" style="margin-top:10px">
    <div class="stat"><div class="label">ISL Stage</div><div class="value">${islInfo?.name?.split('(')[0] || 'N/A'}</div></div>
    <div class="stat"><div class="label">Campisi Stage</div><div class="value">${campisiInfo?.name || 'N/A'}</div></div>
  </div>
  <p style="margin-top:8px"><strong>What this means:</strong> ${islInfo?.description || ''}</p>
  <h3>Your Measurements</h3>
  <div class="grid3">
    <div class="stat"><div class="label">Affected Limb Volume</div><div class="value">${assessment.volume_affected_ml} ml</div></div>
    <div class="stat"><div class="label">Normal Limb Volume</div><div class="value">${assessment.volume_contralateral_ml} ml</div></div>
    <div class="stat"><div class="label">Volume Difference</div><div class="value" style="color:${assessment.volume_difference_pct > 20 ? '#DC2626' : '#0E9F6E'}">${assessment.volume_difference_pct}%</div></div>
  </div>
  ${assessment.lefs_score !== undefined || assessment.dash_score !== undefined || assessment.quality_of_life_score !== undefined ? `
  <h3>Functional & Quality of Life Scores</h3>
  <div class="grid3">
    ${assessment.lefs_score !== undefined ? `<div class="stat"><div class="label">LEFS (Lower Limb Function)</div><div class="value">${assessment.lefs_score}/80</div><div style="font-size:8pt;color:#666">${assessment.lefs_score >= 60 ? 'Good function' : assessment.lefs_score >= 40 ? 'Moderate limitation' : 'Significant limitation'}</div></div>` : ''}
    ${assessment.dash_score !== undefined ? `<div class="stat"><div class="label">DASH (Upper Limb)</div><div class="value">${assessment.dash_score}/100</div><div style="font-size:8pt;color:#666">${assessment.dash_score <= 30 ? 'Mild disability' : assessment.dash_score <= 60 ? 'Moderate disability' : 'Severe disability'}</div></div>` : ''}
    ${assessment.quality_of_life_score !== undefined ? `<div class="stat"><div class="label">QoL Score (LYMQOL)</div><div class="value">${assessment.quality_of_life_score}/10</div><div style="font-size:8pt;color:#666">${assessment.quality_of_life_score <= 3 ? 'Good QoL' : assessment.quality_of_life_score <= 6 ? 'Moderate impact' : 'Significant impact'}</div></div>` : ''}
  </div>` : ''}
</div>

<div class="section">
  <h2>Your Treatment Plan</h2>
  <p>Your care team has designed a treatment plan based on your specific condition:</p>
  <table>
    <tr><th>Component</th><th>Details</th></tr>
    <tr><td><strong>CDT Phase</strong></td><td>${assessment.cdt_phase === 'intensive' ? 'Phase I — Intensive (daily clinical treatment)' : 'Phase II — Maintenance (self-management)'}</td></tr>
    <tr><td><strong>Manual Lymphatic Drainage (MLD)</strong></td><td>${tp.mld_frequency}</td></tr>
    <tr><td><strong>Compression Bandaging</strong></td><td>${tp.bandaging_type}</td></tr>
    <tr><td><strong>Compression Garment</strong></td><td>${tp.compression_garment}</td></tr>
    <tr><td><strong>Exercises</strong></td><td>${tp.exercise_program.join(', ')}</td></tr>
    <tr><td><strong>Skin Care</strong></td><td>${tp.skin_care_regimen.join(', ')}</td></tr>
    <tr><td><strong>Pneumatic Compression</strong></td><td>${tp.pneumatic_compression ? 'Yes — as adjunct to MLD' : 'Not currently required'}</td></tr>
  </table>
  <h3>Follow-Up Schedule</h3>
  <p>You will be seen at these intervals: <strong>${tp.follow_up_schedule.join(', ')}</strong></p>
</div>

<div class="section">
  <h2>Treatment Timeline</h2>
  <p>Your treatment follows a structured phased approach:</p>
  ${timelineForStage.map((t, i) => `
  <div class="timeline-item">
    <div class="timeline-num">${i + 1}</div>
    <div>
      <strong>${t.name}</strong><br>
      <span style="font-size:9pt;color:#666">${t.period}</span><br>
      <span style="font-size:10pt">${t.description}</span>
      <ul>${t.milestones.map(m => `<li><strong>Goal:</strong> ${m}</li>`).join('')}</ul>
    </div>
  </div>`).join('')}
</div>

<div class="section">
  <h2>Important Self-Care Instructions</h2>
  <h3>Daily Skin Care (CRITICAL — Prevents Infections)</h3>
  <ul class="checklist">
    <li>Wash your affected limb gently with pH-neutral soap every day</li>
    <li>Pat dry thoroughly — especially between toes/fingers and skin folds</li>
    <li>Apply moisturizer (urea 10% cream) to keep skin soft</li>
    <li>Inspect your skin daily for cuts, redness, warmth, or swelling</li>
    <li>Treat any fungal infections immediately</li>
    <li>Protect from cuts, burns, and insect bites</li>
    <li>NO blood draws, IVs, or blood pressure on the affected limb</li>
  </ul>
  <div class="${sc.candidate ? 'alert danger' : 'alert'}">
    <strong>${sc.candidate ? '⚠️ Surgical Evaluation May Be Needed' : '✅ Continue Conservative Treatment'}</strong>
    <p style="font-size:10pt;margin:4px 0">${sc.candidate ? 'Based on your assessment, surgical intervention may be considered. Your surgeon will discuss options with you.' : 'Your condition is being managed with CDT. Continue your daily routine and attend all follow-up appointments.'}</p>
  </div>
  <h3>When to Seek Urgent Help</h3>
  <ul>
    <li><strong>Signs of cellulitis:</strong> Sudden redness, warmth, pain, fever — <strong style="color:#DC2626">Go to hospital immediately</strong></li>
    <li>Sudden increase in limb swelling</li>
    <li>New wounds or fluid leaking from skin</li>
    <li>Temperature above 38°C (100.4°F)</li>
  </ul>
</div>

<div class="consent-box">
  <h2>Consent to Treatment</h2>
  <p>I, <strong>${patientName}</strong>, have been informed about my lymphedema diagnosis, the proposed treatment plan, and the expected timeline. I understand the importance of compliance with compression therapy, skin care, and follow-up appointments. I have had the opportunity to ask questions and I consent to the proposed treatment.</p>
  <div style="margin-top:20px;display:flex;justify-content:space-between">
    <div><p>Patient Signature: <span class="sig-line"></span></p><p>Date: <span class="sig-line"></span></p></div>
    <div><p>Clinician Signature: <span class="sig-line"></span></p><p>Date: <span class="sig-line"></span></p></div>
  </div>
</div>

<div class="footer">
  <p>Plastic Surgery Department — Lymphedema Management Program | Generated: ${new Date().toLocaleString()}</p>
  <p>This document is for patient education purposes. Always follow your care team's specific instructions.</p>
</div>
</body></html>`;
    return htmlContent;
  };

  const handleDownloadPDF = (assessment: LymphedemaAssessment) => {
    const html = generatePatientEducationPDF(assessment);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lymphedema_CarePlan_${assessment.patient_name.replace(/\s+/g, '_')}_${new Date(assessment.assessment_date).toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = (assessment: LymphedemaAssessment) => {
    const html = generatePatientEducationPDF(assessment);
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.onload = () => printWin.print();
    }
  };

  const handleSharePDF = async (assessment: LymphedemaAssessment) => {
    const html = generatePatientEducationPDF(assessment);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const file = new File([blob], `Lymphedema_CarePlan_${assessment.patient_name.replace(/\s+/g, '_')}.html`, { type: 'text/html' });
    if (navigator.share) {
      try {
        await navigator.share({ title: `Lymphedema Care Plan - ${assessment.patient_name}`, files: [file] });
      } catch { /* user cancelled */ }
    } else {
      handleDownloadPDF(assessment);
    }
  };

  // ============================================
  // CONSENT UPLOAD
  // ============================================
  const handleConsentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File too large (max 10MB)'); return; }
    setConsentFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setConsentPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setConsentPreview('');
    }
    setConsentUploaded(false);
  };

  const handleSaveConsent = async (assessmentId: string) => {
    if (!consentFile) return;
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = ev.target?.result as string;
        await db.lymphedema_assessments.update(assessmentId as any, {
          consent_document: data,
          consent_filename: consentFile.name,
          consent_uploaded_at: new Date().toISOString(),
          updated_at: new Date()
        } as any);
        setConsentUploaded(true);
        setAssessments(prev => prev.map(a => a.id === assessmentId ? { ...a, consent_document: data, consent_filename: consentFile.name } as any : a));
        if (selectedAssessment?.id === assessmentId) {
          setSelectedAssessment({ ...selectedAssessment, consent_document: data, consent_filename: consentFile.name } as any);
        }
      };
      reader.readAsDataURL(consentFile);
    } catch (e) {
      console.error('Error saving consent:', e);
      alert('Failed to save consent document');
    }
  };

  // ============================================
  // TREATMENT TRACKING
  // ============================================
  const handleAddTrackingEntry = async (assessmentId: string) => {
    const entry = {
      id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      ...trackingForm
    };
    const updated = [...trackingEntries, entry];
    setTrackingEntries(updated);
    try {
      await db.lymphedema_assessments.update(assessmentId as any, {
        tracking_entries: updated,
        updated_at: new Date()
      } as any);
    } catch (e) { console.error('Error saving tracking entry:', e); }
    setShowAddTracking(false);
    setTrackingForm({ phase: 'cdt_intensive', activity: '', notes: '', measurements_taken: false, volume_change_pct: 0, compliance: 'full', next_due: '' });
  };

  // ============================================
  // REMINDERS
  // ============================================
  const REMINDER_PRESETS: Record<string, { title: string; message: string }> = {
    mld: { title: 'MLD Session Due', message: 'Time for your Manual Lymphatic Drainage session. Remember to follow proximal-to-distal sequence.' },
    bandaging: { title: 'Compression Bandaging', message: 'Apply your multi-layer compression bandaging. Check skin condition before applying.' },
    exercise: { title: 'Exercise Reminder', message: 'Time for your decongestive exercises. Wear your compression garment during exercise.' },
    garment: { title: 'Garment Check', message: 'Check your compression garment fit. Replace every 4-6 months.' },
    followup: { title: 'Follow-Up Appointment', message: 'You have a follow-up appointment coming up. Bring your measurement log.' },
    medication: { title: 'Medication Reminder', message: 'Take your prescribed medication as directed.' },
    custom: { title: '', message: '' }
  };

  const handleAddReminder = async (assessmentId: string, patientName: string) => {
    const preset = REMINDER_PRESETS[reminderForm.type];
    const title = reminderForm.title || preset.title;
    const message = (reminderForm.message || preset.message).replace('{patient}', patientName);
    const reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: reminderForm.type,
      title, message,
      date: reminderForm.date,
      time: reminderForm.time,
      sent: false
    };
    const updatedReminders = [...reminders, reminder];
    setReminders(updatedReminders);
    try {
      await db.lymphedema_assessments.update(assessmentId as any, {
        reminders: updatedReminders,
        updated_at: new Date()
      } as any);
      // Schedule push notification
      const scheduledDate = new Date(`${reminderForm.date}T${reminderForm.time}`);
      if (scheduledDate > new Date()) {
        await notificationService.scheduleLocalNotification({
          title: `🔔 ${title}`,
          message: `${patientName}: ${message}`,
          type: 'reminder',
          scheduledFor: scheduledDate,
          url: '/lymphedema'
        });
      }
    } catch (e) { console.error('Error saving reminder:', e); }
    setShowAddReminder(false);
    setReminderForm({ type: 'mld', title: '', message: '', date: '', time: '09:00' });
  };

  const handleDeleteReminder = async (assessmentId: string, reminderId: string) => {
    const updated = reminders.filter(r => r.id !== reminderId);
    setReminders(updated);
    try {
      await db.lymphedema_assessments.update(assessmentId as any, { reminders: updated, updated_at: new Date() } as any);
    } catch (e) { console.error('Error removing reminder:', e); }
  };

  // Load tracking & reminders when assessment is selected
  useEffect(() => {
    if (selectedAssessment) {
      setTrackingEntries((selectedAssessment as any).tracking_entries || []);
      setReminders((selectedAssessment as any).reminders || []);
      setConsentFile(null);
      setConsentPreview('');
      setConsentUploaded(false);
    }
  }, [selectedAssessment?.id]);

  // Save assessment
  const handleSaveAssessment = async () => {
    if (!selectedPatient) return alert('Please select a patient');
    if (!formData.etiology || !formData.affected_limb) return alert('Please complete required fields');

    setIsSaving(true);
    try {
      const patientName = selectedPatient.full_name || `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim();
      const surgCriteria = evaluateSurgicalCriteria();

      const assessment: LymphedemaAssessment = {
        id: `lymph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patient_id: String(selectedPatient.id),
        patient_name: patientName,
        hospital_number: selectedPatient.hospital_number || '',
        assessment_date: new Date(),
        assessed_by: getCurrentUserName(),
        etiology: formData.etiology as LymphedemaEtiology,
        affected_limb: formData.affected_limb as LymphedemaAssessment['affected_limb'],
        onset_date: formData.onset_date,
        duration_months: formData.duration_months,
        prior_treatments: formData.prior_treatments,
        comorbidities: formData.comorbidities,
        cancer_history: formData.cancer_history,
        radiation_history: formData.radiation_history,
        lymph_node_dissection: formData.lymph_node_dissection,
        recurrent_cellulitis_episodes: formData.recurrent_cellulitis_episodes,
        limb_measurements: limbMeasurements,
        volume_affected_ml: computedVolumes.affected,
        volume_contralateral_ml: computedVolumes.contralateral,
        volume_difference_pct: computedVolumes.difference_pct,
        skin_changes: formData.skin_changes,
        stemmer_sign: formData.stemmer_sign,
        pitting: formData.pitting,
        fibrosis: formData.fibrosis,
        papillomatosis: formData.papillomatosis,
        lymphorrhea: formData.lymphorrhea,
        fungal_infection: formData.fungal_infection,
        wounds_present: formData.wounds_present,
        isl_stage: computedISL,
        campisi_stage: computedCampisi,
        lefs_score: formData.lefs_score,
        dash_score: formData.dash_score,
        quality_of_life_score: formData.quality_of_life_score,
        cdt_phase: (typeof computedISL === 'number' ? computedISL : 2) >= 2 ? 'intensive' : 'maintenance',
        current_timeline_phase: 'initial_assessment',
        treatment_plan: {
          mld_frequency: (typeof computedISL === 'number' ? computedISL : 2) >= 2 ? 'Daily × 5 days/week' : '2-3 times/week',
          bandaging_type: (typeof computedISL === 'number' ? computedISL : 2) >= 2 ? 'Multi-layer short-stretch' : 'Light compression',
          exercise_program: ['Diaphragmatic breathing', 'Active ROM exercises', 'Walking 30 min/day'],
          skin_care_regimen: ['pH-neutral wash daily', 'Urea 10% moisturizer', 'Antifungal if needed'],
          compression_garment: computedISL === 3 ? 'Flat-knit Class III-IV' : computedISL === 2 || computedISL === '2late' ? 'Flat-knit Class II-III' : 'Circular-knit Class I-II',
          compression_class: formData.compression_class,
          pneumatic_compression: formData.pneumatic_compression,
          follow_up_schedule: ['Week 2', 'Week 4', 'Month 2', 'Month 3', 'Month 6', 'Month 12', 'Annually']
        },
        surgical_candidate: surgCriteria.candidate,
        surgical_criteria_met: surgCriteria.met,
        surgical_criteria_not_met: surgCriteria.notMet,
        status: 'active',
        notes: formData.notes,
        created_at: new Date(),
        updated_at: new Date()
      };

      const localId = await db.lymphedema_assessments.add(assessment as any);
      await syncService.queueAction('create', 'lymphedema_assessments' as any, localId as number, assessment);
      setAssessments(prev => [assessment, ...prev]);
      setSelectedAssessment(assessment);
      setActiveTab('details');

      // Reset form
      setFormData({
        etiology: '', affected_limb: '', onset_date: '', duration_months: 0,
        prior_treatments: [], comorbidities: [], cancer_history: '',
        radiation_history: false, lymph_node_dissection: false,
        recurrent_cellulitis_episodes: 0, stemmer_sign: false,
        pitting: 'none', fibrosis: 'none', papillomatosis: false,
        lymphorrhea: false, fungal_infection: false, wounds_present: false,
        skin_changes: [], elevation_reduces: true,
        lefs_score: undefined, dash_score: undefined, quality_of_life_score: undefined,
        notes: '', compression_class: 'II', pneumatic_compression: false
      });
      setSelectedPatient(null);
    } catch (e) {
      console.error('Error saving assessment:', e);
      alert('Failed to save assessment');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // RENDER: Protocol Reference Tab
  // ============================================
  const renderProtocolTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200 p-5">
        <h2 className="text-xl font-bold text-green-800 mb-2">Lymphedema Management Protocol</h2>
        <p className="text-sm text-green-700">
          Comprehensive evidence-based protocol for assessment, staging, treatment planning, CDT, surgical debulking criteria, and long-term monitoring.
        </p>
      </div>

      {/* ISL Staging */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <button onClick={() => setExpandedSection(expandedSection === 'isl' ? null : 'isl')}
          className="w-full flex justify-between items-center">
          <h3 className="text-lg font-semibold">ISL Staging System</h3>
          {expandedSection === 'isl' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {expandedSection === 'isl' && (
          <div className="mt-4 space-y-3">
            {Object.entries(ISL_STAGES).map(([key, stage]) => (
              <div key={key} className={`rounded-lg border p-3 ${stage.color}`}>
                <h4 className="font-semibold text-sm">{stage.name}</h4>
                <p className="text-xs mt-1 italic">{stage.description}</p>
                <ul className="mt-2 space-y-0.5">
                  {stage.criteria.map((c, i) => <li key={i} className="text-xs flex items-start"><span className="mr-1.5 mt-0.5">•</span>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CDT Protocol */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <button onClick={() => setExpandedSection(expandedSection === 'cdt' ? null : 'cdt')}
          className="w-full flex justify-between items-center">
          <h3 className="text-lg font-semibold text-green-700">Complete Decongestive Therapy (CDT)</h3>
          {expandedSection === 'cdt' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {expandedSection === 'cdt' && (
          <div className="mt-4 space-y-6">
            {[CDT_PROTOCOL.intensive_phase, CDT_PROTOCOL.maintenance_phase].map((phase) => (
              <div key={phase.name} className="border rounded-lg p-4">
                <h4 className="font-bold text-green-700">{phase.name}</h4>
                <div className="flex gap-4 mt-1 mb-3">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3 inline mr-1" />{phase.duration}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{phase.frequency}</span>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-3">{phase.goal}</p>
                <div className="space-y-4">
                  {phase.components.map((comp, ci) => (
                    <div key={ci} className="bg-gray-50 rounded-lg p-3">
                      <h5 className="font-semibold text-sm text-gray-800">{comp.name}</h5>
                      <p className="text-xs text-gray-600 italic mb-2">{comp.description}</p>
                      <ul className="space-y-0.5">
                        {comp.details.map((d, di) => <li key={di} className="text-xs text-gray-700 flex items-start"><span className="mr-1.5 text-green-500 mt-0.5">•</span>{d}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Surgical Criteria */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <button onClick={() => setExpandedSection(expandedSection === 'surg' ? null : 'surg')}
          className="w-full flex justify-between items-center">
          <h3 className="text-lg font-semibold text-red-700">Surgical Debulking Criteria & Procedures</h3>
          {expandedSection === 'surg' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {expandedSection === 'surg' && (
          <div className="mt-4 space-y-4">
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <h4 className="font-semibold text-red-800 text-sm mb-2">Absolute Indications</h4>
              <ul className="space-y-1">
                {SURGICAL_DEBULKING_CRITERIA.absolute_indications.map((c, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start"><AlertCircle className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />{c}</li>
                ))}
              </ul>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 text-sm mb-2">Relative Indications</h4>
              <ul className="space-y-1">
                {SURGICAL_DEBULKING_CRITERIA.relative_indications.map((c, i) => (
                  <li key={i} className="text-xs text-yellow-700 flex items-start"><Info className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />{c}</li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="font-semibold text-gray-800 text-sm mb-2">Contraindications</h4>
              <ul className="space-y-1">
                {SURGICAL_DEBULKING_CRITERIA.contraindications.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start"><X className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0 text-red-400" />{c}</li>
                ))}
              </ul>
            </div>
            <h4 className="font-bold text-gray-800 mt-4">Surgical Procedures</h4>
            {SURGICAL_DEBULKING_CRITERIA.surgical_procedures.map((proc, pi) => (
              <div key={pi} className="border rounded-lg p-3">
                <h5 className="font-semibold text-sm">{proc.name}</h5>
                <p className="text-xs text-gray-600 italic">{proc.description}</p>
                <p className="text-xs mt-1"><span className="font-medium">Indications:</span> {proc.indications}</p>
                <ul className="mt-2 space-y-0.5">
                  {proc.key_points.map((kp, ki) => <li key={ki} className="text-xs text-gray-700 flex items-start"><span className="mr-1.5 text-green-500 mt-0.5">•</span>{kp}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scoring Systems */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <button onClick={() => setExpandedSection(expandedSection === 'scoring' ? null : 'scoring')}
          className="w-full flex justify-between items-center">
          <h3 className="text-lg font-semibold">Scoring & Assessment Tools</h3>
          {expandedSection === 'scoring' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {expandedSection === 'scoring' && (
          <div className="mt-4 space-y-3">
            {Object.entries(SCORING_SYSTEMS).map(([key, sys]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-semibold text-sm">{sys.name}</h4>
                <p className="text-xs text-gray-600">{sys.description}</p>
                <p className="text-xs font-medium mt-1">{sys.scoring}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // RENDER: Treatment Timeline Tab
  // ============================================
  const renderTimelineTab = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
        <h2 className="text-xl font-bold text-blue-800">Complete Treatment Timeline</h2>
        <p className="text-sm text-blue-700 mt-1">Standard 10-phase sequence from initial assessment through lifelong maintenance.</p>
      </div>
      <div className="relative">
        {/* Timeline vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-green-200" />
        {TREATMENT_TIMELINE.map((phase, idx) => (
          <div key={phase.phase} className="relative pl-14 pb-4">
            {/* Timeline node */}
            <div className={`absolute left-4 w-5 h-5 rounded-full border-2 ${
              idx < 4 ? 'bg-green-500 border-green-600' : idx < 6 ? 'bg-yellow-500 border-yellow-600' : idx < 8 ? 'bg-red-500 border-red-600' : 'bg-blue-500 border-blue-600'
            } flex items-center justify-center`}>
              <span className="text-white text-[8px] font-bold">{idx + 1}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <button onClick={() => setExpandedTimeline(expandedTimeline === phase.phase ? null : phase.phase)}
                className="w-full text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-sm">{phase.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1 inline-block">
                      <Calendar className="w-3 h-3 inline mr-1" />{phase.period}
                    </span>
                  </div>
                  {expandedTimeline === phase.phase ? <ChevronUp className="w-4 h-4 mt-1" /> : <ChevronDown className="w-4 h-4 mt-1" />}
                </div>
                <p className="text-xs text-gray-600 mt-1">{phase.description}</p>
              </button>
              {expandedTimeline === phase.phase && (
                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Activities</h4>
                    <ul className="space-y-0.5">
                      {phase.activities.map((a, i) => <li key={i} className="text-xs text-gray-700 flex items-start"><span className="mr-1.5 text-green-500 mt-0.5">•</span>{a}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assessments Required</h4>
                    <div className="flex flex-wrap gap-1">
                      {phase.assessments.map((a, i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a}</span>)}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Milestones</h4>
                    <ul className="space-y-0.5">
                      {phase.milestones.map((m, i) => <li key={i} className="text-xs text-green-700 flex items-start"><CheckCircle className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />{m}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================
  // RENDER: New Assessment Tab
  // ============================================
  const renderNewAssessmentTab = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">New Lymphedema Assessment</h2>

      {/* Patient Selection */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-2">Select Patient</h3>
        {selectedPatient ? (
          <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
            <div>
              <p className="font-medium">{selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}</p>
              <p className="text-xs text-gray-500">#{selectedPatient.hospital_number}</p>
            </div>
            <button onClick={() => setSelectedPatient(null)} className="text-red-500" title="Clear patient selection"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search by name or hospital number..."
                value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            {patientSearch && (
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                {filteredPatients.slice(0, 10).map(p => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b text-sm">
                    <span className="font-medium">{p.full_name || `${p.first_name} ${p.last_name}`}</span>
                    <span className="text-gray-400 ml-2">#{p.hospital_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History & Etiology */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-3">History & Etiology</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="lymph-etiology" className="text-xs font-medium text-gray-600">Etiology *</label>
            <select id="lymph-etiology" value={formData.etiology} onChange={e => setFormData(prev => ({ ...prev, etiology: e.target.value as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select etiology...</option>
              <optgroup label="Primary">
                <option value="primary_congenital">Congenital (onset at birth)</option>
                <option value="primary_praecox">Praecox (onset before age 35)</option>
                <option value="primary_tarda">Tarda (onset after age 35)</option>
              </optgroup>
              <optgroup label="Secondary">
                <option value="secondary_surgical">Post-surgical (lymph node dissection)</option>
                <option value="secondary_radiation">Post-radiation therapy</option>
                <option value="secondary_infection">Post-infection (cellulitis/filariasis)</option>
                <option value="secondary_trauma">Post-trauma</option>
                <option value="secondary_filariasis">Filariasis</option>
                <option value="secondary_malignancy">Malignancy/tumour obstruction</option>
                <option value="secondary_obesity">Obesity-related</option>
                <option value="secondary_cvi">Chronic venous insufficiency</option>
                <option value="secondary_other">Other secondary</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="lymph-affected-limb" className="text-xs font-medium text-gray-600">Affected Limb *</label>
            <select id="lymph-affected-limb" value={formData.affected_limb} onChange={e => setFormData(prev => ({ ...prev, affected_limb: e.target.value as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select...</option>
              <option value="left_upper">Left Upper Limb</option>
              <option value="right_upper">Right Upper Limb</option>
              <option value="left_lower">Left Lower Limb</option>
              <option value="right_lower">Right Lower Limb</option>
              <option value="bilateral_upper">Bilateral Upper Limbs</option>
              <option value="bilateral_lower">Bilateral Lower Limbs</option>
              <option value="genital">Genital</option>
              <option value="head_neck">Head & Neck</option>
            </select>
          </div>
          <div>
            <label htmlFor="lymph-onset-date" className="text-xs font-medium text-gray-600">Onset Date</label>
            <input id="lymph-onset-date" type="date" value={formData.onset_date} onChange={e => setFormData(prev => ({ ...prev, onset_date: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label htmlFor="lymph-duration" className="text-xs font-medium text-gray-600">Duration (months)</label>
            <input id="lymph-duration" type="number" min={0} value={formData.duration_months} onChange={e => setFormData(prev => ({ ...prev, duration_months: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Cancer History</label>
            <input type="text" placeholder="e.g., Breast Ca, Cervical Ca..." value={formData.cancer_history}
              onChange={e => setFormData(prev => ({ ...prev, cancer_history: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label htmlFor="lymph-cellulitis-episodes" className="text-xs font-medium text-gray-600">Cellulitis Episodes / Year</label>
            <input id="lymph-cellulitis-episodes" type="number" min={0} value={formData.recurrent_cellulitis_episodes}
              onChange={e => setFormData(prev => ({ ...prev, recurrent_cellulitis_episodes: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.radiation_history} onChange={e => setFormData(prev => ({ ...prev, radiation_history: e.target.checked }))} className="rounded" />
            Prior radiation therapy
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.lymph_node_dissection} onChange={e => setFormData(prev => ({ ...prev, lymph_node_dissection: e.target.checked }))} className="rounded" />
            Lymph node dissection
          </label>
        </div>
      </div>

      {/* Physical Examination */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-3">Physical Examination</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.stemmer_sign} onChange={e => setFormData(prev => ({ ...prev, stemmer_sign: e.target.checked }))} className="rounded" />
            Stemmer Sign Positive
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.papillomatosis} onChange={e => setFormData(prev => ({ ...prev, papillomatosis: e.target.checked }))} className="rounded" />
            Papillomatosis
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.lymphorrhea} onChange={e => setFormData(prev => ({ ...prev, lymphorrhea: e.target.checked }))} className="rounded" />
            Lymphorrhea
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.fungal_infection} onChange={e => setFormData(prev => ({ ...prev, fungal_infection: e.target.checked }))} className="rounded" />
            Fungal Infection
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.wounds_present} onChange={e => setFormData(prev => ({ ...prev, wounds_present: e.target.checked }))} className="rounded" />
            Wounds Present
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.elevation_reduces} onChange={e => setFormData(prev => ({ ...prev, elevation_reduces: e.target.checked }))} className="rounded" />
            Elevation Reduces Swelling
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div>
            <label htmlFor="lymph-pitting" className="text-xs font-medium text-gray-600">Pitting</label>
            <select id="lymph-pitting" value={formData.pitting} onChange={e => setFormData(prev => ({ ...prev, pitting: e.target.value as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="none">None</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
          <div>
            <label htmlFor="lymph-fibrosis" className="text-xs font-medium text-gray-600">Fibrosis</label>
            <select id="lymph-fibrosis" value={formData.fibrosis} onChange={e => setFormData(prev => ({ ...prev, fibrosis: e.target.value as any }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="none">None</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
        </div>
      </div>

      {/* Circumferential Measurements */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-3 flex items-center">
          <Ruler className="w-4 h-4 mr-2 text-green-600" />
          Circumferential Limb Measurements (cm)
        </h3>
        <p className="text-xs text-gray-500 mb-3">Measure at each point every 4cm from the most distal landmark. Enter both affected and contralateral limb.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Location</th>
                <th className="text-center p-2">Affected (cm)</th>
                <th className="text-center p-2">Contralateral (cm)</th>
                <th className="text-center p-2">Diff (cm)</th>
                <th className="text-center p-2">Diff (%)</th>
              </tr>
            </thead>
            <tbody>
              {limbMeasurements.map((m, i) => (
                <tr key={i} className={`border-t ${m.difference_pct > 20 ? 'bg-red-50' : m.difference_pct > 10 ? 'bg-yellow-50' : ''}`}>
                  <td className="p-2 font-medium">{m.location}</td>
                  <td className="p-1 text-center">
                    <input type="number" step="0.1" min={0} value={m.affected_cm || ''}
                      onChange={e => updateMeasurement(i, 'affected_cm', Number(e.target.value))}
                      aria-label={`Affected limb measurement at ${m.location}`}
                      className="w-16 border rounded px-2 py-1 text-center" />
                  </td>
                  <td className="p-1 text-center">
                    <input type="number" step="0.1" min={0} value={m.contralateral_cm || ''}
                      onChange={e => updateMeasurement(i, 'contralateral_cm', Number(e.target.value))}
                      aria-label={`Contralateral limb measurement at ${m.location}`}
                      className="w-16 border rounded px-2 py-1 text-center" />
                  </td>
                  <td className={`p-2 text-center font-medium ${m.difference_cm > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {m.difference_cm > 0 ? '+' : ''}{m.difference_cm}
                  </td>
                  <td className={`p-2 text-center font-medium ${m.difference_pct > 20 ? 'text-red-600' : m.difference_pct > 10 ? 'text-yellow-600' : 'text-gray-600'}`}>
                    {m.difference_pct > 0 ? '+' : ''}{m.difference_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Volume Summary */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-xs text-blue-600">Affected Volume</p>
            <p className="text-lg font-bold text-blue-800">{computedVolumes.affected} ml</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-600">Contralateral Volume</p>
            <p className="text-lg font-bold text-gray-800">{computedVolumes.contralateral} ml</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${computedVolumes.difference_pct > 20 ? 'bg-red-50' : computedVolumes.difference_pct > 10 ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <p className="text-xs text-gray-600">Volume Difference</p>
            <p className={`text-lg font-bold ${computedVolumes.difference_pct > 20 ? 'text-red-700' : computedVolumes.difference_pct > 10 ? 'text-yellow-700' : 'text-green-700'}`}>
              {computedVolumes.difference_pct}%
            </p>
          </div>
        </div>
      </div>

      {/* Auto-Staging Result */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-3">Auto-Generated Staging</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={`rounded-lg border p-3 ${ISL_STAGES[String(computedISL)]?.color || 'bg-gray-50'}`}>
            <p className="text-xs font-medium">ISL Stage</p>
            <p className="text-lg font-bold">{ISL_STAGES[String(computedISL)]?.name || 'Unknown'}</p>
          </div>
          <div className="rounded-lg border p-3 bg-purple-50 border-purple-200">
            <p className="text-xs font-medium text-purple-600">Campisi Stage</p>
            <p className="text-lg font-bold text-purple-800">{CAMPISI_STAGES[computedCampisi]?.name}: {CAMPISI_STAGES[computedCampisi]?.description}</p>
          </div>
        </div>
        {/* Surgical Candidacy */}
        {(() => {
          const sc = evaluateSurgicalCriteria();
          return (
            <div className={`mt-3 rounded-lg border p-3 ${sc.candidate ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`font-semibold text-sm ${sc.candidate ? 'text-red-800' : 'text-green-800'}`}>
                Surgical Candidacy: {sc.candidate ? 'POTENTIALLY INDICATED — Consider referral' : 'Not currently indicated — Continue CDT'}
              </p>
              {sc.met.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-600">Criteria Met:</p>
                  {sc.met.map((m, i) => <p key={i} className="text-xs text-red-700">✓ {m}</p>)}
                </div>
              )}
              {sc.notMet.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs font-medium text-gray-500">Criteria Not Met:</p>
                  {sc.notMet.map((m, i) => <p key={i} className="text-xs text-gray-500">✗ {m}</p>)}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Functional Scores */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-3">Functional & QoL Scores (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">LEFS Score (0-80)</label>
            <input type="number" min={0} max={80} value={formData.lefs_score ?? ''}
              onChange={e => setFormData(prev => ({ ...prev, lefs_score: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Lower limb function" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">DASH Score (0-100)</label>
            <input type="number" min={0} max={100} value={formData.dash_score ?? ''}
              onChange={e => setFormData(prev => ({ ...prev, dash_score: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Upper limb disability" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">LYMQOL (0-10)</label>
            <input type="number" min={0} max={10} step="0.1" value={formData.quality_of_life_score ?? ''}
              onChange={e => setFormData(prev => ({ ...prev, quality_of_life_score: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Quality of life" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold mb-2">Clinical Notes</h3>
        <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3} placeholder="Additional clinical notes..."
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Save */}
      <button onClick={handleSaveAssessment} disabled={isSaving || !selectedPatient || !formData.etiology}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        {isSaving ? 'Saving...' : 'Save Lymphedema Assessment'}
      </button>
    </div>
  );

  // ============================================
  // RENDER: Assessment Detail View
  // ============================================
  const renderDetailsTab = () => {
    if (!selectedAssessment) return <p className="text-center text-gray-500 py-12">Select an assessment to view details</p>;
    const a = selectedAssessment;
    const islInfo = ISL_STAGES[String(a.isl_stage)];
    const campisiInfo = CAMPISI_STAGES[a.campisi_stage];

    return (
      <div className="space-y-4">
        <button onClick={() => setActiveTab('assessments')} className="text-sm text-green-600 flex items-center gap-1">
          ← Back to Assessments
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{a.patient_name}</h2>
              <p className="text-sm text-gray-500">#{a.hospital_number} | {new Date(a.assessment_date).toLocaleDateString()}</p>
              <p className="text-xs text-gray-400">Assessed by: {a.assessed_by}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {a.status}
            </div>
          </div>
        </div>

        {/* Staging */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={`rounded-xl border p-4 ${islInfo?.color || 'bg-gray-50'}`}>
            <p className="text-xs font-medium">ISL Stage</p>
            <p className="text-lg font-bold">{islInfo?.name}</p>
            <p className="text-xs italic mt-1">{islInfo?.description}</p>
          </div>
          <div className="rounded-xl border p-4 bg-purple-50 border-purple-200">
            <p className="text-xs font-medium text-purple-600">Campisi Stage</p>
            <p className="text-lg font-bold text-purple-800">{campisiInfo?.name}</p>
            <p className="text-xs text-purple-600">{campisiInfo?.description}</p>
          </div>
        </div>

        {/* Clinical Details */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Clinical Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">Etiology</p><p className="font-medium">{a.etiology.replace(/_/g, ' ')}</p></div>
            <div><p className="text-gray-500 text-xs">Affected Limb</p><p className="font-medium">{a.affected_limb.replace(/_/g, ' ')}</p></div>
            <div><p className="text-gray-500 text-xs">Duration</p><p className="font-medium">{a.duration_months} months</p></div>
            <div><p className="text-gray-500 text-xs">Cellulitis Episodes</p><p className="font-medium">{a.recurrent_cellulitis_episodes}/year</p></div>
            <div><p className="text-gray-500 text-xs">Stemmer Sign</p><p className="font-medium">{a.stemmer_sign ? 'Positive' : 'Negative'}</p></div>
            <div><p className="text-gray-500 text-xs">Pitting</p><p className="font-medium capitalize">{a.pitting}</p></div>
            <div><p className="text-gray-500 text-xs">Fibrosis</p><p className="font-medium capitalize">{a.fibrosis}</p></div>
            <div><p className="text-gray-500 text-xs">Papillomatosis</p><p className="font-medium">{a.papillomatosis ? 'Yes' : 'No'}</p></div>
          </div>
        </div>

        {/* Volumes */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Volume Assessment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600">Affected</p>
              <p className="text-xl font-bold text-blue-800">{a.volume_affected_ml} ml</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600">Contralateral</p>
              <p className="text-xl font-bold text-gray-800">{a.volume_contralateral_ml} ml</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${a.volume_difference_pct > 20 ? 'bg-red-50' : a.volume_difference_pct > 10 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <p className="text-xs text-gray-600">Difference</p>
              <p className={`text-xl font-bold ${a.volume_difference_pct > 20 ? 'text-red-700' : a.volume_difference_pct > 10 ? 'text-yellow-700' : 'text-green-700'}`}>
                {a.volume_difference_pct}%
              </p>
            </div>
          </div>
          {/* Measurement table */}
          {a.limb_measurements && a.limb_measurements.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50"><th className="p-1.5 text-left">Location</th><th className="p-1.5 text-center">Affected</th><th className="p-1.5 text-center">Contralateral</th><th className="p-1.5 text-center">Diff %</th></tr></thead>
                <tbody>
                  {a.limb_measurements.filter(m => m.affected_cm > 0).map((m, i) => (
                    <tr key={i} className={`border-t ${m.difference_pct > 20 ? 'bg-red-50' : ''}`}>
                      <td className="p-1.5">{m.location}</td>
                      <td className="p-1.5 text-center">{m.affected_cm}</td>
                      <td className="p-1.5 text-center">{m.contralateral_cm}</td>
                      <td className={`p-1.5 text-center font-medium ${m.difference_pct > 20 ? 'text-red-600' : ''}`}>{m.difference_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Treatment Plan */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold mb-3 text-green-700">Treatment Plan</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">CDT Phase</p><p className="font-medium capitalize">{a.cdt_phase}</p></div>
            <div><p className="text-gray-500 text-xs">MLD Frequency</p><p className="font-medium">{a.treatment_plan.mld_frequency}</p></div>
            <div><p className="text-gray-500 text-xs">Bandaging</p><p className="font-medium">{a.treatment_plan.bandaging_type}</p></div>
            <div><p className="text-gray-500 text-xs">Compression Garment</p><p className="font-medium">{a.treatment_plan.compression_garment}</p></div>
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500">Follow-Up Schedule:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {a.treatment_plan.follow_up_schedule.map((f, i) => (
                <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Surgical Candidacy */}
        <div className={`rounded-xl border p-4 ${a.surgical_candidate ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className={`font-semibold mb-2 ${a.surgical_candidate ? 'text-red-800' : 'text-green-800'}`}>
            Surgical Candidacy: {a.surgical_candidate ? 'Potentially Indicated' : 'Not Currently Indicated'}
          </h3>
          {a.surgical_criteria_met.length > 0 && (
            <div className="mb-2">
              {a.surgical_criteria_met.map((c, i) => <p key={i} className="text-xs text-red-700">✓ {c}</p>)}
            </div>
          )}
          {a.surgical_criteria_not_met.length > 0 && (
            <div>
              {a.surgical_criteria_not_met.map((c, i) => <p key={i} className="text-xs text-gray-500">✗ {c}</p>)}
            </div>
          )}
        </div>

        {a.notes && (
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold mb-2">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.notes}</p>
          </div>
        )}

        {/* Patient Education & PDF Download */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-700">
            <FileText className="w-5 h-5" />
            Patient Education & Care Plan Document
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Generate a comprehensive patient education document with diagnosis explanation, treatment plan, timeline, self-care instructions, and consent form.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handlePrintPDF(a)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <Printer className="w-4 h-4" /> Print Care Plan
            </button>
            <button onClick={() => handleDownloadPDF(a)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Download className="w-4 h-4" /> Download as PDF
            </button>
            <button onClick={() => handleSharePDF(a)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
              <Share2 className="w-4 h-4" /> Share with Patient
            </button>
          </div>
        </div>

        {/* Consent Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-700">
            <Upload className="w-5 h-5" />
            Patient Consent to Treatment
          </h3>
          {(a as any).consent_document ? (
            <div className="bg-green-50 rounded-lg border border-green-200 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Consent uploaded</p>
                  <p className="text-xs text-green-600">{(a as any).consent_filename || 'consent_document'} — {(a as any).consent_uploaded_at ? new Date((a as any).consent_uploaded_at).toLocaleString() : ''}</p>
                </div>
              </div>
              {(a as any).consent_document?.startsWith('data:image') && (
                <img src={(a as any).consent_document} alt="Consent" className="mt-2 max-h-48 rounded border" />
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">Upload the signed consent form (photo/scan of signature, PDF, or image).</p>
              <input ref={consentInputRef} type="file" accept="image/*,.pdf" onChange={handleConsentUpload} className="hidden" />
              <div className="flex items-center gap-3">
                <button onClick={() => consentInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm hover:border-green-500 hover:bg-green-50 transition-colors">
                  <Upload className="w-4 h-4 text-gray-500" />
                  {consentFile ? consentFile.name : 'Choose file or take photo...'}
                </button>
                {consentFile && (
                  <button onClick={() => handleSaveConsent(a.id)}
                    disabled={consentUploaded}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    <Save className="w-4 h-4" />
                    {consentUploaded ? 'Saved ✓' : 'Save Consent'}
                  </button>
                )}
              </div>
              {consentPreview && (
                <img src={consentPreview} alt="Consent preview" className="mt-3 max-h-48 rounded border" />
              )}
            </div>
          )}
        </div>

        {/* Treatment Tracking & Monitoring */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold flex items-center gap-2 text-blue-700">
              <Activity className="w-5 h-5" />
              Treatment Tracking & Monitoring
            </h3>
            <button onClick={() => setShowAddTracking(!showAddTracking)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
              <Plus className="w-3 h-3" /> Add Entry
            </button>
          </div>

          {showAddTracking && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 mb-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Phase</label>
                  <select value={trackingForm.phase} onChange={e => setTrackingForm(prev => ({ ...prev, phase: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
                    <option value="cdt_intensive">CDT Intensive</option>
                    <option value="cdt_maintenance">CDT Maintenance</option>
                    <option value="transition">Transition</option>
                    <option value="surgical_evaluation">Surgical Evaluation</option>
                    <option value="postoperative">Post-Operative</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Activity</label>
                  <input type="text" value={trackingForm.activity} placeholder="e.g., MLD session, garment fitting..."
                    onChange={e => setTrackingForm(prev => ({ ...prev, activity: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Compliance</label>
                  <select value={trackingForm.compliance} onChange={e => setTrackingForm(prev => ({ ...prev, compliance: e.target.value as any }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
                    <option value="full">Full Compliance</option>
                    <option value="partial">Partial Compliance</option>
                    <option value="missed">Missed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Volume Change (%)</label>
                  <input type="number" step="0.1" value={trackingForm.volume_change_pct}
                    onChange={e => setTrackingForm(prev => ({ ...prev, volume_change_pct: Number(e.target.value) }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Next Due Date</label>
                  <input type="date" value={trackingForm.next_due}
                    onChange={e => setTrackingForm(prev => ({ ...prev, next_due: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                </div>
                <label className="flex items-center gap-2 text-sm mt-4">
                  <input type="checkbox" checked={trackingForm.measurements_taken}
                    onChange={e => setTrackingForm(prev => ({ ...prev, measurements_taken: e.target.checked }))} className="rounded" />
                  Measurements taken
                </label>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <textarea value={trackingForm.notes} onChange={e => setTrackingForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2} placeholder="Clinical notes for this entry..."
                  className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
              </div>
              <button onClick={() => handleAddTrackingEntry(a.id)}
                disabled={!trackingForm.activity}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">
                Save Entry
              </button>
            </div>
          )}

          {trackingEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tracking entries yet. Click "Add Entry" to start monitoring treatment progress.</p>
          ) : (
            <div className="space-y-2">
              {trackingEntries.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                <div key={entry.id} className={`rounded-lg border p-3 ${
                  entry.compliance === 'full' ? 'bg-green-50 border-green-200' :
                  entry.compliance === 'partial' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{entry.activity}</p>
                      <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString()} — Phase: {entry.phase.replace(/_/g, ' ')}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.compliance === 'full' ? 'bg-green-200 text-green-800' :
                      entry.compliance === 'partial' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'
                    }`}>{entry.compliance}</span>
                  </div>
                  {entry.volume_change_pct !== 0 && (
                    <p className="text-xs mt-1">
                      Volume change: <span className={entry.volume_change_pct < 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {entry.volume_change_pct > 0 ? '+' : ''}{entry.volume_change_pct}%
                      </span>
                    </p>
                  )}
                  {entry.notes && <p className="text-xs text-gray-600 mt-1">{entry.notes}</p>}
                  {entry.next_due && <p className="text-xs text-blue-600 mt-1">Next due: {new Date(entry.next_due).toLocaleDateString()}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminders & Notifications */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold flex items-center gap-2 text-orange-700">
              <Bell className="w-5 h-5" />
              Treatment Reminders & Notifications
            </h3>
            <button onClick={() => setShowAddReminder(!showAddReminder)}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium">
              <Plus className="w-3 h-3" /> Schedule Reminder
            </button>
          </div>

          {showAddReminder && (
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 mb-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Reminder Type</label>
                  <select value={reminderForm.type} onChange={e => {
                    const type = e.target.value as any;
                    const preset = REMINDER_PRESETS[type];
                    setReminderForm(prev => ({ ...prev, type, title: type !== 'custom' ? '' : prev.title, message: type !== 'custom' ? '' : prev.message }));
                  }} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
                    <option value="mld">MLD Session</option>
                    <option value="bandaging">Compression Bandaging</option>
                    <option value="exercise">Exercise</option>
                    <option value="garment">Garment Check/Replace</option>
                    <option value="followup">Follow-Up Appointment</option>
                    <option value="medication">Medication</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Custom Title (optional)</label>
                  <input type="text" value={reminderForm.title}
                    placeholder={REMINDER_PRESETS[reminderForm.type]?.title || 'Reminder title'}
                    onChange={e => setReminderForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Date</label>
                  <input type="date" value={reminderForm.date}
                    onChange={e => setReminderForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Time</label>
                  <input type="time" value={reminderForm.time}
                    onChange={e => setReminderForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Custom Message (optional)</label>
                <textarea value={reminderForm.message}
                  placeholder={REMINDER_PRESETS[reminderForm.type]?.message || 'Reminder message...'}
                  onChange={e => setReminderForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={2} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
              </div>
              <button onClick={() => handleAddReminder(a.id, a.patient_name)}
                disabled={!reminderForm.date}
                className="px-4 py-1.5 bg-orange-600 text-white rounded text-sm font-medium disabled:opacity-50">
                Schedule Reminder
              </button>
            </div>
          )}

          {reminders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No reminders scheduled. Click "Schedule Reminder" to set up treatment notifications.</p>
          ) : (
            <div className="space-y-2">
              {reminders.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(rem => {
                const remDate = new Date(`${rem.date}T${rem.time}`);
                const isPast = remDate < new Date();
                return (
                  <div key={rem.id} className={`rounded-lg border p-3 flex justify-between items-start ${
                    isPast ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div>
                      <p className={`text-sm font-medium ${isPast ? 'text-gray-500' : ''}`}>
                        {rem.type === 'mld' ? '💆' : rem.type === 'bandaging' ? '🩹' : rem.type === 'exercise' ? '🏃' :
                          rem.type === 'garment' ? '🧤' : rem.type === 'followup' ? '📅' : rem.type === 'medication' ? '💊' : '🔔'}
                        {' '}{rem.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{rem.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        📆 {remDate.toLocaleDateString()} at {remDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isPast ? ' — Past' : ` — In ${Math.ceil((remDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} day(s)`}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteReminder(a.id, rem.id)}
                      className="text-red-400 hover:text-red-600 p-1" title="Remove reminder">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  const tabs = [
    { id: 'protocol' as const, label: 'Protocol', icon: FileText },
    { id: 'timeline' as const, label: 'Timeline', icon: Clock },
    { id: 'assessments' as const, label: 'Assessments', icon: ClipboardList },
    { id: 'new' as const, label: 'New', icon: Plus },
    { id: 'surgical' as const, label: 'Surgery', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            <tab.icon className="w-4 h-4 inline mr-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'protocol' && renderProtocolTab()}
      {activeTab === 'timeline' && renderTimelineTab()}
      {activeTab === 'new' && renderNewAssessmentTab()}
      {activeTab === 'details' && renderDetailsTab()}
      {activeTab === 'surgical' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 p-5">
            <h2 className="text-xl font-bold text-red-800">Surgical Debulking & Reconstruction</h2>
            <p className="text-sm text-red-700 mt-1">Indications, contraindications, and procedure details for surgical management of lymphedema.</p>
          </div>
          {/* Criteria */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-red-700 mb-3">Absolute Indications for Surgery</h3>
            {SURGICAL_DEBULKING_CRITERIA.absolute_indications.map((c, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{c}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-yellow-700 mb-3">Relative Indications</h3>
            {SURGICAL_DEBULKING_CRITERIA.relative_indications.map((c, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <Info className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{c}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Contraindications</h3>
            {SURGICAL_DEBULKING_CRITERIA.contraindications.map((c, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{c}</p>
              </div>
            ))}
          </div>
          {/* Procedures */}
          {SURGICAL_DEBULKING_CRITERIA.surgical_procedures.map((proc, pi) => (
            <div key={pi} className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-semibold text-lg">{proc.name}</h3>
              <p className="text-sm text-gray-600 italic mt-1">{proc.description}</p>
              <p className="text-sm mt-2"><span className="font-medium text-green-700">Indications:</span> {proc.indications}</p>
              <div className="mt-3 bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Key Operative Points</h4>
                <ul className="space-y-1">
                  {proc.key_points.map((kp, ki) => (
                    <li key={ki} className="text-sm flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      {kp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">All Lymphedema Assessments</h2>
          {assessments.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No assessments yet. Create one from the "New" tab.</p>
          ) : (
            <div className="grid gap-3">
              {assessments.map(a => (
                <div key={a.id} onClick={() => { setSelectedAssessment(a); setActiveTab('details'); }}
                  className="bg-white rounded-xl shadow-sm border p-4 hover:border-green-500 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{a.patient_name}</h3>
                      <p className="text-sm text-gray-500">{a.affected_limb.replace(/_/g, ' ')} — {a.etiology.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400 mt-1">Vol diff: {a.volume_difference_pct}% | {a.limb_measurements?.filter(m => m.affected_cm > 0).length || 0} measurements</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${ISL_STAGES[String(a.isl_stage)]?.color || 'bg-gray-100'}`}>
                        {ISL_STAGES[String(a.isl_stage)]?.name?.split('(')[0] || `ISL ${a.isl_stage}`}
                      </span>
                      <p className="text-xs text-gray-400 mt-2">{new Date(a.assessment_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LymphedemaPage;
