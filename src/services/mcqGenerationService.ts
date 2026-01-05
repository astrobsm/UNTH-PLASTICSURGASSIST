import { db } from '../db/database';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS
} from '../utils/pdfUtils';

// WACS Curriculum Topics Database
export const WACS_CURRICULUM_TOPICS = {
  // Part I - Principles of Surgery
  part_i_principles: [
    {
      title: "Preoperative Management & Patient Assessment",
      category: "Part I - Principles",
      content: "Patient assessment for anaesthesia and surgery; applied physiology/anatomy/biochemistry (respiratory, cardiovascular, renal); principles of anaesthesia; fluid and electrolyte balance; shock management"
    },
    {
      title: "Laboratory Investigations in Surgery",
      category: "Part I - Principles",
      content: "Biochemistry, haematology/transfusion, microbiology; blood grouping and cross-matching; coagulation studies; electrolyte monitoring"
    },
    {
      title: "Imaging and Interventional Radiology",
      category: "Part I - Principles",
      content: "X-ray interpretation, ultrasound, CT scan, MRI; interventional radiology procedures; contrast studies"
    },
    {
      title: "Management of Comorbid Conditions",
      category: "Part I - Principles",
      content: "Malaria in surgical patients, malnutrition, cardiovascular disorders, respiratory diseases, endocrine disorders (diabetes, thyroid), anaemia management, HIV/AIDS in surgical practice"
    },
    {
      title: "Perioperative Care & Complications",
      category: "Part I - Principles",
      content: "Post-operative complications management, metabolic response to injury, DVT prophylaxis and treatment, acute renal failure in surgical patients"
    },
    {
      title: "Sepsis, Asepsis & Infection Control",
      category: "Part I - Principles",
      content: "Sterilisation and disinfection principles, surgical site infection prevention, hand hygiene, theatre protocols"
    },
    {
      title: "Antibiotics in Surgery",
      category: "Part I - Principles",
      content: "Prophylactic antibiotics, therapeutic antibiotic use, antibiotic resistance, surgical infections management"
    },
    {
      title: "Theatre Design & Surgical Equipment",
      category: "Part I - Principles",
      content: "Theatre design principles, surgical diathermy (monopolar/bipolar), equipment sterilisation, theatre management"
    },
    {
      title: "Trauma: Initial Resuscitation",
      category: "Part I - Principles",
      content: "ATLS principles, primary survey (ABCDE), venous access (peripheral, central), airway management, tracheostomy indications and technique"
    },
    {
      title: "Wound Management & Fracture Care",
      category: "Part I - Principles",
      content: "Wound exploration, wound care principles, primary and secondary closure, fracture management basics, splinting and immobilisation"
    },
    {
      title: "Day-Care Surgery & Ethics",
      category: "Part I - Principles",
      content: "Day-care surgery fundamentals, patient selection, surgical ethics, informed consent, medico-legal aspects, communication skills"
    },
    {
      title: "Hospital Administration & Surgical Audit",
      category: "Part I - Principles",
      content: "Hospital management basics, report writing, presentation skills, computers in surgical practice, surgical audit principles"
    }
  ],

  // Part I - Specialty Introductions
  part_i_specialty: [
    {
      title: "General Surgery Emergencies",
      category: "Part I - Specialty Intro",
      content: "Common abdominal emergencies, acute abdomen, soft tissue infections, emergency presentations and management"
    },
    {
      title: "Trauma & Emergency Assessment",
      category: "Part I - Specialty Intro",
      content: "Initial trauma assessment, resuscitation protocols, triage principles, mass casualty management basics"
    },
    {
      title: "Urology Basics",
      category: "Part I - Specialty Intro",
      content: "Renal ultrasonography principles, bladder outlet obstruction, prostatic conditions (BPH, prostatitis), urethral problems, testicular conditions"
    },
    {
      title: "Orthopaedics Fundamentals",
      category: "Part I - Specialty Intro",
      content: "Traction and immobilisation techniques, bone and joint infections (osteomyelitis, septic arthritis), bone tumours basics"
    },
    {
      title: "Anaesthesia & Critical Care",
      category: "Part I - Specialty Intro",
      content: "Local anaesthesia, regional anaesthesia, general anaesthesia principles, analgesia management, ICU care basics"
    },
    {
      title: "Paediatric Surgery Introduction",
      category: "Part I - Specialty Intro",
      content: "Paediatric patient assessment, hernias and hydroceles in children, stoma care, common childhood tumours"
    },
    {
      title: "Plastic Surgery Basics",
      category: "Part I - Specialty Intro",
      content: "Principles of reconstructive surgery, basic burns management, common craniofacial abnormalities (cleft lip & palate)"
    }
  ],

  // Part II - General Surgery
  part_ii_general: [
    {
      title: "Advanced Trauma Management",
      category: "Part II - General Surgery",
      content: "Craniocerebral trauma, thoracic trauma (pneumothorax, haemothorax, flail chest), abdominal trauma (solid organ injury, hollow viscus), skeletal trauma, mass casualties"
    },
    {
      title: "Surgical Infections & Abscesses",
      category: "Part II - General Surgery",
      content: "Breast abscess, injection site abscess, perianal abscess, pyomyositis, necrotizing fasciitis"
    },
    {
      title: "Soft Tissue Lumps & Swellings",
      category: "Part II - General Surgery",
      content: "Lipoma, sebaceous cyst, dermoid cyst, ganglion, other benign soft tissue masses"
    },
    {
      title: "Hernias - Comprehensive Management",
      category: "Part II - General Surgery",
      content: "Inguinal hernia (direct/indirect), femoral hernia, umbilical/paraumbilical hernia, epigastric hernia, incisional hernia repair"
    },
    {
      title: "Scrotal Pathology",
      category: "Part II - General Surgery",
      content: "Hydroceles, varicocele, testicular torsion, epididymo-orchitis, testicular tumours"
    },
    {
      title: "Oesophageal Diseases",
      category: "Part II - General Surgery",
      content: "Oesophageal perforation, oesophagitis, strictures (benign/malignant), motility disorders (achalasia), oesophageal carcinoma"
    },
    {
      title: "Gastrointestinal Bleeding",
      category: "Part II - General Surgery",
      content: "Upper GI bleeding (peptic ulcer, varices), lower GI bleeding (diverticular, colorectal), diagnosis and management protocols"
    },
    {
      title: "Gastric & Duodenal Pathology",
      category: "Part II - General Surgery",
      content: "Peptic ulcer disease, perforation, gastric outlet obstruction, gastric neoplasms (benign/malignant), Helicobacter pylori"
    },
    {
      title: "Appendicitis & Small Bowel Disorders",
      category: "Part II - General Surgery",
      content: "Acute appendicitis, appendiceal tumours, small bowel obstruction, Meckel's diverticulum"
    },
    {
      title: "Intestinal Obstruction",
      category: "Part II - General Surgery",
      content: "Adhesive obstruction, volvulus, intussusception, hernial obstruction, management algorithms"
    },
    {
      title: "Colorectal & Infectious Diseases",
      category: "Part II - General Surgery",
      content: "Typhoid perforation, amoebiasis, ascariasis, schistosomiasis, enterocutaneous fistula, inflammatory bowel disease, diverticular disease"
    },
    {
      title: "Colorectal Neoplasms",
      category: "Part II - General Surgery",
      content: "Colorectal cancer staging, surgical management, adjuvant therapy, polyps, familial adenomatous polyposis"
    },
    {
      title: "Anorectal Diseases",
      category: "Part II - General Surgery",
      content: "Anorectal trauma, infections, perianal abscess, fistula-in-ano, anal fissure, haemorrhoids, rectal prolapse, anal tumours"
    },
    {
      title: "Hepatobiliary Infections & Portal Hypertension",
      category: "Part II - General Surgery",
      content: "Liver abscess (pyogenic/amoebic), hydatid cyst, portal hypertension (variceal bleeding, ascites), surgical shunts"
    },
    {
      title: "Biliary Tract Disorders",
      category: "Part II - General Surgery",
      content: "Bile duct obstruction, cholelithiasis, cholecystitis (acute/chronic), cholangitis, biliary malignancies"
    },
    {
      title: "Pancreatic Diseases",
      category: "Part II - General Surgery",
      content: "Acute pancreatitis, chronic pancreatitis, pancreatic pseudocyst, pancreatic neoplasms"
    },
    {
      title: "Splenic Pathology",
      category: "Part II - General Surgery",
      content: "Splenic infections/infestations, hypersplenism, splenic trauma, splenic tumours, splenectomy indications"
    },
    {
      title: "Endocrine Surgery - Thyroid & Parathyroid",
      category: "Part II - General Surgery",
      content: "Thyroid nodules, goitre, thyroid cancer, thyroidectomy, hyperparathyroidism, parathyroidectomy"
    },
    {
      title: "Pituitary & Adrenal Surgery",
      category: "Part II - General Surgery",
      content: "Pituitary tumours workup, adrenal masses, phaeochromocytoma, Cushing's syndrome surgical management"
    },
    {
      title: "Breast Disease & Surgical Oncology",
      category: "Part II - General Surgery",
      content: "Breast cancer staging, surgical options (lumpectomy, mastectomy), sentinel node biopsy, axillary clearance, reconstruction"
    },
    {
      title: "Abdominal Wall Pathologies",
      category: "Part II - General Surgery",
      content: "Desmoid tumours, rectus sheath haematoma, ventral hernias, abdominal wall reconstruction"
    },
    {
      title: "Minimally Invasive Surgery",
      category: "Part II - General Surgery",
      content: "Laparoscopic cholecystectomy, laparoscopic appendectomy, diagnostic laparoscopy, endoscopic procedures"
    },
    {
      title: "Transplant Surgery Principles",
      category: "Part II - General Surgery",
      content: "Renal transplantation overview, organ donation, immunosuppression basics, transplant complications"
    },
    {
      title: "Surgical Critical Care",
      category: "Part II - General Surgery",
      content: "ICU management, ventilator support, sepsis management, multi-organ failure, nutrition support"
    },
    {
      title: "Research Methods & Evidence-Based Practice",
      category: "Part II - General Surgery",
      content: "Research methodology, surgical audit, evidence-based practice, dissertation requirements, statistical analysis"
    }
  ],

  // Part II - Plastic & Reconstructive Surgery
  part_ii_plastic: [
    {
      title: "Wound Healing & Tissue Repair",
      category: "Part II - Plastic Surgery",
      content: "Principles of wound healing, primary vs secondary intention, factors affecting healing, chronic wounds, growth factors"
    },
    {
      title: "Tissue Transfer Techniques",
      category: "Part II - Plastic Surgery",
      content: "Free skin grafts (split/full thickness), local flaps, pedicled flaps, free flaps with micro-anastomosis, flap physiology"
    },
    {
      title: "Grafts, Implants & Tissue Expansion",
      category: "Part II - Plastic Surgery",
      content: "Non-autogenous grafts, implant materials, tissue expansion principles and applications, biomaterials in plastic surgery"
    },
    {
      title: "Aesthetic Surgery Principles",
      category: "Part II - Plastic Surgery",
      content: "Patient selection for aesthetic procedures, psychological assessment, informed consent in cosmetic surgery, complications management"
    },
    {
      title: "Scar Management",
      category: "Part II - Plastic Surgery",
      content: "Scar cosmesis, hypertrophic scars, keloids, scar revision techniques, silicone therapy, steroid injections, laser treatment"
    },
    {
      title: "Benign Skin Lesions",
      category: "Part II - Plastic Surgery",
      content: "Naevi management, congenital melanocytic naevi, vascular malformations, benign tumours excision and reconstruction"
    },
    {
      title: "Laser Therapy in Plastic Surgery",
      category: "Part II - Plastic Surgery",
      content: "Basic laser principles, laser types, applications in scar treatment, vascular lesions, pigmentation, safety protocols"
    },
    {
      title: "Hand Trauma & Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Tendon injuries (flexor/extensor), neurovascular injuries, bone and joint injuries, hand infections (felon, paronychia), tendon transfers"
    },
    {
      title: "Facial Trauma Management",
      category: "Part II - Plastic Surgery",
      content: "Soft tissue facial injuries, nasal fractures, malar fractures, orbital fractures, maxillofacial trauma, mandibular fractures"
    },
    {
      title: "Microsurgery Principles",
      category: "Part II - Plastic Surgery",
      content: "Microvascular anastomosis techniques, free flap selection, donor site considerations, flap monitoring, complications"
    },
    {
      title: "Burns: Acute Management",
      category: "Part II - Plastic Surgery",
      content: "Major burns resuscitation (Parkland formula), airway management in burns, escharotomy, early excision and grafting"
    },
    {
      title: "Burns: Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Post-burn scarring, contracture release, skin grafting, flap reconstruction, burn scar management, rehabilitation"
    },
    {
      title: "Nutrition & Infection in Burns",
      category: "Part II - Plastic Surgery",
      content: "Hypermetabolic response, nutritional support, burn wound infections, antimicrobial dressings, topical agents"
    },
    {
      title: "Cleft Lip & Palate",
      category: "Part II - Plastic Surgery",
      content: "Embryology, surgical timing, cleft lip repair (Millard technique), cleft palate repair, speech outcomes, secondary procedures"
    },
    {
      title: "Craniofacial Surgery",
      category: "Part II - Plastic Surgery",
      content: "Craniosynostosis, craniofacial clefts, distraction osteogenesis, multidisciplinary team approach"
    },
    {
      title: "Hypospadias Repair",
      category: "Part II - Plastic Surgery",
      content: "Hypospadias classification, surgical techniques (TIP, onlay, tubularised), complications (fistula, stricture), staged repairs"
    },
    {
      title: "Congenital Hand Surgery",
      category: "Part II - Plastic Surgery",
      content: "Polydactyly, syndactyly, thumb hypoplasia, radial club hand, congenital constriction bands"
    },
    {
      title: "Malignant Skin Tumours",
      category: "Part II - Plastic Surgery",
      content: "Melanoma staging and management, sentinel node biopsy, regional lymph node dissection, squamous cell carcinoma, basal cell carcinoma"
    },
    {
      title: "Soft Tissue Sarcomas",
      category: "Part II - Plastic Surgery",
      content: "Sarcoma classification, biopsy techniques, wide local excision, reconstruction options, adjuvant therapy, prognosis"
    },
    {
      title: "Head & Neck Tumours",
      category: "Part II - Plastic Surgery",
      content: "Floor of mouth tumours, palate/maxillary tumours, treatment principles, multidisciplinary management"
    },
    {
      title: "Neck Dissection",
      category: "Part II - Plastic Surgery",
      content: "Functional neck dissection, radical neck dissection, modified radical, selective dissection, complications"
    },
    {
      title: "Mandibular Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Fibula free flap, scapula flap, reconstruction plates, dental rehabilitation, osseointegrated implants"
    },
    {
      title: "Facial Nerve Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Facial nerve anatomy, nerve repair techniques, nerve grafting, muscle transfers, facial reanimation"
    },
    {
      title: "Parotidectomy & Facial Prosthetics",
      category: "Part II - Plastic Surgery",
      content: "Parotid tumour surgery, facial nerve preservation, prosthetic reconstruction, maxillofacial prosthetics"
    },
    {
      title: "Hand Contractures & Nerve Compression",
      category: "Part II - Plastic Surgery",
      content: "Dupuytren's contracture, carpal tunnel syndrome, cubital tunnel syndrome, nerve decompression, rehabilitation"
    },
    {
      title: "Facial Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Facial defect reconstruction, local flaps (nasolabial, forehead), regional flaps, free flaps for facial defects"
    },
    {
      title: "Facial Aesthetic Surgery",
      category: "Part II - Plastic Surgery",
      content: "Facelifts (SMAS, deep plane), brow lift, blepharoplasty, facial fat grafting, botulinum toxin, fillers"
    },
    {
      title: "Rhinoplasty",
      category: "Part II - Plastic Surgery",
      content: "Reconstructive rhinoplasty, nasal anatomy, septoplasty, dorsal hump reduction, tip refinement, alar base reduction"
    },
    {
      title: "Eyelid & Ear Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Eyelid reconstruction (upper/lower), ptosis correction, ear reconstruction (microtia), prominent ear correction"
    },
    {
      title: "Breast Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Immediate vs delayed reconstruction, implant-based, autologous (TRAM, DIEP, latissimus dorsi), nipple reconstruction"
    },
    {
      title: "Aesthetic Breast Surgery",
      category: "Part II - Plastic Surgery",
      content: "Breast augmentation, mastopexy, breast reduction, gynecomastia surgery, complications management"
    },
    {
      title: "Trunk & Limb Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Chest wall reconstruction (pectus excavatum), abdominal wall reconstruction, abdominoplasty, liposuction principles"
    },
    {
      title: "Lower Limb Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Lower limb trauma coverage, flap options (gastrocnemius, soleus, free flaps), diabetic foot reconstruction, pressure sores"
    },
    {
      title: "Lipoatrophy & Body Contouring",
      category: "Part II - Plastic Surgery",
      content: "Fat grafting techniques, lipoatrophy treatment, post-bariatric body contouring, panniculectomy"
    },
    {
      title: "Genital Reconstruction",
      category: "Part II - Plastic Surgery",
      content: "Hypospadias/epispadias repair, penile reconstruction, scrotal reconstruction, perineal reconstruction"
    },
    {
      title: "Gender Reassignment Surgery",
      category: "Part II - Plastic Surgery",
      content: "Vaginal reconstruction (vaginoplasty), phalloplasty principles, chest surgery (masculinization/feminization), multidisciplinary care"
    }
  ]
};

// Enhanced interfaces for the new MCQ system
export interface ClinicalTopic {
  id: string;
  title: string;
  category: string;
  targetLevels: ('house_officer' | 'junior_resident' | 'senior_resident')[];
  uploadedBy: string;
  uploadedAt: Date;
  content: string; // Raw clinical topic content
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
  status: 'active' | 'archived';
}

export interface GeneratedMCQ {
  id: string;
  question: string;
  clinicalScenario: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  explanation: string;
  difficulty: 'moderate' | 'high';
  targetLevel: 'house_officer' | 'junior_resident' | 'senior_resident';
  category: string;
  points: number; // Always 4 marks per question
  topicId: string;
  generatedAt: Date;
  learningObjectives: string[];
  references: string[];
}

export interface MCQTestSchedule {
  id: string;
  scheduledFor: Date; // Every Tuesday 9 AM
  topicId: string;
  testDuration: number; // 10 minutes in seconds
  totalQuestions: number; // 25 questions
  targetLevels: ('house_officer' | 'junior_resident' | 'senior_resident')[];
  status: 'scheduled' | 'active' | 'completed';
  notificationSent: boolean;
}

export interface MCQTestSession {
  id: string;
  userId: string;
  userLevel: 'house_officer' | 'junior_resident' | 'senior_resident';
  scheduleId: string;
  topicId: string;
  questions: GeneratedMCQ[];
  answers: Record<string, number>; // questionId -> answerIndex
  startedAt: Date;
  completedAt?: Date;
  timeRemaining: number; // seconds
  rawScore: number; // (correct * 4) + (wrong * -1)
  percentageScore: number;
  passed: boolean;
  aiRecommendations?: string;
  weakAreas: string[];
  studyMaterialGenerated: boolean;
}

export interface StudyMaterial {
  id: string;
  sessionId: string;
  userId: string;
  weakAreas: string[];
  content: string; // Rich comprehensive content
  recommendations: string[];
  additionalResources: {
    title: string;
    description: string;
    content: string;
  }[];
  generatedAt: Date;
  downloadUrl?: string;
}

export interface NotificationSchedule {
  id: string;
  userId: string;
  scheduleId: string;
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
  message: string;
  type: 'test_reminder' | 'test_available' | 'results_ready';
}

class MCQGenerationService {
  /**
   * Upload clinical topic (Admin only)
   */
  async uploadClinicalTopic(
    title: string,
    category: string,
    content: string,
    targetLevels: ('house_officer' | 'junior_resident' | 'senior_resident')[],
    uploadedBy: string,
    attachments?: { name: string; url: string; type: string }[]
  ): Promise<ClinicalTopic> {
    const topic: ClinicalTopic = {
      id: this.generateId(),
      title,
      category,
      targetLevels,
      uploadedBy,
      uploadedAt: new Date(),
      content,
      attachments,
      status: 'active'
    };

    await db.clinical_topics.add(topic);
    
    // Automatically generate MCQs for this topic
    await this.generateMCQsForTopic(topic);
    
    // Schedule test for next Tuesday 9 AM
    await this.scheduleTest(topic);
    
    return topic;
  }

  /**
   * AI-powered MCQ generation from clinical topic
   */
  async generateMCQsForTopic(topic: ClinicalTopic): Promise<void> {
    // Generate 25 questions for each target level
    for (const level of topic.targetLevels) {
      const difficulty = level === 'senior_resident' ? 'high' : 'moderate';
      const questions = await this.aiGenerateMCQs(topic, level, difficulty, 25);
      
      for (const question of questions) {
        await db.generated_mcqs.add(question);
      }
    }
  }

  /**
   * AI MCQ Generation Engine
   */
  private async aiGenerateMCQs(
    topic: ClinicalTopic,
    targetLevel: 'house_officer' | 'junior_resident' | 'senior_resident',
    difficulty: 'moderate' | 'high',
    count: number
  ): Promise<GeneratedMCQ[]> {
    const questions: GeneratedMCQ[] = [];
    
    // AI-powered question generation based on clinical content
    // This simulates intelligent MCQ generation
    const scenarios = this.generateClinicalScenarios(topic.content, targetLevel, difficulty);
    
    for (let i = 0; i < count && i < scenarios.length; i++) {
      const scenario = scenarios[i];
      
      const mcq: GeneratedMCQ = {
        id: this.generateId(),
        question: scenario.question,
        clinicalScenario: scenario.scenario,
        options: scenario.options,
        correctAnswer: scenario.correctAnswer,
        explanation: scenario.explanation,
        difficulty,
        targetLevel,
        category: topic.category,
        points: 4, // Each question worth 4 marks
        topicId: topic.id,
        generatedAt: new Date(),
        learningObjectives: scenario.learningObjectives,
        references: scenario.references
      };
      
      questions.push(mcq);
    }
    
    return questions;
  }

  /**
   * Generate clinical scenarios based on topic content
   */
  private generateClinicalScenarios(
    content: string,
    targetLevel: string,
    difficulty: string
  ): any[] {
    // This is a simplified version. In production, this would use advanced AI
    const scenarios = [];
    
    // Example clinical scenarios
    const baseScenarios = [
      {
        scenario: "A 45-year-old diabetic patient presents to the emergency department with a deep laceration on the dorsum of the hand sustained from a glass injury 2 hours ago. The wound measures 5cm x 2cm, and you notice exposed extensor tendons. The patient's last meal was 6 hours ago.",
        question: "What is the MOST appropriate initial management?",
        options: [
          "Immediate primary closure under local anesthesia",
          "Thorough irrigation, wound exploration, tendon repair under regional block",
          "Simple bandaging and outpatient follow-up in 24 hours",
          "Broad-spectrum antibiotics and delayed closure in 48 hours"
        ],
        correctAnswer: 1,
        explanation: "In traumatic hand injuries with exposed tendons, thorough irrigation and exploration are essential. Regional anesthesia (e.g., wrist block) provides better conditions than local infiltration for adequate exploration and tendon repair. Primary repair should be performed within 6-12 hours of injury when possible. The patient's diabetic status increases infection risk, making proper debridement crucial.",
        learningObjectives: [
          "Understand timing of wound closure in contaminated injuries",
          "Recognize indications for regional vs local anesthesia",
          "Identify proper management of tendon injuries",
          "Consider comorbidities in wound management"
        ],
        references: [
          "Green's Operative Hand Surgery, 7th Edition - Hand Trauma",
          "ATLS Guidelines - Extremity Trauma Management",
          "British Society for Surgery of the Hand - Open Hand Injury Guidelines"
        ]
      },
      {
        scenario: "A 28-year-old woman presents 6 months post-breast augmentation with progressive pain, firmness, and asymmetry of the right breast. On examination, the right breast is firm, sits higher, and has a spherical appearance compared to the left. She denies fever or discharge.",
        question: "What is the MOST likely diagnosis and appropriate management?",
        options: [
          "Breast abscess requiring immediate incision and drainage",
          "Baker Grade III/IV capsular contracture requiring capsulotomy or capsulectomy",
          "Normal post-operative healing requiring observation only",
          "Implant rupture requiring emergency removal"
        ],
        correctAnswer: 1,
        explanation: "The clinical presentation (firmness, elevation, spherical shape, asymmetry, pain at 6 months post-op) is classic for Baker Grade III or IV capsular contracture. This is one of the most common complications of breast augmentation. Management options include capsulotomy (incision of capsule) or capsulectomy (removal of capsule) with or without implant exchange. Conservative management is inappropriate for symptomatic capsular contracture.",
        learningObjectives: [
          "Recognize clinical features of capsular contracture",
          "Understand Baker grading system",
          "Know management options for capsular contracture",
          "Differentiate capsular contracture from other complications"
        ],
        references: [
          "Plastic and Reconstructive Surgery Journal - Capsular Contracture Review",
          "American Society of Plastic Surgeons - Breast Augmentation Complications",
          "ASPS Practice Guidelines for Breast Augmentation"
        ]
      },
      {
        scenario: "A 65-year-old smoker with peripheral vascular disease is scheduled for below-knee amputation. During pre-operative assessment, you note poor nutritional status (albumin 2.8 g/dL), HbA1c of 9.2%, and he is currently smoking 10 cigarettes daily. He is eager to proceed with surgery as soon as possible.",
        question: "What is the MOST important pre-operative optimization measure?",
        options: [
          "Proceed immediately as delay worsens ischemia",
          "Optimize all factors: smoking cessation (4 weeks), glycemic control (HbA1c <7%), nutritional support before surgery",
          "Only address smoking cessation, proceed with surgery",
          "Only optimize nutrition with supplements, proceed in 1 week"
        ],
        correctAnswer: 1,
        explanation: "Multiple risk factors are present that significantly increase complications: active smoking (wound healing impairment, infection), poor glycemic control (infection, delayed healing), and malnutrition (albumin <3.5 g/dL indicates poor wound healing capacity). Evidence shows that optimizing these factors pre-operatively reduces complications by 40-60%. Smoking cessation for at least 4 weeks, HbA1c reduction to <7%, and nutritional optimization are all critical. While the limb is ischemic, proper optimization prevents post-operative complications that could lead to revision amputations at higher levels.",
        learningObjectives: [
          "Identify modifiable surgical risk factors",
          "Understand impact of smoking on wound healing",
          "Recognize importance of glycemic control in surgery",
          "Appreciate role of nutritional status in outcomes"
        ],
        references: [
          "WHO Guidelines - Pre-operative Optimization",
          "Journal of Vascular Surgery - Amputation Success Rates",
          "British Journal of Surgery - Nutritional Status and Surgical Outcomes"
        ]
      }
    ];

    // Adjust complexity based on difficulty level
    if (difficulty === 'high') {
      // Add more complex multi-step reasoning scenarios
      return baseScenarios.map(s => ({
        ...s,
        scenario: s.scenario + " Additional findings include...",
        options: s.options.map(opt => opt + " with consideration of..."),
      }));
    }

    return baseScenarios;
  }

  /**
   * Schedule test for next Tuesday 9 AM
   */
  async scheduleTest(topic: ClinicalTopic): Promise<MCQTestSchedule> {
    const nextTuesday = this.getNextTuesday9AM();
    
    const schedule: MCQTestSchedule = {
      id: this.generateId(),
      scheduledFor: nextTuesday,
      topicId: topic.id,
      testDuration: 600, // 10 minutes in seconds
      totalQuestions: 25,
      targetLevels: topic.targetLevels,
      status: 'scheduled',
      notificationSent: false
    };

    await db.mcq_test_schedules.add(schedule);
    
    // Create notification schedules for all users in target levels
    await this.createNotificationSchedules(schedule);
    
    return schedule;
  }

  /**
   * Get next Tuesday at 9 AM
   */
  private getNextTuesday9AM(): Date {
    const now = new Date();
    const nextTuesday = new Date(now);
    
    // Get days until next Tuesday (2 = Tuesday)
    const daysUntilTuesday = (2 - now.getDay() + 7) % 7 || 7;
    nextTuesday.setDate(now.getDate() + daysUntilTuesday);
    
    // Set to 9 AM
    nextTuesday.setHours(9, 0, 0, 0);
    
    return nextTuesday;
  }

  /**
   * Create notification schedules for users
   */
  private async createNotificationSchedules(schedule: MCQTestSchedule): Promise<void> {
    // In production, fetch all users with target levels
    // For now, we'll create a template
    const users = await this.getUsersByLevels(schedule.targetLevels);
    
    for (const user of users) {
      const notification: NotificationSchedule = {
        id: this.generateId(),
        userId: user.id,
        scheduleId: schedule.id,
        scheduledFor: schedule.scheduledFor,
        sent: false,
        message: `🎯 New CME Test Available! Topic: "${await this.getTopicTitle(schedule.topicId)}". Test opens Tuesday 9:00 AM. Duration: 10 minutes, 25 questions. Good luck!`,
        type: 'test_reminder'
      };
      
      await db.notification_schedules.add(notification);
    }
  }

  /**
   * Start MCQ test session
   */
  async startMCQTest(
    userId: string,
    userLevel: 'house_officer' | 'junior_resident' | 'senior_resident',
    scheduleId: string
  ): Promise<MCQTestSession> {
    const schedule = await db.mcq_test_schedules.get(scheduleId);
    if (!schedule) throw new Error('Test schedule not found');
    
    // Get 25 questions for the user's level
    const questions = await db.generated_mcqs
      .where('topicId')
      .equals(schedule.topicId)
      .and(q => q.targetLevel === userLevel)
      .limit(25)
      .toArray();

    if (questions.length < 25) {
      throw new Error('Insufficient questions for test');
    }

    // Shuffle questions
    const shuffledQuestions = this.shuffleArray(questions);

    const session: MCQTestSession = {
      id: this.generateId(),
      userId,
      userLevel,
      scheduleId,
      topicId: schedule.topicId,
      questions: shuffledQuestions,
      answers: {},
      startedAt: new Date(),
      timeRemaining: schedule.testDuration,
      rawScore: 0,
      percentageScore: 0,
      passed: false,
      weakAreas: [],
      studyMaterialGenerated: false
    };

    await db.mcq_test_sessions.add(session);
    return session;
  }

  /**
   * Submit answer in real-time
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    answerIndex: number
  ): Promise<{ correct: boolean; explanation: string }> {
    const session = await db.mcq_test_sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const question = session.questions.find(q => q.id === questionId);
    if (!question) throw new Error('Question not found');

    // Update answers
    session.answers[questionId] = answerIndex;
    await db.mcq_test_sessions.put(session);

    // Return immediate feedback
    const correct = answerIndex === question.correctAnswer;
    return {
      correct,
      explanation: question.explanation
    };
  }

  /**
   * Complete test and calculate final score
   */
  async completeTest(sessionId: string): Promise<MCQTestSession> {
    const session = await db.mcq_test_sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Calculate score: correct * 4, wrong * -1
    let correctCount = 0;
    let wrongCount = 0;
    const weakAreas: string[] = [];

    session.questions.forEach(question => {
      const userAnswer = session.answers[question.id];
      if (userAnswer === question.correctAnswer) {
        correctCount++;
      } else if (userAnswer !== undefined) {
        wrongCount++;
        weakAreas.push(question.category);
      }
    });

    const rawScore = (correctCount * 4) + (wrongCount * -1);
    const maxScore = session.questions.length * 4; // 25 * 4 = 100
    const percentageScore = Math.max(0, (rawScore / maxScore) * 100);
    const passed = percentageScore >= 50; // 50% passing threshold

    // Update session
    session.completedAt = new Date();
    session.rawScore = rawScore;
    session.percentageScore = Math.round(percentageScore);
    session.passed = passed;
    session.weakAreas = [...new Set(weakAreas)];

    await db.mcq_test_sessions.put(session);

    // Generate AI recommendations and study materials
    await this.generateAIRecommendations(session);
    await this.generateStudyMaterials(session);

    return session;
  }

  /**
   * Generate AI-powered recommendations based on performance
   */
  private async generateAIRecommendations(session: MCQTestSession): Promise<void> {
    const correctCount = Object.keys(session.answers).filter(
      qId => session.answers[qId] === session.questions.find(q => q.id === qId)?.correctAnswer
    ).length;

    const totalQuestions = session.questions.length;
    const accuracy = (correctCount / totalQuestions) * 100;

    let recommendations = '';

    if (accuracy >= 80) {
      recommendations = `🎉 **Excellent Performance!** 

You've demonstrated strong understanding of this clinical topic (${accuracy.toFixed(1)}% accuracy).

**Strengths:**
- Solid grasp of clinical decision-making
- Good application of theoretical knowledge to scenarios
- Appropriate consideration of patient factors

**Recommendations:**
- Continue maintaining this level of preparation
- Consider peer teaching to reinforce knowledge
- Focus on challenging cases in clinical practice
- Explore advanced topics in ${session.weakAreas.length > 0 ? session.weakAreas[0] : 'this area'}

**Next Steps:**
- Review the study materials for depth
- Attempt senior-level questions for challenge
- Share insights with colleagues`;
    } else if (accuracy >= 60) {
      recommendations = `👍 **Good Performance - Room for Growth**

You've shown competent understanding (${accuracy.toFixed(1)}% accuracy) with areas to strengthen.

**Strengths:**
- Adequate foundational knowledge
- Reasonable clinical reasoning

**Areas Needing Attention:**
${session.weakAreas.slice(0, 3).map(area => `- ${area}`).join('\n')}

**Recommendations:**
- Review the generated study materials thoroughly
- Focus on understanding pathophysiology in weak areas
- Practice more clinical scenario-based questions
- Discuss difficult cases with senior colleagues
- Dedicate 30 minutes daily to focused study

**Action Plan:**
1. Complete the downloadable study materials (below)
2. Re-read relevant chapters in standard textbooks
3. Attend relevant clinical cases this week
4. Reattempt similar questions in 1 week`;
    } else if (accuracy >= 40) {
      recommendations = `⚠️ **Performance Needs Improvement**

Your score of ${accuracy.toFixed(1)}% indicates significant knowledge gaps requiring urgent attention.

**Critical Weak Areas:**
${session.weakAreas.slice(0, 5).map(area => `- ${area}`).join('\n')}

**Immediate Actions Required:**
1. **DOWNLOAD** the comprehensive study materials below
2. **SCHEDULE** 1-2 hours daily for focused study
3. **SEEK** mentorship from senior residents/consultants
4. **ATTEND** departmental teaching sessions
5. **REVIEW** basic principles before clinical scenarios

**Study Strategy:**
- Start with fundamentals in each weak area
- Use the structured study materials provided
- Practice with moderate-difficulty questions first
- Discuss each case with supervisors
- Make detailed notes and flashcards

**Timeline:**
- Week 1-2: Master fundamentals using study materials
- Week 3: Practice clinical scenarios
- Week 4: Reattempt assessment

**Support Available:**
- Request additional supervision in weak areas
- Attend consultant-led teaching rounds
- Utilize departmental resources`;
    } else {
      recommendations = `🚨 **Urgent: Significant Learning Gaps Identified**

Score: ${accuracy.toFixed(1)}% - This indicates fundamental knowledge deficits requiring **immediate intervention**.

**Critical Concerns:**
- Major gaps in clinical knowledge across multiple areas
- Potential patient safety implications
- Requires structured remediation plan

**Immediate Mandatory Actions:**
1. **MEET** with your supervisor/program director THIS WEEK
2. **DOWNLOAD** and study all provided materials intensively
3. **SUSPEND** independent clinical decision-making until competency demonstrated
4. **ENROLL** in remedial teaching program
5. **SCHEDULE** weekly assessments to track progress

**Structured Remediation Plan:**
- **Week 1-2:** Intensive review of fundamentals
  - 3-4 hours daily focused study
  - Daily supervision in clinical areas
  - Complete all study materials thoroughly
  
- **Week 3-4:** Supervised clinical application
  - Direct observation of clinical reasoning
  - Case-based discussions with mentor
  - Progressive responsibility under supervision
  
- **Week 5:** Reassessment
  - Repeat this assessment
  - Target: Minimum 60% to proceed
  - Additional remediation if needed

**Resources Provided:**
- Comprehensive study materials (download below)
- Structured reading list
- Practice questions with detailed explanations

**Next Steps:**
1. Download study materials NOW
2. Contact program coordinator today
3. Schedule urgent meeting with supervisor
4. Begin structured study plan immediately

Remember: This is a learning opportunity. With dedicated effort and support, improvement is achievable.`;
    }

    session.aiRecommendations = recommendations;
    await db.mcq_test_sessions.put(session);
  }

  /**
   * Generate comprehensive study materials for weak areas
   */
  async generateStudyMaterials(session: MCQTestSession): Promise<StudyMaterial> {
    const weakAreaContent = await this.generateWeakAreaContent(session.weakAreas, session.questions);
    
    const studyMaterial: StudyMaterial = {
      id: this.generateId(),
      sessionId: session.id,
      userId: session.userId,
      weakAreas: session.weakAreas,
      content: weakAreaContent,
      recommendations: this.generateSpecificRecommendations(session.weakAreas),
      additionalResources: this.generateAdditionalResources(session.weakAreas),
      generatedAt: new Date()
    };

    await db.study_materials.add(studyMaterial);
    
    // Update session
    session.studyMaterialGenerated = true;
    await db.mcq_test_sessions.put(session);

    return studyMaterial;
  }

  /**
   * Generate detailed content for weak areas
   */
  private async generateWeakAreaContent(weakAreas: string[], questions: GeneratedMCQ[]): Promise<string> {
    let content = '# Personalized Study Materials - Areas for Improvement\n\n';
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += '---\n\n';

    for (const area of [...new Set(weakAreas)]) {
      const relevantQuestions = questions.filter(q => q.category === area);
      
      content += `## ${area}\n\n`;
      content += `### Overview\n`;
      content += `You answered ${relevantQuestions.length} question(s) in this category incorrectly. Let's review the key concepts.\n\n`;
      
      content += `### Key Learning Points\n\n`;
      
      // Extract learning objectives from missed questions
      const learningObjectives = new Set<string>();
      relevantQuestions.forEach(q => {
        q.learningObjectives.forEach(obj => learningObjectives.add(obj));
      });

      Array.from(learningObjectives).forEach((obj, index) => {
        content += `${index + 1}. ${obj}\n`;
      });
      content += '\n';

      content += `### Detailed Review\n\n`;
      
      relevantQuestions.forEach((q, index) => {
        content += `#### Question ${index + 1}: ${q.question}\n\n`;
        content += `**Clinical Scenario:**\n${q.clinicalScenario}\n\n`;
        content += `**Correct Answer:** ${q.options[q.correctAnswer]}\n\n`;
        content += `**Explanation:**\n${q.explanation}\n\n`;
        content += `**Key Takeaways:**\n`;
        q.learningObjectives.forEach(obj => {
          content += `- ${obj}\n`;
        });
        content += '\n';
        
        if (q.references.length > 0) {
          content += `**References for Further Reading:**\n`;
          q.references.forEach(ref => {
            content += `- ${ref}\n`;
          });
          content += '\n';
        }
        
        content += '---\n\n';
      });

      content += `### Clinical Application\n\n`;
      content += this.generateClinicalApplicationGuidance(area);
      content += '\n\n';

      content += `### Self-Assessment Checklist\n\n`;
      content += `Before moving forward, ensure you can:\n\n`;
      Array.from(learningObjectives).forEach(obj => {
        content += `- [ ] ${obj}\n`;
      });
      content += '\n---\n\n';
    }

    content += `## Summary and Action Plan\n\n`;
    content += `### Immediate Actions (This Week)\n`;
    content += `1. Review all missed questions and their explanations carefully\n`;
    content += `2. Read the referenced materials for each weak area\n`;
    content += `3. Discuss challenging concepts with senior colleagues\n`;
    content += `4. Observe related clinical cases during ward rounds\n\n`;

    content += `### Medium-term Goals (2-4 Weeks)\n`;
    content += `1. Actively seek out cases related to weak areas\n`;
    content += `2. Present one case from each weak area at teaching sessions\n`;
    content += `3. Complete additional practice questions\n`;
    content += `4. Request focused teaching on problem areas\n\n`;

    content += `### Long-term Development\n`;
    content += `1. Reattempt this assessment after completing remediation\n`;
    content += `2. Maintain a learning portfolio documenting improvement\n`;
    content += `3. Mentor junior colleagues once mastery is achieved\n\n`;

    return content;
  }

  /**
   * Generate clinical application guidance
   */
  private generateClinicalApplicationGuidance(category: string): string {
    // This would be more sophisticated with real AI
    return `**How to Apply This Knowledge in Clinical Practice:**

1. **Recognition:** When you encounter similar cases, systematically assess all relevant factors before making decisions.

2. **Decision-Making Framework:**
   - Identify the clinical problem clearly
   - Consider all management options
   - Evaluate risks and benefits of each approach
   - Choose evidence-based best practice
   - Document reasoning thoroughly

3. **Common Pitfalls to Avoid:**
   - Rushing to diagnosis without complete assessment
   - Overlooking patient-specific factors (comorbidities, allergies)
   - Failing to consider alternative diagnoses
   - Not seeking senior input when uncertain

4. **When to Seek Help:**
   - Any time you're unsure about management
   - Complex cases with multiple comorbidities
   - Unexpected patient responses to treatment
   - Medicolegal concerns

5. **Documentation:**
   - Always document your clinical reasoning
   - Note any discussions with seniors
   - Record patient education provided
   - Document follow-up plans`;
  }

  /**
   * Generate specific recommendations
   */
  private generateSpecificRecommendations(weakAreas: string[]): string[] {
    return [
      `Review standard textbook chapters on: ${weakAreas.join(', ')}`,
      'Attend next departmental teaching session focused on these topics',
      'Request supervised practice in clinical scenarios involving these areas',
      'Create flashcards for key concepts and review daily',
      'Discuss difficult cases with senior residents or consultants',
      'Complete additional practice questions on these topics',
      'Observe relevant procedures/cases in clinical settings'
    ];
  }

  /**
   * Generate additional resources
   */
  private generateAdditionalResources(weakAreas: string[]): { title: string; description: string; content: string }[] {
    return [
      {
        title: 'Essential Reading List',
        description: 'Core textbooks and journal articles for foundational knowledge',
        content: `**Required Reading:**
        
1. Grabb and Smith's Plastic Surgery, 8th Edition
   - Chapters on: ${weakAreas.join(', ')}
   
2. Plastic and Reconstructive Surgery Journal
   - Recent review articles on identified weak areas
   
3. British Journal of Plastic Surgery
   - Clinical practice guidelines relevant to your areas
   
**Online Resources:**
- UpToDate: Evidence-based clinical topics
- ASPS (American Society of Plastic Surgeons) Guidelines
- BAPRAS (British Association of Plastic Surgeons) Resources
- PubMed: Latest research in weak areas`
      },
      {
        title: 'Clinical Skills Practice Guide',
        description: 'Hands-on approaches to improve practical competence',
        content: `**Practical Skills Development:**

1. **Observation:**
   - Shadow senior colleagues during relevant procedures
   - Attend theatre sessions involving weak area topics
   - Participate in ward rounds focusing on these cases

2. **Supervised Practice:**
   - Request graduated responsibility under supervision
   - Perform procedures with direct observation
   - Present cases for feedback

3. **Simulation:**
   - Use departmental simulation facilities
   - Practice decision-making with case scenarios
   - Role-play patient consultations

4. **Reflection:**
   - Maintain a reflective learning journal
   - Document each clinical encounter
   - Review decisions and outcomes
   - Identify learning points`
      },
      {
        title: 'Quick Reference Clinical Algorithms',
        description: 'Step-by-step approaches to common clinical situations',
        content: `**Clinical Decision-Making Algorithms:**

These flowcharts provide structured approaches to the topics you found challenging:

**Algorithm 1: Emergency Assessment**
1. Primary Survey (ABCDE)
2. Life-threatening interventions
3. Secondary Survey
4. Definitive care planning
5. Documentation

**Algorithm 2: Wound Management**
1. Assess wound characteristics
2. Classify contamination level
3. Determine closure timing
4. Select closure technique
5. Plan follow-up

**Algorithm 3: Pre-operative Optimization**
1. Identify modifiable risk factors
2. Implement optimization strategies
3. Set timeline for surgery
4. Monitor progress
5. Proceed when targets met

**Algorithm 4: Complication Management**
1. Recognize complication early
2. Stabilize patient
3. Determine severity
4. Implement appropriate treatment
5. Document and report

Apply these algorithms systematically in your clinical practice.`
      }
    ];
  }

  /**
   * Generate PDF study materials for download
   */
  async generateStudyMaterialPDF(studyMaterialId: string): Promise<string> {
    const material = await db.study_materials.get(studyMaterialId);
    if (!material) throw new Error('Study material not found');

    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = PDF_MARGINS.left;
    const contentWidth = pageWidth - (2 * margin);

    // Helper to sanitize text
    const clean = (text: string): string => sanitizeTextForPDF(text);

    // Header
    doc.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(PDF_FONT_SIZES.title);
    doc.setFont('helvetica', 'bold');
    doc.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT - Personalized Study Materials', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.text('Generated: ' + material.generatedAt.toLocaleDateString(), pageWidth / 2, 19, { align: 'center' });

    // Content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(PDF_FONT_SIZES.subHeader);
    let yPos = 35;

    // Split content into pages
    const lines = doc.splitTextToSize(clean(material.content), contentWidth);
    
    lines.forEach((line: string) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      
      // Format headings
      if (line.startsWith('##')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_FONT_SIZES.sectionHeader + 2);
        doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
        yPos += 5;
      } else if (line.startsWith('#')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_FONT_SIZES.title);
        doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
        yPos += 8;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
      }
      
      doc.text(line.replace(/^#+\s*/, ''), margin, yPos);
      yPos += 6;
    });

    // Footer on each page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(14, 159, 110);
      doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT - CME Program', pageWidth / 2, pageHeight - 5, { align: 'center' });
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }

    // Save and return blob URL
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    
    // Update material with download URL
    material.downloadUrl = url;
    await db.study_materials.put(material);

    return url;
  }

  /**
   * Get user's test history
   */
  async getUserTestHistory(userId: string): Promise<MCQTestSession[]> {
    return await db.mcq_test_sessions
      .where('userId')
      .equals(userId)
      .reverse()
      .toArray();
  }

  /**
   * Get upcoming test schedules
   */
  async getUpcomingTests(userLevel: string): Promise<MCQTestSchedule[]> {
    const now = new Date();
    return await db.mcq_test_schedules
      .where('scheduledFor')
      .above(now)
      .and(schedule => schedule.targetLevels.includes(userLevel as any))
      .toArray();
  }

  /**
   * Check and send notifications (called by background service)
   */
  async processNotifications(): Promise<void> {
    const now = new Date();
    const pendingNotifications = await db.notification_schedules
      .where('scheduledFor')
      .below(now)
      .and(n => !n.sent)
      .toArray();

    for (const notification of pendingNotifications) {
      // In production, this would trigger push notification
      console.log(`Sending notification to user ${notification.userId}:`, notification.message);
      
      notification.sent = true;
      notification.sentAt = new Date();
      await db.notification_schedules.put(notification);
    }
  }

  /**
   * Initialize WACS Curriculum Topics
   * Populates database with comprehensive WACS topics for automated MCQ generation
   */
  async initializeWACSTopics(): Promise<void> {
    console.log('Initializing WACS Curriculum Topics...');
    
    // Check if topics already exist
    const existingTopics = await db.clinical_topics.count();
    if (existingTopics > 0) {
      console.log(`${existingTopics} topics already exist. Skipping initialization.`);
      return;
    }

    const allTopics = [
      ...WACS_CURRICULUM_TOPICS.part_i_principles.map(t => ({
        ...t,
        targetLevels: ['house_officer', 'junior_resident', 'senior_resident'] as ('house_officer' | 'junior_resident' | 'senior_resident')[]
      })),
      ...WACS_CURRICULUM_TOPICS.part_i_specialty.map(t => ({
        ...t,
        targetLevels: ['house_officer', 'junior_resident', 'senior_resident'] as ('house_officer' | 'junior_resident' | 'senior_resident')[]
      })),
      ...WACS_CURRICULUM_TOPICS.part_ii_general.map(t => ({
        ...t,
        targetLevels: ['junior_resident', 'senior_resident'] as ('house_officer' | 'junior_resident' | 'senior_resident')[]
      })),
      ...WACS_CURRICULUM_TOPICS.part_ii_plastic.map(t => ({
        ...t,
        targetLevels: ['junior_resident', 'senior_resident'] as ('house_officer' | 'junior_resident' | 'senior_resident')[]
      }))
    ];

    for (const topicData of allTopics) {
      await this.uploadClinicalTopic(
        topicData.title,
        topicData.category,
        topicData.content,
        topicData.targetLevels,
        'system',
        []
      );
    }

    console.log(`✅ Initialized ${allTopics.length} WACS curriculum topics`);
  }

  /**
   * Start Weekly Test Notification Scheduler
   * Sends push notifications every Tuesday at 9:30 AM
   */
  startWeeklyTestNotificationScheduler(): void {
    console.log('📅 Starting Weekly MCQ Test Notification Scheduler...');

    // Check every hour if it's Tuesday 9:30 AM
    setInterval(async () => {
      await this.checkAndSendTestReminders();
    }, 60 * 60 * 1000); // Check every hour

    // Also check immediately on startup
    this.checkAndSendTestReminders();

    console.log('✅ Weekly test notification scheduler started');
  }

  /**
   * Check if it's Tuesday 9:30 AM and send test reminders
   */
  private async checkAndSendTestReminders(): Promise<void> {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 2 = Tuesday
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if it's Tuesday (day 2) and between 9:30-10:30 AM
    if (day === 2 && hour === 9 && minute >= 30) {
      console.log('📚 It\'s Tuesday 9:30 AM - Sending MCQ test reminders...');
      await this.sendWeeklyTestNotifications();
    }
  }

  /**
   * Send push notifications for weekly MCQ test
   */
  private async sendWeeklyTestNotifications(): Promise<void> {
    try {
      // Get upcoming tests scheduled for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const upcomingTests = await db.mcq_test_schedules
        .where('scheduledFor')
        .between(today, tomorrow)
        .and(t => t.status === 'scheduled')
        .toArray();

      if (upcomingTests.length === 0) {
        console.log('No tests scheduled for today');
        return;
      }

      for (const test of upcomingTests) {
        const topicTitle = await this.getTopicTitle(test.topicId);
        
        const notification = {
          title: '📝 Weekly MCQ Assessment Ready!',
          body: `${topicTitle} - 25 questions, 10 minutes. Take your test now!`,
          icon: '/logo192.png',
          badge: '/badge-72x72.png',
          data: {
            type: 'mcq_test_reminder',
            test_id: test.id,
            topic_id: test.topicId,
            url: '/education',
            scheduled_for: test.scheduledFor
          },
          actions: [
            {
              action: 'take_test',
              title: 'Take Test Now'
            },
            {
              action: 'remind_later',
              title: 'Remind Me Later'
            }
          ],
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          tag: 'mcq-test-reminder',
        };

        // Send via Service Worker push notification
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const registration = await navigator.serviceWorker.ready;
              await registration.showNotification(notification.title, notification);
              console.log(`✅ Test reminder sent: ${topicTitle}`);
              
              // Mark notification as sent
              test.notificationSent = true;
              await db.mcq_test_schedules.put(test);
            }
          } catch (error) {
            console.error('Error sending push notification:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in sendWeeklyTestNotifications:', error);
    }
  }

  /**
   * Get next Tuesday 9:30 AM
   */
  getNextTestDate(): Date {
    const now = new Date();
    const currentDay = now.getDay();
    
    // Calculate days until next Tuesday (2)
    let daysUntilTuesday = 2 - currentDay;
    if (daysUntilTuesday <= 0 || (daysUntilTuesday === 0 && now.getHours() >= 9)) {
      daysUntilTuesday += 7; // Next week's Tuesday
    }
    
    const nextTuesday = new Date(now);
    nextTuesday.setDate(now.getDate() + daysUntilTuesday);
    nextTuesday.setHours(9, 30, 0, 0); // 9:30 AM
    
    return nextTuesday;
  }

  /**
   * Schedule next week's test automatically
   */
  async autoScheduleNextWeekTest(): Promise<void> {
    try {
      // Get a random topic that hasn't been used recently
      const allTopics = await db.clinical_topics.where('status').equals('active').toArray();
      
      if (allTopics.length === 0) {
        console.log('No active topics available for scheduling');
        return;
      }

      // Get recently used topics (last 4 weeks)
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      
      const recentTests = await db.mcq_test_schedules
        .where('scheduledFor')
        .above(fourWeeksAgo)
        .toArray();
      
      const recentTopicIds = recentTests.map(t => t.topicId);
      
      // Filter out recently used topics
      const availableTopics = allTopics.filter(t => !recentTopicIds.includes(t.id));
      const selectedTopic = availableTopics.length > 0 
        ? availableTopics[Math.floor(Math.random() * availableTopics.length)]
        : allTopics[Math.floor(Math.random() * allTopics.length)];

      // Schedule for next Tuesday 9:30 AM
      await this.scheduleTest(selectedTopic);
      
      console.log(`✅ Auto-scheduled test for next Tuesday: ${selectedTopic.title}`);
    } catch (error) {
      console.error('Error auto-scheduling test:', error);
    }
  }

  // Helper methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async getUsersByLevels(levels: string[]): Promise<{ id: string; level: string }[]> {
    // Mock implementation - in production, fetch from user database
    return [
      { id: 'user1', level: 'house_officer' },
      { id: 'user2', level: 'junior_resident' },
      { id: 'user3', level: 'senior_resident' }
    ].filter(u => levels.includes(u.level));
  }

  private async getTopicTitle(topicId: string): Promise<string> {
    const topic = await db.clinical_topics.get(topicId);
    return topic?.title || 'Clinical Topic';
  }
}

export const mcqGenerationService = new MCQGenerationService();
