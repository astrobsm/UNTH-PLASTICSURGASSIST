/**
 * Medical Training CME Service
 * Comprehensive CME content for House Officers, Junior Residents, and Senior Residents
 */

export type TrainingLevel = 'house_officer' | 'junior_resident' | 'senior_resident';

export interface CMEModule {
  id: string;
  title: string;
  level: TrainingLevel;
  topics: CMETopic[];
}

export interface CMETopic {
  id: string;
  moduleId: string;
  title: string;
  article: CMEArticle;
}

export interface CMEArticle {
  title: string;
  overview: string;
  learningObjectives: string[];
  sections: ArticleSection[];
  keyPoints: string[];
  examTips: string[];
  clinicalPearls: string[];
  commonMistakes: string[];
  references: string[];
  selfAssessment: MCQQuestion[];
}

export interface ArticleSection {
  title: string;
  content: string;
  subsections?: { title: string; content: string }[];
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// ==================== HOUSE OFFICER CME MODULES ====================

export const HOUSE_OFFICER_MODULES: CMEModule[] = [
  {
    id: 'ho-module-1',
    title: 'Module 1: Foundations of Safe Surgical Practice',
    level: 'house_officer',
    topics: [
      {
        id: 'ho-1-1',
        moduleId: 'ho-module-1',
        title: 'Roles, Responsibilities, and Limits of the House Officer',
        article: {
          title: 'Roles, Responsibilities, and Limits of the House Officer',
          overview: 'The House Officer (HO) or intern occupies a unique position in the medical hierarchy—possessing a medical degree but still developing the clinical judgment that comes with experience. Understanding your role, responsibilities, and critically, your limitations, is essential for patient safety and professional development.',
          learningObjectives: [
            'Define the core responsibilities of a House Officer in surgical practice',
            'Identify tasks that fall within and outside HO scope of practice',
            'Understand the importance of supervision and when to escalate',
            'Recognize legal and ethical boundaries of practice',
            'Develop strategies for safe handover and communication'
          ],
          sections: [
            {
              title: 'Core Responsibilities of the House Officer',
              content: 'The House Officer serves as the foundation of the clinical team, responsible for direct patient care under supervision. Your primary duties include: patient clerking and admission, daily ward rounds and documentation, executing treatment plans, monitoring patient progress, and communicating with the multidisciplinary team.',
              subsections: [
                {
                  title: 'Clinical Documentation',
                  content: 'Accurate, timely, and legible documentation is a legal requirement. Every entry must include: date, time, your name, designation, and signature. Document what you see, what you do, and what you plan. Remember: "If it wasn\'t documented, it wasn\'t done."'
                },
                {
                  title: 'Patient Monitoring',
                  content: 'Regular assessment of vital signs, fluid balance, pain scores, and wound status. Recognize trends indicating deterioration. The Early Warning Score (EWS) system helps identify patients at risk.'
                }
              ]
            },
            {
              title: 'Scope of Practice: What You CAN Do',
              content: 'With appropriate training and supervision, House Officers may perform: venepuncture and IV cannulation, urethral catheterization, nasogastric tube insertion, basic wound care and dressing, arterial blood gas sampling, simple suturing of superficial wounds, and assistance in theatre.',
              subsections: [
                {
                  title: 'Procedures Requiring Direct Supervision',
                  content: 'Lumbar puncture, chest drain insertion, central venous catheterization, and any procedure you have not been signed off for. Always ensure a senior is present or immediately available.'
                }
              ]
            },
            {
              title: 'Limits of Practice: What You Should NOT Do Alone',
              content: 'Critical limitations include: independent surgical decision-making, prescribing controlled substances without senior review, consenting patients for major procedures, discharging patients without senior approval, and breaking bad news without support. Exceeding your competence puts patients at risk and may have legal consequences.',
              subsections: [
                {
                  title: 'The "Two-Call Rule"',
                  content: 'If you are uncertain about a clinical decision, call your senior. If they are unavailable or you remain concerned, escalate further. Patient safety trumps hierarchy.'
                }
              ]
            },
            {
              title: 'Supervision and Escalation',
              content: 'Never be afraid to ask for help. The transition from medical student to doctor is challenging. Seniors expect questions from interns—it demonstrates insight, not weakness. Establish clear escalation pathways: know who to call, when to call, and how to present information concisely using SBAR (Situation, Background, Assessment, Recommendation).'
            },
            {
              title: 'Legal and Ethical Considerations',
              content: 'As a registered medical practitioner, you are legally accountable for your actions. Maintain patient confidentiality, obtain valid consent for procedures within your scope, and document thoroughly. If asked to do something beyond your competence, politely decline and escalate.'
            }
          ],
          keyPoints: [
            'Your primary role is patient safety through careful monitoring and timely escalation',
            'Documentation is a legal requirement—be accurate, timely, and legible',
            'Know your scope of practice and never exceed it without supervision',
            'Asking for help is a sign of good clinical judgment, not weakness',
            'Use SBAR for effective communication with seniors',
            'Patient safety always takes priority over hierarchy or convenience'
          ],
          examTips: [
            'Exam questions often test knowledge of when to escalate—err on the side of caution',
            'Know the legal aspects of consent—who can consent and for what',
            'Understand the difference between direct and indirect supervision',
            'Be familiar with documentation standards and their legal significance'
          ],
          clinicalPearls: [
            'Arrive early for ward rounds—review patients before the team arrives',
            'Keep a small notebook with patient details for quick reference',
            'Build good relationships with nurses—they are invaluable allies',
            'Never assume someone else has done a task—verify and document'
          ],
          commonMistakes: [
            'Assuming verbal orders have been documented by someone else',
            'Not escalating early enough when a patient deteriorates',
            'Attempting procedures without adequate training or supervision',
            'Poor handover leading to missed information',
            'Forgetting to document allergies and medication reconciliation'
          ],
          references: [
            'Medical and Dental Council of Nigeria: Guidelines for Internship Training',
            'WHO Patient Safety Curriculum Guide',
            'General Medical Council: Good Medical Practice',
            'West African College of Surgeons: Training Guidelines'
          ],
          selfAssessment: [
            {
              id: 'ho-1-1-q1',
              question: 'A House Officer is asked to consent a patient for an appendicectomy. The correct action is:',
              options: [
                'Consent the patient as you have witnessed the procedure before',
                'Explain the procedure but have the operating surgeon sign the consent',
                'Politely decline and ask the registrar or consultant to consent the patient',
                'Consent the patient if the senior is busy in theatre'
              ],
              correctAnswer: 2,
              explanation: 'House Officers should not consent patients for procedures they cannot perform themselves. Consent should be obtained by someone capable of performing the procedure who can explain risks, benefits, and alternatives.'
            },
            {
              id: 'ho-1-1-q2',
              question: 'The SBAR communication tool stands for:',
              options: [
                'Symptoms, Background, Assessment, Review',
                'Situation, Background, Assessment, Recommendation',
                'Signs, Baseline, Action, Response',
                'Summary, Brief, Analysis, Report'
              ],
              correctAnswer: 1,
              explanation: 'SBAR (Situation, Background, Assessment, Recommendation) is a structured communication tool that ensures clear, concise handover of patient information.'
            },
            {
              id: 'ho-1-1-q3',
              question: 'Which of the following is within the scope of an unsupervised House Officer?',
              options: [
                'Insertion of a chest drain for pneumothorax',
                'Peripheral IV cannulation',
                'Lumbar puncture for suspected meningitis',
                'Central venous catheter insertion'
              ],
              correctAnswer: 1,
              explanation: 'Peripheral IV cannulation is a basic procedure within HO scope. Chest drains, lumbar punctures, and central lines require direct supervision until competency is demonstrated.'
            }
          ]
        }
      },
      {
        id: 'ho-1-2',
        moduleId: 'ho-module-1',
        title: 'Patient Safety Principles in Surgical Practice',
        article: {
          title: 'Patient Safety Principles in Surgical Practice',
          overview: 'Patient safety is the foundation of quality healthcare. In surgical practice, where interventions carry inherent risks, understanding and applying safety principles can prevent harm, reduce complications, and save lives. This module introduces the key concepts every House Officer must internalize.',
          learningObjectives: [
            'Understand the burden of surgical harm and never events',
            'Apply the WHO Surgical Safety Checklist correctly',
            'Identify common sources of error in surgical care',
            'Implement strategies to prevent wrong-site surgery',
            'Recognize the importance of a safety culture'
          ],
          sections: [
            {
              title: 'The Burden of Surgical Harm',
              content: 'Globally, an estimated 310 million surgical procedures are performed annually. Studies suggest 3-17% of these result in complications, with up to half being preventable. In low-resource settings, surgical mortality can be 10 times higher than in high-income countries. As a House Officer, your vigilance can prevent many of these adverse events.',
              subsections: [
                {
                  title: 'Never Events in Surgery',
                  content: 'Never events are serious, preventable incidents that should never occur: wrong-site surgery, retained foreign objects, wrong patient procedures, and death from air embolism. These are sentinel events requiring root cause analysis.'
                }
              ]
            },
            {
              title: 'The WHO Surgical Safety Checklist',
              content: 'Introduced in 2009, the WHO Surgical Safety Checklist has reduced surgical mortality by 47% and complications by 36% in multiple studies. It consists of three phases: Sign In (before anesthesia), Time Out (before incision), and Sign Out (before patient leaves theatre).',
              subsections: [
                {
                  title: 'Sign In (Before Anesthesia)',
                  content: 'Confirm patient identity, site marking, consent, known allergies, difficult airway risk, and risk of significant blood loss (>500ml adults, 7ml/kg children).'
                },
                {
                  title: 'Time Out (Before Incision)',
                  content: 'All team members introduce themselves. Confirm patient name, procedure, and site. Surgeon reviews critical steps and anticipated blood loss. Anesthetist confirms patient-specific concerns. Nursing team confirms sterility and equipment availability. Antibiotic prophylaxis within 60 minutes confirmed. Essential imaging displayed.'
                },
                {
                  title: 'Sign Out (Before Patient Leaves)',
                  content: 'Confirm procedure performed and documented. Instrument, sponge, and needle counts correct. Specimens labeled. Equipment problems documented. Key concerns for recovery reviewed.'
                }
              ]
            },
            {
              title: 'Swiss Cheese Model of Error',
              content: 'James Reason\'s Swiss Cheese Model explains that errors occur when holes in multiple defensive layers align. Each layer (training, protocols, equipment checks, supervision) has weaknesses. Your role is to be a barrier that catches errors before they reach the patient.'
            },
            {
              title: 'Preventing Wrong-Site Surgery',
              content: 'Mark the operative site with indelible marker before leaving the ward. The mark should be visible after draping. Use "Stop Before You Block" for regional anesthesia. Participate actively in the Time Out—speak up if something seems wrong.',
              subsections: [
                {
                  title: 'Site Marking Guidelines',
                  content: 'Mark the site yourself or witness the surgeon marking it. Use "YES" or an arrow, never "NO" or "X". Mark should be adjacent to, not on, the incision site. For bilateral procedures, mark the correct side. For midline procedures, marking may not apply but verify with team.'
                }
              ]
            },
            {
              title: 'Creating a Safety Culture',
              content: 'A safety culture is one where errors are reported without blame, near-misses are analyzed, and everyone feels empowered to speak up. Hierarchy should never prevent a junior from raising safety concerns. Use phrases like "I need clarity on..." or "Can we pause to verify...?"'
            },
            {
              title: 'Hand Hygiene: The Simplest Safety Intervention',
              content: 'Hand hygiene prevents healthcare-associated infections. WHO\'s 5 Moments for Hand Hygiene: before patient contact, before aseptic procedure, after body fluid exposure, after patient contact, and after touching patient surroundings. Alcohol-based hand rub is preferred unless hands are visibly soiled.'
            }
          ],
          keyPoints: [
            'Up to 50% of surgical complications are preventable',
            'The WHO Surgical Safety Checklist reduces mortality by 47%',
            'Never events include wrong-site surgery and retained foreign objects',
            'Site marking should be done before leaving the ward',
            'Everyone in theatre can and should participate in the Time Out',
            'Hand hygiene is the single most effective infection prevention measure'
          ],
          examTips: [
            'Know the three phases of the WHO Surgical Safety Checklist',
            'Understand the Swiss Cheese Model and how layers of defense work',
            'Be familiar with the 5 Moments for Hand Hygiene',
            'Questions may ask about who is responsible for site marking'
          ],
          clinicalPearls: [
            'Print or carry a checklist card until it becomes second nature',
            'If the Time Out feels rushed, slow it down—it\'s more important than saving a minute',
            'Document that site marking was verified by both you and the patient',
            'Report near-misses—they are learning opportunities, not failures'
          ],
          commonMistakes: [
            'Treating the checklist as a tick-box exercise rather than meaningful verification',
            'Not speaking up when something seems wrong',
            'Assuming someone else has verified patient identity or consent',
            'Skipping hand hygiene between patients due to time pressure',
            'Marking the wrong side due to mirror confusion when facing the patient'
          ],
          references: [
            'WHO: Surgical Safety Checklist Implementation Manual',
            'Haynes AB et al. NEJM 2009: A Surgical Safety Checklist to Reduce Morbidity and Mortality',
            'Reason J. BMJ 2000: Human error: models and management',
            'WHO Guidelines on Hand Hygiene in Health Care'
          ],
          selfAssessment: [
            {
              id: 'ho-1-2-q1',
              question: 'The Time Out phase of the WHO Surgical Safety Checklist occurs:',
              options: [
                'Before anesthesia induction',
                'Before skin incision',
                'After the procedure is completed',
                'During patient transfer to recovery'
              ],
              correctAnswer: 1,
              explanation: 'Time Out occurs before skin incision, after anesthesia but before the procedure begins. This is the final verification before an irreversible step.'
            },
            {
              id: 'ho-1-2-q2',
              question: 'Which of the following is NOT a "never event" in surgery?',
              options: [
                'Wrong-site surgery',
                'Retained surgical sponge',
                'Postoperative wound infection',
                'Surgery on the wrong patient'
              ],
              correctAnswer: 2,
              explanation: 'While wound infections are complications, they are not classified as never events. Never events are serious, preventable incidents like wrong-site surgery, retained objects, or wrong patient procedures.'
            },
            {
              id: 'ho-1-2-q3',
              question: 'According to WHO, when should antibiotic prophylaxis be administered for surgical procedures?',
              options: [
                'At the time of skin incision',
                'Within 60 minutes before incision',
                '2 hours before surgery',
                'Immediately after the procedure'
              ],
              correctAnswer: 1,
              explanation: 'Antibiotic prophylaxis should be given within 60 minutes before incision to ensure adequate tissue levels at the time of potential contamination.'
            }
          ]
        }
      },
      {
        id: 'ho-1-3',
        moduleId: 'ho-module-1',
        title: 'Clinical Documentation: Clerking, Progress Notes, Consent, and Handover',
        article: {
          title: 'Clinical Documentation: Clerking, Progress Notes, Consent, and Handover',
          overview: 'Clinical documentation is both a medicolegal requirement and a critical communication tool. Good documentation ensures continuity of care, facilitates clinical decision-making, and provides legal protection. This module covers the essential documentation skills every House Officer must master.',
          learningObjectives: [
            'Perform comprehensive surgical clerking',
            'Write effective daily progress notes using SOAP format',
            'Understand consent documentation requirements',
            'Execute safe clinical handover using SBAR',
            'Recognize documentation as a medicolegal duty'
          ],
          sections: [
            {
              title: 'Surgical Clerking',
              content: 'A complete surgical clerking establishes the patient\'s story, guides management, and serves as the baseline for comparison. It should be thorough yet focused on surgically relevant information.',
              subsections: [
                {
                  title: 'Components of Surgical Clerking',
                  content: 'Patient demographics, presenting complaint with duration, history of presenting complaint (SOCRATES for pain), past medical and surgical history, drug history including allergies, family and social history, systemic review, and physical examination findings.'
                },
                {
                  title: 'SOCRATES Pain Assessment',
                  content: 'Site, Onset, Character, Radiation, Associations (nausea, vomiting, fever), Time course/duration, Exacerbating and relieving factors, Severity (0-10 scale). This structured approach ensures no aspect of pain is missed.'
                },
                {
                  title: 'Physical Examination Documentation',
                  content: 'Document both positive and relevant negative findings. For abdominal examination: inspection (scars, distension), palpation (tenderness, masses, organomegaly), percussion (shifting dullness, tympany), auscultation (bowel sounds). Always include vital signs and general appearance.'
                }
              ]
            },
            {
              title: 'Progress Notes',
              content: 'Daily progress notes document the patient\'s clinical trajectory. Use the SOAP format: Subjective (patient\'s symptoms and concerns), Objective (examination findings, vital signs, investigation results), Assessment (your clinical impression), Plan (management steps).',
              subsections: [
                {
                  title: 'SOAP Format Example',
                  content: 'S: "Pain is improving, passed flatus this morning." O: Afebrile, HR 78, BP 120/80, abdomen soft, wound clean, bowels opened. A: Post-appendicectomy Day 2, recovering well. P: Continue analgesia, advance diet to light, plan discharge if stable.'
                },
                {
                  title: 'Post-Operative Notes',
                  content: 'Include: procedure performed, surgeon and assistant, anesthesia type, intraoperative findings, specimens sent, estimated blood loss, drains/catheters in situ, closure method, and immediate postoperative orders.'
                }
              ]
            },
            {
              title: 'Consent Documentation',
              content: 'Informed consent is a process, not just a form. The patient must understand: the nature of the procedure, expected benefits, material risks, alternatives including no treatment, and who will perform the procedure. Document that these were explained and the patient\'s questions answered.',
              subsections: [
                {
                  title: 'Who Can Consent?',
                  content: 'Consent should be obtained by someone capable of performing the procedure. House Officers may consent for procedures within their competence (e.g., cannulation, catheterization) but should not consent for surgical procedures they cannot perform.'
                },
                {
                  title: 'Capacity Assessment',
                  content: 'A patient with capacity can: understand information, retain it, weigh it in decision-making, and communicate a decision. Capacity is decision-specific and time-specific. If capacity is in doubt, document your assessment and seek senior guidance.'
                }
              ]
            },
            {
              title: 'Clinical Handover',
              content: 'Poor handover is a leading cause of adverse events. Use SBAR: Situation (who you are, who the patient is, current concern), Background (relevant history, reason for admission, current treatment), Assessment (your clinical assessment, vital signs), Recommendation (what you need the receiver to do).',
              subsections: [
                {
                  title: 'End-of-Shift Handover',
                  content: 'Prepare a written list of patients with outstanding tasks. Highlight sick patients and those needing review. Ensure the receiving team knows who to worry about. Verbal handover should be face-to-face when possible.'
                },
                {
                  title: 'Handover Red Flags',
                  content: 'Patients with Early Warning Score ≥5, those awaiting urgent investigations or review, patients with altered consciousness, and those with new onset sepsis markers must be specifically highlighted.'
                }
              ]
            },
            {
              title: 'Medicolegal Aspects of Documentation',
              content: 'Your documentation may be reviewed years later in legal proceedings. Write as if it will be read in court. Be factual, avoid speculation, use objective language, and never alter records retrospectively. Late entries should be clearly dated and marked as "Late entry."'
            }
          ],
          keyPoints: [
            'Documentation is a medicolegal duty—"If it wasn\'t documented, it wasn\'t done"',
            'Use SOAP format for progress notes: Subjective, Objective, Assessment, Plan',
            'Use SOCRATES for comprehensive pain assessment',
            'Consent requires understanding, not just a signature',
            'SBAR ensures structured, effective handover',
            'Never alter records retrospectively without clear annotation'
          ],
          examTips: [
            'Know the components of SBAR and when to use it',
            'Understand who can legally consent patients for procedures',
            'Be familiar with capacity assessment criteria',
            'Questions often test knowledge of proper documentation standards'
          ],
          clinicalPearls: [
            'Date and time every entry—use 24-hour clock',
            'Sign with your name, designation, and GMC/MDCN number',
            'If unsure about a finding, document "? mass in RIF, for senior review"',
            'Prepare handover lists before your shift ends, not during handover'
          ],
          commonMistakes: [
            'Illegible handwriting that cannot be deciphered',
            'Using unexplained abbreviations',
            'Failing to document allergies prominently',
            'Copying previous notes without re-examining the patient',
            'Giving verbal handover without written backup'
          ],
          references: [
            'Medical and Dental Council of Nigeria: Code of Medical Ethics',
            'GMC: Good Medical Practice - Documentation Standards',
            'Royal College of Surgeons: Good Surgical Practice',
            'WHO: Communication During Patient Handovers'
          ],
          selfAssessment: [
            {
              id: 'ho-1-3-q1',
              question: 'In the SOAP format for progress notes, "A" stands for:',
              options: [
                'Action plan',
                'Assessment',
                'Allergies',
                'Advice given'
              ],
              correctAnswer: 1,
              explanation: 'SOAP stands for Subjective (patient\'s symptoms), Objective (examination findings), Assessment (clinical impression), and Plan (management steps).'
            },
            {
              id: 'ho-1-3-q2',
              question: 'A House Officer should consent a patient for:',
              options: [
                'Appendicectomy if the registrar is busy',
                'Procedures within their competence like IV cannulation',
                'Any procedure they have witnessed three times',
                'Emergency procedures when no senior is available'
              ],
              correctAnswer: 1,
              explanation: 'House Officers should only consent patients for procedures within their own competence—typically basic procedures like cannulation, catheterization, or simple wound care.'
            },
            {
              id: 'ho-1-3-q3',
              question: 'Which component of SBAR provides the clinical impression and vital signs?',
              options: [
                'Situation',
                'Background',
                'Assessment',
                'Recommendation'
              ],
              correctAnswer: 2,
              explanation: 'Assessment provides your clinical impression, including vital signs and relevant examination findings. It tells the receiver what you think is happening.'
            }
          ]
        }
      }
    ]
  }
];

// Additional Module 1 Topics
const HO_MODULE_1_ADDITIONAL_TOPICS: CMETopic[] = [
  {
    id: 'ho-1-4',
    moduleId: 'ho-module-1',
    title: 'Communication and Teamwork in Surgery',
    article: {
      title: 'Communication and Teamwork in Surgery',
      overview: 'Effective communication is as critical to surgical outcomes as technical skill. Communication failures contribute to 70% of sentinel events in healthcare. This module explores evidence-based communication strategies and teamwork principles essential for safe surgical practice.',
      learningObjectives: [
        'Understand the role of communication in surgical safety',
        'Apply Crew Resource Management (CRM) principles to surgical teams',
        'Use closed-loop communication effectively',
        'Navigate hierarchy to voice safety concerns',
        'Communicate effectively with patients and families'
      ],
      sections: [
        {
          title: 'The Cost of Communication Failure',
          content: 'Studies show that communication failures are the root cause of most surgical adverse events. The Joint Commission found that 70% of sentinel events involved communication breakdowns. In the operating theatre, this can mean wrong-site surgery, medication errors, or missed critical information. Unlike technical errors, communication failures are entirely preventable.',
          subsections: [
            {
              title: 'Types of Communication Failure',
              content: 'Failures include: missing information (not shared), misunderstood information (shared but not understood), and misinterpreted information (understood differently than intended). Each requires different prevention strategies.'
            }
          ]
        },
        {
          title: 'Crew Resource Management in Surgery',
          content: 'CRM originated in aviation and has been adapted for healthcare. Core principles include: flattened hierarchy for safety communication, structured communication protocols, shared mental models, cross-monitoring of team performance, and speaking up when something seems wrong.',
          subsections: [
            {
              title: 'Shared Mental Model',
              content: 'All team members should have the same understanding of the procedure, the patient, potential risks, and contingency plans. The Time Out helps establish this shared understanding.'
            },
            {
              title: 'Cross-Monitoring',
              content: 'Team members observe each other\'s work and speak up if they notice potential errors. This is not criticism—it is a safety behavior that catches errors before they reach the patient.'
            }
          ]
        },
        {
          title: 'Closed-Loop Communication',
          content: 'Closed-loop communication ensures messages are received and understood. Step 1: Sender delivers clear message. Step 2: Receiver acknowledges and repeats back. Step 3: Sender confirms accuracy. Example: Surgeon: "10mg morphine IV please." Nurse: "10mg morphine IV, administering now." Surgeon: "Correct, thank you."'
        },
        {
          title: 'Challenging Hierarchy Safely',
          content: 'Hierarchy is necessary but should not prevent safety concerns being raised. Techniques include: CUS words (Concerned, Uncomfortable, Safety issue), Two-Challenge Rule (state concern twice, then escalate), and the "Advocacy-Inquiry" approach ("I notice X, help me understand why we\'re doing Y").',
          subsections: [
            {
              title: 'CUS Words',
              content: 'Use escalating phrases: "I am Concerned about...", "I am Uncomfortable with...", "This is a Safety issue." These signal increasing severity and demand attention.'
            }
          ]
        },
        {
          title: 'Patient and Family Communication',
          content: 'Clear communication with patients builds trust and improves outcomes. Use plain language (avoid medical jargon), confirm understanding with teach-back, and create space for questions. When delivering difficult news, use the SPIKES protocol: Setting, Perception, Invitation, Knowledge, Emotions, Strategy.',
          subsections: [
            {
              title: 'Teach-Back Method',
              content: 'Ask patients to explain what you\'ve told them in their own words. "Just to make sure I explained clearly, can you tell me what you understand about the procedure?" This identifies gaps in understanding.'
            }
          ]
        }
      ],
      keyPoints: [
        'Communication failures cause 70% of sentinel events',
        'CRM principles apply to surgical teams: flattened hierarchy, shared mental models',
        'Use closed-loop communication for critical information',
        'CUS words and the Two-Challenge Rule help navigate hierarchy',
        'Teach-back confirms patient understanding',
        'Speaking up for safety is a professional obligation, not insubordination'
      ],
      examTips: [
        'Know the components of closed-loop communication',
        'Understand CUS words and when to use them',
        'Be familiar with the SPIKES protocol for breaking bad news',
        'Questions may test knowledge of team communication strategies'
      ],
      clinicalPearls: [
        'Address team members by name—it improves response rates',
        'If you\'re ignored, speak louder and more directly; do not back down on safety',
        'Brief families before and after procedures—consistency builds trust',
        'Document significant communications in the notes'
      ],
      commonMistakes: [
        'Assuming everyone knows what you know',
        'Using medical jargon with patients',
        'Staying silent when something seems wrong',
        'Not confirming that critical messages were received',
        'Giving complex information when patients are stressed or sedated'
      ],
      references: [
        'Joint Commission: Sentinel Event Data 2020',
        'Lingard L. NEJM 2004: Communication failures in the operating room',
        'Agency for Healthcare Research and Quality: TeamSTEPPS',
        'Baile WF. Oncologist 2000: SPIKES—A Six-Step Protocol for Breaking Bad News'
      ],
      selfAssessment: [
        {
          id: 'ho-1-4-q1',
          question: 'Closed-loop communication involves:',
          options: [
            'Sending a message and assuming it was understood',
            'Sender delivers message, receiver repeats back, sender confirms',
            'Writing all communications in the patient notes',
            'Using only hand signals in the operating theatre'
          ],
          correctAnswer: 1,
          explanation: 'Closed-loop communication has three steps: sender delivers message, receiver acknowledges and repeats back, sender confirms accuracy. This ensures the message was correctly received.'
        },
        {
          id: 'ho-1-4-q2',
          question: 'The "CUS" words in escalating safety concerns stand for:',
          options: [
            'Check, Understand, Stop',
            'Concerned, Uncomfortable, Safety issue',
            'Call, Urgent, Serious',
            'Confirm, Update, Supervise'
          ],
          correctAnswer: 1,
          explanation: 'CUS words (Concerned, Uncomfortable, Safety issue) provide escalating phrases to challenge decisions safely when there are safety concerns.'
        }
      ]
    }
  },
  {
    id: 'ho-1-5',
    moduleId: 'ho-module-1',
    title: 'Operating Theatre Etiquette and Sterile Technique',
    article: {
      title: 'Operating Theatre Etiquette and Sterile Technique',
      overview: 'The operating theatre is a controlled environment where infection prevention and surgical precision are paramount. Understanding theatre etiquette and sterile technique is essential for House Officers, whether assisting in surgery or performing procedures. This module covers the principles that protect both patient and practitioner.',
      learningObjectives: [
        'Understand the zones and traffic flow in operating theatres',
        'Demonstrate correct surgical scrubbing, gowning, and gloving',
        'Maintain sterile fields and recognize contamination',
        'Apply principles of aseptic technique',
        'Understand your role as a surgical assistant'
      ],
      sections: [
        {
          title: 'Theatre Zones and Traffic Flow',
          content: 'Operating theatres are designed with zones to minimize infection risk. The Outer Zone (unrestricted) includes reception and changing areas. The Transition Zone (semi-restricted) requires scrubs and caps. The Inner Zone (restricted) includes the operating room itself—full theatre attire required. Traffic flow should be unidirectional where possible.',
          subsections: [
            {
              title: 'Theatre Attire',
              content: 'In the operating suite, wear: clean scrubs (change if visibly soiled), theatre cap covering all hair, mask covering nose and mouth, and dedicated theatre footwear or shoe covers. Remove watches, jewelry, and ensure nails are short and unvarnished.'
            }
          ]
        },
        {
          title: 'Surgical Hand Scrubbing',
          content: 'The surgical scrub reduces hand microbial load before gloving. Traditional scrub: use antiseptic solution (chlorhexidine or povidone-iodine) for 3-5 minutes, scrubbing from fingertips to elbows. Modern alcohol-based scrub: wash hands first, then apply alcohol-based hand rub systematically. Either method must be performed thoroughly.',
          subsections: [
            {
              title: 'Scrub Technique',
              content: 'Scrub each finger, palm, dorsum of hand, wrist, and forearm systematically. Keep hands above elbows so water runs away from fingertips. Do not touch anything non-sterile after scrubbing. Enter the theatre with hands raised.'
            }
          ]
        },
        {
          title: 'Gowning and Gloving',
          content: 'After scrubbing, a circulating nurse or scrub nurse assists with gowning. Put arms into the gown sleeves without hands emerging from cuffs (closed gloving technique). For gloves, use the closed technique: pick up the first glove through the gown cuff, place on opposite hand palm-to-palm, flip over and pull onto hand. Repeat for second glove.',
          subsections: [
            {
              title: 'Closed Gloving Technique',
              content: 'This technique keeps hands covered by the gown until inside the glove, reducing contamination risk. It requires practice to master but is the preferred method for primary surgical team members.'
            },
            {
              title: 'Assisted Gloving',
              content: 'A scrubbed team member can hold gloves open for you to insert hands directly. This is faster but requires the assistant to be already gloved and gowned.'
            }
          ]
        },
        {
          title: 'Maintaining Sterile Fields',
          content: 'Once scrubbed and gowned, your sterile area is from mid-chest to waist, and hands to just below the elbows. Keep hands visible and within the sterile zone—clasped in front or resting on a draped surface. Never turn your back to the sterile field. If you must move, pass back-to-back with other sterile team members.',
          subsections: [
            {
              title: 'Recognizing Contamination',
              content: 'Contamination occurs when sterile surfaces contact non-sterile surfaces. If in doubt, consider it contaminated. Common contaminations: touching the face, back of gown, below waist level, or non-sterile surfaces. If contaminated, change gloves (or re-gown if the gown is affected).'
            }
          ]
        },
        {
          title: 'Assisting in Surgery',
          content: 'As a House Officer, you assist by: providing retraction and exposure, suctioning to maintain visibility, cutting sutures on command, and anticipating the surgeon\'s needs. Watch the operative field, not the surgeon\'s hands. Stay alert, maintain retraction tension, and respond promptly to instructions.',
          subsections: [
            {
              title: 'Common Tasks',
              content: 'Retraction (steady, not jerky movements), suction (follow bleeding, keep tip visible), cutting sutures (leave appropriate length as instructed), and holding instruments when passed. Learn to anticipate what\'s needed next.'
            }
          ]
        },
        {
          title: 'Theatre Behavior and Etiquette',
          content: 'Minimize unnecessary movement and conversation—this reduces contamination and distraction. Mobile phones should be silenced and not used in theatre. If you feel faint, step back from the sterile field and sit down. Stay hydrated before long cases. Treat all theatre staff with respect.'
        }
      ],
      keyPoints: [
        'Theatres have three zones: outer, transition, and inner',
        'Surgical scrub duration: 3-5 minutes (traditional) or thorough alcohol rub',
        'Closed gloving technique is preferred for primary team members',
        'Sterile zone: mid-chest to waist, hands to below elbows',
        'If in doubt about contamination, consider it contaminated',
        'Minimize movement and conversation; stay alert as an assistant'
      ],
      examTips: [
        'Know the duration and technique for surgical hand scrubbing',
        'Understand the sterile and non-sterile zones of a scrubbed person',
        'Be familiar with what constitutes a break in sterile technique',
        'Questions may test your response to suspected contamination'
      ],
      clinicalPearls: [
        'Arrive early enough to scrub calmly—rushing leads to poor technique',
        'If you are the first to notice contamination, speak up politely',
        'Practice gloving technique before your first time in theatre',
        'Stay focused on the operative field—anticipation impresses surgeons'
      ],
      commonMistakes: [
        'Touching the mask or face after scrubbing',
        'Letting hands drop below waist level',
        'Turning back toward the sterile field',
        'Not changing gloves after suspected contamination',
        'Leaning over the sterile field to see better'
      ],
      references: [
        'AORN Guidelines for Perioperative Practice',
        'WHO: Surgical Site Infection Prevention Guidelines',
        'Association for Surgical Technologists: Standards of Practice',
        'Royal College of Surgeons: Intercollegiate Surgical Curriculum Programme'
      ],
      selfAssessment: [
        {
          id: 'ho-1-5-q1',
          question: 'The sterile zone on a scrubbed surgeon extends:',
          options: [
            'From shoulders to knees',
            'From mid-chest to waist, hands to below elbows',
            'The entire front of the gown',
            'Only the gloved hands'
          ],
          correctAnswer: 1,
          explanation: 'The sterile zone is from mid-chest to waist (front only), and from hands to just below the elbows. Areas outside this zone, including the back of the gown, are considered non-sterile.'
        },
        {
          id: 'ho-1-5-q2',
          question: 'If you suspect your gloves have been contaminated during surgery, you should:',
          options: [
            'Continue if the surgery is almost complete',
            'Wipe the gloves with alcohol solution',
            'Notify the team and change gloves immediately',
            'Wait until the current step is finished before changing'
          ],
          correctAnswer: 2,
          explanation: 'If contamination is suspected, notify the team and change gloves immediately. Continuing with potentially contaminated gloves risks surgical site infection.'
        }
      ]
    }
  },
  {
    id: 'ho-1-6',
    moduleId: 'ho-module-1',
    title: 'Informed Consent: Principles and Practice',
    article: {
      title: 'Informed Consent: Principles and Practice',
      overview: 'Informed consent is a fundamental ethical and legal requirement in medical practice. It represents the patient\'s autonomous decision to accept or refuse treatment based on adequate information. This module explores the principles, processes, and documentation of informed consent in surgical practice.',
      learningObjectives: [
        'Explain the ethical basis of informed consent',
        'Identify the components required for valid consent',
        'Assess patient capacity for consent',
        'Handle situations where capacity is impaired or absent',
        'Document consent appropriately'
      ],
      sections: [
        {
          title: 'Ethical and Legal Foundations',
          content: 'Informed consent is grounded in the ethical principle of autonomy—the patient\'s right to make decisions about their own body. Legally, any medical intervention without valid consent may constitute assault or battery. The landmark Montgomery v Lanarkshire (2015) case established that doctors must disclose any material risks that a reasonable patient would want to know.',
          subsections: [
            {
              title: 'Material Risk Standard',
              content: 'A risk is material if: a reasonable person in the patient\'s position would attach significance to it, or the doctor should reasonably be aware that this particular patient would attach significance to it. This moves beyond what doctors think is important to what patients need to know.'
            }
          ]
        },
        {
          title: 'Components of Valid Consent',
          content: 'For consent to be valid, three conditions must be met: 1) The patient has capacity, 2) Consent is given voluntarily without coercion, 3) The patient is adequately informed. Missing any component invalidates the consent.',
          subsections: [
            {
              title: 'Adequate Information',
              content: 'Patients must be told: the nature of the procedure, the expected benefits, material risks and complications, alternative treatments (including no treatment), and who will perform the procedure. Information should be tailored to the patient\'s understanding.'
            },
            {
              title: 'Voluntary Consent',
              content: 'Consent must be given freely. Pressure from doctors, family, or institutions invalidates consent. Allow patients time to consider, ask questions, and change their mind. Consent given under duress is not valid.'
            }
          ]
        },
        {
          title: 'Assessing Capacity',
          content: 'Capacity is decision-specific and time-specific. A patient has capacity if they can: 1) Understand information relevant to the decision, 2) Retain that information, 3) Use or weigh information as part of decision-making, 4) Communicate a decision (by any means).',
          subsections: [
            {
              title: 'Presumption of Capacity',
              content: 'Every adult is presumed to have capacity unless demonstrated otherwise. Unwise decisions do not automatically indicate lack of capacity. Capacity can fluctuate—assess at the appropriate time for the decision.'
            },
            {
              title: 'When Capacity is Lacking',
              content: 'If a patient lacks capacity, act in their best interests. Consider: what decision they would likely make, any previously expressed wishes, the views of those close to them, and the least restrictive option. Document your assessment and reasoning thoroughly.'
            }
          ]
        },
        {
          title: 'Special Situations',
          content: 'Several situations require special consideration: emergency treatment when consent cannot be obtained, minors, patients with fluctuating capacity, and those with advance directives.',
          subsections: [
            {
              title: 'Emergency Treatment',
              content: 'In emergencies where the patient cannot consent and delay would cause harm, necessary treatment can proceed under the principle of necessity. Only perform what is immediately necessary to save life or prevent serious deterioration. Document why emergency treatment was required.'
            },
            {
              title: 'Minors',
              content: 'In most jurisdictions, 16+ can consent to treatment. Under 16, assess for "Gillick competence"—can the child understand what is proposed and its implications? Parents cannot override a competent minor\'s consent, but may consent on behalf of an incompetent minor in their best interests.'
            }
          ]
        },
        {
          title: 'Documentation of Consent',
          content: 'Consent is a process, not just a form. The form documents that consent has been given, but the conversation is equally important. Document: who obtained consent, what was explained, questions asked, risks discussed, and that the patient had opportunity to ask questions.',
          subsections: [
            {
              title: 'Who Should Obtain Consent?',
              content: 'Ideally, consent should be obtained by the person performing the procedure, who can best explain risks and answer questions. If delegated, the person obtaining consent must be capable of performing the procedure or have been specifically trained.'
            }
          ]
        }
      ],
      keyPoints: [
        'Valid consent requires capacity, voluntariness, and adequate information',
        'Material risks are those a reasonable patient would want to know',
        'Capacity is decision-specific and time-specific; presumed unless demonstrated otherwise',
        'In emergencies, treat under necessity but only what is immediately required',
        'Consent should ideally be obtained by the person performing the procedure',
        'Document the consent process, not just the signature'
      ],
      examTips: [
        'Know the four components of capacity assessment',
        'Understand the Montgomery ruling and material risk standard',
        'Be familiar with Gillick competence for minors',
        'Questions often present ethical dilemmas about consent'
      ],
      clinicalPearls: [
        'Give written information in advance so patients can read and prepare questions',
        'Use diagrams or models to explain complex procedures',
        'Document if a patient declines to hear about risks—but still offer information',
        'Consent can be withdrawn at any time—respect this immediately'
      ],
      commonMistakes: [
        'Rushing consent immediately before a procedure',
        'Using technical jargon that patients cannot understand',
        'Failing to discuss alternatives, including no treatment',
        'Assuming relatives can consent for adults who lack capacity',
        'Not documenting the consent conversation'
      ],
      references: [
        'Montgomery v Lanarkshire Health Board [2015] UKSC 11',
        'General Medical Council: Consent: Patients and Doctors Making Decisions Together',
        'Mental Capacity Act 2005 Code of Practice',
        'Gillick v West Norfolk AHA [1986] AC 112'
      ],
      selfAssessment: [
        {
          id: 'ho-1-6-q1',
          question: 'According to the Montgomery ruling, material risks are those that:',
          options: [
            'Have a probability greater than 5%',
            'The surgeon considers most important',
            'A reasonable patient would attach significance to',
            'Are listed on the standard consent form'
          ],
          correctAnswer: 2,
          explanation: 'The Montgomery ruling established that material risks are those that a reasonable person in the patient\'s position would attach significance to, or that the doctor should reasonably know this particular patient would consider significant.'
        },
        {
          id: 'ho-1-6-q2',
          question: 'Which of the following is NOT a component of capacity assessment?',
          options: [
            'Ability to understand information',
            'Ability to make a sensible decision',
            'Ability to retain information',
            'Ability to communicate a decision'
          ],
          correctAnswer: 1,
          explanation: 'Capacity requires ability to understand, retain, and weigh information, and communicate a decision. Making a "sensible" decision is not required—patients may make decisions others consider unwise while still having capacity.'
        }
      ]
    }
  },
  {
    id: 'ho-1-7',
    moduleId: 'ho-module-1',
    title: 'Handling Critical Incidents and Resuscitation Scenarios',
    article: {
      title: 'Handling Critical Incidents and Resuscitation Scenarios',
      overview: 'Critical incidents in surgical practice can occur suddenly and require immediate, coordinated response. House Officers must be prepared to recognize deterioration, initiate resuscitation, and work effectively as part of the resuscitation team. This module covers the recognition and initial management of common critical incidents.',
      learningObjectives: [
        'Recognize signs of patient deterioration using early warning scores',
        'Apply the ABCDE systematic approach to the deteriorating patient',
        'Initiate basic life support and know when to call for help',
        'Understand your role in the resuscitation team',
        'Participate in structured debriefing after critical incidents'
      ],
      sections: [
        {
          title: 'Recognizing Deterioration',
          content: 'Patient deterioration often follows predictable patterns. The National Early Warning Score (NEWS) provides a standardized assessment tool using vital signs: respiratory rate, oxygen saturation, temperature, blood pressure, heart rate, and level of consciousness (AVPU). A NEWS ≥5 indicates high risk and requires urgent senior review.',
          subsections: [
            {
              title: 'NEWS Scoring',
              content: 'Each parameter scores 0-3 based on deviation from normal. Total score 0-4: low risk, routine monitoring. Score 5-6: medium risk, urgent senior review. Score ≥7: high risk, emergency assessment. Any single parameter scoring 3 triggers urgent review.'
            },
            {
              title: 'Subtle Signs of Deterioration',
              content: 'Not all deterioration is dramatic. Watch for: increasing oxygen requirements, rising heart rate, decreasing urine output, new confusion, and the patient who "just doesn\'t look right." Trust your instincts and escalate early.'
            }
          ]
        },
        {
          title: 'The ABCDE Approach',
          content: 'A systematic approach ensures nothing is missed. Airway: is it patent? Look, listen, feel for obstruction. Breathing: rate, oxygen saturation, work of breathing, chest auscultation. Circulation: pulse rate and character, blood pressure, capillary refill, skin color. Disability: AVPU (Alert, Voice, Pain, Unresponsive), glucose, pupils. Exposure: fully examine but maintain dignity.',
          subsections: [
            {
              title: 'Treat as You Find',
              content: 'The ABCDE approach is not just assessment—treat life-threatening problems as you find them before moving on. Airway obstruction? Clear it. Not breathing? Ventilate. No pulse? Start CPR. Hypoglycemic? Give glucose. Don\'t wait until you\'ve finished assessing to start treating.'
            }
          ]
        },
        {
          title: 'Basic Life Support',
          content: 'When you find an unresponsive patient: Check response (shake and shout). Call for help. Open airway (head tilt, chin lift). Check breathing for no more than 10 seconds. If not breathing normally, start CPR: 30 chest compressions (5-6cm depth, 100-120/min) followed by 2 rescue breaths. Continue until help arrives or patient responds.',
          subsections: [
            {
              title: 'High-Quality CPR',
              content: 'Push hard (5-6cm) and fast (100-120/min). Allow complete chest recoil between compressions. Minimize interruptions. Switch compressor every 2 minutes to prevent fatigue. Compression fraction should be >60%.'
            },
            {
              title: 'Defibrillation',
              content: 'Early defibrillation saves lives in shockable rhythms (VF/pulseless VT). If an AED is available, apply pads and follow voice prompts. If using a manual defibrillator, follow team leader instructions. Never delay defibrillation for any intervention except CPR.'
            }
          ]
        },
        {
          title: 'Your Role in the Resuscitation Team',
          content: 'In a resuscitation, roles should be clearly assigned. The team leader coordinates and makes decisions. Airway manager secures and maintains the airway. Chest compressor delivers compressions. Others manage access, medications, and documentation. As a House Officer, you may be assigned any of these roles—be ready.',
          subsections: [
            {
              title: 'Common HO Tasks During Resuscitation',
              content: 'Chest compressions, IV access, drawing up medications, time-keeping, documentation, fetching equipment, and preparation for procedures. If you\'re not sure what to do, ask the team leader. Stay in the room and be useful.'
            },
            {
              title: 'Communication During Resuscitation',
              content: 'Use closed-loop communication. Acknowledge instructions: "Giving 1mg adrenaline IV now." Report when complete: "Adrenaline given." If you cannot complete a task, say so: "I cannot get IV access, need assistance."'
            }
          ]
        },
        {
          title: 'Post-Resuscitation Care',
          content: 'If return of spontaneous circulation (ROSC) is achieved: continue monitoring, secure airway if needed, aim for target SpO2 94-98%, maintain blood pressure (may need fluids/vasopressors), check 12-lead ECG, check blood glucose, arrange appropriate destination (ICU, cath lab as indicated).'
        },
        {
          title: 'Debriefing After Critical Incidents',
          content: 'After any critical incident, debriefing is essential for learning and wellbeing. Hot debrief: immediately after, brief check-in on team welfare and immediate concerns. Cold debrief: structured review of what happened, what went well, what could improve. Psychological support should be available for those affected.'
        }
      ],
      keyPoints: [
        'NEWS ≥5 or any parameter scoring 3 requires urgent senior review',
        'ABCDE: Airway, Breathing, Circulation, Disability, Exposure',
        'Treat life-threatening problems as you find them',
        'High-quality CPR: 5-6cm depth, 100-120/min, minimal interruptions',
        'Know your role in the resuscitation team and communicate clearly',
        'Debriefing after critical incidents supports learning and wellbeing'
      ],
      examTips: [
        'Know the NEWS thresholds for escalation',
        'ABCDE approach appears frequently in clinical exams',
        'Understand the sequence and ratios for BLS (30:2)',
        'Know the criteria for high-quality CPR'
      ],
      clinicalPearls: [
        'When in doubt, put out the arrest call—it\'s better to have help you don\'t need',
        'The first blood gas tells you a lot—get it early in deteriorating patients',
        'Massive blood loss can occur with normal blood pressure initially (compensated shock)',
        'Attend resuscitation attempts whenever possible—observation is valuable learning'
      ],
      commonMistakes: [
        'Waiting too long to escalate concerns about a deteriorating patient',
        'Not calling for help early enough in a resuscitation',
        'Interrupting CPR unnecessarily (for pulse checks that take too long)',
        'Not speaking up when you notice something wrong',
        'Forgetting to document during and after resuscitation'
      ],
      references: [
        'Resuscitation Council UK: Adult Advanced Life Support Guidelines 2021',
        'Royal College of Physicians: National Early Warning Score (NEWS) 2',
        'European Resuscitation Council Guidelines 2021',
        'American Heart Association: BLS and ACLS Guidelines'
      ],
      selfAssessment: [
        {
          id: 'ho-1-7-q1',
          question: 'A NEWS score of 7 indicates:',
          options: [
            'Normal monitoring can continue',
            'Routine senior review on ward round',
            'Emergency assessment and intervention required',
            'The scoring system needs recalibration'
          ],
          correctAnswer: 2,
          explanation: 'A NEWS score of 7 or above indicates high clinical risk requiring emergency assessment by a clinical team with competencies in the care of acutely ill patients.'
        },
        {
          id: 'ho-1-7-q2',
          question: 'The recommended compression depth for adult CPR is:',
          options: [
            '2-3 cm',
            '3-4 cm',
            '4-5 cm',
            '5-6 cm'
          ],
          correctAnswer: 3,
          explanation: 'For adult CPR, chest compressions should be 5-6 cm deep, at a rate of 100-120 compressions per minute, with complete recoil between compressions.'
        },
        {
          id: 'ho-1-7-q3',
          question: 'In the ABCDE approach, "D" stands for:',
          options: [
            'Diagnosis',
            'Disability',
            'Defibrillation',
            'Drugs'
          ],
          correctAnswer: 1,
          explanation: 'D stands for Disability, which includes neurological assessment (AVPU scale or GCS), blood glucose check, and pupil examination.'
        }
      ]
    }
  }
];

// Add additional topics to Module 1
HOUSE_OFFICER_MODULES[0].topics.push(...HO_MODULE_1_ADDITIONAL_TOPICS);

// ==================== HOUSE OFFICER MODULE 2 ====================
const HO_MODULE_2: CMEModule = {
  id: 'ho-module-2',
  title: 'Module 2: Perioperative Care Essentials',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-2-1',
      moduleId: 'ho-module-2',
      title: 'Preoperative Assessment: History, Examination, and Risk Stratification',
      article: {
        title: 'Preoperative Assessment: History, Examination, and Risk Stratification',
        overview: 'Thorough preoperative assessment identifies risk factors, optimizes patients for surgery, and informs surgical decision-making. This module covers systematic preoperative evaluation from the House Officer\'s perspective.',
        learningObjectives: [
          'Perform comprehensive preoperative history and examination',
          'Identify major perioperative risk factors',
          'Apply risk stratification tools (ASA, cardiac risk indices)',
          'Order appropriate preoperative investigations',
          'Recognize patients who require specialist referral'
        ],
        sections: [
          {
            title: 'Preoperative History',
            content: 'A focused surgical history should include: presenting complaint, past surgical history (previous anesthesia, complications), medical comorbidities (especially cardiovascular, respiratory, diabetes, renal disease), medications (particularly anticoagulants, antiplatelets, steroids, cardiac medications), allergies (true allergies vs. intolerances), and functional status (exercise tolerance, daily activities).',
            subsections: [
              {
                title: 'Functional Status Assessment',
                content: 'Ask about daily activities: Can you climb 2 flights of stairs without stopping? Walk 4 blocks? The ability to achieve 4 METs (metabolic equivalents) correlates with lower perioperative risk. Poor functional capacity warrants further cardiac assessment.'
              },
              {
                title: 'Anesthesia History',
                content: 'Previous anesthesia complications: difficult intubation, malignant hyperthermia, prolonged paralysis (pseudocholinesterase deficiency), severe PONV. Family history of anesthesia problems is also relevant.'
              }
            ]
          },
          {
            title: 'Preoperative Examination',
            content: 'Systematic examination should cover: general appearance and mobility, airway assessment (Mallampati score, neck extension, mouth opening), cardiovascular system (JVP, murmurs, peripheral edema, blood pressure), respiratory system (breath sounds, work of breathing), and relevant regional examination for the planned surgery.',
            subsections: [
              {
                title: 'Mallampati Airway Assessment',
                content: 'Class I: soft palate, uvula, tonsils visible. Class II: soft palate, upper uvula visible. Class III: soft palate, base of uvula visible. Class IV: hard palate only. Higher class correlates with more difficult intubation.'
              }
            ]
          },
          {
            title: 'Risk Stratification',
            content: 'Several tools help predict perioperative risk. The ASA Physical Status Classification ranges from I (healthy) to VI (brain-dead organ donor). Cardiac risk assessment uses indices like the Revised Cardiac Risk Index (RCRI) or ACS NSQIP calculator.',
            subsections: [
              {
                title: 'ASA Classification',
                content: 'ASA I: healthy patient. ASA II: mild systemic disease (well-controlled hypertension, obesity). ASA III: severe systemic disease (poorly controlled diabetes, stable angina). ASA IV: severe disease that is constant threat to life (recent MI, unstable angina). ASA V: moribund, not expected to survive without surgery. Add "E" for emergency.'
              },
              {
                title: 'Revised Cardiac Risk Index (RCRI)',
                content: 'One point for each: high-risk surgery, history of ischemic heart disease, history of congestive heart failure, history of cerebrovascular disease, preoperative creatinine >177 μmol/L, insulin-treated diabetes. Score ≥3 indicates high cardiac risk.'
              }
            ]
          },
          {
            title: 'Preoperative Investigations',
            content: 'Investigations should be guided by clinical findings, not ordered routinely. Consider: full blood count (anemia, bleeding disorders), electrolytes and renal function (especially if on ACE-i, ARBs, diuretics), coagulation (if on anticoagulants or liver disease), ECG (cardiac history or high-risk surgery), chest X-ray (new respiratory symptoms or decompensated cardiac disease).',
            subsections: [
              {
                title: 'Avoiding Unnecessary Tests',
                content: 'Routine testing without clinical indication delays surgery and can lead to false positives requiring further work-up. NICE guidelines recommend targeted testing based on ASA status and surgery grade.'
              }
            ]
          },
          {
            title: 'Medication Management',
            content: 'Many medications require perioperative adjustment. Continue: beta-blockers, most antihypertensives, inhaled medications. Hold: ACE-i/ARBs on day of surgery (risk of intraoperative hypotension), metformin (variable practice, consult local guidelines). Anticoagulants and antiplatelets require specific bridging protocols—always discuss with seniors.',
            subsections: [
              {
                title: 'Anticoagulation Management',
                content: 'Warfarin: stop 5 days before surgery, check INR. Bridging with LMWH for high-risk indications. DOACs: stop 24-48 hours before depending on renal function and procedure. Antiplatelets: discuss risk of stopping versus bleeding risk.'
              }
            ]
          }
        ],
        keyPoints: [
          'Functional status (METs) is a key predictor of perioperative risk',
          'ASA classification ranges from I (healthy) to VI (brain-dead)',
          'RCRI predicts cardiac risk; score ≥3 is high risk',
          'Preoperative tests should be clinically indicated, not routine',
          'Know which medications to continue, hold, or bridge perioperatively'
        ],
        examTips: [
          'Know the ASA classification criteria',
          'Be familiar with the RCRI components',
          'Understand Mallampati scoring for airway assessment',
          'Questions often test medication management decisions'
        ],
        clinicalPearls: [
          'Always ask about previous anesthesia experiences',
          'Document functional status quantitatively (e.g., "climbs 2 flights of stairs without stopping")',
          'If in doubt about stopping a medication, ask the anesthetist',
          'Ensure allergies are clearly documented and differentiated from intolerances'
        ],
        commonMistakes: [
          'Ordering unnecessary routine investigations',
          'Forgetting to ask about over-the-counter medications and supplements',
          'Not documenting the preoperative assessment clearly',
          'Failing to escalate high-risk patients for specialist review'
        ],
        references: [
          'NICE: Preoperative Tests NG45',
          'American College of Cardiology: Perioperative Guidelines',
          'ASA Physical Status Classification System',
          'Lee TH. Circulation 1999: Derivation and validation of RCRI'
        ],
        selfAssessment: [
          {
            id: 'ho-2-1-q1',
            question: 'ASA III classification describes a patient with:',
            options: [
              'No systemic disease',
              'Mild systemic disease',
              'Severe systemic disease',
              'Severe disease that is constant threat to life'
            ],
            correctAnswer: 2,
            explanation: 'ASA III describes a patient with severe systemic disease that is not immediately life-threatening (e.g., poorly controlled diabetes, moderate COPD, stable angina).'
          },
          {
            id: 'ho-2-1-q2',
            question: 'Which medication is typically held on the day of surgery?',
            options: [
              'Beta-blockers',
              'ACE inhibitors',
              'Thyroid replacement',
              'Inhaled corticosteroids'
            ],
            correctAnswer: 1,
            explanation: 'ACE inhibitors and ARBs are typically held on the day of surgery due to the risk of refractory intraoperative hypotension. Beta-blockers should be continued.'
          }
        ]
      }
    },
    {
      id: 'ho-2-2',
      moduleId: 'ho-module-2',
      title: 'Fluid and Electrolyte Management',
      article: {
        title: 'Fluid and Electrolyte Management',
        overview: 'Intravenous fluid therapy is one of the most common interventions in surgical patients. Understanding the principles of fluid balance and electrolyte management is essential for preventing complications and optimizing patient outcomes.',
        learningObjectives: [
          'Calculate daily fluid and electrolyte requirements',
          'Select appropriate IV fluids for different clinical scenarios',
          'Recognize and manage common electrolyte disturbances',
          'Monitor fluid balance effectively',
          'Identify signs of fluid overload and dehydration'
        ],
        sections: [
          {
            title: 'Daily Requirements',
            content: 'The average 70kg adult requires: Water: 25-30 mL/kg/day (approximately 2-2.5L). Sodium: 1-2 mmol/kg/day. Potassium: 1 mmol/kg/day. Remember: these are maintenance requirements—losses (vomiting, diarrhea, drains, third-spacing) must be replaced in addition.',
            subsections: [
              {
                title: 'Calculating Maintenance Fluids',
                content: 'For a 70kg patient: 25-30 × 70 = 1750-2100mL/day. Adding electrolytes: 70mmol Na+ and 70mmol K+ daily. A common regimen: 2-3L of balanced crystalloid (e.g., Hartmann\'s) with added KCl.'
              }
            ]
          },
          {
            title: 'Types of IV Fluids',
            content: 'Crystalloids: Normal saline (0.9% NaCl) - 154mmol Na+, no K+, pH 5.0. Hartmann\'s/Ringer\'s lactate - balanced electrolytes, lactate as buffer. 5% Dextrose - essentially free water once glucose metabolized. Colloids: Gelatin solutions, albumin - remain in intravascular space longer but controversial in sepsis.',
            subsections: [
              {
                title: 'Choosing the Right Fluid',
                content: 'Resuscitation: balanced crystalloid (Hartmann\'s) is generally preferred. Maintenance: balanced crystalloid with appropriate K+ supplementation. Normal saline is associated with hyperchloremic acidosis if used in large volumes.'
              },
              {
                title: 'Fluid Composition Comparison',
                content: 'Normal saline: Na+ 154, Cl- 154, K+ 0, Ca2+ 0, pH 5.0. Hartmann\'s: Na+ 131, Cl- 111, K+ 5, Ca2+ 2, lactate 29, pH 6.5. Hartmann\'s is more physiological for most purposes.'
              }
            ]
          },
          {
            title: 'Assessing Fluid Status',
            content: 'Clinical assessment: vital signs (HR, BP, postural drop), mucous membranes, skin turgor, capillary refill, urine output (aim for >0.5mL/kg/hr in adults), JVP. Laboratory: urea/creatinine ratio (pre-renal vs. renal failure), electrolytes, lactate, hematocrit.',
            subsections: [
              {
                title: 'Signs of Dehydration',
                content: 'Mild (5%): dry mucous membranes, thirst. Moderate (10%): tachycardia, reduced skin turgor, oliguria. Severe (15%): hypotension, confusion, anuria. Clinical signs may be less reliable in the elderly.'
              },
              {
                title: 'Signs of Fluid Overload',
                content: 'Peripheral edema, raised JVP, pulmonary crackles, tachypnea, weight gain, reduced oxygen saturation. Overload is particularly dangerous in patients with cardiac or renal impairment.'
              }
            ]
          },
          {
            title: 'Common Electrolyte Disturbances',
            content: 'Surgical patients commonly develop electrolyte imbalances. The most important to recognize are hypo/hypernatremia and hypo/hyperkalemia, as these can cause significant morbidity if untreated.',
            subsections: [
              {
                title: 'Hyponatremia',
                content: 'Na+ <135 mmol/L. Causes: excessive IV dextrose, SIADH, diuretics, GI losses. Symptoms: confusion, seizures (if severe/rapid onset). Treatment: depends on volume status—restrict fluids if euvolemic, replace with normal saline if hypovolemic. Correct slowly to avoid osmotic demyelination.'
              },
              {
                title: 'Hypokalemia',
                content: 'K+ <3.5 mmol/L. Causes: vomiting, NG drainage, diarrhea, diuretics. Symptoms: weakness, arrhythmias, ileus. Treatment: oral replacement if mild and able to tolerate; IV KCl if severe (maximum 10mmol/hr peripheral, 20mmol/hr central with ECG monitoring).'
              },
              {
                title: 'Hyperkalemia',
                content: 'K+ >5.5 mmol/L. Causes: renal failure, tissue damage, potassium-sparing diuretics. ECG changes: tall T waves, prolonged PR, loss of P waves, wide QRS, sine wave. Treatment: cardiac protection (calcium gluconate), shift K+ intracellularly (insulin/dextrose, salbutamol), remove K+ (resonium, dialysis).'
              }
            ]
          },
          {
            title: 'Fluid Balance Monitoring',
            content: 'Accurate fluid balance is essential in surgical patients. Record: all IV input, oral intake (if applicable), urine output, NG output, drain output, estimated insensible losses (fever increases by 10-15% per °C). Review balance at least twice daily.',
            subsections: [
              {
                title: 'Third-Space Losses',
                content: 'After major surgery, fluid shifts into the interstitial space (third-spacing). This may require additional replacement in the first 24-48 hours, followed by mobilization (diuresis) as the patient recovers.'
              }
            ]
          }
        ],
        keyPoints: [
          'Daily requirements: 25-30mL/kg water, 1-2mmol/kg Na+, 1mmol/kg K+',
          'Hartmann\'s is generally preferred over normal saline for resuscitation',
          'Aim for urine output >0.5mL/kg/hr in adults',
          'IV potassium: maximum 10mmol/hr peripherally',
          'Hyperkalemia with ECG changes is an emergency—give calcium gluconate first',
          'Accurate fluid balance charting is essential'
        ],
        examTips: [
          'Know the composition of common IV fluids',
          'Understand the approach to hyponatremia based on volume status',
          'Know the ECG changes in hyperkalemia',
          'Be familiar with maximum IV potassium infusion rates'
        ],
        clinicalPearls: [
          'Check electrolytes before prescribing potassium replacement',
          'Weigh patients daily to assess fluid balance',
          'In elderly patients, less is often more—small fluid boluses with reassessment',
          'Always examine the patient rather than relying on fluid charts alone'
        ],
        commonMistakes: [
          'Using dextrose solutions for resuscitation',
          'Giving potassium too quickly or without cardiac monitoring in severe cases',
          'Not replacing ongoing losses in addition to maintenance fluids',
          'Ignoring fluid balance until problems arise'
        ],
        references: [
          'NICE: IV Fluid Therapy in Adults NG174',
          'GIFTASUP Guidelines',
          'British Consensus Guidelines on IV Fluid Therapy for Adult Surgical Patients',
          'Myburgh JA. NEJM 2012: Resuscitation Fluids'
        ],
        selfAssessment: [
          {
            id: 'ho-2-2-q1',
            question: 'The daily maintenance potassium requirement for a 70kg adult is approximately:',
            options: [
              '20 mmol',
              '40 mmol',
              '70 mmol',
              '100 mmol'
            ],
            correctAnswer: 2,
            explanation: 'Potassium requirement is approximately 1mmol/kg/day, so a 70kg adult needs about 70mmol daily.'
          },
          {
            id: 'ho-2-2-q2',
            question: 'The first treatment for hyperkalemia with ECG changes is:',
            options: [
              'Insulin and dextrose',
              'Calcium gluconate',
              'Sodium bicarbonate',
              'Calcium resonium'
            ],
            correctAnswer: 1,
            explanation: 'Calcium gluconate provides cardiac membrane stabilization and is the first treatment to protect against arrhythmias. It doesn\'t lower potassium but buys time for other treatments.'
          }
        ]
      }
    },
    {
      id: 'ho-2-3',
      moduleId: 'ho-module-2',
      title: 'Postoperative Care: Analgesia, Mobilization, and VTE Prophylaxis',
      article: {
        title: 'Postoperative Care: Analgesia, Mobilization, and VTE Prophylaxis',
        overview: 'Postoperative care aims to ensure patient comfort, prevent complications, and facilitate recovery. This module covers the essential elements of postoperative management that every House Officer must understand and implement.',
        learningObjectives: [
          'Apply the WHO analgesic ladder to postoperative pain management',
          'Understand multimodal analgesia and its benefits',
          'Implement early mobilization protocols',
          'Risk-stratify patients for VTE and prescribe appropriate prophylaxis',
          'Recognize and manage common postoperative complications'
        ],
        sections: [
          {
            title: 'Postoperative Analgesia',
            content: 'Effective pain management improves patient satisfaction, facilitates early mobilization, reduces complications, and may reduce chronic pain development. Use the WHO analgesic ladder as a framework: Step 1 (mild pain): non-opioids (paracetamol, NSAIDs). Step 2 (moderate): weak opioids (codeine, tramadol) + non-opioids. Step 3 (severe): strong opioids (morphine, fentanyl) + non-opioids.',
            subsections: [
              {
                title: 'Multimodal Analgesia',
                content: 'Combining analgesics with different mechanisms provides better pain control with fewer side effects. A typical regimen: regular paracetamol 1g QDS, regular NSAID (if not contraindicated), opioid as needed. Consider regional anesthesia or nerve blocks where appropriate.'
              },
              {
                title: 'Opioid Side Effects',
                content: 'Monitor for: respiratory depression (especially in opioid-naive, elderly, or those with sleep apnea), nausea and vomiting, constipation (prescribe laxatives prophylactically), urinary retention, pruritus, and sedation.'
              }
            ]
          },
          {
            title: 'NSAIDs: Risks and Contraindications',
            content: 'NSAIDs are excellent analgesics but have significant risks. Contraindications: active peptic ulcer disease, renal impairment (avoid if eGFR <30), severe heart failure, perioperative CABG surgery, aspirin-exacerbated respiratory disease. Caution in: elderly, hypertension, concurrent anticoagulation.',
            subsections: [
              {
                title: 'Renal Risks',
                content: 'NSAIDs reduce renal prostaglandins, decreasing renal blood flow. In combination with hypovolemia and ACE-i/ARBs (the "triple whammy"), they can cause acute kidney injury. Monitor renal function and avoid in dehydrated patients.'
              }
            ]
          },
          {
            title: 'Early Mobilization',
            content: 'Early mobilization reduces respiratory complications, VTE risk, muscle deconditioning, and length of stay. Goals: sit out of bed Day 0-1 for most surgeries, walk with assistance by Day 1-2, increase activity progressively. Ensure adequate analgesia to facilitate mobility.',
            subsections: [
              {
                title: 'Enhanced Recovery After Surgery (ERAS)',
                content: 'ERAS protocols combine early feeding, early mobilization, and optimized analgesia to accelerate recovery. Components include: no routine nasogastric tubes, early oral fluids, multimodal analgesia (minimizing opioids), and mobilization targets.'
              }
            ]
          },
          {
            title: 'VTE Prophylaxis',
            content: 'Surgical patients are at high risk for venous thromboembolism (DVT/PE). Risk stratify using tools like Caprini score. Low risk: early mobilization, hydration. Moderate-high risk: pharmacological prophylaxis (LMWH or UFH) plus mechanical prophylaxis (TEDs, SCDs). Duration: typically until fully mobile, extended (28 days) for major cancer surgery.',
            subsections: [
              {
                title: 'Pharmacological Prophylaxis',
                content: 'LMWH (e.g., enoxaparin 40mg daily) is preferred. Start 6-12 hours postoperatively (check local protocols). Adjust dose for renal impairment. Contraindications: active bleeding, severe thrombocytopenia, recent intracranial hemorrhage.'
              },
              {
                title: 'Mechanical Prophylaxis',
                content: 'TED stockings and sequential compression devices reduce VTE risk independently of pharmacological measures. Use when anticoagulation is contraindicated. Contraindicated in peripheral arterial disease and acute DVT.'
              }
            ]
          },
          {
            title: 'Common Postoperative Complications',
            content: 'Fever: day 1-2 often inflammatory (wind/atelectasis), day 3-5 consider infection (wound/water/walking/wonder drugs). Urinary retention: common post-pelvic surgery or with opioids. Ileus: reduced bowel sounds, distension—often resolves with time and mobilization. Wound complications: check for bleeding, hematoma, or early infection.',
            subsections: [
              {
                title: '5 Ws of Postoperative Fever',
                content: 'Wind (atelectasis) - days 1-2. Water (UTI) - days 3-5. Wound (surgical site infection) - days 5-7. Walking (DVT/PE) - days 7-10. Wonder drugs (drug fever, transfusion reaction) - any time.'
              }
            ]
          }
        ],
        keyPoints: [
          'Multimodal analgesia provides better pain control with fewer side effects',
          'Avoid NSAIDs in renal impairment, GI bleeding risk, and heart failure',
          'Early mobilization reduces complications and hospital stay',
          'Risk-stratify all surgical patients for VTE prophylaxis',
          'LMWH is the preferred pharmacological VTE prophylaxis',
          'Know the 5 Ws of postoperative fever'
        ],
        examTips: [
          'Know the WHO analgesic ladder steps',
          'Understand NSAID contraindications',
          'Be familiar with VTE prophylaxis duration recommendations',
          'The 5 Ws of fever is commonly examined'
        ],
        clinicalPearls: [
          'Write up analgesia prospectively—don\'t let patients wait in pain',
          'Review opioid requirements daily and step down as appropriate',
          'Check anticoagulation timing before epidural removal',
          'Document daily VTE prophylaxis and any reasons for omission'
        ],
        commonMistakes: [
          'Inadequate analgesia preventing mobilization',
          'Giving NSAIDs to patients with renal impairment or on ACE-i',
          'Forgetting to prescribe VTE prophylaxis or discontinuing too early',
          'Not investigating persistent postoperative fever'
        ],
        references: [
          'WHO: Cancer Pain Relief—Analgesic Ladder',
          'NICE: VTE Prevention NG89',
          'ERAS Society Guidelines',
          'Faculty of Pain Medicine: Best Practice in Postoperative Pain Management'
        ],
        selfAssessment: [
          {
            id: 'ho-2-3-q1',
            question: 'A postoperative patient develops fever on day 5. The MOST likely cause is:',
            options: [
              'Atelectasis',
              'Surgical site infection',
              'Deep vein thrombosis',
              'Drug reaction'
            ],
            correctAnswer: 1,
            explanation: 'According to the 5 Ws, day 5 fever is most likely from Wound (surgical site infection). Wind/atelectasis is typically days 1-2, DVT/PE days 7-10.'
          },
          {
            id: 'ho-2-3-q2',
            question: 'Which is a contraindication to NSAID use postoperatively?',
            options: [
              'Mild postoperative pain',
              'eGFR of 25 mL/min',
              'Day 1 after laparoscopic cholecystectomy',
              'History of well-controlled hypertension'
            ],
            correctAnswer: 1,
            explanation: 'NSAIDs should be avoided when eGFR <30 mL/min due to the risk of acute kidney injury from reduction in renal prostaglandins.'
          }
        ]
      }
    }
  ]
};

// Add Module 2 to the array
HOUSE_OFFICER_MODULES.push(HO_MODULE_2);

// ==================== HOUSE OFFICER MODULE 3 ====================
const HO_MODULE_3: CMEModule = {
  id: 'ho-module-3',
  title: 'Module 3: Wounds and Wound Healing',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-3-1',
      moduleId: 'ho-module-3',
      title: 'Wound Classification and Assessment',
      article: {
        title: 'Wound Classification and Assessment',
        overview: 'Accurate wound assessment is fundamental to appropriate management. This module covers wound classification systems, systematic assessment techniques, and documentation standards that guide treatment decisions.',
        learningObjectives: [
          'Classify wounds by etiology, depth, and contamination level',
          'Perform systematic wound assessment',
          'Document wound characteristics accurately',
          'Identify factors affecting wound healing',
          'Recognize wounds requiring specialist referral'
        ],
        sections: [
          {
            title: 'Classification by Etiology',
            content: 'Wounds are classified by their cause: Traumatic (cuts, abrasions, avulsions, crush injuries), Surgical (incisions, excisions), Burn (thermal, chemical, electrical, radiation), Pressure injuries (prolonged immobility), Vascular (arterial, venous, mixed), Diabetic/Neuropathic, and Malignant (tumor ulceration).',
            subsections: [
              {
                title: 'Acute vs. Chronic Wounds',
                content: 'Acute wounds progress through healing phases normally and close within expected timeframes. Chronic wounds fail to heal within 4-6 weeks despite appropriate treatment, indicating underlying pathology that must be addressed.'
              }
            ]
          },
          {
            title: 'Wound Depth Classification',
            content: 'Superficial: epidermis only (abrasions, superficial burns). Partial thickness: epidermis and dermis (blisters, deeper abrasions). Full thickness: through dermis into subcutaneous tissue. Involving deep structures: fascia, muscle, tendon, bone, or viscera.',
            subsections: [
              {
                title: 'Tissue Layers',
                content: 'Understanding tissue layers aids assessment: Epidermis (stratified squamous epithelium), Dermis (collagen, elastin, vessels, nerves, appendages), Subcutaneous fat, Fascia, Muscle, and Bone. Each layer has different healing capacity.'
              }
            ]
          },
          {
            title: 'Surgical Wound Classification',
            content: 'Clean (Class I): uninfected, no inflammation, respiratory/GI/GU tract not entered. Clean-contaminated (Class II): respiratory/GI/GU entered under controlled conditions. Contaminated (Class III): open trauma, gross spillage, major break in sterile technique. Dirty/Infected (Class IV): old trauma with dead tissue, existing infection.',
            subsections: [
              {
                title: 'Infection Risk by Class',
                content: 'Clean: 1-2% SSI rate. Clean-contaminated: 3-11%. Contaminated: 10-17%. Dirty: >27%. Classification guides antibiotic prophylaxis decisions and closure timing.'
              }
            ]
          },
          {
            title: 'Systematic Wound Assessment',
            content: 'Document: Location, Size (length × width × depth in cm), Shape, Wound bed (granulation, slough, necrosis, eschar), Wound edges (undermining, rolled, epithelializing), Exudate (type, amount, odor), Surrounding skin (erythema, induration, maceration), Pain level, Duration, and Previous treatments.',
            subsections: [
              {
                title: 'Wound Bed Tissue Types',
                content: 'Granulation tissue: healthy, red, granular, bleeds easily. Slough: yellow/white, stringy or adherent, non-viable. Necrosis: black/brown, dry (eschar) or moist. Epithelializing tissue: pink/white, thin, fragile new skin from wound edges.'
              },
              {
                title: 'Signs of Infection',
                content: 'Classic signs: increased pain, erythema, warmth, swelling, purulent discharge. Chronic wound signs: delayed healing, friable granulation, wound breakdown, increased exudate, malodor, discoloration.'
              }
            ]
          },
          {
            title: 'Factors Affecting Wound Healing',
            content: 'Local factors: infection, foreign bodies, ischemia, radiation damage, repeated trauma. Systemic factors: age, nutrition (protein, vitamin C, zinc), diabetes, vascular disease, immunosuppression, steroids, smoking, obesity. Identify and optimize modifiable factors.',
            subsections: [
              {
                title: 'Nutrition and Healing',
                content: 'Protein (1.25-1.5g/kg/day), Vitamin C (collagen synthesis), Zinc (cell proliferation), Vitamin A (epithelialization). Consider supplementation in malnourished patients or non-healing wounds.'
              }
            ]
          }
        ],
        keyPoints: [
          'Chronic wounds fail to heal within 4-6 weeks despite appropriate treatment',
          'Surgical wound classes: Clean, Clean-contaminated, Contaminated, Dirty',
          'Document wound size in three dimensions (L × W × D)',
          'Identify local and systemic factors affecting healing',
          'Red granulation tissue indicates healthy healing; slough/necrosis requires debridement'
        ],
        examTips: [
          'Know the surgical wound classification and infection rates',
          'Understand the difference between acute and chronic wounds',
          'Be able to describe wound bed tissue types',
          'Know nutritional requirements for wound healing'
        ],
        clinicalPearls: [
          'Photograph wounds with a ruler for objective measurement over time',
          'Always probe wounds to assess for undermining and sinuses',
          'Consider underlying osteomyelitis in chronic wounds over bony prominences',
          'Malodorous wounds are not always infected—necrotic tissue also smells'
        ],
        commonMistakes: [
          'Failing to measure wound depth and undermining',
          'Not addressing underlying factors (diabetes, vascular disease)',
          'Confusing slough with infection',
          'Inadequate documentation preventing assessment of progress'
        ],
        references: [
          'NICE: Surgical Site Infections: Prevention and Treatment NG125',
          'EWMA: Wound Bed Preparation Guidelines',
          'CDC: Surgical Wound Classification',
          'International Wound Infection Institute: Wound Infection in Clinical Practice'
        ],
        selfAssessment: [
          {
            id: 'ho-3-1-q1',
            question: 'A Class II (Clean-contaminated) surgical wound is characterized by:',
            options: [
              'Existing infection at the surgical site',
              'Entry into respiratory, GI, or GU tract under controlled conditions',
              'Fresh traumatic wound from a clean source',
              'Uninfected wound with no inflammation'
            ],
            correctAnswer: 1,
            explanation: 'Clean-contaminated (Class II) wounds involve controlled entry into the respiratory, gastrointestinal, or genitourinary tract without unusual contamination.'
          },
          {
            id: 'ho-3-1-q2',
            question: 'Yellow, stringy tissue in a wound bed is most likely:',
            options: [
              'Healthy granulation tissue',
              'Slough (non-viable tissue)',
              'Epithelializing tissue',
              'Subcutaneous fat'
            ],
            correctAnswer: 1,
            explanation: 'Slough is yellow or white, stringy or adherent non-viable tissue that should be debrided to promote healing.'
          }
        ]
      }
    },
    {
      id: 'ho-3-2',
      moduleId: 'ho-module-3',
      title: 'Phases of Wound Healing',
      article: {
        title: 'Phases of Wound Healing',
        overview: 'Wound healing is a complex, overlapping process involving multiple cell types, growth factors, and matrix components. Understanding these phases helps predict healing trajectory and identify pathological delays.',
        learningObjectives: [
          'Describe the four phases of wound healing',
          'Identify key cellular and molecular events in each phase',
          'Differentiate between primary, secondary, and tertiary intention healing',
          'Recognize factors that impair each healing phase',
          'Apply knowledge to predict healing timelines'
        ],
        sections: [
          {
            title: 'Hemostasis Phase (Immediate)',
            content: 'Begins immediately upon injury. Vasoconstriction occurs within seconds, followed by platelet aggregation and clot formation. The fibrin clot serves as a scaffold for cell migration and releases growth factors (PDGF, TGF-β) that initiate the healing cascade.',
            subsections: [
              {
                title: 'The Coagulation Cascade',
                content: 'Intrinsic and extrinsic pathways converge on the common pathway, generating thrombin and ultimately fibrin. Platelets degranulate, releasing cytokines that recruit inflammatory cells.'
              }
            ]
          },
          {
            title: 'Inflammatory Phase (Days 1-4)',
            content: 'Characterized by vasodilation, increased permeability, and cellular infiltration. Neutrophils arrive first (24-48 hours), clearing bacteria and debris. Macrophages follow (48-72 hours), continuing phagocytosis and secreting growth factors essential for the next phase.',
            subsections: [
              {
                title: 'Role of Macrophages',
                content: 'Macrophages are "master regulators" of healing. They transition from inflammatory (M1) to reparative (M2) phenotypes, releasing VEGF, FGF, and TGF-β. Macrophage depletion severely impairs healing.'
              },
              {
                title: 'Cardinal Signs of Inflammation',
                content: 'Rubor (redness), Calor (heat), Tumor (swelling), Dolor (pain), and Functio laesa (loss of function). These are normal in early healing but should resolve; persistence suggests infection or chronic inflammation.'
              }
            ]
          },
          {
            title: 'Proliferative Phase (Days 4-21)',
            content: 'The constructive phase involving granulation tissue formation, angiogenesis, and epithelialization. Fibroblasts migrate into the wound, synthesizing collagen and extracellular matrix. New blood vessels (angiogenesis) supply oxygen and nutrients. Epithelial cells migrate from wound edges to resurface the wound.',
            subsections: [
              {
                title: 'Granulation Tissue',
                content: 'Named for its granular appearance, composed of new capillaries, fibroblasts, and inflammatory cells in a collagen matrix. Healthy granulation is red, moist, and bleeds easily. Pale, dusky, or friable granulation suggests problems.'
              },
              {
                title: 'Wound Contraction',
                content: 'Myofibroblasts (specialized fibroblasts with actin) contract the wound, reducing its size by up to 40-80%. Important in secondary intention healing but can cause contractures across joints.'
              }
            ]
          },
          {
            title: 'Remodeling Phase (Day 21 - 1+ year)',
            content: 'Collagen is reorganized from type III to type I, increasing tensile strength. Wound strength reaches 80% of original tissue by 3 months but never achieves 100%. Excess matrix is degraded by matrix metalloproteinases (MMPs). Scar maturation continues for 12-18 months.',
            subsections: [
              {
                title: 'Scar Maturation',
                content: 'Scars initially appear red, raised, and firm. Over 12-18 months, they flatten, soften, and pale. Abnormal scarring (hypertrophic or keloid) results from excessive collagen deposition.'
              }
            ]
          },
          {
            title: 'Types of Wound Healing',
            content: 'Primary intention: wound edges approximated (surgical incision, sutured laceration). Fast healing, minimal scarring. Secondary intention: wound left open to heal by granulation and contraction. Used for contaminated wounds, tissue loss. Tertiary intention (delayed primary closure): wound initially left open, then closed after a few days once clean.',
            subsections: [
              {
                title: 'When to Use Each Type',
                content: 'Primary: clean wounds within 6-8 hours, minimal tissue loss. Secondary: infected wounds, tissue defects, bite wounds (except face). Tertiary: contaminated wounds that become clean, wounds with high infection risk that need initial debridement.'
              }
            ]
          }
        ],
        keyPoints: [
          'Four phases: Hemostasis, Inflammation, Proliferation, Remodeling',
          'Macrophages are master regulators, essential for healing',
          'Granulation tissue should be red, moist, and bleed easily',
          'Wound strength reaches only 80% of original at 3 months',
          'Primary intention: approximated edges; Secondary: open healing; Tertiary: delayed closure'
        ],
        examTips: [
          'Know the timeline of each healing phase',
          'Understand the role of different cell types (neutrophils, macrophages, fibroblasts)',
          'Differentiate primary, secondary, and tertiary intention',
          'Know when wounds achieve maximum tensile strength'
        ],
        clinicalPearls: [
          'Prolonged inflammation (>7 days) suggests infection or foreign body',
          'Diabetic wounds often stall in the inflammatory phase',
          'Moisture is essential for epithelialization—avoid desiccation',
          'Sutures can be removed earlier in well-vascularized areas (face: 5 days)'
        ],
        commonMistakes: [
          'Expecting wounds to reach full strength after suture removal',
          'Confusing normal inflammatory signs with infection',
          'Closing contaminated wounds primarily',
          'Not accounting for remodeling phase when counseling patients about scar appearance'
        ],
        references: [
          'Gurtner GC. Wound Healing: Normal and Abnormal. Grabb & Smith\'s Plastic Surgery',
          'Singer AJ, Clark RA. NEJM 1999: Cutaneous Wound Healing',
          'Werner S, Grose R. Physiol Rev 2003: Regulation of Wound Healing',
          'Eming SA. Science Translational Medicine 2014: Wound Repair and Regeneration'
        ],
        selfAssessment: [
          {
            id: 'ho-3-2-q1',
            question: 'The predominant cell type in the wound at 48-72 hours is:',
            options: [
              'Neutrophils',
              'Macrophages',
              'Fibroblasts',
              'Epithelial cells'
            ],
            correctAnswer: 1,
            explanation: 'Macrophages become predominant at 48-72 hours, taking over from neutrophils. They are essential for transitioning from inflammation to proliferation.'
          },
          {
            id: 'ho-3-2-q2',
            question: 'Wound tensile strength at 3 months is approximately what percentage of unwounded tissue?',
            options: [
              '50%',
              '70%',
              '80%',
              '100%'
            ],
            correctAnswer: 2,
            explanation: 'Healed wounds achieve approximately 80% of original tissue strength by 3 months and never reach 100%, which is why repeat dehiscence at the same site is possible.'
          }
        ]
      }
    },
    {
      id: 'ho-3-3',
      moduleId: 'ho-module-3',
      title: 'Wound Closure Techniques',
      article: {
        title: 'Wound Closure Techniques',
        overview: 'Choosing the appropriate wound closure method is crucial for optimal healing. This module covers suturing techniques, alternative closure methods, and the principles guiding closure decisions.',
        learningObjectives: [
          'Select appropriate closure materials for different wounds',
          'Demonstrate basic suturing techniques',
          'Apply principles of tension-free closure',
          'Know when to use alternatives to sutures',
          'Understand timing of suture removal'
        ],
        sections: [
          {
            title: 'Principles of Wound Closure',
            content: 'Goals: approximate wound edges without tension, evert edges slightly for optimal healing, maintain vascularity, minimize dead space, and obliterate potential infection pockets. Respect tissue planes—close deep layers separately before skin.',
            subsections: [
              {
                title: 'Tension-Free Closure',
                content: 'Excessive tension causes ischemia, necrosis, and wound dehiscence. If primary closure is not possible without tension, consider undermining, relaxing incisions, skin grafts, or flaps.'
              }
            ]
          },
          {
            title: 'Suture Materials',
            content: 'Absorbable: Vicryl (polyglactin, 60-90 day absorption), Monocryl (poliglecaprone, 90-120 days), PDS (polydioxanone, 180+ days), Plain/Chromic gut (variable). Non-absorbable: Nylon (Ethilon), Prolene (polypropylene), Silk. Choice depends on tissue, required support duration, and location.',
            subsections: [
              {
                title: 'Monofilament vs. Braided',
                content: 'Monofilament (nylon, prolene, PDS): less tissue drag, lower infection risk. Braided (vicryl, silk): better knot security but can harbor bacteria. Use monofilament in contaminated wounds.'
              },
              {
                title: 'Suture Sizing',
                content: 'Larger numbers = finer sutures. Face: 5-0 or 6-0. Trunk/limbs: 3-0 or 4-0. Fascia: 0 or 1. Tendons: 3-0 or 4-0 braided (e.g., Ethibond). Match suture strength to tissue strength.'
              }
            ]
          },
          {
            title: 'Suturing Techniques',
            content: 'Simple interrupted: individual sutures, most versatile. Continuous/running: faster, distributes tension, but if one fails all may unravel. Mattress sutures (vertical/horizontal): evert edges, reduce dead space. Subcuticular: buried running suture for cosmesis.',
            subsections: [
              {
                title: 'Simple Interrupted Technique',
                content: 'Enter perpendicular to skin, pass through dermis, exit equidistant from wound edge on opposite side. Width:depth should equal distance from wound edge. Tie to approximate edges without strangulating tissue.'
              },
              {
                title: 'Deep Dermal Sutures',
                content: 'Buried absorbable sutures reduce skin tension and dead space. The knot is placed deep (inverted) to prevent extrusion. Essential for wounds under tension or in cosmetically sensitive areas.'
              }
            ]
          },
          {
            title: 'Alternative Closure Methods',
            content: 'Staples: fast, good for scalp and linear trunk wounds, equivalent infection rates to sutures. Skin adhesive (2-octyl cyanoacrylate): superficial lacerations, no suture removal needed, waterproof. Steri-strips: superficial wounds, use as adjunct after suture removal.',
            subsections: [
              {
                title: 'Staples',
                content: 'Advantages: speed, less tissue reaction, cost-effective. Disadvantages: poor cosmesis (not for face), more painful removal. Remove at same intervals as equivalent sutures.'
              }
            ]
          },
          {
            title: 'Suture Removal Timing',
            content: 'Face: 5-7 days (good blood supply, cosmesis important). Scalp: 7-10 days. Trunk/upper limbs: 10-14 days. Lower limbs: 14-21 days (poor vascularity). Joints: longer (movement stress). Earlier removal risks dehiscence; later removal increases scarring.',
            subsections: [
              {
                title: 'After Suture Removal',
                content: 'Apply steri-strips perpendicular to wound for 1-2 weeks to support the wound during continued remodeling. Advise sun protection for 6-12 months to prevent hyperpigmentation.'
              }
            ]
          }
        ],
        keyPoints: [
          'Tension-free closure is essential—consider alternatives if tension is excessive',
          'Match suture material and size to tissue and wound requirements',
          'Deep dermal sutures reduce skin tension and improve cosmesis',
          'Staples are appropriate for scalp and trunk, not face',
          'Suture removal timing varies by location: face 5-7 days, lower limb up to 21 days'
        ],
        examTips: [
          'Know absorbable vs. non-absorbable suture materials',
          'Understand when to use different suture techniques',
          'Be familiar with suture removal timing by body region',
          'Know alternatives to sutures and their indications'
        ],
        clinicalPearls: [
          'Use the finest suture that will hold the tissue',
          'Evert wound edges slightly—they will flatten with healing',
          'Always close in layers for deep wounds',
          'Remove every other suture first; if wound looks good, remove the rest'
        ],
        commonMistakes: [
          'Sutures too tight—causes ischemia and railroad track scarring',
          'Sutures too far apart—leads to gapping and poor cosmesis',
          'Forgetting deep sutures—increases skin tension and dead space',
          'Leaving sutures too long—increases scarring and suture marks'
        ],
        references: [
          'Forsch RT. Am Fam Physician 2008: Essentials of Skin Laceration Repair',
          'Moy RL. J Am Acad Dermatol 1991: A Review of Sutures and Suturing Techniques',
          'Singer AJ. Ann Emerg Med 2008: Closure of Lacerations and Incisions',
          'Trott AT. Wounds and Lacerations: Emergency Care and Closure'
        ],
        selfAssessment: [
          {
            id: 'ho-3-3-q1',
            question: 'The appropriate time for suture removal from a facial laceration is:',
            options: [
              '3-4 days',
              '5-7 days',
              '10-14 days',
              '14-21 days'
            ],
            correctAnswer: 1,
            explanation: 'Facial sutures should be removed at 5-7 days due to excellent blood supply and to minimize suture marks in this cosmetically important area.'
          },
          {
            id: 'ho-3-3-q2',
            question: 'Which suture material is most appropriate for a contaminated wound?',
            options: [
              'Silk (braided, non-absorbable)',
              'Vicryl (braided, absorbable)',
              'Nylon (monofilament, non-absorbable)',
              'Chromic gut (absorbable)'
            ],
            correctAnswer: 2,
            explanation: 'Monofilament sutures like nylon are preferred in contaminated wounds as they have lower infection risk compared to braided sutures which can harbor bacteria.'
          }
        ]
      }
    },
    {
      id: 'ho-3-4',
      moduleId: 'ho-module-3',
      title: 'Dressings and Wound Care Products',
      article: {
        title: 'Dressings and Wound Care Products',
        overview: 'Modern wound care embraces the principle of moist wound healing. Selecting the appropriate dressing based on wound characteristics optimizes the healing environment and reduces complications.',
        learningObjectives: [
          'Understand the principles of moist wound healing',
          'Match dressing type to wound characteristics',
          'Apply commonly used wound care products appropriately',
          'Know when to change dressings',
          'Recognize when specialist wound care is needed'
        ],
        sections: [
          {
            title: 'Principles of Moist Wound Healing',
            content: 'Winter (1962) demonstrated that wounds heal faster in a moist environment. Benefits include: faster epithelialization, reduced pain, autolytic debridement, fewer dressing changes, and better cosmesis. The goal is moisture balance—neither too wet nor too dry.',
            subsections: [
              {
                title: 'Wound Bed Preparation',
                content: 'The TIME framework: Tissue (debride non-viable), Infection/Inflammation (manage bioburden), Moisture balance (optimize), Edge (assess for non-advancing epithelium). Address each element before selecting dressings.'
              }
            ]
          },
          {
            title: 'Dressing Categories',
            content: 'Primary dressings contact the wound directly. Secondary dressings provide absorption, protection, or fixation over the primary. Some dressings serve both functions. Match absorbency to exudate level and maintain optimal moisture.',
            subsections: [
              {
                title: 'Low-Exudate Wounds',
                content: 'Hydrogels (donate moisture), thin hydrocolloids, films (retain moisture). Suitable for dry wounds, necrotic tissue (autolytic debridement), or epithelializing wounds.'
              },
              {
                title: 'High-Exudate Wounds',
                content: 'Alginates, hydrofibers, foams, superabsorbent dressings. Alginates and hydrofibers form a gel that traps exudate. Change when strikethrough occurs.'
              }
            ]
          },
          {
            title: 'Common Dressing Types',
            content: 'Films (Opsite, Tegaderm): transparent, waterproof, low exudate. Hydrocolloids (Duoderm): form gel, autolytic debridement, moderate exudate. Foams (Allevyn, Mepilex): absorbent, cushioning, moderate-high exudate. Alginates (Kaltostat): high absorbency, hemostatic. Hydrogels (Intrasite): donate moisture, rehydrate eschar.',
            subsections: [
              {
                title: 'Antimicrobial Dressings',
                content: 'Silver dressings (Acticoat, Aquacel Ag): broad spectrum, for infected or at-risk wounds. Iodine dressings (Iodoflex, Inadine): antimicrobial, debriding. Honey (Medihoney): antimicrobial, deodorizing, promotes healing. Use when infection suspected or high risk.'
              },
              {
                title: 'Negative Pressure Wound Therapy (NPWT)',
                content: 'Applies controlled suction to promote granulation, remove exudate, and reduce edema. Indications: large wounds, skin grafts, wounds with high exudate. Contraindicated in malignancy, untreated osteomyelitis, exposed vessels.'
              }
            ]
          },
          {
            title: 'Selecting the Right Dressing',
            content: 'Assessment: What is the wound bed (necrotic, sloughy, granulating, epithelializing)? What is the exudate level (none, low, moderate, high)? Is infection present or likely? What is the wound location? What are patient factors (allergies, mobility, concordance)?',
            subsections: [
              {
                title: 'Dressing Selection Guide',
                content: 'Necrotic/eschar: hydrogel + film (if dry), sharp debridement if necessary. Sloughy: hydrofiber/alginate, autolytic debridement. Granulating: foam, hydrocolloid. Epithelializing: hydrocolloid, film (protect fragile epithelium). Infected: antimicrobial dressing.'
              }
            ]
          },
          {
            title: 'Dressing Change Frequency',
            content: 'Depends on exudate level, dressing type, and wound stage. Clean surgical wounds: 48-72 hours initially, then as needed. Heavily exuding: daily or when strikethrough. Non-infected granulating: every 2-3 days. Infected: daily assessment. Avoid unnecessary changes—each is an opportunity for contamination and disrupts healing.'
          }
        ],
        keyPoints: [
          'Moist wound healing is faster than dry healing',
          'Use TIME framework: Tissue, Infection, Moisture, Edge',
          'Match dressing absorbency to exudate level',
          'Silver dressings for infected or high-risk wounds',
          'NPWT for complex wounds with high exudate or to prepare for grafting',
          'Avoid unnecessary dressing changes'
        ],
        examTips: [
          'Know the main dressing categories and their indications',
          'Understand the principle of moist wound healing',
          'Be familiar with antimicrobial dressing options',
          'Know contraindications to NPWT'
        ],
        clinicalPearls: [
          'If a dressing is working (wound improving), don\'t change the type',
          'Peri-wound skin protection is as important as wound care',
          'Consider patient comfort and lifestyle when selecting dressings',
          'Silicone-based dressings reduce pain at dressing changes'
        ],
        commonMistakes: [
          'Using gauze on granulating wounds (disrupts healing)',
          'Allowing wounds to dry out or become macerated',
          'Changing dressings too frequently',
          'Not addressing underlying factors (offloading, compression)'
        ],
        references: [
          'Winter GD. Nature 1962: Formation of the Scab and Rate of Epithelialization',
          'EWMA: Position Document on Wound Bed Preparation',
          'NICE: Wound Care Products',
          'World Union of Wound Healing Societies: Wound Dressing Selection'
        ],
        selfAssessment: [
          {
            id: 'ho-3-4-q1',
            question: 'For a wound with heavy exudate, the most appropriate primary dressing is:',
            options: [
              'Hydrogel',
              'Film dressing',
              'Alginate or hydrofiber',
              'Thin hydrocolloid'
            ],
            correctAnswer: 2,
            explanation: 'Alginates and hydrofibers are highly absorbent and form a gel that traps exudate, making them ideal for heavily exuding wounds.'
          },
          {
            id: 'ho-3-4-q2',
            question: 'Which dressing donates moisture to a dry wound?',
            options: [
              'Foam dressing',
              'Alginate',
              'Hydrogel',
              'Gauze'
            ],
            correctAnswer: 2,
            explanation: 'Hydrogels have high water content and donate moisture to dry wounds, aiding autolytic debridement of eschar and rehydrating the wound bed.'
          }
        ]
      }
    }
  ]
};

HOUSE_OFFICER_MODULES.push(HO_MODULE_3);

// ==================== HOUSE OFFICER MODULE 4 ====================
const HO_MODULE_4: CMEModule = {
  id: 'ho-module-4',
  title: 'Module 4: Trauma and Emergency Care',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-4-1',
      moduleId: 'ho-module-4',
      title: 'Primary and Secondary Survey in Trauma',
      article: {
        title: 'Primary and Secondary Survey in Trauma',
        overview: 'The Advanced Trauma Life Support (ATLS) approach provides a systematic framework for assessing and managing trauma patients. The primary survey identifies and treats life-threatening conditions, while the secondary survey provides a comprehensive head-to-toe examination.',
        learningObjectives: [
          'Perform the ABCDE primary survey systematically',
          'Recognize and initiate treatment for life-threatening conditions',
          'Conduct a thorough secondary survey',
          'Understand the importance of reassessment',
          'Know when to call for specialist help'
        ],
        sections: [
          {
            title: 'Primary Survey: ABCDE',
            content: 'The primary survey identifies and treats life-threats in order of priority. A: Airway with cervical spine protection. B: Breathing and ventilation. C: Circulation with hemorrhage control. D: Disability (neurological status). E: Exposure and Environment. Treat problems as you find them before moving on.',
            subsections: [
              {
                title: 'Airway and C-Spine',
                content: 'Assume cervical spine injury in all trauma until cleared. Maintain in-line stabilization. Look for obstruction: blood, vomit, foreign body, swelling. Simple maneuvers: chin lift, jaw thrust (safer than head tilt). Definitive airway if needed.'
              },
              {
                title: 'Breathing',
                content: 'Expose chest. Look: respiratory rate, symmetry, wounds. Listen: bilateral air entry, added sounds. Feel: tracheal deviation, crepitus, flail segments. Life-threats: tension pneumothorax, open pneumothorax, flail chest, massive hemothorax. Needle decompression for tension pneumothorax before imaging.'
              },
              {
                title: 'Circulation',
                content: 'Control external hemorrhage with direct pressure. Assess: pulse (rate, quality), skin (color, temperature, cap refill), blood pressure. Two large-bore IV cannulas (14-16G). Initiate fluid resuscitation. Identify occult bleeding: chest, abdomen, pelvis, long bones, "on the floor."'
              },
              {
                title: 'Disability',
                content: 'AVPU: Alert, Voice responsive, Pain responsive, Unresponsive. Check pupils: size, symmetry, reactivity. GCS (if time permits). Lateralizing signs suggest intracranial lesion. Blood glucose (hypoglycemia mimics head injury).'
              },
              {
                title: 'Exposure',
                content: 'Fully expose the patient to identify all injuries. Log roll with cervical spine control to examine back. Prevent hypothermia: warm blankets, warmed fluids, warm environment. Hypothermia worsens coagulopathy and acidosis.'
              }
            ]
          },
          {
            title: 'Adjuncts to Primary Survey',
            content: 'Monitoring: ECG, pulse oximetry, blood pressure. Urinary catheter (unless contraindicated—blood at meatus, scrotal hematoma, high-riding prostate). Gastric tube (orogastric if facial fractures). X-rays: chest, pelvis, lateral c-spine (or CT if available). FAST ultrasound for abdominal free fluid.',
            subsections: [
              {
                title: 'FAST Examination',
                content: 'Focused Assessment with Sonography in Trauma. Four views: perihepatic, perisplenic, pelvis, pericardium. Detects free fluid (blood) but not solid organ injury. Positive FAST in unstable patient → theatre. Extended FAST (eFAST) includes lungs for pneumothorax.'
              }
            ]
          },
          {
            title: 'Secondary Survey',
            content: 'Only after primary survey complete and resuscitation underway. Complete head-to-toe examination: head (scalp, eyes, ears, nose, mouth), neck, chest, abdomen, pelvis, perineum, musculoskeletal, neurological. Take history: AMPLE (Allergies, Medications, Past medical history, Last meal, Events leading to injury).',
            subsections: [
              {
                title: 'AMPLE History',
                content: 'Allergies: drugs, latex. Medications: anticoagulants, antiplatelets, insulin, steroids. Past medical history: comorbidities affecting treatment. Last meal: aspiration risk, timing for surgery. Events: mechanism of injury, intrusion, speed, restraints, ejection.'
              },
              {
                title: 'Mechanism of Injury',
                content: 'High-energy mechanisms increase injury severity. RTAs: speed, ejection, rollover, death of other occupant, entrapment. Falls: height, surface. Assault: weapon type. Predict injury patterns based on mechanism.'
              }
            ]
          },
          {
            title: 'Reassessment',
            content: 'Trauma is dynamic. Continuously reassess ABCDEs. Vital signs should improve with resuscitation; if not, look for missed injuries or ongoing bleeding. Response to fluids guides intervention: responders may need surgery; transient responders likely need surgery; non-responders need immediate surgery.'
          }
        ],
        keyPoints: [
          'Primary survey: ABCDE—treat life-threats as you find them',
          'Assume c-spine injury until cleared',
          'Control hemorrhage with direct pressure',
          'Look for occult bleeding: chest, abdomen, pelvis, long bones, floor',
          'Secondary survey: head-to-toe after resuscitation started',
          'Continuously reassess—response to treatment guides management'
        ],
        examTips: [
          'Know the ABCDE sequence and what each component assesses',
          'Understand life-threatening chest injuries (tension pneumothorax)',
          'FAST examination views and interpretation',
          'AMPLE history components'
        ],
        clinicalPearls: [
          'Tension pneumothorax is a clinical diagnosis—don\'t wait for X-ray',
          'Trauma triad of death: hypothermia, acidosis, coagulopathy',
          'Blood pressure may be maintained until 30% blood volume is lost',
          'Always log roll to examine the back—missed injuries are common'
        ],
        commonMistakes: [
          'Proceeding to secondary survey before stabilizing primary survey',
          'Forgetting to expose and examine the back',
          'Not controlling obvious hemorrhage early',
          'Assuming a negative FAST means no abdominal injury'
        ],
        references: [
          'American College of Surgeons: ATLS Student Manual 10th Edition',
          'NICE: Major Trauma Assessment and Initial Management NG39',
          'Eastern Association for the Surgery of Trauma Guidelines',
          'Royal College of Surgeons: Trauma Care Guidelines'
        ],
        selfAssessment: [
          {
            id: 'ho-4-1-q1',
            question: 'In a trauma patient with suspected tension pneumothorax, the correct action is:',
            options: [
              'Wait for chest X-ray to confirm diagnosis',
              'Perform immediate needle decompression',
              'Give high-flow oxygen and observe',
              'Intubate the patient first'
            ],
            correctAnswer: 1,
            explanation: 'Tension pneumothorax is a clinical diagnosis and requires immediate needle decompression. Waiting for imaging delays life-saving treatment.'
          },
          {
            id: 'ho-4-1-q2',
            question: 'The AMPLE history includes all EXCEPT:',
            options: [
              'Allergies',
              'Medications',
              'Previous injuries',
              'Last meal'
            ],
            correctAnswer: 2,
            explanation: 'AMPLE stands for Allergies, Medications, Past medical history (not previous injuries specifically), Last meal, and Events leading to injury.'
          }
        ]
      }
    },
    {
      id: 'ho-4-2',
      moduleId: 'ho-module-4',
      title: 'Laceration Repair and Soft Tissue Injuries',
      article: {
        title: 'Laceration Repair and Soft Tissue Injuries',
        overview: 'Lacerations are among the most common injuries requiring treatment. Understanding wound assessment, appropriate repair techniques, and aftercare ensures optimal outcomes and minimizes complications.',
        learningObjectives: [
          'Assess lacerations systematically for associated injuries',
          'Determine appropriate closure timing and method',
          'Perform local anesthesia safely',
          'Apply appropriate wound closure techniques',
          'Provide appropriate aftercare instructions'
        ],
        sections: [
          {
            title: 'Laceration Assessment',
            content: 'Before repair, assess: Mechanism (sharp, blunt, crush), Time since injury, Contamination level, Depth and structures involved, Neurovascular status distal to injury, Tendon function, Foreign bodies. Document findings and tetanus status.',
            subsections: [
              {
                title: 'Golden Period',
                content: 'Traditionally, wounds should be closed within 6-8 hours, extended to 12-24 hours for clean face/scalp wounds with good blood supply. Heavily contaminated wounds, bites, and crush injuries may need delayed closure regardless of timing.'
              },
              {
                title: 'Wounds Requiring Specialist Input',
                content: 'Injuries involving: tendons, nerves, vessels, bone, joints, ducts (parotid, lacrimal). Complex facial wounds, tissue loss requiring reconstruction, heavily contaminated or infected wounds, wounds from high-pressure injection.'
              }
            ]
          },
          {
            title: 'Wound Preparation',
            content: 'Anesthesia first for painful procedures. Copious irrigation with saline or tap water (high volume, low pressure). Debride devitalized tissue conservatively. Remove foreign bodies. Meticulous hemostasis before closure. Shave hair if obscuring wound edges (never eyebrows).',
            subsections: [
              {
                title: 'Irrigation',
                content: 'High-volume, low-pressure irrigation is more effective than scrubbing. Use 100-200mL per cm wound length. Saline, tap water, and potable water have similar infection rates. High pressure (syringe with 18G needle) for contaminated wounds.'
              }
            ]
          },
          {
            title: 'Local Anesthesia',
            content: 'Lidocaine 1-2% is standard. Maximum dose: 3mg/kg plain, 7mg/kg with adrenaline. Adrenaline provides hemostasis but avoid in end-arteries (fingers, toes, nose, ears, penis—though evidence now supports careful use in fingers). Inject through wound edges, not intact skin. Use nerve blocks for extensive wounds.',
            subsections: [
              {
                title: 'Buffering Lidocaine',
                content: 'Add sodium bicarbonate (1:10 ratio) to reduce injection pain from acidity. Warm the solution to body temperature. Inject slowly. Use smallest needle possible (25G or 27G).'
              },
              {
                title: 'Digital Nerve Block',
                content: 'For finger/toe lacerations. Inject 1-2mL each side of digit base, avoiding vessels. Wait 5-10 minutes for effect. Use plain lidocaine (no adrenaline traditionally, though this is now debated).'
              }
            ]
          },
          {
            title: 'Closure Techniques',
            content: 'Choose method based on wound characteristics, location, and tension. Simple lacerations: primary closure. Contaminated/bite wounds: consider delayed closure. Tissue loss: may need specialist reconstruction. Deep wounds: layered closure.',
            subsections: [
              {
                title: 'Suturing Tips',
                content: 'Match dermal edges precisely. Slight eversion is desirable. Equal bites on each side. Avoid excessive tension. Use deep sutures to close dead space. Minimize number of sutures needed. Handle tissue gently—avoid crushing with forceps.'
              }
            ]
          },
          {
            title: 'Aftercare',
            content: 'Wound care instructions: keep clean and dry for 24-48 hours, then gentle cleaning. Watch for signs of infection (increasing pain, redness, swelling, discharge). Suture removal timing by location. Tetanus prophylaxis if needed. Antibiotics rarely needed for clean wounds; consider for contaminated wounds, bites, immunocompromised patients.',
            subsections: [
              {
                title: 'Tetanus Prophylaxis',
                content: 'Clean minor wounds: vaccine if >10 years since last dose. Tetanus-prone wounds (contaminated, puncture, devitalized tissue): vaccine if >5 years, consider tetanus immunoglobulin if unvaccinated or high-risk wound.'
              }
            ]
          }
        ],
        keyPoints: [
          'Assess for deep structure injury before closing',
          'Copious irrigation is the most important infection prevention',
          'Maximum lidocaine: 3mg/kg plain, 7mg/kg with adrenaline',
          'Bite wounds and heavily contaminated wounds may need delayed closure',
          'Tetanus prophylaxis based on wound type and vaccination history',
          'Antibiotics rarely needed for clean, properly managed wounds'
        ],
        examTips: [
          'Know local anesthetic maximum doses',
          'Understand indications for delayed primary closure',
          'Be familiar with tetanus prophylaxis guidelines',
          'Know which wounds require specialist referral'
        ],
        clinicalPearls: [
          'Test tendon function before anesthesia obscures findings',
          'Always explore wounds for foreign bodies',
          'Never close a wound under tension—it will fail',
          'Give clear written discharge instructions'
        ],
        commonMistakes: [
          'Closing dirty wounds primarily',
          'Inadequate wound irrigation',
          'Missing tendon or nerve injuries',
          'Exceeding local anesthetic maximum doses',
          'Suturing eyebrows after shaving'
        ],
        references: [
          'Singer AJ. NEJM 1997: Laceration Management',
          'Forsch RT. Am Fam Physician 2008: Skin Laceration Repair',
          'NICE: Tetanus Immunisation Guidelines',
          'Emergency Medicine Clinics: Wound Management'
        ],
        selfAssessment: [
          {
            id: 'ho-4-2-q1',
            question: 'The maximum dose of lidocaine with adrenaline for local anesthesia is:',
            options: [
              '3 mg/kg',
              '5 mg/kg',
              '7 mg/kg',
              '10 mg/kg'
            ],
            correctAnswer: 2,
            explanation: 'Lidocaine maximum dose is 3mg/kg without adrenaline and 7mg/kg with adrenaline. The adrenaline causes vasoconstriction, slowing absorption.'
          },
          {
            id: 'ho-4-2-q2',
            question: 'Which wound should NOT be closed primarily?',
            options: [
              'Clean 4-hour-old facial laceration',
              'Cat bite to the hand',
              '10-hour-old scalp laceration',
              'Surgical incision'
            ],
            correctAnswer: 1,
            explanation: 'Cat bites have high infection rates due to penetrating puncture wounds with oral flora. They should generally be left open or have delayed closure, with antibiotic prophylaxis.'
          }
        ]
      }
    },
    {
      id: 'ho-4-3',
      moduleId: 'ho-module-4',
      title: 'Fracture Recognition and Initial Management',
      article: {
        title: 'Fracture Recognition and Initial Management',
        overview: 'While definitive fracture management is typically handled by specialists, House Officers must recognize fractures, provide initial stabilization, and identify those requiring urgent intervention. This module covers fracture assessment and initial management principles.',
        learningObjectives: [
          'Recognize clinical signs of fractures',
          'Describe fractures using standard terminology',
          'Provide initial fracture management',
          'Identify fractures requiring urgent intervention',
          'Understand principles of splinting and immobilization'
        ],
        sections: [
          {
            title: 'Clinical Assessment',
            content: 'History: mechanism of injury, pain, functional impairment. Examination: look (deformity, swelling, bruising, wounds), feel (point tenderness, crepitus), move (active before passive, note range and pain). Always assess neurovascular status distal to injury.',
            subsections: [
              {
                title: 'Neurovascular Assessment',
                content: 'Pulses, capillary refill, skin color and temperature, sensation, and motor function distal to injury. Document and reassess after any intervention. Vascular compromise is an emergency requiring immediate senior input.'
              }
            ]
          },
          {
            title: 'Describing Fractures',
            content: 'Systematic description: Bone affected, Location (proximal, mid-shaft, distal, intra-articular), Pattern (transverse, oblique, spiral, comminuted), Displacement (% overlap, angulation, rotation), Open or closed. Use standardized terminology for clear communication.',
            subsections: [
              {
                title: 'Fracture Patterns',
                content: 'Transverse: perpendicular to bone axis, direct force. Oblique: angled, usually from bending force. Spiral: rotational force, common in tibia. Comminuted: >2 fragments, high energy. Segmental: two separate fractures isolating a segment.'
              },
              {
                title: 'Open (Compound) Fractures',
                content: 'Any wound communicating with fracture site, or bone visible through wound. Classify by Gustilo-Anderson: Type I (<1cm wound, minimal contamination), Type II (1-10cm wound), Type III (>10cm, high energy, vascular injury, or severe contamination). Ortho emergency.'
              }
            ]
          },
          {
            title: 'Initial Management',
            content: 'Analgesia (IV opioids for severe pain), Splint the fracture (immobilize joints above and below), Elevate to reduce swelling, Check neurovascular status before and after splinting, Cover open wounds with saline-soaked gauze, Tetanus and antibiotics for open fractures, Arrange imaging.',
            subsections: [
              {
                title: 'Splinting Principles',
                content: 'Immobilize the joint above and below the fracture. Pad bony prominences. Check neurovascular status before and after. Use available materials: plaster, fiberglass, vacuum splints, traction. Splint in position of comfort unless reduction needed.'
              }
            ]
          },
          {
            title: 'Urgent Fractures',
            content: 'Require immediate orthopaedic input: Open fractures, Fracture-dislocations, Vascular injury, Compartment syndrome (increasing pain, pain on passive stretch, tense swelling), Unstable pelvic fractures, Spinal injuries with neurology.',
            subsections: [
              {
                title: 'Compartment Syndrome',
                content: 'Increased pressure within closed fascial compartment compromises perfusion. Pain out of proportion, pain on passive stretch, paraesthesia. Pulses may be present until late. Requires emergency fasciotomy—do not delay for pressure measurement if clinical suspicion is high.'
              }
            ]
          },
          {
            title: 'Special Fractures',
            content: 'Some fractures have high morbidity and require specific awareness.',
            subsections: [
              {
                title: 'Neck of Femur',
                content: 'Common in elderly, often after simple fall. Shortened, externally rotated leg. High mortality if surgery delayed >48 hours. Intracapsular fractures risk avascular necrosis.'
              },
              {
                title: 'Supracondylar Humerus',
                content: 'Common pediatric fracture. Risk to brachial artery and median nerve. Assess carefully for vascular compromise (absent pulse, pale, cold hand).'
              }
            ]
          }
        ],
        keyPoints: [
          'Always assess neurovascular status distal to fracture',
          'Describe fractures systematically: bone, location, pattern, displacement, open/closed',
          'Open fractures need tetanus, antibiotics, and urgent orthopaedic input',
          'Compartment syndrome is a clinical diagnosis—pain on passive stretch is key',
          'Splint fractures to reduce pain and prevent further injury',
          'Neck of femur fractures need surgery within 48 hours'
        ],
        examTips: [
          'Know the Gustilo-Anderson classification for open fractures',
          'Recognize compartment syndrome features',
          'Understand splinting principles',
          'Know which fractures are orthopaedic emergencies'
        ],
        clinicalPearls: [
          'In children, compare with the other side—normal variants are bilateral',
          'Beware the polytrauma patient—fractures may distract from visceral injuries',
          'If X-ray looks normal but clinical concern high, get senior review or more imaging',
          'Always X-ray the joint above and below the suspected fracture'
        ],
        commonMistakes: [
          'Not assessing neurovascular status before and after splinting',
          'Missing associated injuries (e.g., scaphoid with distal radius)',
          'Delaying antibiotics in open fractures',
          'Relying on presence of pulses to exclude compartment syndrome',
          'Applying circumferential casts in acute swelling (risk of compartment syndrome)'
        ],
        references: [
          'ATLS Manual: Musculoskeletal Trauma',
          'NICE: Fractures—Non-Complex',
          'BOA Standards for Trauma: Open Fractures',
          'McRae\'s Orthopaedic Trauma and Emergency Fracture Management'
        ],
        selfAssessment: [
          {
            id: 'ho-4-3-q1',
            question: 'The earliest and most reliable sign of compartment syndrome is:',
            options: [
              'Absent distal pulses',
              'Pallor of the limb',
              'Pain on passive stretch of the affected compartment',
              'Paralysis of the limb'
            ],
            correctAnswer: 2,
            explanation: 'Pain on passive stretch of muscles in the affected compartment is the earliest sign. Absent pulses is a late sign—do not wait for this.'
          },
          {
            id: 'ho-4-3-q2',
            question: 'A Gustilo Type III open fracture is characterized by:',
            options: [
              'Wound less than 1cm',
              'Wound 1-10cm with moderate contamination',
              'Wound >10cm, high energy, or vascular injury',
              'Any open fracture in an immunocompromised patient'
            ],
            correctAnswer: 2,
            explanation: 'Type III injuries have wounds >10cm, high-energy mechanisms, significant soft tissue injury, or vascular compromise requiring repair. They have the highest complication rates.'
          }
        ]
      }
    }
  ]
};

HOUSE_OFFICER_MODULES.push(HO_MODULE_4);

// ==================== HOUSE OFFICER MODULE 5 ====================
const HO_MODULE_5: CMEModule = {
  id: 'ho-module-5',
  title: 'Module 5: Burns Management',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-5-1',
      moduleId: 'ho-module-5',
      title: 'Burn Assessment and Classification',
      article: {
        title: 'Burn Assessment and Classification',
        overview: 'Accurate burn assessment is critical for determining treatment intensity, fluid requirements, and prognosis. This module covers burn depth, extent estimation, and severity classification.',
        learningObjectives: [
          'Classify burns by depth and mechanism',
          'Estimate burn extent using appropriate methods',
          'Identify burns requiring specialist referral',
          'Perform initial burn assessment systematically',
          'Calculate prognostic scores'
        ],
        sections: [
          {
            title: 'Burn Depth',
            content: 'Superficial (1st degree): epidermis only, red, painful, no blisters, heals 5-7 days. Superficial partial thickness: blisters, moist, painful, blanches, heals 2-3 weeks. Deep partial thickness: pale, less sensation, may need grafting, heals 3+ weeks with scarring. Full thickness (3rd degree): white/brown/black, leathery, insensate, requires grafting.',
            subsections: [
              {
                title: 'Depth Assessment',
                content: 'Color (red, mottled, white, black), Capillary refill (present in superficial), Sensation (painful = superficial), Blistering (characteristic of partial thickness). Accurate assessment may require 24-48 hours as burns evolve.'
              }
            ]
          },
          {
            title: 'Burn Extent - TBSA',
            content: 'Total Body Surface Area (TBSA) determines fluid requirements and prognosis. Rule of Nines (adults): head 9%, each arm 9%, each leg 18%, trunk front 18%, trunk back 18%, perineum 1%. Lund and Browder chart is more accurate, especially for children.',
            subsections: [
              {
                title: 'Palmar Method',
                content: 'The patient\'s palm (without fingers) represents approximately 0.5% TBSA; including fingers represents 1%. Useful for small or scattered burns.'
              },
              {
                title: 'Pediatric Differences',
                content: 'Children have proportionally larger heads and smaller legs. Use Lund and Browder charts with age adjustments. For rough estimate: child\'s head = 18% (reducing with age), each leg = 14% (increasing with age).'
              }
            ]
          },
          {
            title: 'Referral Criteria',
            content: 'Burns requiring specialist burns unit: >10% TBSA adults (>5% children/elderly), full thickness >5%, burns to face/hands/feet/genitalia/perineum/major joints, circumferential burns, inhalation injury, electrical/chemical burns, burns with associated trauma, pre-existing conditions.',
            subsections: [
              {
                title: 'Inhalation Injury',
                content: 'Suspect in: enclosed space fires, facial burns, singed nasal hairs, soot in mouth/nose, hoarse voice, stridor, carbonaceous sputum. Can cause rapid airway obstruction—early intubation may be needed.'
              }
            ]
          },
          {
            title: 'Prognostic Scores',
            content: 'Baux Score = Age + %TBSA (values >100 historically suggested non-survivable). Revised Baux adds 17 for inhalation injury. ABSI (Abbreviated Burn Severity Index) incorporates age, sex, TBSA, full thickness, and inhalation injury. These guide prognosis and discussions.',
            subsections: [
              {
                title: 'Modern Survival',
                content: 'Modern burn care has improved outcomes significantly. Baux >100 is no longer universally fatal. However, larger burns, increasing age, and inhalation injury remain major mortality predictors.'
              }
            ]
          }
        ],
        keyPoints: [
          'Superficial burns are painful and heal without scarring',
          'Full thickness burns are insensate and require grafting',
          'Rule of Nines for quick TBSA estimation; Lund-Browder for accuracy',
          'Inhalation injury suspected with enclosed fire, facial burns, hoarse voice',
          'Refer: >10% TBSA, full thickness >5%, special areas, inhalation, circumferential'
        ],
        examTips: [
          'Know the Rule of Nines percentages',
          'Understand burn depth characteristics',
          'Know referral criteria for burns units',
          'Be familiar with signs of inhalation injury'
        ],
        clinicalPearls: [
          'Burn depth often evolves over 24-48 hours—reassess',
          'The palm = 1% TBSA is a useful quick estimate',
          'Do not include superficial burns in TBSA for fluid calculations',
          'Circumferential limb burns may need escharotomy to prevent compartment syndrome'
        ],
        commonMistakes: [
          'Including superficial burns in TBSA calculations',
          'Underestimating burn extent',
          'Missing inhalation injury',
          'Delayed referral of significant burns'
        ],
        references: [
          'American Burn Association: Burn Center Referral Criteria',
          'ISBI Practice Guidelines for Burn Care',
          'NICE Emergency and Acute Medical Care: Burns',
          'WHO: Burns Prevention and Care'
        ],
        selfAssessment: [
          {
            id: 'ho-5-1-q1',
            question: 'A burn that is white, leathery, and insensate is classified as:',
            options: [
              'Superficial',
              'Superficial partial thickness',
              'Deep partial thickness',
              'Full thickness'
            ],
            correctAnswer: 3,
            explanation: 'Full thickness burns are white, brown, or black, leathery/waxy, and insensate because nerve endings are destroyed. They require grafting.'
          },
          {
            id: 'ho-5-1-q2',
            question: 'Using the Rule of Nines, an adult with burns to the entire right arm and anterior trunk has TBSA of:',
            options: [
              '18%',
              '27%',
              '36%',
              '45%'
            ],
            correctAnswer: 1,
            explanation: 'Right arm = 9%, anterior trunk = 18%, total = 27% TBSA.'
          }
        ]
      }
    },
    {
      id: 'ho-5-2',
      moduleId: 'ho-module-5',
      title: 'Burn Resuscitation and Initial Management',
      article: {
        title: 'Burn Resuscitation and Initial Management',
        overview: 'Burns cause significant fluid shifts requiring calculated resuscitation. Initial management follows ATLS principles with burn-specific considerations. This module covers the first 24-48 hours of burn care.',
        learningObjectives: [
          'Apply ATLS principles to the burned patient',
          'Calculate fluid resuscitation using the Parkland formula',
          'Monitor resuscitation adequacy',
          'Manage pain in burn patients',
          'Understand escharotomy indications'
        ],
        sections: [
          {
            title: 'Initial Approach',
            content: 'Stop the burning process (remove from source, cool with water, remove clothing/jewelry). Primary survey ABCDE with burn-specific considerations: Airway (inhalation injury), Breathing (circumferential chest burns), Circulation (IV access through burn if needed). Secondary survey: estimate %TBSA and depth.',
            subsections: [
              {
                title: 'Cooling',
                content: 'Cool running water 10-20°C for 20 minutes within 3 hours of injury. Do not use ice (vasoconstriction, further injury). For large burns, stop cooling early if hypothermia develops. Cover with clean, non-adherent dressings.'
              }
            ]
          },
          {
            title: 'Fluid Resuscitation',
            content: 'Burns >15% TBSA adults (>10% children) require IV resuscitation. Parkland Formula: 4mL × weight (kg) × %TBSA. Give half in first 8 hours (from time of burn), remainder over next 16 hours. Use Hartmann\'s/Ringer\'s lactate.',
            subsections: [
              {
                title: 'Parkland Formula Example',
                content: '70kg patient with 30% TBSA: 4 × 70 × 30 = 8400mL in 24 hours. First 8 hours = 4200mL (525mL/hr). Next 16 hours = 4200mL (262.5mL/hr). Adjust based on urine output.'
              },
              {
                title: 'Monitoring Resuscitation',
                content: 'Target urine output 0.5-1mL/kg/hr adults, 1mL/kg/hr children. Increase fluids if below target, decrease if above. Avoid over-resuscitation (causes edema, abdominal compartment syndrome).'
              }
            ]
          },
          {
            title: 'Analgesia',
            content: 'Burns are extremely painful. IV opioids (morphine) in titrated doses. Ketamine useful for dressing changes. Anxiolytics may be needed. Ensure adequate analgesia before procedures. Pain should be regularly assessed and treated.',
            subsections: [
              {
                title: 'Procedure-Related Pain',
                content: 'Dressing changes are painful—premedicate. Consider inhaled nitrous oxide, ketamine, or increased opioids. Non-pharmacological measures: explanation, distraction, controlled environment.'
              }
            ]
          },
          {
            title: 'Escharotomy',
            content: 'Circumferential full thickness burns form inelastic eschar that can compromise circulation (limbs) or ventilation (chest). Signs: decreased pulses, prolonged cap refill, cyanosis, decreased chest movement. Escharotomy: incision through eschar to release constriction. Bedside procedure, no anesthesia needed in full thickness burns.',
            subsections: [
              {
                title: 'Escharotomy Technique',
                content: 'Longitudinal incisions through eschar along mid-lateral lines of limbs. Avoid major vessels and nerves. Incise until fat bulges through. For chest, bilateral mid-axillary incisions connected by transverse incisions.'
              }
            ]
          },
          {
            title: 'Other Initial Measures',
            content: 'Tetanus prophylaxis. NG tube (ileus common in large burns). Urinary catheter for monitoring. Keep patient warm (impaired thermoregulation). DVT prophylaxis. Elevate burned limbs. Photograph burns for records.',
            subsections: [
              {
                title: 'Nutrition',
                content: 'Burns cause hypermetabolism. Start enteral feeding early (within 6-12 hours). Protein requirements increase significantly. Glutamine and vitamin supplementation may be beneficial.'
              }
            ]
          }
        ],
        keyPoints: [
          'Cool burns with running water for 20 minutes; avoid hypothermia in large burns',
          'Parkland formula: 4mL × kg × %TBSA; half in first 8 hours',
          'Target urine output 0.5-1mL/kg/hr',
          'Escharotomy for circumferential full thickness burns with compromised circulation/ventilation',
          'IV opioids for pain; premedicate before dressing changes'
        ],
        examTips: [
          'Know the Parkland formula',
          'Understand escharotomy indications',
          'Know target urine outputs for burn resuscitation',
          'Understand the timing of fluid administration'
        ],
        clinicalPearls: [
          'Time zero for Parkland is time of burn, not hospital arrival',
          'Lactated Ringer\'s preferred over normal saline (less hyperchloremia)',
          'If urine output inadequate despite adequate fluids, consider other causes (missed injury, myoglobinuria)',
          'Document urine color—dark urine may indicate myoglobinuria needing additional fluid'
        ],
        commonMistakes: [
          'Starting fluid calculation from hospital arrival, not burn time',
          'Over-resuscitation causing edema and compartment syndrome',
          'Delayed escharotomy in circumferential burns',
          'Inadequate analgesia',
          'Using ice for cooling'
        ],
        references: [
          'ISBI Practice Guidelines for Burn Care',
          'American Burn Association: Initial Assessment and Management',
          'ANZBA: Emergency Management of Severe Burns',
          'Cochrane Review: Cooling Burns'
        ],
        selfAssessment: [
          {
            id: 'ho-5-2-q1',
            question: 'Using the Parkland formula, the 24-hour fluid requirement for an 80kg patient with 25% TBSA burns is:',
            options: [
              '4000mL',
              '6000mL',
              '8000mL',
              '10000mL'
            ],
            correctAnswer: 2,
            explanation: 'Parkland: 4 × 80 × 25 = 8000mL. Half (4000mL) given in first 8 hours, half (4000mL) over next 16 hours.'
          },
          {
            id: 'ho-5-2-q2',
            question: 'The indication for escharotomy in a burned limb is:',
            options: [
              'Pain on passive movement',
              'Blistering across a joint',
              'Evidence of compromised distal circulation',
              'Burns deeper than superficial partial thickness'
            ],
            correctAnswer: 2,
            explanation: 'Escharotomy is indicated when circumferential eschar compromises distal circulation (absent pulses, poor cap refill, cyanosis) or ventilation (chest burns).'
          }
        ]
      }
    }
  ]
};

HOUSE_OFFICER_MODULES.push(HO_MODULE_5);

// ==================== HOUSE OFFICER MODULE 6 ====================
const HO_MODULE_6: CMEModule = {
  id: 'ho-module-6',
  title: 'Module 6: Hand and Facial Injuries',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-6-1',
      moduleId: 'ho-module-6',
      title: 'Hand Injury Assessment',
      article: {
        title: 'Hand Injury Assessment',
        overview: 'The hand is a complex structure where small injuries can have major functional consequences. Systematic assessment ensures no injuries are missed and appropriate referrals are made.',
        learningObjectives: [
          'Perform systematic hand examination',
          'Test individual tendons and nerves',
          'Identify injuries requiring specialist referral',
          'Provide appropriate initial management',
          'Understand hand functional anatomy'
        ],
        sections: [
          {
            title: 'Functional Anatomy',
            content: 'Tendons: Flexor digitorum superficialis (FDS) and profundus (FDP) flex fingers; extensor digitorum extends. Nerves: Median (thenar muscles, lateral 3.5 digits sensation), Ulnar (intrinsics, medial 1.5 digits), Radial (wrist/finger extension, dorsal sensation). Vessels: Radial and ulnar arteries form deep and superficial arches.',
            subsections: [
              {
                title: 'Safe Position of the Hand',
                content: 'Wrist 30° extension, MCP joints 70-90° flexion, IP joints slight flexion, thumb abducted. This position maintains ligament length and prevents contractures during immobilization.'
              }
            ]
          },
          {
            title: 'Tendon Testing',
            content: 'FDP: hold PIP joint extended, ask patient to flex DIP. FDS: hold other fingers extended, ask patient to flex the tested finger at PIP. Extensor tendons: extend fingers against resistance. Test each digit individually. Partial tendon injuries may have weak but present movement.',
            subsections: [
              {
                title: 'Extensor Tendon Zones',
                content: 'Zone I (DIP): mallet finger. Zone III (PIP): boutonnière. Zone V (MCP): fight bite injuries. Different zones have different treatment implications.'
              }
            ]
          },
          {
            title: 'Nerve Testing',
            content: 'Median: sensation over thenar eminence and lateral 3.5 digits. Motor: thumb abduction (abductor pollicis brevis). Ulnar: sensation little finger and medial ring finger. Motor: finger abduction/adduction, Froment\'s sign. Radial: sensation first dorsal web space. Motor: wrist and finger extension.',
            subsections: [
              {
                title: 'Two-Point Discrimination',
                content: 'Normal: <6mm on fingertips. Tests sensory nerve integrity more sensitively than light touch. Compare with uninjured side.'
              }
            ]
          },
          {
            title: 'Vascular Assessment',
            content: 'Radial and ulnar pulses. Allen\'s test for arch patency. Capillary refill (<2 seconds). Color and temperature of digits. Bleeding from wounds (arterial = bright pulsatile, venous = dark oozing).',
            subsections: [
              {
                title: 'Allen\'s Test',
                content: 'Occlude both radial and ulnar arteries, have patient make fist, release one artery—hand should pink up in <5 seconds if that artery supplies adequate perfusion. Tests arch patency before radial artery harvest.'
              }
            ]
          },
          {
            title: 'Injuries Requiring Specialist Referral',
            content: 'Flexor tendon injuries, extensor tendon injuries over MCP or proximal, nerve injuries, arterial injuries, open fractures, replantation candidates, complex wounds, fight bites, high-pressure injection injuries.',
            subsections: [
              {
                title: 'Fight Bite',
                content: 'Clenched fist striking teeth causes penetrating injury to MCP joint. High infection risk (oral flora). May appear minor but can lead to septic arthritis. Requires washout, antibiotics, and usually admission.'
              }
            ]
          }
        ],
        keyPoints: [
          'Test FDP with PIP held extended; test FDS with other fingers held extended',
          'Median nerve: thenar sensation and thumb abduction',
          'Ulnar nerve: little finger sensation and finger abduction',
          'Fight bites are ortho/plastics emergencies despite innocuous appearance',
          'Immobilize hand in safe position: wrist extended, MCPs flexed, IPs slightly flexed'
        ],
        examTips: [
          'Know how to test individual tendons',
          'Know motor and sensory distribution of median, ulnar, and radial nerves',
          'Understand zones of extensor tendon injuries',
          'Know referral criteria for hand injuries'
        ],
        clinicalPearls: [
          'Always test tendon function before local anesthetic',
          'A wound over the MCP after a fight is a fight bite until proven otherwise',
          'High-pressure injection injuries look benign but are emergencies',
          'Partial tendon injuries are easy to miss—pain on resisted movement is a clue'
        ],
        commonMistakes: [
          'Failing to test tendons before anesthesia',
          'Missing fight bite injuries',
          'Incomplete nerve examination',
          'Suturing wounds over MCP joints without considering joint penetration',
          'Immobilizing in non-functional position'
        ],
        references: [
          'Green\'s Operative Hand Surgery',
          'BSSH Standards for Hand Trauma',
          'Tang JB. Journal of Hand Surgery: Flexor Tendon Repair',
          'EAST Guidelines: Hand Injuries'
        ],
        selfAssessment: [
          {
            id: 'ho-6-1-q1',
            question: 'To test flexor digitorum profundus (FDP) function, you should:',
            options: [
              'Ask the patient to make a fist',
              'Hold the MCP joint flexed and ask patient to flex the DIP',
              'Hold the PIP joint extended and ask patient to flex the DIP',
              'Ask the patient to extend the finger against resistance'
            ],
            correctAnswer: 2,
            explanation: 'Holding the PIP extended isolates the FDP, which is the only flexor of the DIP joint when the FDS is rendered ineffective.'
          },
          {
            id: 'ho-6-1-q2',
            question: 'A fight bite injury should be:',
            options: [
              'Sutured closed with prophylactic antibiotics',
              'Irrigated and left open, with antibiotics and usually admission',
              'Dressed and reviewed in 48 hours',
              'Treated as a minor laceration'
            ],
            correctAnswer: 1,
            explanation: 'Fight bites have high infection rates due to oral flora and joint involvement. They need irrigation, antibiotics, and often surgical washout. Never suture closed.'
          }
        ]
      }
    },
    {
      id: 'ho-6-2',
      moduleId: 'ho-module-6',
      title: 'Facial Trauma Assessment and Initial Management',
      article: {
        title: 'Facial Trauma Assessment and Initial Management',
        overview: 'Facial injuries require careful assessment for both functional and cosmetic implications. This module covers systematic facial trauma assessment and initial management principles.',
        learningObjectives: [
          'Assess facial injuries systematically',
          'Recognize facial fracture patterns',
          'Identify injuries requiring specialist referral',
          'Manage facial soft tissue injuries',
          'Understand principles of facial wound closure'
        ],
        sections: [
          {
            title: 'Primary Survey Considerations',
            content: 'Facial trauma can compromise airway (blood, teeth, swelling, unstable mandible) and cause hemorrhage. Secure airway if threatened. Control bleeding with direct pressure. C-spine precautions if mechanism warrants.',
            subsections: [
              {
                title: 'Airway Threats',
                content: 'Bilateral mandible fractures can cause tongue to fall back. Severe midface fractures can cause posterior displacement. Le Fort III fractures may need midface to be pulled forward. Prepare for difficult airway.'
              }
            ]
          },
          {
            title: 'Systematic Facial Examination',
            content: 'Inspect: lacerations, asymmetry, swelling, bruising, deformity. Palpate: orbital rims, zygoma, nose, mandible (for step-offs, tenderness, crepitus). Assess: eye movement, vision, pupil reactions, facial nerve function, dental occlusion, mouth opening.',
            subsections: [
              {
                title: 'Facial Nerve Testing',
                content: 'Test each branch: Temporal (raise eyebrows), Zygomatic (close eyes tight), Buccal (puff cheeks), Marginal mandibular (show teeth), Cervical (platysma). Document before local anesthetic.'
              },
              {
                title: 'Eye Examination',
                content: 'Visual acuity (even roughly), pupil responses, eye movements (diplopia, entrapment), globe position (enophthalmos, proptosis), subconjunctival hemorrhage (may indicate orbital fracture). Urgent ophthalmology if globe injury suspected.'
              }
            ]
          },
          {
            title: 'Facial Fracture Patterns',
            content: 'Nasal: most common, assess septum for hematoma (drain if present). Zygoma: flattening of cheek, step at infraorbital rim, trismus, infraorbital nerve numbness. Orbital floor: diplopia on upward gaze, enophthalmos, infraorbital numbness. Mandible: malocclusion, trismus, numbness lower lip.',
            subsections: [
              {
                title: 'Le Fort Fractures',
                content: 'Midface fractures classified by level. Le Fort I: maxilla only (floating palate). Le Fort II: pyramidal, through infraorbital rim and nasal bridge. Le Fort III: complete craniofacial disjunction. Test by grasping maxilla and checking for mobility.'
              }
            ]
          },
          {
            title: 'Soft Tissue Management',
            content: 'Face has excellent blood supply—tissue-sparing approach. Preserve all viable tissue. Irrigate copiously. Close wounds primarily if clean (even up to 24 hours given good vascularity). Careful alignment of landmarks (vermillion border, eyebrow, hairline). Layered closure.',
            subsections: [
              {
                title: 'Special Structures',
                content: 'Vermillion border: must align precisely (even 1mm mismatch is visible). Eyebrow: never shave (regrowth unpredictable). Ear cartilage: cover with skin, avoid hematoma. Nose: check for septal hematoma. Parotid duct and facial nerve: injuries require specialist repair.'
              }
            ]
          },
          {
            title: 'Referral Indications',
            content: 'Facial fractures, significant tissue loss, facial nerve injury, parotid duct injury, eyelid lacerations through the lid margin, lacrimal duct injury, wounds requiring complex reconstruction. Early specialist involvement optimizes outcomes.'
          }
        ],
        keyPoints: [
          'Facial trauma can compromise airway—assess and secure early',
          'Test facial nerve function before local anesthetic',
          'Drain septal hematoma to prevent saddle nose deformity',
          'Face heals well—preserve tissue and close primarily when appropriate',
          'Align landmarks precisely: vermillion border, eyebrow, hairline'
        ],
        examTips: [
          'Know the branches of the facial nerve',
          'Understand Le Fort fracture classification',
          'Know which facial injuries require specialist referral',
          'Understand the importance of vermillion border alignment'
        ],
        clinicalPearls: [
          'Always check inside the mouth after facial trauma',
          'Infraorbital numbness suggests orbital floor or zygoma fracture',
          'Subconjunctival hemorrhage extending posteriorly suggests orbital fracture',
          'Dog ears after suturing will settle—don\'t trim excessively'
        ],
        commonMistakes: [
          'Forgetting airway assessment in facial trauma',
          'Missing septal hematoma',
          'Shaving eyebrows',
          'Poor alignment of vermillion border',
          'Missing associated injuries (head, c-spine)'
        ],
        references: [
          'ATLS Manual: Head and Facial Trauma',
          'AO Surgery Reference: Facial Fractures',
          'NICE: Head Injury Guidelines',
          'Facial Plastic and Reconstructive Surgery Clinics'
        ],
        selfAssessment: [
          {
            id: 'ho-6-2-q1',
            question: 'Infraorbital nerve numbness is associated with fractures of the:',
            options: [
              'Nasal bones',
              'Mandible',
              'Zygoma and/or orbital floor',
              'Frontal bone'
            ],
            correctAnswer: 2,
            explanation: 'The infraorbital nerve runs through the orbital floor and zygoma. Numbness in its distribution (cheek, upper lip, lateral nose) suggests these fractures.'
          },
          {
            id: 'ho-6-2-q2',
            question: 'A septal hematoma after nasal trauma should be:',
            options: [
              'Observed and reviewed in 1 week',
              'Drained urgently to prevent septal necrosis',
              'Treated with antibiotics only',
              'Managed conservatively with ice packs'
            ],
            correctAnswer: 1,
            explanation: 'Septal hematoma must be drained urgently. If left, it causes pressure necrosis of septal cartilage, resulting in saddle nose deformity.'
          }
        ]
      }
    }
  ]
};

HOUSE_OFFICER_MODULES.push(HO_MODULE_6);

// ==================== HOUSE OFFICER MODULE 7 ====================
const HO_MODULE_7: CMEModule = {
  id: 'ho-module-7',
  title: 'Module 7: ICU Basics for Surgical Patients',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-7-1',
      moduleId: 'ho-module-7',
      title: 'Critical Care Monitoring and Organ Support',
      article: {
        title: 'Critical Care Monitoring and Organ Support',
        overview: 'Surgical patients in the ICU require complex monitoring and support. Understanding the basics of critical care monitoring helps House Officers participate in patient care and recognize deterioration.',
        learningObjectives: [
          'Interpret basic ICU monitoring',
          'Understand principles of ventilatory support',
          'Recognize sepsis and septic shock',
          'Understand vasopressor and inotrope basics',
          'Participate in ICU ward rounds effectively'
        ],
        sections: [
          {
            title: 'ICU Monitoring',
            content: 'Standard monitoring: continuous ECG, SpO2, arterial blood pressure (invasive), CVP, temperature, urine output. Advanced: cardiac output monitoring, ICP monitoring, BIS (depth of anesthesia). Interpret trends, not single values.',
            subsections: [
              {
                title: 'Arterial Line',
                content: 'Continuous BP monitoring, allows frequent ABG sampling. Mean arterial pressure (MAP) >65mmHg usually target. Waveform analysis can indicate fluid responsiveness.'
              },
              {
                title: 'Central Venous Pressure',
                content: 'CVP reflects right atrial pressure. Normal 0-8 mmHg. High CVP: fluid overload, RV failure, tamponade. Low CVP: hypovolemia. Trend is more useful than absolute value.'
              }
            ]
          },
          {
            title: 'Mechanical Ventilation',
            content: 'Ventilators support or replace breathing. Key settings: FiO2 (oxygen concentration), Tidal volume (6-8mL/kg ideal body weight for lung-protective ventilation), PEEP (maintains alveolar recruitment), Respiratory rate.',
            subsections: [
              {
                title: 'Modes of Ventilation',
                content: 'Controlled: ventilator delivers all breaths. Assisted: patient triggers breaths, ventilator supports. Spontaneous: patient breathes independently with pressure support. Weaning progresses from controlled to spontaneous.'
              },
              {
                title: 'Ventilator Alarms',
                content: 'High pressure: kinked tube, secretions, bronchospasm, patient biting tube. Low pressure: disconnection, leak. Know how to respond to alarms and when to call for help.'
              }
            ]
          },
          {
            title: 'Sepsis and Septic Shock',
            content: 'Sepsis: life-threatening organ dysfunction due to dysregulated response to infection. qSOFA score (≥2 = high risk): RR ≥22, altered mental status, SBP ≤100. Septic shock: sepsis with hypotension requiring vasopressors and lactate >2 despite adequate fluids.',
            subsections: [
              {
                title: 'Sepsis Bundles',
                content: 'Hour-1 bundle: Measure lactate, Blood cultures before antibiotics, Broad-spectrum antibiotics, Start 30mL/kg crystalloid if hypotensive or lactate >4, Vasopressors if hypotensive during or after fluids.'
              }
            ]
          },
          {
            title: 'Vasopressors and Inotropes',
            content: 'Vasopressors increase vascular resistance (noradrenaline first-line for septic shock). Inotropes increase contractility (dobutamine for cardiogenic shock). Know common agents, not detailed pharmacology.',
            subsections: [
              {
                title: 'Common Agents',
                content: 'Noradrenaline (norepinephrine): vasopressor of choice in sepsis. Adrenaline (epinephrine): inotropy + vasoconstriction. Dobutamine: inotropy with some vasodilation. Vasopressin: second-line vasopressor.'
              }
            ]
          },
          {
            title: 'Daily ICU Review',
            content: 'Systematic approach for rounds: Neurological (sedation, GCS), Cardiovascular (rhythm, BP, pressors), Respiratory (ventilator settings, gases), Renal (urine output, creatinine, RRT), GI (feeding, bowels, liver), Haem (Hb, platelets, coag), ID (cultures, antibiotics), Lines (days in situ, needed?), VTE prophylaxis, Nutrition.'
          }
        ],
        keyPoints: [
          'MAP target usually >65mmHg; CVP trends more useful than absolutes',
          'Lung-protective ventilation: 6-8mL/kg tidal volume',
          'Sepsis Hour-1 bundle: lactate, cultures, antibiotics, fluids, vasopressors',
          'Noradrenaline is first-line vasopressor in septic shock',
          'Systematic daily review covers all organ systems'
        ],
        examTips: [
          'Know qSOFA criteria for sepsis screening',
          'Understand basic ventilator settings and their effects',
          'Know first-line vasopressor for septic shock',
          'Be familiar with sepsis bundle components'
        ],
        clinicalPearls: [
          'Lactate clearance is a marker of resuscitation adequacy',
          'Central lines can stay up to 7 days if functioning and no infection signs',
          'Ask ICU nurses—they know the patient best',
          'Read the observation chart before rounds—trends matter'
        ],
        commonMistakes: [
          'Focusing on one organ system and missing others',
          'Ignoring ventilator alarms',
          'Not participating actively in rounds',
          'Forgetting VTE prophylaxis in ICU patients'
        ],
        references: [
          'Surviving Sepsis Campaign Guidelines 2021',
          'NICE: Sepsis Recognition and Management',
          'ANZICS Core Curriculum',
          'Oh\'s Intensive Care Manual'
        ],
        selfAssessment: [
          {
            id: 'ho-7-1-q1',
            question: 'The first-line vasopressor in septic shock is:',
            options: [
              'Dopamine',
              'Dobutamine',
              'Noradrenaline (norepinephrine)',
              'Adrenaline (epinephrine)'
            ],
            correctAnswer: 2,
            explanation: 'Noradrenaline is the first-line vasopressor in septic shock according to Surviving Sepsis Campaign guidelines.'
          },
          {
            id: 'ho-7-1-q2',
            question: 'Lung-protective ventilation uses a tidal volume of:',
            options: [
              '4-6 mL/kg ideal body weight',
              '6-8 mL/kg ideal body weight',
              '10-12 mL/kg ideal body weight',
              '12-15 mL/kg ideal body weight'
            ],
            correctAnswer: 1,
            explanation: 'Lung-protective ventilation uses 6-8 mL/kg ideal body weight to prevent ventilator-induced lung injury, especially in ARDS.'
          }
        ]
      }
    }
  ]
};

HOUSE_OFFICER_MODULES.push(HO_MODULE_7);

// ==================== HOUSE OFFICER MODULES 8-11 ====================
const HO_MODULE_8: CMEModule = {
  id: 'ho-module-8',
  title: 'Module 8: Common Surgical Conditions',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-8-1',
      moduleId: 'ho-module-8',
      title: 'Acute Abdomen: Assessment and Initial Management',
      article: {
        title: 'Acute Abdomen: Assessment and Initial Management',
        overview: 'The acute abdomen is a common surgical presentation requiring systematic evaluation to differentiate conditions needing urgent surgery from those managed conservatively. This module covers the House Officer\'s role in assessment and initial management.',
        learningObjectives: [
          'Perform systematic abdominal assessment',
          'Recognize patterns suggesting different diagnoses',
          'Order appropriate initial investigations',
          'Initiate resuscitation and supportive care',
          'Identify patients needing urgent surgical intervention'
        ],
        sections: [
          {
            title: 'History Taking',
            content: 'Pain: SOCRATES (Site, Onset, Character, Radiation, Associations, Time course, Exacerbating/relieving factors, Severity). Associated symptoms: nausea, vomiting, fever, bowel changes, urinary symptoms, last menstrual period (always in women of childbearing age). Past surgical history.',
            subsections: [
              {
                title: 'Pain Patterns',
                content: 'Colicky: obstruction (biliary, ureteric, bowel). Constant severe: peritonitis, ischemia. Epigastric radiating to back: pancreatitis. RIF: appendicitis. RUQ: cholecystitis. LIF: diverticulitis.'
              }
            ]
          },
          {
            title: 'Examination',
            content: 'General: position (still with peritonitis, restless with colic), hydration, jaundice, fever. Abdomen: inspection (distension, scars, visible peristalsis), palpation (tenderness, guarding, rigidity, masses), percussion (tympanic = gas, dull = fluid/mass), auscultation (absent = ileus/peritonitis, high-pitched = obstruction). Always check hernial orifices.',
            subsections: [
              {
                title: 'Peritoneal Signs',
                content: 'Guarding: voluntary muscle contraction. Rigidity: involuntary (board-like) contraction. Rebound tenderness: pain on releasing pressure. Percussion tenderness. These suggest peritonitis requiring urgent surgery.'
              }
            ]
          },
          {
            title: 'Investigations',
            content: 'Bloods: FBC, U&E, LFTs, amylase/lipase, CRP, lactate, group and save, pregnancy test. Imaging: erect CXR (pneumoperitoneum), AXR (obstruction), CT abdomen/pelvis (gold standard for most acute abdomens), ultrasound (biliary, gynecological).',
            subsections: [
              {
                title: 'When to CT',
                content: 'CT is highly sensitive and specific for most acute abdominal pathology. Consider early in unclear cases. Contrast: oral (obstruction), IV (most other indications), rectal (specific indications).'
              }
            ]
          },
          {
            title: 'Initial Management',
            content: 'Resuscitation: IV access, fluids, analgesia (do not withhold). NBM if surgery likely. NG tube if vomiting/obstruction. Urinary catheter for monitoring and comfort. Antibiotics if infection suspected. VTE prophylaxis. Regular reassessment.',
            subsections: [
              {
                title: 'Analgesia',
                content: 'Adequate analgesia does NOT mask signs or delay diagnosis. IV opioids titrated to comfort. Withholding analgesia is unethical and makes examination harder.'
              }
            ]
          },
          {
            title: 'Indications for Urgent Surgery',
            content: 'Free air (perforation), peritonitis (generalized tenderness, rigidity), bowel obstruction not resolving with conservative management, ischemic bowel (pain out of proportion, lactate elevation, peritonitis), ruptured AAA, severe sepsis from abdominal source.'
          }
        ],
        keyPoints: [
          'Always check hernial orifices in bowel obstruction',
          'Peritoneal signs (guarding, rigidity, rebound) suggest need for surgery',
          'Do not withhold analgesia—it does not mask diagnosis',
          'Erect CXR for free air; CT is gold standard for most diagnoses',
          'NBM, IV fluids, analgesia, and NG tube are standard initial management'
        ],
        examTips: [
          'Know classic pain patterns for common conditions',
          'Understand peritoneal signs and their significance',
          'Know indications for emergency laparotomy',
          'Be familiar with initial investigation panel'
        ],
        clinicalPearls: [
          'Elderly and immunocompromised patients may have minimal signs despite severe pathology',
          'Non-specific abdominal pain is the most common diagnosis—but exclude serious causes first',
          'Rising lactate and metabolic acidosis suggest ischemia',
          'A quiet abdomen with severe pain suggests ischemic bowel'
        ],
        commonMistakes: [
          'Forgetting to check hernial orifices',
          'Withholding analgesia',
          'Not considering pregnancy in women of childbearing age',
          'Delayed recognition of peritonitis'
        ],
        references: [
          'NICE: Acute Abdomen - Recognition and Referral',
          'World Journal of Emergency Surgery: Acute Abdomen Guidelines',
          'ACR Appropriateness Criteria: Acute Abdominal Pain',
          'Emergency General Surgery: Core Curriculum'
        ],
        selfAssessment: [
          {
            id: 'ho-8-1-q1',
            question: 'Which finding on examination most strongly suggests need for surgery?',
            options: [
              'Hyperactive bowel sounds',
              'Generalized abdominal rigidity',
              'Left lower quadrant tenderness',
              'Mild distension'
            ],
            correctAnswer: 1,
            explanation: 'Generalized abdominal rigidity indicates peritonitis and usually requires urgent surgical intervention.'
          }
        ]
      }
    },
    {
      id: 'ho-8-2',
      moduleId: 'ho-module-8',
      title: 'Surgical Site Infections: Prevention and Management',
      article: {
        title: 'Surgical Site Infections: Prevention and Management',
        overview: 'Surgical site infections (SSIs) are among the most common healthcare-associated infections. Prevention requires attention to multiple factors throughout the surgical pathway.',
        learningObjectives: [
          'Classify surgical site infections',
          'Identify risk factors for SSI',
          'Implement prevention strategies',
          'Recognize and manage SSI',
          'Understand antibiotic stewardship in SSI'
        ],
        sections: [
          {
            title: 'Classification',
            content: 'Superficial incisional: skin and subcutaneous tissue, within 30 days. Deep incisional: deep soft tissue (fascia, muscle), within 30 days (or 90 days if implant). Organ/space: any part of anatomy opened/manipulated, within 30/90 days.',
            subsections: [
              {
                title: 'Diagnostic Criteria',
                content: 'Purulent drainage, organisms isolated from wound culture, signs of infection (pain, tenderness, swelling, redness, heat) plus wound opened, or surgeon diagnosis of infection.'
              }
            ]
          },
          {
            title: 'Risk Factors',
            content: 'Patient factors: diabetes, obesity, smoking, malnutrition, immunosuppression, advanced age. Surgical factors: wound class, duration of surgery, emergency surgery, poor hemostasis, tissue trauma, foreign material. Environmental: operating room traffic, inadequate sterilization.',
            subsections: [
              {
                title: 'Modifiable Risk Factors',
                content: 'Optimize diabetes (HbA1c <8.5%, perioperative glucose <11 mmol/L). Smoking cessation 4+ weeks preop. Treat malnutrition. MRSA decolonization in carriers. Weight loss if time permits.'
              }
            ]
          },
          {
            title: 'Prevention Bundle',
            content: 'Preoperative: shower, hair removal by clipping (not shaving), skin antisepsis, antibiotic prophylaxis. Intraoperative: normothermia, glycemic control, oxygenation, aseptic technique. Postoperative: appropriate wound care, early mobilization, monitor for signs.',
            subsections: [
              {
                title: 'Antibiotic Prophylaxis',
                content: 'Give within 60 minutes of incision. Cefazolin 2g (3g if >120kg) for most procedures. Redose if surgery >4 hours or significant blood loss. Continue for 24 hours maximum (single dose often sufficient). Adjust for allergies and local resistance patterns.'
              }
            ]
          },
          {
            title: 'Recognition and Management',
            content: 'Signs: increasing pain, erythema, warmth, swelling, discharge (serous → purulent), fever, wound breakdown. Management: wound exploration, drainage of collection, debridement if needed, cultures, antibiotics guided by cultures, wound care.',
            subsections: [
              {
                title: 'When to Involve Seniors',
                content: 'Deep incisional or organ/space infection, systemic sepsis, wound breakdown exposing implant, need for debridement, failure to improve with initial treatment.'
              }
            ]
          }
        ],
        keyPoints: [
          'SSI classified by depth: superficial, deep incisional, organ/space',
          'Antibiotic prophylaxis within 60 minutes of incision',
          'Hair removal by clipping, not shaving',
          'Maintain normothermia and normoglycemia perioperatively',
          'Wound exploration and drainage are cornerstone of treatment'
        ],
        examTips: [
          'Know SSI classification and timeframes',
          'Understand antibiotic prophylaxis timing and duration',
          'Know modifiable risk factors',
          'Be familiar with SSI prevention bundles'
        ],
        clinicalPearls: [
          'SSI typically presents day 5-7 postoperatively',
          'Opening the wound often provides immediate relief and is the main treatment',
          'Culture pus, not swabs from wound surface',
          'Not all wound erythema is SSI—consider other diagnoses'
        ],
        commonMistakes: [
          'Shaving instead of clipping for hair removal',
          'Giving antibiotics too early or continuing too long',
          'Treating with antibiotics without wound exploration',
          'Not recognizing deep SSI early'
        ],
        references: [
          'NICE: Surgical Site Infections NG125',
          'CDC: Guideline for the Prevention of SSI',
          'WHO: Global Guidelines for SSI Prevention',
          'SIGN: Antibiotic Prophylaxis in Surgery'
        ],
        selfAssessment: [
          {
            id: 'ho-8-2-q1',
            question: 'Antibiotic prophylaxis should be administered:',
            options: [
              '2 hours before incision',
              'Within 60 minutes before incision',
              'At time of skin incision',
              'Postoperatively only'
            ],
            correctAnswer: 1,
            explanation: 'Antibiotic prophylaxis should be given within 60 minutes before incision to ensure adequate tissue levels at the time of potential contamination.'
          }
        ]
      }
    }
  ]
};

const HO_MODULE_9: CMEModule = {
  id: 'ho-module-9',
  title: 'Module 9: Paediatric Surgery Basics',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-9-1',
      moduleId: 'ho-module-9',
      title: 'Paediatric Surgical Emergencies',
      article: {
        title: 'Paediatric Surgical Emergencies',
        overview: 'Children are not small adults. Pediatric surgical emergencies require age-appropriate assessment and management. This module covers common pediatric presentations relevant to House Officers.',
        learningObjectives: [
          'Recognize common pediatric surgical emergencies',
          'Understand age-specific considerations in assessment',
          'Calculate pediatric fluid and medication doses',
          'Communicate effectively with children and parents',
          'Know when to escalate to senior/specialist care'
        ],
        sections: [
          {
            title: 'Age-Specific Considerations',
            content: 'Anatomy: proportionally larger head, shorter neck, higher airway. Physiology: faster respiratory/heart rates, less reserve. Communication: adapt to developmental stage, parents are crucial historians. Weight-based dosing: weigh children, estimate using formulas if emergency.',
            subsections: [
              {
                title: 'Weight Estimation',
                content: '1-12 months: (age in months + 9)/2 = kg. 1-5 years: (age × 2) + 8 = kg. 6-12 years: (age × 3) + 7 = kg. Or use Broselow tape. Always weigh when possible.'
              }
            ]
          },
          {
            title: 'Common Emergencies',
            content: 'Appendicitis: most common surgical emergency. May present atypically in young children. Intussusception: 3 months-3 years, colicky pain, currant jelly stool, sausage-shaped mass. Pyloric stenosis: 3-6 weeks, projectile vomiting, hungry baby, olive mass. Incarcerated hernia: irreducible inguinal swelling, urgent reduction needed.',
            subsections: [
              {
                title: 'Appendicitis Pearls',
                content: 'Younger children present later with higher perforation rates. May not have classic RIF pain. Anorexia is a key feature. Ultrasound is first-line imaging (no radiation).'
              },
              {
                title: 'Intussusception',
                content: 'Peak 5-9 months. Intermittent severe colicky pain (draws up legs), lethargy between episodes, vomiting, bloody stool (late). Air/contrast enema is diagnostic and therapeutic. Surgery if reduction fails or peritonitis.'
              }
            ]
          },
          {
            title: 'Fluid Resuscitation',
            content: 'Bolus: 10-20mL/kg isotonic crystalloid, reassess after each bolus. Maintenance fluids: Holliday-Segar formula (4-2-1): 4mL/kg/hr for first 10kg, 2mL/kg/hr for next 10kg, 1mL/kg/hr thereafter. Use glucose-containing fluids for maintenance in young infants.',
            subsections: [
              {
                title: 'Holliday-Segar Example',
                content: '25kg child: first 10kg = 40mL/hr, next 10kg = 20mL/hr, next 5kg = 5mL/hr. Total = 65mL/hr. This is maintenance—add for ongoing losses.'
              }
            ]
          },
          {
            title: 'Communication',
            content: 'Speak to children at their level. Use simple language. Explain procedures honestly (it may hurt a bit). Involve play specialists if available. Keep parents present and informed. Document child protection concerns.',
            subsections: [
              {
                title: 'Consent in Children',
                content: 'Under 16: parent/guardian consent, but involve child in decisions. Gillick competent: can consent if they understand. 16+: presumed competent. Emergency: act in best interests.'
              }
            ]
          }
        ],
        keyPoints: [
          'Children have less physiological reserve—recognize deterioration early',
          'Weight-based dosing for all medications and fluids',
          'Appendicitis presentation in young children is often atypical',
          'Intussusception: colicky pain, lethargy, currant jelly stool',
          'Pyloric stenosis: 3-6 week old with projectile vomiting'
        ],
        examTips: [
          'Know Holliday-Segar formula for maintenance fluids',
          'Recognize classic presentations of pediatric surgical emergencies',
          'Understand consent in children',
          'Know age-appropriate vital signs (children have faster HR and RR)'
        ],
        clinicalPearls: [
          'A quiet, lethargic child is a worrying child',
          'Parents know their child—listen to their concerns',
          'Ultrasound is first-line for most pediatric abdominal imaging',
          'EMLA cream needs 60 minutes to work—plan ahead for cannulation'
        ],
        commonMistakes: [
          'Using adult doses in children',
          'Ignoring parental concerns',
          'Not recognizing atypical presentations',
          'Delayed fluid resuscitation in sick children'
        ],
        references: [
          'APLS: Advanced Paediatric Life Support',
          'NICE: Appendicitis in Children',
          'RCPCH: Paediatric Care Standards',
          'BAPS: Guidelines for Paediatric Surgery'
        ],
        selfAssessment: [
          {
            id: 'ho-9-1-q1',
            question: 'Using the 4-2-1 rule, the hourly maintenance fluid rate for a 15kg child is:',
            options: [
              '40 mL/hr',
              '50 mL/hr',
              '60 mL/hr',
              '65 mL/hr'
            ],
            correctAnswer: 1,
            explanation: 'First 10kg = 40mL/hr (4×10), next 5kg = 10mL/hr (2×5), total = 50mL/hr.'
          }
        ]
      }
    }
  ]
};

const HO_MODULE_10: CMEModule = {
  id: 'ho-module-10',
  title: 'Module 10: Medical Ethics and Professionalism',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-10-1',
      moduleId: 'ho-module-10',
      title: 'Core Ethical Principles in Surgical Practice',
      article: {
        title: 'Core Ethical Principles in Surgical Practice',
        overview: 'Ethical practice is fundamental to medicine. Understanding core principles helps navigate complex situations and maintain patient trust. This module covers essential ethics for surgical House Officers.',
        learningObjectives: [
          'Apply the four principles of medical ethics',
          'Handle confidentiality and its exceptions',
          'Approach end-of-life decisions ethically',
          'Recognize and manage conflicts of interest',
          'Maintain professional boundaries'
        ],
        sections: [
          {
            title: 'Four Principles of Medical Ethics',
            content: 'Autonomy: respect patient\'s right to make decisions about their care. Beneficence: act in the patient\'s best interest. Non-maleficence: do no harm. Justice: treat patients fairly, allocate resources equitably. These principles often need to be balanced against each other.',
            subsections: [
              {
                title: 'Autonomy in Practice',
                content: 'Informed consent, respecting refusal of treatment, truth-telling. Autonomy can be limited if decisions affect others or in the case of incapacity.'
              },
              {
                title: 'When Principles Conflict',
                content: 'A patient refusing life-saving treatment: autonomy vs. beneficence. Allocating ICU beds: individual benefit vs. justice. Discuss complex cases with seniors and ethics committees.'
              }
            ]
          },
          {
            title: 'Confidentiality',
            content: 'Patient information is confidential and should only be shared with those directly involved in care, with patient consent, or in specific exceptional circumstances.',
            subsections: [
              {
                title: 'Exceptions to Confidentiality',
                content: 'Statutory requirements (notifiable diseases, court orders). Risk of serious harm to patient or others. Child protection concerns. Patient incapacity with disclosure in their best interest. Public interest (very high bar). Document rationale for any disclosure.'
              }
            ]
          },
          {
            title: 'End-of-Life Decisions',
            content: 'Surgeons frequently face end-of-life decisions. Principles: patient wishes are paramount, distinguish withdrawing from withholding treatment (ethically equivalent), futility does not require offering treatment, good palliative care is never withdrawal of care.',
            subsections: [
              {
                title: 'DNACPR Decisions',
                content: 'Should involve patient/family where possible. Based on likelihood of success and patient\'s wishes. Does not mean "do not treat"—all other care continues. Document clearly and communicate to team.'
              }
            ]
          },
          {
            title: 'Professionalism',
            content: 'Professional behavior: honesty, reliability, responsibility, respect. Maintain boundaries (personal/professional). Acknowledge errors and apologize. Duty of candor: inform patients when things go wrong. Self-care: recognize burnout, seek help when needed.',
            subsections: [
              {
                title: 'Social Media',
                content: 'Never post identifiable patient information. Maintain professional online presence. Comments are permanent. Separate personal and professional accounts.'
              }
            ]
          }
        ],
        keyPoints: [
          'Four principles: Autonomy, Beneficence, Non-maleficence, Justice',
          'Confidentiality has limited exceptions—document rationale',
          'Patient wishes are paramount in end-of-life decisions',
          'Duty of candor: tell patients when things go wrong',
          'Maintain professional boundaries and online presence'
        ],
        examTips: [
          'Know the four principles and how to apply them',
          'Understand exceptions to confidentiality',
          'Be familiar with capacity assessment',
          'Ethics questions often present dilemmas—acknowledge tensions'
        ],
        clinicalPearls: [
          'When in doubt, ask "What is in the best interest of this patient?"',
          'Document ethical discussions in the notes',
          'Involve seniors and ethics committees in complex cases',
          'Apologizing is not admitting liability—it\'s being human'
        ],
        commonMistakes: [
          'Breaching confidentiality without justification',
          'Not documenting consent discussions',
          'Ignoring patient wishes',
          'Failing to recognize personal biases'
        ],
        references: [
          'GMC: Good Medical Practice',
          'Medical and Dental Council of Nigeria: Code of Medical Ethics',
          'Beauchamp and Childress: Principles of Biomedical Ethics',
          'Royal College of Surgeons: Professional Standards'
        ],
        selfAssessment: [
          {
            id: 'ho-10-1-q1',
            question: 'Which is NOT one of the four principles of medical ethics?',
            options: [
              'Autonomy',
              'Beneficence',
              'Veracity',
              'Justice'
            ],
            correctAnswer: 2,
            explanation: 'The four principles are Autonomy, Beneficence, Non-maleficence, and Justice. Veracity (truth-telling) is a related but separate concept.'
          }
        ]
      }
    }
  ]
};

const HO_MODULE_11: CMEModule = {
  id: 'ho-module-11',
  title: 'Module 11: Transition to Residency',
  level: 'house_officer',
  topics: [
    {
      id: 'ho-11-1',
      moduleId: 'ho-module-11',
      title: 'Building Competence for Surgical Residency',
      article: {
        title: 'Building Competence for Surgical Residency',
        overview: 'The transition from House Officer to surgical resident requires developing clinical skills, academic foundations, and professional behaviors. This module guides preparation for the next stage of training.',
        learningObjectives: [
          'Identify essential competencies for residency',
          'Develop a personal learning plan',
          'Build a portfolio of experience',
          'Prepare for residency selection',
          'Establish healthy work-life practices'
        ],
        sections: [
          {
            title: 'Clinical Competencies',
            content: 'Technical skills: venepuncture, cannulation, catheterization, NG tubes, suturing, assisting in surgery. Clinical reasoning: history, examination, investigation interpretation, differential diagnosis. Patient management: prescribing, fluid management, wound care.',
            subsections: [
              {
                title: 'Maximizing Opportunities',
                content: 'Volunteer for procedures, attend theatre when possible, practice skills in simulation, seek feedback, keep a logbook. Competence comes from supervised practice.'
              }
            ]
          },
          {
            title: 'Academic Foundations',
            content: 'Anatomy, physiology, pathology—continually revise. Surgical science: wound healing, infection, nutrition. Evidence-based practice: read journals, attend teaching. Consider research exposure: audits, case reports, literature reviews.',
            subsections: [
              {
                title: 'Examinations',
                content: 'WACS/MDCN requirements for residency. Primary fellowship examinations test basic sciences. Start preparing early. Study groups and courses are helpful.'
              }
            ]
          },
          {
            title: 'Portfolio Development',
            content: 'Document: clinical experience (cases, procedures), teaching (given and received), courses and conferences, audit and research, reflective practice. A strong portfolio demonstrates commitment and self-directed learning.',
            subsections: [
              {
                title: 'Reflective Practice',
                content: 'After significant events (good or bad), reflect: What happened? What did I learn? What will I do differently? Document reflections in portfolio. This is professional maturation.'
              }
            ]
          },
          {
            title: 'Residency Selection',
            content: 'Research programs of interest. Obtain references from consultants who know your work. Prepare for interviews: know your CV, know why surgery, know the program. Demonstrate enthusiasm, reliability, and insight.',
            subsections: [
              {
                title: 'What Programs Look For',
                content: 'Commitment to surgery: demonstrated interest. Clinical competence: references matter. Academic potential: research, teaching, exams. Personal qualities: teamwork, communication, resilience.'
              }
            ]
          },
          {
            title: 'Wellbeing and Sustainability',
            content: 'Surgery is demanding. Establish healthy habits: exercise, sleep, relationships outside medicine. Recognize signs of burnout: exhaustion, cynicism, reduced efficacy. Seek help early. Peer support is valuable.',
            subsections: [
              {
                title: 'Building Resilience',
                content: 'Accept that challenges are part of training. Develop coping strategies. Maintain perspective. Celebrate achievements. Find mentors. Remember why you chose this path.'
              }
            ]
          }
        ],
        keyPoints: [
          'Competence comes from supervised practice—seek opportunities',
          'Build a portfolio documenting clinical, academic, and professional activities',
          'Prepare for primary fellowship exams early',
          'References and demonstrated commitment matter for selection',
          'Establish sustainable work-life practices from the start'
        ],
        examTips: [
          'Primary exams test basic sciences heavily—revise continuously',
          'Practice viva and clinical examination formats',
          'Audit and research demonstrate academic engagement',
          'Use study groups and courses'
        ],
        clinicalPearls: [
          'The best residents are those who are reliable, willing, and self-aware',
          'Ask for feedback regularly—it shows maturity',
          'Network with residents in programs you\'re interested in',
          'It\'s okay not to know everything—know your limits'
        ],
        commonMistakes: [
          'Waiting until final year to prepare for residency',
          'Neglecting portfolio documentation',
          'Burning out by not taking care of yourself',
          'Not seeking help when struggling'
        ],
        references: [
          'WACS: Training Guidelines for Surgical Residents',
          'GMC: Outcomes for Graduates',
          'Royal College of Surgeons: Surgical Training Standards',
          'ACGME: Core Competencies for Residents'
        ],
        selfAssessment: [
          {
            id: 'ho-11-1-q1',
            question: 'Which component is LEAST likely to strengthen a residency application?',
            options: [
              'Strong consultant references',
              'Demonstrated commitment to surgery',
              'Research publications',
              'Long working hours logged'
            ],
            correctAnswer: 3,
            explanation: 'Quality of experience matters more than quantity. Long hours don\'t demonstrate learning or development. References, commitment, and academic engagement are more valued.'
          }
        ]
      }
    }
  ]
};

HOUSE_OFFICER_MODULES.push(HO_MODULE_8, HO_MODULE_9, HO_MODULE_10, HO_MODULE_11);

// ==================== JUNIOR RESIDENT CME MODULES ====================

const JR_MODULE_1: CMEModule = {
  id: 'jr-module-1',
  title: 'Section 1: General Principles of Surgery',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-1-1',
      moduleId: 'jr-module-1',
      title: 'Surgical Physiology and Metabolic Response to Trauma',
      article: {
        title: 'Surgical Physiology and Metabolic Response to Trauma',
        overview: 'Understanding the body\'s physiological response to surgical stress and trauma is fundamental to managing surgical patients. The metabolic response to injury involves complex neuroendocrine, immunological, and inflammatory cascades that profoundly affect patient outcomes.',
        learningObjectives: [
          'Describe the phases of metabolic response to surgical trauma',
          'Explain the neuroendocrine response to injury',
          'Understand the immunological consequences of surgery',
          'Apply physiological principles to perioperative care',
          'Recognize pathological responses and their management'
        ],
        sections: [
          {
            title: 'The Ebb and Flow Phases of Trauma Response',
            content: 'Sir David Cuthbertson described two phases of metabolic response: the Ebb phase (acute, 24-48 hours) characterized by decreased metabolic rate, hypothermia, and cardiovascular instability; and the Flow phase (days to weeks) marked by hypermetabolism, catabolism, and increased oxygen consumption.',
            subsections: [
              {
                title: 'Ebb Phase Characteristics',
                content: 'Hypovolaemia, reduced cardiac output, decreased tissue perfusion, hypothermia, insulin resistance, and elevated blood glucose. Priority: resuscitation and hemodynamic stabilization.'
              },
              {
                title: 'Flow Phase Characteristics',
                content: 'Hyperdynamic circulation, increased cardiac output, oxygen consumption rises 20-50%, protein catabolism (muscle wasting), lipolysis, gluconeogenesis, and negative nitrogen balance. This phase can persist for weeks in major trauma.'
              }
            ]
          },
          {
            title: 'Neuroendocrine Response',
            content: 'The hypothalamic-pituitary-adrenal (HPA) axis activation drives the stress response. Afferent signals from the wound trigger hypothalamic release of CRH, leading to ACTH release and cortisol secretion. Sympathetic activation causes catecholamine surge.',
            subsections: [
              {
                title: 'Hormonal Changes',
                content: 'Cortisol: promotes gluconeogenesis, protein catabolism, immunomodulation. Catecholamines: tachycardia, vasoconstriction, glycogenolysis. Growth hormone: lipolysis, insulin resistance. ADH: water retention. Aldosterone: sodium retention. Glucagon: elevated. Insulin: resistance despite elevated levels.'
              },
              {
                title: 'Clinical Implications',
                content: 'Post-operative hyperglycemia requires monitoring and may need insulin. Salt and water retention leads to oliguria—don\'t overload with fluids. Protein catabolism necessitates nutritional support.'
              }
            ]
          },
          {
            title: 'Inflammatory and Immune Response',
            content: 'Surgery triggers both local and systemic inflammatory responses. Pro-inflammatory cytokines (IL-1, IL-6, TNF-α) are released from the wound. The acute phase response leads to hepatic synthesis of acute phase proteins (CRP, fibrinogen, complement).',
            subsections: [
              {
                title: 'SIRS and Immunosuppression',
                content: 'Major surgery can induce Systemic Inflammatory Response Syndrome (SIRS). Paradoxically, surgery also causes transient immunosuppression with reduced lymphocyte function, making patients susceptible to infection. The balance between inflammation and immunosuppression determines outcome.'
              },
              {
                title: 'Modulating the Response',
                content: 'Enhanced Recovery After Surgery (ERAS) protocols minimize the stress response through: epidural anesthesia (blocks afferent signals), minimally invasive surgery, normothermia, early feeding, and multimodal analgesia.'
              }
            ]
          },
          {
            title: 'Fluid and Electrolyte Changes',
            content: 'Third-spacing of fluid into the extravascular space occurs post-operatively. ADH and aldosterone cause sodium and water retention. Potassium may shift intracellularly. Understanding these changes prevents both under- and over-resuscitation.',
            subsections: [
              {
                title: 'Fluid Management Principles',
                content: 'Day 0-1: Restrict to maintenance + losses. Day 2-3: Third space mobilization—watch for fluid overload. Avoid chloride-rich fluids (0.9% saline) to prevent hyperchloremic acidosis. Balanced crystalloids preferred.'
              }
            ]
          }
        ],
        keyPoints: [
          'Ebb phase (24-48h): hypometabolic, resuscitation priority',
          'Flow phase (days-weeks): hypermetabolic, catabolic, nutritional support needed',
          'Cortisol and catecholamines drive the stress response',
          'Post-operative hyperglycemia is common and should be monitored',
          'Salt and water retention is physiological—avoid fluid overload',
          'ERAS protocols minimize the metabolic stress response',
          'Balance between inflammation and immunosuppression affects infection risk'
        ],
        examTips: [
          'Cuthbertson\'s Ebb and Flow phases are exam favorites',
          'Know the hormonal changes and their clinical effects',
          'Understand why ERAS protocols work physiologically',
          'Link metabolic response to nutritional requirements'
        ],
        clinicalPearls: [
          'Oliguria post-operatively is often appropriate ADH response—not always hypovolemia',
          'Day 2-3 diuresis signals third-space mobilization—reduce IV fluids',
          'Hyperglycemia >10 mmol/L associated with worse outcomes—control it',
          'Fever in first 48h often cytokine-mediated, not infection'
        ],
        commonMistakes: [
          'Over-resuscitating based on urine output alone',
          'Ignoring post-operative hyperglycemia',
          'Excessive saline causing hyperchloremic acidosis',
          'Assuming all post-op fever is infection'
        ],
        references: [
          'Desborough JP. The stress response to trauma and surgery. Br J Anaesth 2000',
          'Kehlet H. Multimodal approach to control postoperative pathophysiology. Br J Anaesth 1997',
          'Lassen K et al. ERAS Guidelines for perioperative care. World J Surg 2009',
          'Cuthbertson DP. Post-traumatic metabolism. Br Med Bull 1954'
        ],
        selfAssessment: [
          {
            id: 'jr-1-1-q1',
            question: 'Which hormone is responsible for the protein catabolism seen in the Flow phase?',
            options: [
              'Insulin',
              'Cortisol',
              'Growth hormone',
              'Glucagon'
            ],
            correctAnswer: 1,
            explanation: 'Cortisol is the primary catabolic hormone, promoting breakdown of muscle protein to provide amino acids for gluconeogenesis and acute phase protein synthesis.'
          },
          {
            id: 'jr-1-1-q2',
            question: 'What characterizes the Ebb phase of metabolic response?',
            options: [
              'Hypermetabolism and increased cardiac output',
              'Hypometabolism and reduced tissue perfusion',
              'Positive nitrogen balance',
              'Decreased cortisol levels'
            ],
            correctAnswer: 1,
            explanation: 'The Ebb phase (first 24-48h) is characterized by hypometabolism, reduced cardiac output, hypothermia, and decreased tissue perfusion. The hypermetabolic Flow phase follows.'
          }
        ]
      }
    },
    {
      id: 'jr-1-2',
      moduleId: 'jr-module-1',
      title: 'Shock: Classification, Pathophysiology, and Management',
      article: {
        title: 'Shock: Classification, Pathophysiology, and Management',
        overview: 'Shock is a life-threatening condition of circulatory failure resulting in inadequate tissue perfusion and cellular oxygen delivery. Early recognition and appropriate management are essential for survival. The surgical resident must be proficient in diagnosing and treating all types of shock.',
        learningObjectives: [
          'Define shock and understand its cellular pathophysiology',
          'Classify shock into its major categories',
          'Recognize clinical features of different shock types',
          'Apply evidence-based resuscitation principles',
          'Understand the role of vasopressors and inotropes'
        ],
        sections: [
          {
            title: 'Pathophysiology of Shock',
            content: 'At the cellular level, shock results in inadequate oxygen delivery to meet metabolic demands. Cells switch to anaerobic metabolism, producing lactate. ATP depletion leads to failure of membrane ion pumps, cellular swelling, and ultimately cell death. Prolonged shock causes irreversible organ damage.',
            subsections: [
              {
                title: 'Oxygen Delivery Equation',
                content: 'DO2 = CO × CaO2 = CO × (1.34 × Hb × SaO2 + 0.003 × PaO2). Oxygen delivery depends on cardiac output and arterial oxygen content. Shock impairs DO2 through reduced CO, anemia, or hypoxemia.'
              },
              {
                title: 'Compensatory Mechanisms',
                content: 'Sympathetic activation: tachycardia, vasoconstriction, increased contractility. RAAS activation: sodium and water retention. ADH release: water retention. These maintain perfusion to vital organs initially but fail in decompensated shock.'
              }
            ]
          },
          {
            title: 'Classification of Shock',
            content: 'Shock is classified by etiology into four main categories: Hypovolemic (loss of circulating volume), Cardiogenic (pump failure), Distributive (abnormal vascular resistance), and Obstructive (mechanical obstruction to blood flow).',
            subsections: [
              {
                title: 'Hypovolemic Shock',
                content: 'Causes: Hemorrhage (Class I-IV based on blood loss), dehydration, burns. Features: Tachycardia, hypotension, cold extremities, reduced urine output. Treatment: Volume replacement—crystalloid, blood products for hemorrhage.'
              },
              {
                title: 'Cardiogenic Shock',
                content: 'Causes: Myocardial infarction, arrhythmias, cardiomyopathy, valvular disease. Features: Hypotension with elevated JVP, pulmonary edema. Treatment: Inotropes, treat underlying cause, avoid fluid overload.'
              },
              {
                title: 'Distributive Shock',
                content: 'Causes: Sepsis (most common), anaphylaxis, neurogenic, adrenal crisis. Features: Warm peripheries (initially in sepsis), bounding pulse, low SVR. Treatment: Fluids initially, then vasopressors (norepinephrine first-line in sepsis).'
              },
              {
                title: 'Obstructive Shock',
                content: 'Causes: Tension pneumothorax, cardiac tamponade, massive PE. Features: Elevated JVP, pulsus paradoxus (tamponade), absent breath sounds (pneumothorax). Treatment: Immediate relief of obstruction—needle decompression, pericardiocentesis, thrombolysis.'
              }
            ]
          },
          {
            title: 'Clinical Assessment',
            content: 'Recognition of shock requires integration of clinical signs: mental status changes, tachycardia (may be absent in beta-blocked patients), hypotension (late sign), tachypnea, oliguria, mottled skin, prolonged capillary refill, and elevated lactate.',
            subsections: [
              {
                title: 'Hemorrhagic Shock Classification (ATLS)',
                content: 'Class I (<15% loss): minimal changes. Class II (15-30%): tachycardia, narrowed pulse pressure. Class III (30-40%): hypotension, tachycardia >120, confusion. Class IV (>40%): profound hypotension, obtunded, life-threatening.'
              },
              {
                title: 'Shock Index',
                content: 'Heart rate ÷ Systolic BP. Normal <0.7. SI >1.0 indicates significant shock. Useful for early detection when vital signs are compensated.'
              }
            ]
          },
          {
            title: 'Resuscitation Principles',
            content: 'Systematic approach: Secure airway, provide oxygen, obtain IV access, give fluids appropriately, monitor response. Goal-directed resuscitation targets: MAP >65 mmHg, urine output >0.5 mL/kg/hr, lactate clearance.',
            subsections: [
              {
                title: 'Fluid Resuscitation',
                content: 'Crystalloids (Hartmann\'s/LR preferred over saline). Initial bolus 250-500mL, reassess. Avoid over-resuscitation—target is not normal BP but adequate perfusion. Permissive hypotension in uncontrolled hemorrhage (SBP 80-90).'
              },
              {
                title: 'Blood Products',
                content: 'Massive transfusion protocol: 1:1:1 ratio (PRBC:FFP:Platelets). Tranexamic acid within 3 hours of injury. Calcium replacement (citrate toxicity). Target Hb 7-9 g/dL in most patients.'
              },
              {
                title: 'Vasopressors and Inotropes',
                content: 'Norepinephrine: first-line vasopressor in septic shock. Vasopressin: add to norepinephrine if refractory. Dobutamine: add if poor cardiac output despite volume. Epinephrine: anaphylaxis, cardiac arrest.'
              }
            ]
          }
        ],
        keyPoints: [
          'Shock = inadequate tissue oxygen delivery causing cellular hypoxia',
          'Four types: Hypovolemic, Cardiogenic, Distributive, Obstructive',
          'Tachycardia often precedes hypotension—don\'t wait for BP drop',
          'Lactate is a marker of tissue hypoperfusion',
          'Norepinephrine is first-line vasopressor in septic shock',
          'Permissive hypotension in uncontrolled hemorrhage',
          'Massive transfusion: 1:1:1 ratio with TXA'
        ],
        examTips: [
          'Know ATLS hemorrhage classification and expected findings',
          'Understand shock index calculation and interpretation',
          'Know first-line vasopressors for each shock type',
          'Tranexamic acid must be given within 3 hours'
        ],
        clinicalPearls: [
          'Young patients compensate well—decompensation is sudden and late',
          'Elderly and beta-blocked patients may not mount tachycardia',
          'Warm shock (sepsis) can look deceptively well initially',
          'JVP elevation helps differentiate cardiogenic/obstructive from hypovolemic'
        ],
        commonMistakes: [
          'Waiting for hypotension to diagnose shock',
          'Giving excessive crystalloid in hemorrhage without blood',
          'Using dopamine (inferior to norepinephrine)',
          'Forgetting to treat the underlying cause'
        ],
        references: [
          'ATLS: Advanced Trauma Life Support, 10th Edition',
          'Surviving Sepsis Campaign Guidelines 2021',
          'CRASH-2 Trial: Tranexamic acid in trauma',
          'Vincent JL, De Backer D. Circulatory Shock. NEJM 2013'
        ],
        selfAssessment: [
          {
            id: 'jr-1-2-q1',
            question: 'A trauma patient has HR 130, BP 80/60, confused, and cold extremities. What class of hemorrhagic shock is this?',
            options: [
              'Class I',
              'Class II',
              'Class III',
              'Class IV'
            ],
            correctAnswer: 2,
            explanation: 'Class III shock (30-40% blood loss) presents with tachycardia >120, hypotension, confusion, and cold peripheries. Class IV would show profound hypotension and obtundation.'
          },
          {
            id: 'jr-1-2-q2',
            question: 'What is the first-line vasopressor for septic shock after adequate fluid resuscitation?',
            options: [
              'Dopamine',
              'Epinephrine',
              'Norepinephrine',
              'Dobutamine'
            ],
            correctAnswer: 2,
            explanation: 'Norepinephrine is the first-line vasopressor in septic shock per Surviving Sepsis guidelines. It provides alpha-adrenergic vasoconstriction with some beta-1 effects.'
          }
        ]
      }
    },
    {
      id: 'jr-1-3',
      moduleId: 'jr-module-1',
      title: 'Fluid and Electrolyte Management',
      article: {
        title: 'Fluid and Electrolyte Management',
        overview: 'Mastery of fluid and electrolyte management is essential for the surgical resident. Disorders are common in surgical patients due to losses, shifts, and iatrogenic causes. A systematic approach prevents complications from both under- and over-treatment.',
        learningObjectives: [
          'Understand normal fluid and electrolyte physiology',
          'Calculate maintenance fluid requirements',
          'Recognize and treat common electrolyte disorders',
          'Apply principles of fluid resuscitation',
          'Understand acid-base balance and its disturbances'
        ],
        sections: [
          {
            title: 'Body Fluid Compartments',
            content: 'Total body water (TBW) is approximately 60% of body weight in men, 55% in women. Distributed as: Intracellular (ICF) 40% and Extracellular (ECF) 20%. ECF comprises Interstitial (15%) and Intravascular (5%, plasma volume).',
            subsections: [
              {
                title: 'Fluid Movement',
                content: 'Starling forces govern fluid movement across capillaries. Crystalloids distribute across ECF. Colloids remain intravascular longer. Sodium determines ECF volume; water follows sodium.'
              }
            ]
          },
          {
            title: 'Maintenance Fluid Requirements',
            content: 'Daily requirements: Water 25-30 mL/kg/day, Sodium 1 mmol/kg/day, Potassium 1 mmol/kg/day. Holliday-Segar formula (for children/weight-based): 4 mL/kg/hr for first 10kg, 2 mL/kg/hr for next 10kg, 1 mL/kg/hr thereafter.',
            subsections: [
              {
                title: 'Choice of Maintenance Fluid',
                content: 'Balanced crystalloids preferred (Hartmann\'s, Plasmalyte). 0.9% saline causes hyperchloremic acidosis if used in volume. Dextrose-containing fluids for maintenance in patients nil by mouth. 5% dextrose is essentially free water.'
              },
              {
                title: 'Assessing Fluid Status',
                content: 'Clinical: JVP, skin turgor, mucous membranes, peripheral edema, lung crepitations. Urine output (>0.5 mL/kg/hr). Weight changes. Labs: Urea, creatinine, hematocrit (hemoconcentration suggests dehydration).'
              }
            ]
          },
          {
            title: 'Sodium Disorders',
            content: 'Sodium is the primary determinant of serum osmolality. Disorders reflect water balance more than sodium balance.',
            subsections: [
              {
                title: 'Hyponatremia',
                content: 'Na <135 mmol/L. Causes: SIADH (post-op, CNS, pulmonary), excess hypotonic fluids, heart failure, cirrhosis. Symptoms: Confusion, seizures, coma (severe <120). Treatment: Fluid restriction (SIADH), or saline if volume depleted. Correct slowly (<10 mmol/24hr) to prevent osmotic demyelination.'
              },
              {
                title: 'Hypernatremia',
                content: 'Na >145 mmol/L. Usually indicates free water deficit. Causes: Inadequate water intake, diabetes insipidus, osmotic diuresis. Treatment: Free water replacement (oral, D5W, or hypotonic saline). Correct slowly to prevent cerebral edema.'
              }
            ]
          },
          {
            title: 'Potassium Disorders',
            content: 'Potassium is the major intracellular cation. Serum K+ is tightly regulated (3.5-5.0 mmol/L). Small changes have major cardiac effects.',
            subsections: [
              {
                title: 'Hypokalemia',
                content: 'K <3.5 mmol/L. Causes: GI losses (vomiting, diarrhea, NG drainage), diuretics, alkalosis, insulin, refeeding. ECG: U waves, flattened T waves, ST depression. Treatment: Oral preferred if mild. IV KCl max 10 mmol/hr peripheral, 20 mmol/hr central, with monitoring.'
              },
              {
                title: 'Hyperkalemia',
                content: 'K >5.5 mmol/L. Emergency if >6.5 or ECG changes. Causes: Renal failure, acidosis, cell lysis, ACE inhibitors. ECG: Tall peaked T waves, wide QRS, sine wave (pre-arrest). Treatment: Cardiac protection (calcium gluconate), shift K+ intracellularly (insulin-dextrose, salbutamol), eliminate K+ (furosemide, dialysis).'
              }
            ]
          },
          {
            title: 'Acid-Base Balance',
            content: 'pH is maintained 7.35-7.45 by buffers (bicarbonate, proteins), respiratory compensation (CO2), and renal compensation (H+, HCO3-). Use Henderson-Hasselbalch or Stewart approach.',
            subsections: [
              {
                title: 'Metabolic Acidosis',
                content: 'Low pH, low HCO3-. Calculate anion gap: Na - (Cl + HCO3-), normal 8-12. High AG: MUDPILES (Methanol, Uremia, DKA, Propylene glycol, Isoniazid/Iron, Lactic acidosis, Ethylene glycol, Salicylates). Normal AG: GI bicarbonate loss, RTA, saline excess.'
              },
              {
                title: 'Metabolic Alkalosis',
                content: 'High pH, high HCO3-. Causes: Vomiting/NG losses, diuretics, hypokalaemia. Treatment: Address underlying cause, saline if chloride-responsive, potassium replacement.'
              }
            ]
          }
        ],
        keyPoints: [
          'TBW 60% body weight: ICF 40%, ECF 20%',
          'Maintenance: 25-30 mL/kg/day water, 1 mmol/kg/day Na and K',
          'Balanced crystalloids preferred over 0.9% saline',
          'Hyponatremia: correct slowly <10 mmol/24hr',
          'Hyperkalemia with ECG changes is an emergency',
          'Anion gap helps classify metabolic acidosis',
          'Treat the cause, not just the number'
        ],
        examTips: [
          'Memorize Holliday-Segar formula for fluid calculations',
          'Know ECG changes of potassium disorders',
          'MUDPILES mnemonic for high anion gap acidosis',
          'Understand compensation patterns in acid-base disorders'
        ],
        clinicalPearls: [
          'Post-operative oliguria is often ADH response, not hypovolemia',
          'Check K+ before giving insulin—it will drop further',
          'Saline infusion causes hyperchloremic acidosis',
          'Correct Mg deficiency to effectively treat resistant hypokalemia'
        ],
        commonMistakes: [
          'Correcting hyponatremia too rapidly',
          'Giving K+ too fast IV (cardiac arrest risk)',
          'Using 0.9% saline for all resuscitation',
          'Ignoring acid-base status when interpreting electrolytes'
        ],
        references: [
          'NICE: Intravenous Fluid Therapy in Adults in Hospital (CG174)',
          'Myburgh JA, Mythen MG. Resuscitation Fluids. NEJM 2013',
          'Seifter JL. Integration of acid-base and electrolyte disorders. NEJM 2014',
          'Kellum JA. Fluid Resuscitation and Hyperchloremic Acidosis. Chest 2002'
        ],
        selfAssessment: [
          {
            id: 'jr-1-3-q1',
            question: 'A patient has Na+ 118 mmol/L with confusion. What is the maximum safe correction rate?',
            options: [
              '5 mmol/24hr',
              '10 mmol/24hr',
              '15 mmol/24hr',
              '20 mmol/24hr'
            ],
            correctAnswer: 1,
            explanation: 'Correction should not exceed 10 mmol/L in 24 hours to prevent osmotic demyelination syndrome (central pontine myelinolysis). Slower is safer in chronic hyponatremia.'
          },
          {
            id: 'jr-1-3-q2',
            question: 'Which ECG finding indicates hyperkalemia requiring immediate treatment?',
            options: [
              'U waves',
              'Prolonged QT',
              'Peaked T waves with wide QRS',
              'ST elevation'
            ],
            correctAnswer: 2,
            explanation: 'Peaked T waves with widening QRS complex indicates severe hyperkalemia requiring immediate treatment with calcium gluconate for cardiac membrane stabilization.'
          }
        ]
      }
    }
  ]
};

const JR_MODULE_2: CMEModule = {
  id: 'jr-module-2',
  title: 'Section 2: Trauma and Emergency Surgery',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-2-1',
      moduleId: 'jr-module-2',
      title: 'Primary and Secondary Survey in Trauma',
      article: {
        title: 'Primary and Secondary Survey in Trauma',
        overview: 'The systematic approach to trauma assessment saves lives. The ATLS framework provides a structured method to identify and treat life-threatening injuries in order of priority. Every surgical resident must be proficient in conducting primary and secondary surveys.',
        learningObjectives: [
          'Conduct a systematic primary survey (ABCDE)',
          'Recognize and treat immediately life-threatening conditions',
          'Perform a comprehensive secondary survey',
          'Understand adjuncts to the primary and secondary surveys',
          'Know indications for definitive care and transfer'
        ],
        sections: [
          {
            title: 'Primary Survey: ABCDE',
            content: 'The primary survey identifies and treats life-threatening injuries simultaneously. Progress to the next step only when the current one is addressed. Always return to A if the patient deteriorates.',
            subsections: [
              {
                title: 'A - Airway with C-Spine Protection',
                content: 'Assess: Is the patient talking? Stridor? Gurgling? Look for foreign bodies, facial/neck injuries. Interventions: Jaw thrust, suction, oropharyngeal/nasopharyngeal airway, intubation, surgical airway. Maintain cervical spine immobilization until cleared.'
              },
              {
                title: 'B - Breathing and Ventilation',
                content: 'Look, Listen, Feel. Assess: respiratory rate, chest expansion, oxygen saturation, breath sounds. Life-threatening injuries: Tension pneumothorax, open pneumothorax, massive hemothorax, flail chest. Interventions: High-flow O2, needle decompression, chest drain, intubation.'
              },
              {
                title: 'C - Circulation with Hemorrhage Control',
                content: 'Assess: Pulse, blood pressure, capillary refill, skin color, obvious bleeding. Control external hemorrhage: Direct pressure, tourniquets, pelvic binder. Two large-bore IV access. Warm crystalloid bolus. Blood products if in shock. FAST scan.'
              },
              {
                title: 'D - Disability (Neurological)',
                content: 'Assess: AVPU or GCS, pupil size and reactivity, lateralizing signs. Hypoglycemia check. Identify severe head injury requiring immediate intervention.'
              },
              {
                title: 'E - Exposure and Environmental Control',
                content: 'Fully undress the patient to identify all injuries. Log roll for posterior examination. Prevent hypothermia with warm blankets, warm fluids, warm environment. Hypothermia worsens coagulopathy.'
              }
            ]
          },
          {
            title: 'Adjuncts to Primary Survey',
            content: 'After initial ABCDE, adjuncts provide additional critical information.',
            subsections: [
              {
                title: 'Monitoring',
                content: 'ECG, SpO2, end-tidal CO2 (if intubated), blood pressure. Urinary catheter (contraindicated if urethral injury suspected). Gastric tube (orogastric if facial fractures).'
              },
              {
                title: 'Investigations',
                content: 'Blood gas with lactate. Bloods: FBC, coagulation, crossmatch, glucose. Chest X-ray. Pelvis X-ray. FAST (Focused Assessment with Sonography for Trauma): detects free fluid in abdomen and pericardium.'
              }
            ]
          },
          {
            title: 'Secondary Survey',
            content: 'A complete head-to-toe examination performed after the patient is stabilized. Includes AMPLE history: Allergies, Medications, Past medical history, Last meal, Events leading to injury.',
            subsections: [
              {
                title: 'Systematic Examination',
                content: 'Head: Scalp lacerations, Battle\'s sign, raccoon eyes, hemotympanum. Face: Fractures, dental injury. Neck: Cervical spine, vessels, larynx. Chest: Palpate ribs, sternum, clavicles. Abdomen: Inspection, palpation, DRE. Pelvis: Compression test (once only). Extremities: Fractures, pulses, soft tissue. Back: Log roll examination.'
              },
              {
                title: 'Special Investigations',
                content: 'CT scan (head, cervical spine, chest, abdomen, pelvis) once stable. Angiography for vascular injuries. Focused imaging based on examination findings.'
              }
            ]
          },
          {
            title: 'Definitive Care and Transfer',
            content: 'Determine need for operative intervention, embolization, or transfer to higher level of care. Damage control surgery may be appropriate for unstable patients.',
            subsections: [
              {
                title: 'Damage Control Principles',
                content: 'In severely injured patients with the lethal triad (hypothermia, acidosis, coagulopathy), abbreviated surgery to control hemorrhage and contamination, then ICU resuscitation before definitive repair.'
              }
            ]
          }
        ],
        keyPoints: [
          'Primary survey: ABCDE with simultaneous resuscitation',
          'Always return to A if the patient deteriorates',
          'Control external hemorrhage immediately',
          'Prevent and treat the lethal triad',
          'FAST scan detects free fluid—not solid organ injury detail',
          'Secondary survey only after patient is stabilized',
          'Damage control surgery for unstable patients'
        ],
        examTips: [
          'Know the order of ABCDE and what belongs to each',
          'Life-threatening chest injuries: tension PTX, open PTX, massive hemothorax, flail chest, cardiac tamponade',
          'FAST: four windows (RUQ, LUQ, subxiphoid, suprapubic)',
          'AMPLE history is an exam favorite'
        ],
        clinicalPearls: [
          'A talking patient has an airway—don\'t get complacent, reassess',
          'Absent breath sounds + tracheal deviation + hypotension = tension PTX—decompress, don\'t wait for CXR',
          'Pelvic binder before X-ray if high-energy mechanism',
          'Hypothermia kills—keep the patient warm throughout'
        ],
        commonMistakes: [
          'Getting distracted by dramatic injuries before ABCDE',
          'Ordering CT on an unstable patient',
          'Multiple pelvic manipulation tests (worsens bleeding)',
          'Forgetting to log roll for back examination'
        ],
        references: [
          'ATLS: Advanced Trauma Life Support, 10th Edition',
          'Trauma Victoria: Clinical Practice Guidelines',
          'Scalea TM et al. Damage Control Surgery. Crit Care Clin 2017',
          'Holcomb JB et al. Damage Control Resuscitation. J Trauma 2007'
        ],
        selfAssessment: [
          {
            id: 'jr-2-1-q1',
            question: 'During primary survey, you find absent breath sounds on the left with tracheal deviation to the right. The patient is hypotensive. What is the next step?',
            options: [
              'Order chest X-ray',
              'Immediate needle decompression',
              'Insert chest drain',
              'CT chest'
            ],
            correctAnswer: 1,
            explanation: 'This is tension pneumothorax—a clinical diagnosis requiring immediate needle decompression (2nd intercostal space, midclavicular line). Do not delay for imaging.'
          },
          {
            id: 'jr-2-1-q2',
            question: 'What does FAST ultrasound detect in trauma?',
            options: [
              'Solid organ laceration grade',
              'Free fluid in abdomen and pericardium',
              'Pneumothorax only',
              'Spinal cord injury'
            ],
            correctAnswer: 1,
            explanation: 'FAST (Focused Assessment with Sonography for Trauma) detects free fluid in the hepatorenal space (Morrison\'s), splenorenal space, pelvis, and pericardium. It does not grade solid organ injuries.'
          }
        ]
      }
    },
    {
      id: 'jr-2-2',
      moduleId: 'jr-module-2',
      title: 'Damage Control Surgery and Resuscitation',
      article: {
        title: 'Damage Control Surgery and Resuscitation',
        overview: 'Damage Control Surgery (DCS) is a staged approach to managing severely injured patients who cannot tolerate definitive repair. By abbreviating initial surgery and focusing on physiology restoration, survival improves. Damage Control Resuscitation (DCR) accompanies this strategy.',
        learningObjectives: [
          'Define damage control surgery and its indications',
          'Understand the lethal triad and its significance',
          'Describe the three phases of damage control',
          'Apply principles of damage control resuscitation',
          'Know techniques for hemorrhage and contamination control'
        ],
        sections: [
          {
            title: 'The Lethal Triad',
            content: 'Hypothermia, acidosis, and coagulopathy form a self-perpetuating cycle in severe trauma. Each worsens the others. Breaking this cycle is the goal of damage control.',
            subsections: [
              {
                title: 'Hypothermia',
                content: 'Core temp <35°C impairs coagulation, increases blood loss, causes cardiac irritability. Trauma patients lose heat rapidly through exposure, cold fluids, and open body cavities. Prevention is easier than treatment.'
              },
              {
                title: 'Acidosis',
                content: 'Lactic acidosis from tissue hypoperfusion. pH <7.2 impairs enzyme function, coagulation factors, and myocardial contractility. Base deficit correlates with injury severity and mortality.'
              },
              {
                title: 'Coagulopathy',
                content: 'Acute Traumatic Coagulopathy (ATC) begins within minutes of injury. Dilutional coagulopathy from crystalloid resuscitation. Hypothermia inhibits clotting cascade. Acidosis impairs coagulation factor function. Consumption of clotting factors.'
              }
            ]
          },
          {
            title: 'Phases of Damage Control',
            content: 'DCS has three distinct phases: (1) Abbreviated surgical intervention, (2) ICU resuscitation, (3) Definitive repair.',
            subsections: [
              {
                title: 'Phase 1: Abbreviated Surgery',
                content: 'Control hemorrhage (packing, ligation, shunts). Control contamination (stapled resection, closed drains, no anastomosis). Temporary abdominal closure. Goal: Operating time <60-90 minutes.'
              },
              {
                title: 'Phase 2: ICU Resuscitation',
                content: 'Rewarm (target >36°C). Correct coagulopathy (blood products, TXA, calcium). Correct acidosis (restore perfusion). Optimize ventilation. Monitor for abdominal compartment syndrome.'
              },
              {
                title: 'Phase 3: Definitive Repair',
                content: 'Return to OR when physiology normalized (typically 24-72 hours). Remove packing, repair injuries definitively. Create anastomoses, close fascia if possible.'
              }
            ]
          },
          {
            title: 'Damage Control Resuscitation',
            content: 'Resuscitation strategy paralleling DCS to prevent and treat the lethal triad.',
            subsections: [
              {
                title: 'Permissive Hypotension',
                content: 'Accept lower BP (SBP 80-90 mmHg) until surgical hemorrhage control. Aggressive fluid resuscitation before hemorrhage control increases bleeding. Exception: Traumatic brain injury (needs higher MAP).'
              },
              {
                title: 'Hemostatic Resuscitation',
                content: 'Minimize crystalloid. Early blood products in 1:1:1 ratio (RBC:FFP:Platelets). Tranexamic acid within 3 hours. Massive Transfusion Protocol activation when anticipated need >10 units.'
              },
              {
                title: 'Point-of-Care Testing',
                content: 'TEG/ROTEM guides blood product administration. Faster than conventional coagulation tests. Identifies specific deficits (fibrinogen, platelets, factor deficiency).'
              }
            ]
          },
          {
            title: 'Techniques for Hemorrhage Control',
            content: 'Various techniques for temporary hemorrhage control during DCS.',
            subsections: [
              {
                title: 'Packing',
                content: 'Perihepatic packing for liver injuries. Pelvic packing for pelvic fractures. Leave packs in place for 24-48 hours. Anticipate re-exploration.'
              },
              {
                title: 'Shunts',
                content: 'Temporary intravascular shunts for major vessel injuries. Allows limb perfusion until definitive repair. Can be left for 24-48 hours.'
              },
              {
                title: 'Other Techniques',
                content: 'Ligation of non-critical vessels. Resection without anastomosis (stapled ends). REBOA (Resuscitative Endovascular Balloon Occlusion of Aorta) as bridge to surgery. Interventional radiology embolization.'
              }
            ]
          }
        ],
        keyPoints: [
          'Lethal triad: Hypothermia + Acidosis + Coagulopathy',
          'DCS: Abbreviated surgery → ICU resuscitation → Definitive repair',
          'Goal of phase 1: Control hemorrhage and contamination <60-90 min',
          'Permissive hypotension until hemorrhage controlled',
          'Hemostatic resuscitation: 1:1:1, minimize crystalloid',
          'TXA within 3 hours of injury',
          'Temporary abdominal closure prevents compartment syndrome'
        ],
        examTips: [
          'Know the components and interactions of the lethal triad',
          'Understand indications for damage control approach',
          'Know massive transfusion protocol ratios',
          'Exception to permissive hypotension: TBI'
        ],
        clinicalPearls: [
          'The enemy is physiology, not anatomy—correct the triad',
          'The OR is the most hypothermic place—warm the room',
          'Don\'t chase normal BP with crystalloid—you\'ll dilute clotting factors',
          'Lactate clearance is the best marker of resuscitation'
        ],
        commonMistakes: [
          'Attempting definitive repair in a coagulopathic patient',
          'Excessive crystalloid resuscitation',
          'Giving TXA too late (>3 hours)',
          'Closing fascia over swollen bowel (compartment syndrome)'
        ],
        references: [
          'Rotondo MF, Schwab CW. Damage control. In: Trauma, 3rd ed',
          'Holcomb JB et al. PROPPR trial. JAMA 2015',
          'CRASH-2 Collaborators. TXA in trauma. Lancet 2010',
          'Cotton BA et al. Damage Control Resuscitation. Curr Opin Crit Care 2009'
        ],
        selfAssessment: [
          {
            id: 'jr-2-2-q1',
            question: 'Which of the following is NOT part of the lethal triad?',
            options: [
              'Hypothermia',
              'Acidosis',
              'Hypotension',
              'Coagulopathy'
            ],
            correctAnswer: 2,
            explanation: 'The lethal triad consists of hypothermia, acidosis, and coagulopathy. Hypotension is a consequence but not part of the triad itself.'
          },
          {
            id: 'jr-2-2-q2',
            question: 'In damage control resuscitation, what is the target ratio for blood product administration?',
            options: [
              '3:1:1 (RBC:FFP:Platelets)',
              '1:1:1 (RBC:FFP:Platelets)',
              '2:1:1 (RBC:FFP:Platelets)',
              'RBCs only until bleeding stops'
            ],
            correctAnswer: 1,
            explanation: 'The PROPPR trial established 1:1:1 ratio of packed red cells, fresh frozen plasma, and platelets as optimal for massive transfusion in trauma.'
          }
        ]
      }
    }
  ]
};

export const JUNIOR_RESIDENT_MODULES: CMEModule[] = [JR_MODULE_1, JR_MODULE_2];

const JR_MODULE_3: CMEModule = {
  id: 'jr-module-3',
  title: 'Section 3: Burns Surgery',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-3-1',
      moduleId: 'jr-module-3',
      title: 'Burns Assessment and Resuscitation',
      article: {
        title: 'Burns Assessment and Resuscitation',
        overview: 'Major burns cause both local tissue injury and a profound systemic response. Early, accurate assessment and appropriate fluid resuscitation are critical determinants of survival. The junior resident must be able to estimate burn size, depth, and initiate resuscitation protocols.',
        learningObjectives: [
          'Accurately estimate total body surface area (TBSA) burned',
          'Classify burn depth and understand healing implications',
          'Apply fluid resuscitation formulas correctly',
          'Recognize and manage inhalational injury',
          'Understand criteria for burn center referral'
        ],
        sections: [
          {
            title: 'Burn Size Estimation',
            content: 'Accurate TBSA estimation is essential for fluid resuscitation and determines referral criteria. Only partial and full thickness burns are included—superficial burns (erythema only) are excluded.',
            subsections: [
              {
                title: 'Rule of Nines (Wallace)',
                content: 'Adults: Head 9%, each arm 9%, anterior trunk 18%, posterior trunk 18%, each leg 18%, perineum 1%. Children: Head larger proportion (18% in infant), legs smaller. Quick estimation method.'
              },
              {
                title: 'Lund and Browder Chart',
                content: 'More accurate, especially for children. Accounts for age-related body proportion changes. Head: 19% at birth, decreasing to 7% in adults. Legs: 13% at birth, increasing to 18% in adults. Should be used for definitive assessment.'
              },
              {
                title: 'Palm Method',
                content: 'Patient\'s palm (including fingers) ≈ 1% TBSA. Useful for scattered or patchy burns. Helpful for small burns or to estimate unburned areas in large burns.'
              }
            ]
          },
          {
            title: 'Burn Depth Classification',
            content: 'Burn depth determines healing potential, need for surgery, and scarring risk.',
            subsections: [
              {
                title: 'Superficial (Epidermal)',
                content: 'Epidermis only. Red, dry, painful, blanches. Example: sunburn. Heals 3-7 days without scarring. Not included in TBSA calculations.'
              },
              {
                title: 'Superficial Partial Thickness',
                content: 'Epidermis + superficial dermis. Blistered, moist, very painful, blanches, brisk capillary refill. Heals 10-14 days, minimal scarring.'
              },
              {
                title: 'Deep Partial Thickness',
                content: 'Epidermis + deep dermis. May be blistered, waxy appearance, less painful, sluggish capillary refill. Heals 3-6 weeks with scarring. Often requires excision and grafting.'
              },
              {
                title: 'Full Thickness',
                content: 'Through entire dermis. Leathery, waxy, or charred. Painless (nerve destruction), no blanching. Will not heal without surgery (no epidermal elements remain).'
              }
            ]
          },
          {
            title: 'Fluid Resuscitation',
            content: 'Burns cause massive fluid shifts into the interstitium. Resuscitation aims to maintain organ perfusion while avoiding over-resuscitation (edema, compartment syndrome).',
            subsections: [
              {
                title: 'Parkland Formula',
                content: '4 mL × kg body weight × %TBSA = 24-hour crystalloid (Hartmann\'s) requirement. Give 50% in first 8 hours (from time of burn, not arrival), remaining 50% over next 16 hours. Titrate to urine output 0.5-1 mL/kg/hr.'
              },
              {
                title: 'Modified Brooke Formula',
                content: '2 mL × kg × %TBSA of crystalloid. Some centers use colloid after 8-12 hours. Formulas are starting points—adjust to clinical response.'
              },
              {
                title: 'Resuscitation Endpoints',
                content: 'Urine output: 0.5-1 mL/kg/hr adults, 1 mL/kg/hr children. Avoid >1 mL/kg/hr (over-resuscitation). Heart rate, MAP, lactate clearance. Beware abdominal compartment syndrome with excess fluid.'
              }
            ]
          },
          {
            title: 'Inhalational Injury',
            content: 'Present in 20-30% of major burns. Triples mortality. Suspect with: enclosed space fire, facial burns, singed nasal hair, carbonaceous sputum, hoarse voice.',
            subsections: [
              {
                title: 'Pathophysiology',
                content: 'Thermal injury: usually limited to upper airway (larynx). Chemical injury: smoke particles cause tracheobronchial and alveolar damage. Carbon monoxide and cyanide poisoning.'
              },
              {
                title: 'Management',
                content: 'High-flow oxygen (treats CO poisoning). Early intubation if airway compromise anticipated—swelling worsens over hours. Bronchoscopy for diagnosis and grading. Supportive ventilation. Nebulized heparin/N-acetylcysteine under investigation.'
              }
            ]
          },
          {
            title: 'Burn Center Referral Criteria',
            content: 'Established criteria identify patients benefiting from specialized burn care.',
            subsections: [
              {
                title: 'Referral Indications',
                content: 'Partial thickness >10% TBSA. Burns involving face, hands, feet, genitalia, perineum, major joints. Full thickness burns. Electrical or chemical burns. Inhalational injury. Circumferential burns. Pre-existing conditions complicating management. Associated trauma. Children, elderly. Social/non-accidental injury concerns.'
              }
            ]
          }
        ],
        keyPoints: [
          'Use Lund and Browder for accurate TBSA—Rule of Nines is quick estimate only',
          'Only count partial and full thickness burns in TBSA',
          'Parkland: 4mL × kg × %TBSA, half in first 8 hours',
          'Titrate to urine output 0.5-1 mL/kg/hr',
          'Inhalational injury triples mortality—intubate early if suspected',
          'Know burn center referral criteria',
          'Carbon monoxide: 100% oxygen, consider hyperbaric'
        ],
        examTips: [
          'Lund and Browder is the gold standard for TBSA assessment',
          'Know Parkland formula and timing (8 hours from burn)',
          'Superficial burns excluded from TBSA calculations',
          'Recognize clinical features of inhalation injury'
        ],
        clinicalPearls: [
          'Burns deepen over 48-72 hours—reassess depth serially',
          'Calculate fluids from time of burn, not hospital arrival',
          'Intubation must be early—delayed intubation is extremely difficult with airway edema',
          'Circumferential burns may need escharotomy regardless of depth'
        ],
        commonMistakes: [
          'Including superficial (erythema) burns in TBSA',
          'Calculating fluids from hospital arrival not injury time',
          'Delayed intubation in inhalational injury',
          'Over-resuscitation causing abdominal compartment syndrome'
        ],
        references: [
          'ISBI Practice Guidelines for Burn Care. Burns 2016',
          'Baxter CR. Fluid resuscitation, burn percentage, and physiologic age. J Trauma 1979',
          'Herndon DN. Total Burn Care, 5th Edition',
          'American Burn Association: Burn Center Referral Criteria'
        ],
        selfAssessment: [
          {
            id: 'jr-3-1-q1',
            question: 'A 70kg adult has 40% TBSA burns. Using Parkland formula, what volume is given in the first 8 hours?',
            options: [
              '5,600 mL',
              '11,200 mL',
              '2,800 mL',
              '8,400 mL'
            ],
            correctAnswer: 0,
            explanation: 'Parkland: 4 × 70 × 40 = 11,200 mL in 24 hours. Half (5,600 mL) is given in the first 8 hours from time of burn.'
          },
          {
            id: 'jr-3-1-q2',
            question: 'Which burn depth will NOT heal spontaneously and always requires surgical intervention?',
            options: [
              'Superficial partial thickness',
              'Deep partial thickness',
              'Full thickness',
              'Superficial (epidermal)'
            ],
            correctAnswer: 2,
            explanation: 'Full thickness burns destroy all epidermal elements and dermal appendages, so no epithelial cells remain to regenerate skin. They always require excision and grafting.'
          }
        ]
      }
    },
    {
      id: 'jr-3-2',
      moduleId: 'jr-module-3',
      title: 'Burns Wound Management and Excision',
      article: {
        title: 'Burns Wound Management and Excision',
        overview: 'Definitive burn wound management aims to achieve wound closure, minimize infection, and optimize functional and aesthetic outcomes. Early excision and grafting has revolutionized burn care, reducing mortality and hospital stay.',
        learningObjectives: [
          'Understand principles of burn wound care',
          'Know indications and timing for excision',
          'Describe techniques of tangential and fascial excision',
          'Understand skin graft options and techniques',
          'Manage donor sites appropriately'
        ],
        sections: [
          {
            title: 'Initial Wound Care',
            content: 'First aid: Cool running water for 20 minutes within 3 hours of burn. Remove non-adherent clothing and jewelry. Cover with clean dressings. Avoid ice, butter, or unproven remedies.',
            subsections: [
              {
                title: 'Wound Cleaning',
                content: 'Gentle debridement of loose tissue and blisters. Chlorhexidine or saline cleansing. Controversy regarding intact blisters—generally deroof large blisters, may leave small (<2cm) intact.'
              },
              {
                title: 'Topical Antimicrobials',
                content: 'Silver sulfadiazine: broad-spectrum, may delay epithelialization. Mafenide acetate: penetrates eschar, good for ears/nose, painful. Silver-impregnated dressings (Acticoat, Aquacel Ag). Honey: alternative with antimicrobial and healing properties.'
              }
            ]
          },
          {
            title: 'Burn Wound Dressings',
            content: 'Dressing selection depends on wound depth, location, and phase of healing.',
            subsections: [
              {
                title: 'Superficial and Superficial Partial Thickness',
                content: 'Biosynthetic dressings (Biobrane, Suprathel) can be left in place until healed. Non-adherent dressings with antimicrobial if not available. Minimize dressing changes to protect healing epidermis.'
              },
              {
                title: 'Deep Partial and Full Thickness',
                content: 'Temporary biological dressings (allograft, xenograft) while awaiting surgery. Negative pressure wound therapy may be beneficial. Daily antimicrobial dressings if surgery delayed.'
              }
            ]
          },
          {
            title: 'Surgical Excision',
            content: 'Early excision (within 72 hours) of deep burns reduces mortality, infection, and hospital stay. Removes necrotic tissue (eschar) that serves as culture medium for bacteria.',
            subsections: [
              {
                title: 'Tangential Excision',
                content: 'Sequential shaving of burn tissue until viable dermis (punctate bleeding) reached. Preserves viable tissue. Blood loss significant—limit to 15-20% TBSA per session. Hemostasis with epinephrine-soaked swabs, tourniquets, electrocautery.'
              },
              {
                title: 'Fascial Excision',
                content: 'Removal of all tissue down to fascia. Used for very deep burns, electrical injuries, or failed tangential excision. More rapid, less blood loss. Poorer cosmetic result, lymphedema risk.'
              },
              {
                title: 'Blood Loss Management',
                content: 'Expect 100-150 mL blood loss per 1% TBSA excised tangentially. Tumescent infiltration reduces bleeding. Limit staged excision. Transfusion threshold typically Hb 8-10 g/dL. Cell salvage where available.'
              }
            ]
          },
          {
            title: 'Skin Grafting',
            content: 'Definitive coverage follows excision. Autograft is the gold standard; alternatives used when donor sites are insufficient.',
            subsections: [
              {
                title: 'Split Thickness Skin Graft (STSG)',
                content: 'Epidermis + partial dermis (0.2-0.4mm). Harvested with dermatome from thigh, buttock, or scalp. May be sheet (better cosmesis) or meshed (covers larger area, allows drainage).'
              },
              {
                title: 'Full Thickness Skin Graft (FTSG)',
                content: 'Epidermis + full dermis. Superior cosmetic outcome, less contraction. Limited donor availability, used for face, hands, over joints. Donor site requires primary closure or STSG.'
              },
              {
                title: 'Alternatives to Autograft',
                content: 'Allograft (cadaveric): temporary biological dressing. Xenograft (porcine): temporary coverage. Dermal substitutes (Integra, Matriderm): neodermis formation, then thin STSG. Cultured Epithelial Autografts (CEA): from patient\'s own keratinocytes when donor sites exhausted.'
              }
            ]
          },
          {
            title: 'Donor Site Care',
            content: 'Donor sites are partial thickness wounds and should heal in 10-14 days. Dressings: calcium alginate, foam, or film. Avoid infection. Can be reharvested at 2-3 weeks if needed.'
          }
        ],
        keyPoints: [
          'Cool burns with running water for 20 minutes within 3 hours',
          'Early excision (within 72 hours) reduces mortality',
          'Tangential excision preserves viable tissue; fascial for deep burns',
          'Blood loss ~100-150 mL per 1% TBSA excised',
          'STSG: workhorse for burn coverage; mesh for large areas',
          'FTSG: face, hands, joints for better cosmesis',
          'Dermal substitutes bridge the gap when autograft insufficient'
        ],
        examTips: [
          'Know cooling first aid guidelines (20 min, 3 hrs)',
          'Understand tangential vs. fascial excision indications',
          'Know STSG vs. FTSG properties and indications',
          'Dermal substitutes require staged grafting'
        ],
        clinicalPearls: [
          'Meshed grafts should be 1:1.5 on face and hands, 1:3-4 on trunk/legs',
          'Graft take requires immobility—splint across joints',
          'Donor site infection/conversion is preventable with good care',
          'Scalp is excellent donor—heals well, hidden'
        ],
        commonMistakes: [
          'Delaying excision beyond 72 hours without reason',
          'Excessive meshing ratio on visible areas',
          'Inadequate hemostasis before grafting',
          'Moving patient before graft is taken (5-7 days)'
        ],
        references: [
          'Herndon DN. Total Burn Care, 5th Edition',
          'Janzekovic Z. New concept in early excision. J Trauma 1970',
          'Heimbach DM et al. Artificial dermis for burns. Ann Surg 1988',
          'ISBI Practice Guidelines Committee. Burns 2016'
        ],
        selfAssessment: [
          {
            id: 'jr-3-2-q1',
            question: 'Which excision technique is most appropriate for an electrical burn with necrosis to the level of muscle?',
            options: [
              'Tangential excision',
              'Fascial excision',
              'Chemical debridement',
              'Enzymatic debridement'
            ],
            correctAnswer: 1,
            explanation: 'Deep electrical burns with muscle necrosis require fascial excision, removing all tissue down to viable fascia or muscle. Tangential excision is inadequate for such deep injuries.'
          },
          {
            id: 'jr-3-2-q2',
            question: 'A dermal substitute (Integra) is applied to an excised burn wound. What is the next step?',
            options: [
              'Immediate discharge home',
              'Wait 2-3 weeks then apply thin STSG',
              'Apply STSG at same surgery',
              'No further surgery needed'
            ],
            correctAnswer: 1,
            explanation: 'Integra is a two-stage procedure. The dermal template integrates over 2-3 weeks, developing neovascularization. Then the silicone layer is removed and a thin STSG (0.15mm) is applied.'
          }
        ]
      }
    }
  ]
};

const JR_MODULE_4: CMEModule = {
  id: 'jr-module-4',
  title: 'Section 4: Intensive Care for the Surgical Patient',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-4-1',
      moduleId: 'jr-module-4',
      title: 'Mechanical Ventilation Principles',
      article: {
        title: 'Mechanical Ventilation Principles',
        overview: 'Mechanical ventilation is life-saving but carries significant risks. The surgical resident must understand ventilator modes, settings, and complications to optimize patient outcomes and communicate effectively with intensive care teams.',
        learningObjectives: [
          'Understand indications for mechanical ventilation',
          'Know basic ventilator modes and their applications',
          'Interpret ventilator waveforms and alarms',
          'Apply lung-protective ventilation strategies',
          'Recognize and manage common complications'
        ],
        sections: [
          {
            title: 'Indications for Mechanical Ventilation',
            content: 'Mechanical ventilation supports or replaces spontaneous breathing when respiratory failure occurs or is anticipated.',
            subsections: [
              {
                title: 'Type 1 (Hypoxemic) Respiratory Failure',
                content: 'PaO2 <60 mmHg on supplemental oxygen. Causes: pneumonia, ARDS, pulmonary edema, PE. V/Q mismatch or shunt. NIV may be sufficient; intubation if refractory.'
              },
              {
                title: 'Type 2 (Hypercapnic) Respiratory Failure',
                content: 'PaCO2 >50 mmHg with pH <7.35. Causes: COPD, neuromuscular disease, drug overdose, chest wall pathology. Alveolar hypoventilation. NIV first-line for COPD; intubate if fails or contraindicated.'
              },
              {
                title: 'Airway Protection',
                content: 'GCS ≤8, absent gag reflex, aspiration risk. Post-operative after major surgery. Anticipated airway edema (burns, anaphylaxis).'
              }
            ]
          },
          {
            title: 'Ventilator Modes',
            content: 'Modes are classified by how breaths are triggered, limited, and cycled.',
            subsections: [
              {
                title: 'Volume Control (VC)',
                content: 'Set tidal volume and rate. Ventilator delivers set volume regardless of pressure. Constant flow pattern. Pressure varies with compliance. Risk: high pressures if compliance decreases.'
              },
              {
                title: 'Pressure Control (PC)',
                content: 'Set inspiratory pressure and time. Ventilator delivers pressure regardless of volume. Decelerating flow pattern. Volume varies with compliance. Advantage: limits pressure injury.'
              },
              {
                title: 'Pressure Support (PS)',
                content: 'Patient-triggered, pressure-assisted spontaneous breaths. Used for weaning. Patient controls rate and inspiratory time. Requires adequate respiratory drive.'
              },
              {
                title: 'SIMV (Synchronized Intermittent Mandatory Ventilation)',
                content: 'Combines mandatory breaths with spontaneous breathing. Set rate of mandatory breaths synchronized to patient effort. Spontaneous breaths may have pressure support. Common weaning mode.'
              }
            ]
          },
          {
            title: 'Basic Ventilator Settings',
            content: 'Initial settings based on patient size, pathology, and goals.',
            subsections: [
              {
                title: 'Tidal Volume (Vt)',
                content: 'Target 6-8 mL/kg ideal body weight (IBW). IBW (men) = 50 + 0.91(height cm - 152.4). IBW (women) = 45.5 + 0.91(height cm - 152.4). Lower in ARDS (6 mL/kg).'
              },
              {
                title: 'Respiratory Rate (RR)',
                content: 'Usually 12-16/min. Adjust to achieve target PaCO2 and pH. Higher rates needed in metabolic acidosis (compensation).'
              },
              {
                title: 'FiO2 and PEEP',
                content: 'FiO2: start at 1.0, wean to target SpO2 94-98% (88-92% in COPD). PEEP: typically 5 cmH2O, higher in ARDS to prevent alveolar collapse. ARDSNet tables guide FiO2/PEEP combinations.'
              },
              {
                title: 'I:E Ratio',
                content: 'Inspiratory:Expiratory time ratio. Normal 1:2. Prolonged expiration (1:3-4) in obstructive disease to prevent air trapping. Inverse ratio (2:1) occasionally in severe ARDS.'
              }
            ]
          },
          {
            title: 'Lung-Protective Ventilation',
            content: 'Strategies to minimize ventilator-induced lung injury (VILI).',
            subsections: [
              {
                title: 'Key Principles',
                content: 'Low tidal volume (6 mL/kg IBW). Limit plateau pressure <30 cmH2O. Adequate PEEP to prevent atelectotrauma. Permissive hypercapnia acceptable (pH >7.20). Prone positioning in severe ARDS (P/F <150).'
              },
              {
                title: 'Driving Pressure',
                content: 'ΔP = Plateau pressure - PEEP. Target <15 cmH2O. Best predictor of mortality in ARDS. Reflects lung strain.'
              }
            ]
          },
          {
            title: 'Complications of Mechanical Ventilation',
            content: 'Ventilator-associated pneumonia (VAP), barotrauma (pneumothorax), atelectasis, ICU-acquired weakness, delirium. Prevention bundles: head elevation, oral care, sedation holidays, DVT prophylaxis, stress ulcer prophylaxis.'
          }
        ],
        keyPoints: [
          'Tidal volume 6-8 mL/kg ideal body weight, lower in ARDS',
          'Plateau pressure <30 cmH2O, driving pressure <15 cmH2O',
          'Volume control: set volume, pressure varies',
          'Pressure control: set pressure, volume varies',
          'PEEP prevents alveolar collapse; higher in ARDS',
          'Prone positioning improves oxygenation in severe ARDS',
          'Lung-protective ventilation reduces mortality'
        ],
        examTips: [
          'Know the difference between volume and pressure control',
          'Memorize ideal body weight calculation',
          'ARDSNet low tidal volume targets are exam favorites',
          'Understand indications for NIV vs. intubation'
        ],
        clinicalPearls: [
          'Always use ideal body weight, not actual weight',
          'High plateau pressure? Check for secretions, bronchospasm, tension PTX',
          'Auto-PEEP (breath stacking): disconnect briefly, extend expiration',
          'VAP prevention is easier than treatment'
        ],
        commonMistakes: [
          'Using actual weight for tidal volume calculation',
          'Ignoring plateau pressure while monitoring peak pressure',
          'Excessive tidal volumes in ARDS',
          'Insufficient PEEP causing atelectotrauma'
        ],
        references: [
          'ARDSNet. NEJM 2000. Low tidal volume ventilation',
          'Gattinoni L et al. Prone positioning in ARDS. NEJM 2013',
          'Amato MB et al. Driving pressure and survival in ARDS. NEJM 2015',
          'Tobin MJ. Principles and Practice of Mechanical Ventilation, 3rd Ed'
        ],
        selfAssessment: [
          {
            id: 'jr-4-1-q1',
            question: 'A 70kg (actual weight), 180cm tall man with ARDS is being ventilated. What is the target tidal volume?',
            options: [
              '420 mL (6 mL × 70kg actual)',
              '500 mL (7 mL × 70kg actual)',
              '450 mL (6 mL × 75kg IBW)',
              '350 mL (5 mL × 70kg actual)'
            ],
            correctAnswer: 2,
            explanation: 'IBW (men) = 50 + 0.91(180 - 152.4) = 50 + 25.1 = 75.1kg. In ARDS, target 6 mL/kg IBW = 6 × 75 = 450 mL.'
          },
          {
            id: 'jr-4-1-q2',
            question: 'In lung-protective ventilation, which parameter best predicts mortality in ARDS?',
            options: [
              'Peak airway pressure',
              'Tidal volume',
              'Driving pressure (plateau - PEEP)',
              'FiO2'
            ],
            correctAnswer: 2,
            explanation: 'Driving pressure (plateau pressure minus PEEP) is the best predictor of mortality in ARDS, as it reflects the actual strain on functional lung tissue.'
          }
        ]
      }
    },
    {
      id: 'jr-4-2',
      moduleId: 'jr-module-4',
      title: 'Sepsis and Septic Shock Management',
      article: {
        title: 'Sepsis and Septic Shock Management',
        overview: 'Sepsis is life-threatening organ dysfunction caused by dysregulated host response to infection. Septic shock adds circulatory and cellular/metabolic abnormalities. Early recognition and protocolized treatment (the \"Hour-1 Bundle\") save lives.',
        learningObjectives: [
          'Apply Sepsis-3 definitions correctly',
          'Use qSOFA and SOFA for sepsis screening and diagnosis',
          'Implement the Hour-1 Bundle',
          'Understand source control principles',
          'Manage refractory septic shock'
        ],
        sections: [
          {
            title: 'Sepsis Definitions (Sepsis-3)',
            content: 'Updated definitions focus on organ dysfunction rather than SIRS criteria.',
            subsections: [
              {
                title: 'Sepsis',
                content: 'Life-threatening organ dysfunction due to dysregulated host response to infection. Operationalized as: Suspected/documented infection + SOFA score increase ≥2 points (baseline assumed 0 in previously healthy).'
              },
              {
                title: 'Septic Shock',
                content: 'Sepsis with: Persisting hypotension requiring vasopressors to maintain MAP ≥65 mmHg AND Lactate >2 mmol/L despite adequate fluid resuscitation. Associated with mortality >40%.'
              },
              {
                title: 'qSOFA (Quick SOFA)',
                content: 'Bedside screening tool (outside ICU): Respiratory rate ≥22, Altered mental status (GCS <15), Systolic BP ≤100 mmHg. ≥2 points suggests possible sepsis—investigate further.'
              }
            ]
          },
          {
            title: 'The Hour-1 Bundle',
            content: 'Time-critical interventions to be initiated within 1 hour of sepsis recognition.',
            subsections: [
              {
                title: 'Bundle Elements',
                content: '1. Measure lactate (remeasure if elevated). 2. Obtain blood cultures before antibiotics. 3. Administer broad-spectrum antibiotics. 4. Begin rapid fluid resuscitation (30 mL/kg crystalloid) for hypotension or lactate ≥4. 5. Apply vasopressors for hypotension not responding to fluids (target MAP ≥65).'
              },
              {
                title: 'Antibiotic Selection',
                content: 'Broad-spectrum initially, covering likely pathogens. De-escalate based on cultures. Common choices: Piperacillin-tazobactam, Meropenem (if ESBL risk), add Vancomycin if MRSA suspected. Source and local resistance patterns guide selection.'
              },
              {
                title: 'Fluid Resuscitation',
                content: '30 mL/kg crystalloid bolus (Hartmann\'s/LR preferred over saline). Complete within 3 hours. Reassess fluid responsiveness—passive leg raise, stroke volume variation. Avoid over-resuscitation.'
              }
            ]
          },
          {
            title: 'Source Control',
            content: 'Identify and eliminate the source of infection. This is often surgical and should not be delayed.',
            subsections: [
              {
                title: 'Surgical Source Control',
                content: 'Drainage of abscesses/empyema. Debridement of infected necrotic tissue (necrotizing fasciitis). Removal of infected devices (lines, prostheses). Perforation repair/resection. Damage control principles apply in unstable patients.'
              },
              {
                title: 'Timing',
                content: 'Source control should be achieved within 6-12 hours of diagnosis when anatomically feasible. Imaging (CT) may be needed to localize source. Don\'t delay for imaging if clinical source is obvious.'
              }
            ]
          },
          {
            title: 'Vasopressors and Adjuncts',
            content: 'For shock refractory to fluids.',
            subsections: [
              {
                title: 'First-Line: Norepinephrine',
                content: 'Potent alpha-1 agonist with mild beta-1 effect. Target MAP ≥65 mmHg. Start 0.05-0.1 mcg/kg/min, titrate to effect. Central access preferred but peripheral acceptable short-term.'
              },
              {
                title: 'Second-Line: Vasopressin',
                content: 'Add if norepinephrine dose escalating (>0.25-0.5 mcg/kg/min). Dose 0.03 units/min (fixed). Catecholamine-sparing effect.'
              },
              {
                title: 'Adjuncts',
                content: 'Hydrocortisone 200mg/day if shock refractory to vasopressors. Dobutamine if cardiac dysfunction with low output despite adequate filling. Blood transfusion target Hb 7-9 g/dL.'
              }
            ]
          }
        ],
        keyPoints: [
          'Sepsis = infection + organ dysfunction (SOFA ≥2)',
          'Septic shock = sepsis + vasopressors + lactate >2 despite fluids',
          'Hour-1 Bundle: lactate, cultures, antibiotics, fluids, vasopressors',
          'Norepinephrine is first-line vasopressor',
          'Source control within 6-12 hours is critical',
          'Each hour of antibiotic delay increases mortality',
          'Surviving Sepsis Campaign guidelines updated 2021'
        ],
        examTips: [
          'Know Sepsis-3 definitions and qSOFA criteria',
          'Hour-1 Bundle elements are exam favorites',
          'Norepinephrine first-line, vasopressin second',
          'Lactate is both diagnostic and prognostic'
        ],
        clinicalPearls: [
          'Don\'t wait for cultures to give antibiotics—just get them first',
          'Lactate clearance >10% in 6 hours predicts survival',
          'Source control often more important than antibiotics',
          'Warm shock can look well—don\'t be fooled'
        ],
        commonMistakes: [
          'Delaying antibiotics to get cultures',
          'Using dopamine instead of norepinephrine',
          'Giving antibiotics without source control',
          'Over-relying on CVP for fluid responsiveness'
        ],
        references: [
          'Singer M et al. Sepsis-3 definitions. JAMA 2016',
          'Rhodes A et al. Surviving Sepsis Campaign 2016',
          'Evans L et al. Surviving Sepsis Campaign 2021 Update',
          'Seymour CW et al. qSOFA validation. JAMA 2016'
        ],
        selfAssessment: [
          {
            id: 'jr-4-2-q1',
            question: 'A patient has confirmed infection, MAP 60 mmHg on norepinephrine 0.2 mcg/kg/min, and lactate 3.5 mmol/L after 2L crystalloid. What is the diagnosis?',
            options: [
              'Sepsis',
              'Severe sepsis',
              'Septic shock',
              'SIRS'
            ],
            correctAnswer: 2,
            explanation: 'Septic shock = sepsis + requiring vasopressors to maintain MAP ≥65 + lactate >2 mmol/L despite adequate fluid resuscitation. All criteria are met here.'
          },
          {
            id: 'jr-4-2-q2',
            question: 'Which vasopressor should be added if norepinephrine requirements are escalating in septic shock?',
            options: [
              'Dopamine',
              'Vasopressin',
              'Epinephrine',
              'Phenylephrine'
            ],
            correctAnswer: 1,
            explanation: 'Vasopressin (0.03 units/min) is the recommended second-line vasopressor in septic shock, added when norepinephrine requirements exceed 0.25-0.5 mcg/kg/min.'
          }
        ]
      }
    }
  ]
};

JUNIOR_RESIDENT_MODULES.push(JR_MODULE_3, JR_MODULE_4);

const JR_MODULE_5: CMEModule = {
  id: 'jr-module-5',
  title: 'Section 5: Surgical Oncology Principles',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-5-1',
      moduleId: 'jr-module-5',
      title: 'Cancer Biology and Staging',
      article: {
        title: 'Cancer Biology and Staging',
        overview: 'Understanding cancer biology is fundamental to surgical oncology. Accurate staging determines prognosis and guides treatment decisions. The junior resident must understand carcinogenesis, tumor behavior, and staging systems.',
        learningObjectives: [
          'Describe the hallmarks of cancer and carcinogenesis',
          'Understand tumor growth kinetics and metastasis',
          'Apply TNM staging system correctly',
          'Know principles of oncologic resection',
          'Understand multimodality cancer treatment'
        ],
        sections: [
          {
            title: 'Hallmarks of Cancer',
            content: 'Hanahan and Weinberg defined the hallmarks that distinguish cancer cells from normal cells.',
            subsections: [
              {
                title: 'Core Hallmarks',
                content: '1. Sustaining proliferative signaling. 2. Evading growth suppressors. 3. Resisting cell death. 4. Enabling replicative immortality. 5. Inducing angiogenesis. 6. Activating invasion and metastasis.'
              },
              {
                title: 'Enabling Characteristics',
                content: 'Genome instability and mutation. Tumor-promoting inflammation. Additional hallmarks: deregulating cellular metabolism, avoiding immune destruction.'
              }
            ]
          },
          {
            title: 'Carcinogenesis',
            content: 'Cancer develops through accumulation of genetic and epigenetic changes, typically over decades.',
            subsections: [
              {
                title: 'Multi-Step Model',
                content: 'Initiation: irreversible DNA damage. Promotion: clonal expansion of initiated cells. Progression: acquisition of invasive and metastatic capability. Example: Adenoma-carcinoma sequence in colorectal cancer (APC → KRAS → TP53).'
              },
              {
                title: 'Oncogenes and Tumor Suppressors',
                content: 'Oncogenes: gain-of-function mutations driving proliferation (RAS, MYC, HER2). Tumor suppressors: loss-of-function mutations removing growth control (TP53, RB, BRCA). Two-hit hypothesis for tumor suppressors.'
              }
            ]
          },
          {
            title: 'Tumor Spread',
            content: 'Understanding routes of spread guides surgical planning and staging investigations.',
            subsections: [
              {
                title: 'Local Invasion',
                content: 'Direct extension into adjacent tissues. Determines resectability and margin requirements. Perineural invasion: poor prognostic factor.'
              },
              {
                title: 'Lymphatic Spread',
                content: 'Most common route for carcinomas. Follows predictable drainage patterns. Basis for sentinel lymph node biopsy. Skip metastases can occur.'
              },
              {
                title: 'Hematogenous Spread',
                content: 'Common for sarcomas and some carcinomas. Portal drainage → liver (GI tumors). Systemic drainage → lung, bone, brain. Bone: osteolytic (breast, lung, kidney) or osteoblastic (prostate).'
              },
              {
                title: 'Transcoelomic Spread',
                content: 'Peritoneal carcinomatosis: ovary, stomach, colon. Pleural: lung, breast. Presents with effusions.'
              }
            ]
          },
          {
            title: 'TNM Staging',
            content: 'Standardized staging system essential for treatment planning and prognosis.',
            subsections: [
              {
                title: 'T: Primary Tumor',
                content: 'TX: Cannot assess. T0: No evidence. Tis: Carcinoma in situ. T1-4: Increasing size or local invasion. Definitions vary by tumor site.'
              },
              {
                title: 'N: Regional Lymph Nodes',
                content: 'NX: Cannot assess. N0: No regional nodes. N1-3: Increasing node involvement. Based on number, size, or location depending on tumor type.'
              },
              {
                title: 'M: Distant Metastasis',
                content: 'M0: No distant metastasis. M1: Distant metastasis present. May be subclassified by site (M1a, M1b, etc.).'
              },
              {
                title: 'Stage Grouping',
                content: 'TNM combinations grouped into Stage I-IV. Generally: Stage I = localized, good prognosis. Stage IV = metastatic, poor prognosis. Survival curves should accompany staging.'
              }
            ]
          },
          {
            title: 'Principles of Oncologic Surgery',
            content: 'Surgical resection remains the primary curative treatment for most solid tumors.',
            subsections: [
              {
                title: 'Surgical Margins',
                content: 'R0: Microscopically negative margins. R1: Microscopically positive margins. R2: Macroscopically positive (gross residual). R0 resection is the goal. Margin requirements vary by tumor type (1mm for melanoma in situ, 2cm for thick melanoma, 5cm for colon cancer).'
              },
              {
                title: 'En Bloc Resection',
                content: 'Resection of tumor with surrounding tissue as a single specimen without cutting into tumor. Reduces local recurrence. May include adjacent involved organs.'
              }
            ]
          }
        ],
        keyPoints: [
          'Cancer develops through accumulation of genetic changes over time',
          'Oncogenes (gain of function) and tumor suppressors (loss of function) drive cancer',
          'Routes of spread: local, lymphatic, hematogenous, transcoelomic',
          'TNM staging guides prognosis and treatment',
          'R0 (negative margin) resection is the surgical goal',
          'Margin requirements vary by tumor type and location',
          'Multimodality treatment (surgery, chemo, radiation) for most cancers'
        ],
        examTips: [
          'Hallmarks of cancer are frequently tested',
          'Know common oncogenes (RAS, MYC) and tumor suppressors (TP53, RB)',
          'Understand R classification for surgical margins',
          'TNM to stage grouping logic—know principles'
        ],
        clinicalPearls: [
          'Never cut across tumor—en bloc resection essential',
          'Sentinel node biopsy minimizes morbidity of lymphadenectomy',
          'Staging imaging before biopsy may be cleaner (less inflammation)',
          'Tumor board discussion before major resection'
        ],
        commonMistakes: [
          'Inadequate margins due to poor preoperative planning',
          'Cutting into tumor during resection (R2)',
          'Missing synchronous lesions (colonoscopy for colon cancer)',
          'Operating on metastatic disease without knowing'
        ],
        references: [
          'Hanahan D, Weinberg RA. Hallmarks of Cancer: Next Generation. Cell 2011',
          'AJCC Cancer Staging Manual, 8th Edition',
          'Vogelstein B et al. Genetic alterations during colorectal-tumor development. NEJM 1988',
          'Fisher B et al. Surgical adjuvant principles. Ann Surg 1970'
        ],
        selfAssessment: [
          {
            id: 'jr-5-1-q1',
            question: 'Which is a characteristic of oncogenes rather than tumor suppressor genes?',
            options: [
              'Both alleles must be inactivated for effect',
              'Gain-of-function mutation drives proliferation',
              'TP53 is the classic example',
              'Loss of function causes cancer'
            ],
            correctAnswer: 1,
            explanation: 'Oncogenes require only one mutated allele (dominant) and cause gain-of-function that drives proliferation. Tumor suppressors require both alleles to be inactivated (recessive).'
          },
          {
            id: 'jr-5-1-q2',
            question: 'What does an R1 resection indicate?',
            options: [
              'Macroscopically complete, microscopically negative margins',
              'Microscopically positive margins',
              'Gross residual tumor left behind',
              'Complete resection with wide margins'
            ],
            correctAnswer: 1,
            explanation: 'R1 = microscopically positive margins (tumor at the inked resection margin). R0 = clear margins. R2 = macroscopic residual disease.'
          }
        ]
      }
    },
    {
      id: 'jr-5-2',
      moduleId: 'jr-module-5',
      title: 'Skin Cancer: Diagnosis and Management',
      article: {
        title: 'Skin Cancer: Diagnosis and Management',
        overview: 'Skin cancers are the most common malignancies worldwide. Early detection and appropriate surgical management are essential. The junior resident must recognize different skin cancer types and understand management principles.',
        learningObjectives: [
          'Differentiate between BCC, SCC, and melanoma',
          'Understand ABCDE criteria for melanoma',
          'Apply appropriate surgical margins',
          'Know indications for sentinel lymph node biopsy',
          'Understand Breslow thickness and staging'
        ],
        sections: [
          {
            title: 'Basal Cell Carcinoma (BCC)',
            content: 'Most common skin cancer. Locally invasive, rarely metastasizes (<0.1%). UV exposure is main risk factor.',
            subsections: [
              {
                title: 'Clinical Features',
                content: 'Nodular: pearly, telangiectatic nodule, may ulcerate (rodent ulcer). Superficial: scaly, erythematous patch. Morphoeic/sclerosing: waxy, scar-like, poorly defined borders—more aggressive.'
              },
              {
                title: 'Management',
                content: 'Surgical excision: 3-4mm margin for well-defined lesions. Mohs micrographic surgery: for high-risk locations (face), morphoeic type, recurrent. Non-surgical: topical imiquimod, cryotherapy, radiotherapy for selected cases.'
              }
            ]
          },
          {
            title: 'Squamous Cell Carcinoma (SCC)',
            content: 'Second most common. Higher metastatic potential than BCC (2-5%), especially high-risk subtypes.',
            subsections: [
              {
                title: 'Clinical Features',
                content: 'Keratotic nodule or plaque, may ulcerate. Arises from sun-damaged skin or precursor lesions (actinic keratosis, Bowen\'s disease). Lip, ear, genitalia, chronic wounds have higher metastatic risk.'
              },
              {
                title: 'High-Risk Features',
                content: 'Size >2cm. Depth >4mm or Clark level IV. Poorly differentiated. Perineural invasion. Location: ear, lip, genitalia. Immunosuppression (transplant patients).'
              },
              {
                title: 'Management',
                content: 'Excision with 4-6mm margins. Wider margins (6-10mm) for high-risk. Lymph node assessment for high-risk disease. Adjuvant radiotherapy for positive margins, perineural invasion.'
              }
            ]
          },
          {
            title: 'Melanoma',
            content: 'Arises from melanocytes. Most dangerous skin cancer. Breslow thickness is most important prognostic factor.',
            subsections: [
              {
                title: 'ABCDE Criteria',
                content: 'A: Asymmetry. B: Border irregularity. C: Color variation. D: Diameter >6mm. E: Evolution (changing lesion). Ugly duckling sign: lesion different from others on patient.'
              },
              {
                title: 'Types',
                content: 'Superficial spreading: most common (70%). Nodular: vertical growth, worse prognosis. Lentigo maligna: on sun-damaged skin, elderly. Acral lentiginous: palms, soles, subungual—most common in dark-skinned individuals.'
              },
              {
                title: 'Breslow Thickness',
                content: 'Measured from granular layer to deepest tumor cell. <1mm: thin (good prognosis). 1-2mm: intermediate. >2mm: thick (poor prognosis). Ulceration and mitotic rate also prognostic.'
              },
              {
                title: 'Surgical Margins',
                content: 'Melanoma in situ: 5mm. ≤1mm Breslow: 1cm. 1.01-2mm: 1-2cm. >2mm: 2cm. Wider margins do not improve survival beyond these guidelines.'
              },
              {
                title: 'Sentinel Lymph Node Biopsy',
                content: 'Indicated for melanoma ≥0.8mm Breslow or ulcerated. Identifies occult nodal metastases. Positive SLNB: completion lymphadenectomy vs. observation (MSLT-II shows observation acceptable). Staging and prognostic value.'
              }
            ]
          }
        ],
        keyPoints: [
          'BCC: most common, rarely metastasizes, 3-4mm margins',
          'SCC: metastatic potential 2-5%, wider margins 4-6mm',
          'Melanoma: Breslow thickness is key prognostic factor',
          'ABCDE criteria for melanoma recognition',
          'Melanoma margins: in situ 5mm, ≤1mm 1cm, 1-2mm 1-2cm, >2mm 2cm',
          'SLNB for melanoma ≥0.8mm or ulcerated',
          'High-risk SCC needs nodal assessment'
        ],
        examTips: [
          'Know surgical margins for each skin cancer type',
          'Breslow thickness cutoffs and their significance',
          'High-risk features of SCC are commonly tested',
          'SLNB indications for melanoma'
        ],
        clinicalPearls: [
          'Always send "simple skin lesions" for histology—you may be surprised',
          'Morphoeic BCC margins are hard to assess clinically—Mohs preferred',
          'Melanoma under nails (subungual) can mimic hematoma—biopsy if doubt',
          'Transplant patients have 65× increased SCC risk'
        ],
        commonMistakes: [
          'Inadequate margins due to underestimating extent',
          'Missing melanoma in non-sun-exposed areas (acral, mucosal)',
          'Not referring high-risk SCC for nodal assessment',
          'Shave biopsy of suspected melanoma (need full thickness)'
        ],
        references: [
          'NCCN Guidelines: Basal Cell Skin Cancer 2024',
          'NCCN Guidelines: Squamous Cell Skin Cancer 2024',
          'NCCN Guidelines: Melanoma 2024',
          'Morton DL et al. MSLT-I Trial. NEJM 2006'
        ],
        selfAssessment: [
          {
            id: 'jr-5-2-q1',
            question: 'A melanoma has Breslow thickness of 1.5mm without ulceration. What is the recommended excision margin?',
            options: [
              '5mm',
              '1cm',
              '1-2cm',
              '2cm'
            ],
            correctAnswer: 2,
            explanation: 'For melanoma 1.01-2mm Breslow thickness, recommended excision margin is 1-2cm. This patient would also be a candidate for sentinel lymph node biopsy.'
          },
          {
            id: 'jr-5-2-q2',
            question: 'Which is a high-risk feature for squamous cell carcinoma metastasis?',
            options: [
              'Location on the trunk',
              'Size <1cm',
              'Perineural invasion',
              'Well-differentiated histology'
            ],
            correctAnswer: 2,
            explanation: 'Perineural invasion is a high-risk feature associated with increased metastatic potential in SCC. Other high-risk features include size >2cm, depth >4mm, poor differentiation, and location on lip/ear.'
          }
        ]
      }
    }
  ]
};

const JR_MODULE_6: CMEModule = {
  id: 'jr-module-6',
  title: 'Section 6: System-Based Surgery',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-6-1',
      moduleId: 'jr-module-6',
      title: 'Acute Abdomen: Diagnosis and Management',
      article: {
        title: 'Acute Abdomen: Diagnosis and Management',
        overview: 'The acute abdomen is a common surgical emergency requiring systematic evaluation. Rapid diagnosis distinguishes conditions requiring immediate surgery from those managed conservatively. Pattern recognition and clinical acumen are essential.',
        learningObjectives: [
          'Conduct a systematic evaluation of acute abdominal pain',
          'Recognize patterns of pain suggesting specific diagnoses',
          'Understand the role of investigations in acute abdomen',
          'Identify patients requiring emergency surgery',
          'Apply damage control principles when appropriate'
        ],
        sections: [
          {
            title: 'Clinical Approach',
            content: 'History and examination remain the cornerstone of evaluation. Pain characteristics, associated symptoms, and systemic signs guide diagnosis.',
            subsections: [
              {
                title: 'Pain Characteristics',
                content: 'Visceral pain: dull, poorly localized, midline. Somatic pain: sharp, well-localized, worsened by movement. Referred pain: perceived at distant site (shoulder tip in diaphragmatic irritation).'
              },
              {
                title: 'Pattern Recognition',
                content: 'Appendicitis: periumbilical → RIF. Cholecystitis: RUQ, Murphy\'s positive. Pancreatitis: epigastric radiating to back. Bowel obstruction: colicky, vomiting, distension, constipation. Perforation: sudden, severe, generalized peritonism.'
              }
            ]
          },
          {
            title: 'Physical Examination',
            content: 'Inspection, auscultation, percussion, palpation. Look for signs of peritonitis: guarding, rigidity, rebound tenderness. Special signs: Murphy\'s, Rovsing\'s, McBurney\'s point, obturator/psoas signs.',
            subsections: [
              {
                title: 'Peritonism',
                content: 'Localized: inflammatory process (appendicitis, cholecystitis). Generalized: hollow viscus perforation or diffuse contamination. Board-like rigidity: advanced peritonitis—usually requires surgery.'
              }
            ]
          },
          {
            title: 'Investigations',
            content: 'Targeted based on clinical suspicion.',
            subsections: [
              {
                title: 'Laboratory',
                content: 'FBC: leukocytosis suggests inflammation/infection. CRP: elevated in inflammatory conditions. Amylase/lipase: pancreatitis. LFTs: biliary disease. Lactate: ischemia, sepsis. Beta-hCG: exclude ectopic pregnancy in women.'
              },
              {
                title: 'Imaging',
                content: 'Erect CXR: free air under diaphragm (perforation). AXR: obstruction (limited utility). Ultrasound: biliary disease, appendicitis, AAA, free fluid. CT abdomen-pelvis: gold standard for most acute abdominal conditions.'
              }
            ]
          },
          {
            title: 'Specific Conditions',
            content: 'Common surgical emergencies requiring recognition.',
            subsections: [
              {
                title: 'Appendicitis',
                content: 'Most common surgical emergency. Alvarado score aids diagnosis. CT if diagnosis uncertain. Appendicectomy (laparoscopic preferred). Antibiotics alone controversial for uncomplicated.'
              },
              {
                title: 'Cholecystitis',
                content: 'Murphy\'s sign, RUQ pain, fever. Ultrasound: stones, wall thickening, pericholecystic fluid. Early laparoscopic cholecystectomy (within 72 hours) preferred.'
              },
              {
                title: 'Bowel Obstruction',
                content: 'SBO: vomiting, distension, colicky pain, constipation. Large bowel: more distension, later vomiting. CT: transition point, cause, complications. Adhesional SBO: trial of conservative management if no strangulation. Operative for closed loop, strangulation, failure of conservative.'
              },
              {
                title: 'Perforation',
                content: 'Sudden onset, generalized peritonism, shocked. Free air on imaging. Immediate resuscitation and surgery. Peptic ulcer: omental patch. Colonic: resection ± stoma (Hartmann\'s in unstable patient).'
              }
            ]
          }
        ],
        keyPoints: [
          'History and examination remain paramount',
          'Generalized peritonism usually indicates need for surgery',
          'CT is gold standard imaging for acute abdomen',
          'Erect CXR for free air in suspected perforation',
          'Early cholecystectomy (within 72h) for acute cholecystitis',
          'Strangulation signs mandate urgent surgery in bowel obstruction',
          'Always exclude ectopic pregnancy in women of reproductive age'
        ],
        examTips: [
          'Know classic presentations of common acute abdominal conditions',
          'Pain migration pattern of appendicitis is commonly tested',
          'Indications for surgery in bowel obstruction',
          'Free air under diaphragm = perforation until proven otherwise'
        ],
        clinicalPearls: [
          'Elderly and immunocompromised patients may have minimal signs',
          'A normal white cell count doesn\'t exclude surgical pathology',
          'CT can miss early appendicitis—clinical judgment required',
          'Perforation can occur without free air (sealed, retroperitoneal)'
        ],
        commonMistakes: [
          'Missing ectopic pregnancy in women',
          'Delaying surgery for obstruction with strangulation signs',
          'Over-relying on investigations when clinical picture is clear',
          'Giving strong analgesia before surgical review (debated)'
        ],
        references: [
          'WSES Guidelines: Acute Appendicitis 2020',
          'Tokyo Guidelines: Acute Cholecystitis 2018',
          'WSES Guidelines: Acute Mechanical Intestinal Obstruction 2017',
          'Gans SL et al. Systematic review of acute appendicitis. Br J Surg 2019'
        ],
        selfAssessment: [
          {
            id: 'jr-6-1-q1',
            question: 'A patient with small bowel obstruction has tachycardia, fever, and localized peritonism. What is the most appropriate management?',
            options: [
              'Continue conservative management with NG decompression',
              'Urgent surgical exploration',
              'CT scan before deciding',
              'Water-soluble contrast follow-through'
            ],
            correctAnswer: 1,
            explanation: 'Fever, tachycardia, and localized peritonism in SBO suggest strangulation. This is a surgical emergency requiring urgent exploration. Delaying for investigations risks bowel necrosis.'
          },
          {
            id: 'jr-6-1-q2',
            question: 'What is the preferred timing for laparoscopic cholecystectomy in acute cholecystitis?',
            options: [
              'After 6 weeks to allow inflammation to settle',
              'Within 72 hours of admission',
              'After antibiotic course completed',
              'Only if percutaneous drainage fails'
            ],
            correctAnswer: 1,
            explanation: 'Early cholecystectomy (within 72 hours) is preferred for acute cholecystitis. It reduces overall hospital stay, complications, and costs compared to delayed surgery.'
          }
        ]
      }
    }
  ]
};

const JR_MODULE_7: CMEModule = {
  id: 'jr-module-7',
  title: 'Section 7: Modern Surgical Practice',
  level: 'junior_resident',
  topics: [
    {
      id: 'jr-7-1',
      moduleId: 'jr-module-7',
      title: 'Evidence-Based Surgery and Critical Appraisal',
      article: {
        title: 'Evidence-Based Surgery and Critical Appraisal',
        overview: 'Evidence-based surgery integrates best available research evidence with clinical expertise and patient values. Critical appraisal skills allow surgeons to evaluate literature quality and apply findings appropriately. This is essential for modern surgical practice.',
        learningObjectives: [
          'Define evidence-based medicine and its components',
          'Understand the hierarchy of evidence',
          'Critically appraise randomized controlled trials',
          'Interpret common statistical measures',
          'Apply evidence to clinical practice'
        ],
        sections: [
          {
            title: 'Evidence-Based Medicine',
            content: 'EBM integrates three components: best research evidence, clinical expertise, and patient values/preferences. None alone is sufficient for optimal decision-making.',
            subsections: [
              {
                title: 'Asking Clinical Questions (PICO)',
                content: 'P: Patient/Population. I: Intervention. C: Comparison. O: Outcome. Example: In adults with appendicitis (P), does laparoscopic appendicectomy (I) compared to open (C) reduce wound infection (O)?'
              }
            ]
          },
          {
            title: 'Hierarchy of Evidence',
            content: 'Not all evidence is equal. Higher levels provide stronger evidence for causation.',
            subsections: [
              {
                title: 'Levels',
                content: 'Level 1: Systematic reviews of RCTs. Level 2: Individual RCTs. Level 3: Cohort studies. Level 4: Case-control studies. Level 5: Case series, expert opinion. Meta-analyses synthesize multiple studies.'
              },
              {
                title: 'Study Design Choice',
                content: 'RCTs best for therapy questions. Cohort for prognosis. Case-control for rare outcomes or diseases. Cross-sectional for prevalence. Qualitative for understanding experiences.'
              }
            ]
          },
          {
            title: 'Critical Appraisal of RCTs',
            content: 'Assess validity (bias risk), results (effect size and precision), and applicability.',
            subsections: [
              {
                title: 'Assessing Validity (Bias)',
                content: 'Selection bias: adequate randomization and allocation concealment? Performance bias: blinding of participants and personnel? Detection bias: blinding of outcome assessors? Attrition bias: complete follow-up, intention-to-treat analysis? Reporting bias: all outcomes reported?'
              },
              {
                title: 'Understanding Results',
                content: 'Effect measures: RR, OR, ARR, NNT. Confidence intervals: precision of estimate. p-value: probability result is due to chance (<0.05 conventionally "significant"). Clinical vs. statistical significance may differ.'
              },
              {
                title: 'Absolute vs. Relative Risk',
                content: 'RRR (relative risk reduction) can exaggerate effect. ARR (absolute risk reduction) shows actual benefit. NNT (number needed to treat) = 1/ARR. Example: RRR 50% sounds impressive, but if event rate 2% vs 1%, ARR is only 1%, NNT=100.'
              }
            ]
          },
          {
            title: 'Applying Evidence',
            content: 'Evidence must be integrated with clinical context and patient preferences.',
            subsections: [
              {
                title: 'External Validity',
                content: 'Do trial patients resemble your patient? Were exclusion criteria too strict? Is the setting applicable to your practice?'
              },
              {
                title: 'Shared Decision-Making',
                content: 'Present evidence in understandable terms. Discuss patient preferences and values. Incorporate into clinical recommendation. Document the decision-making process.'
              }
            ]
          }
        ],
        keyPoints: [
          'EBM = evidence + expertise + patient values',
          'PICO structures clinical questions',
          'RCTs are best for therapy questions',
          'Assess bias risk when appraising RCTs',
          'Understand RRR vs. ARR and NNT',
          'Statistical significance ≠ clinical significance',
          'Evidence must be applied in context'
        ],
        examTips: [
          'Know the hierarchy of evidence',
          'Understand common biases in RCTs',
          'Be able to calculate NNT from ARR',
          'Recognize when RRR overstates benefit'
        ],
        clinicalPearls: [
          'High-quality RCT may not apply to your patient—assess carefully',
          'Absence of evidence is not evidence of absence',
          'Industry-funded trials more likely to show positive results—consider bias',
          'Patient-reported outcomes increasingly important'
        ],
        commonMistakes: [
          'Accepting relative risk reduction without considering absolute risk',
          'Ignoring confidence intervals',
          'Applying trial results to dissimilar patients',
          'Assuming statistical significance means clinical importance'
        ],
        references: [
          'Sackett DL et al. Evidence-Based Medicine. Churchill Livingstone 2000',
          'CONSORT Statement for reporting RCTs',
          'Cochrane Handbook for Systematic Reviews',
          'Guyatt GH et al. GRADE Guidelines. JCE 2011'
        ],
        selfAssessment: [
          {
            id: 'jr-7-1-q1',
            question: 'A drug reduces event rate from 4% to 2%. What is the NNT?',
            options: [
              '25',
              '50',
              '100',
              '200'
            ],
            correctAnswer: 1,
            explanation: 'ARR = 4% - 2% = 2% = 0.02. NNT = 1/ARR = 1/0.02 = 50. You need to treat 50 patients to prevent one event.'
          },
          {
            id: 'jr-7-1-q2',
            question: 'Which type of bias is controlled by allocation concealment?',
            options: [
              'Detection bias',
              'Selection bias',
              'Performance bias',
              'Attrition bias'
            ],
            correctAnswer: 1,
            explanation: 'Allocation concealment prevents selection bias by ensuring those enrolling patients cannot predict (and thus manipulate) group assignment. Blinding addresses performance and detection bias.'
          }
        ]
      }
    },
    {
      id: 'jr-7-2',
      moduleId: 'jr-module-7',
      title: 'Quality Improvement and Patient Safety',
      article: {
        title: 'Quality Improvement and Patient Safety',
        overview: 'Patient safety and quality improvement are fundamental to modern surgical practice. Understanding systems thinking, safety culture, and improvement methodology is essential for reducing harm and improving outcomes.',
        learningObjectives: [
          'Understand the epidemiology of medical error',
          'Apply systems thinking to patient safety',
          'Know common safety tools and practices',
          'Conduct a root cause analysis',
          'Apply quality improvement methodology (PDSA)'
        ],
        sections: [
          {
            title: 'The Burden of Harm',
            content: 'Medical error is a leading cause of death. The IOM report "To Err is Human" catalyzed the patient safety movement.',
            subsections: [
              {
                title: 'Epidemiology',
                content: 'Estimated 44,000-98,000 deaths annually from medical errors in US (IOM 1999). Adverse events in 3-17% of hospital admissions. 30-50% are preventable. Surgery has high error rates due to complexity, time pressure, and invasiveness.'
              },
              {
                title: 'Types of Error',
                content: 'Active errors: mistakes at the sharp end (wrong drug, wrong site). Latent conditions: system factors that predispose to error (understaffing, poor design). Human factors: fatigue, distraction, communication failures.'
              }
            ]
          },
          {
            title: 'Systems Thinking',
            content: 'Errors result from system failures, not just individual failures. Blaming individuals does not prevent recurrence.',
            subsections: [
              {
                title: 'Swiss Cheese Model (Reason)',
                content: 'Multiple defensive layers exist (like slices of cheese). Each has holes (weaknesses). Harm occurs when holes align. Prevention requires multiple redundant defenses.'
              },
              {
                title: 'Just Culture',
                content: 'Distinguish between human error (console), at-risk behavior (coach), and reckless behavior (discipline). Encourage reporting without fear. Learn from near-misses and errors.'
              }
            ]
          },
          {
            title: 'Safety Tools',
            content: 'Standardized approaches reduce reliance on memory and vigilance.',
            subsections: [
              {
                title: 'Surgical Safety Checklist',
                content: 'WHO Checklist: Sign In (before anesthesia), Time Out (before incision), Sign Out (before leaving OR). Reduces mortality and complications by ~30% (Haynes 2009). All team members participate. Creates safety culture.'
              },
              {
                title: 'Other Tools',
                content: 'SBAR: Structured communication (Situation, Background, Assessment, Recommendation). Timeout: Pause before critical actions. Read-back: Verbal confirmation of orders. Handoff protocols: Structured transitions of care.'
              }
            ]
          },
          {
            title: 'Root Cause Analysis',
            content: 'Systematic approach to investigating serious incidents.',
            subsections: [
              {
                title: 'Process',
                content: '1. Define the problem. 2. Gather data. 3. Identify contributing factors. 4. Find root causes (ask "why" 5 times). 5. Develop recommendations. 6. Implement and monitor.'
              },
              {
                title: 'Common Root Causes',
                content: 'Communication failures. Inadequate training. Equipment problems. Fatigue and workload. Lack of supervision. Poor team dynamics.'
              }
            ]
          },
          {
            title: 'Quality Improvement',
            content: 'Systematic approach to improving care.',
            subsections: [
              {
                title: 'PDSA Cycle',
                content: 'Plan: Identify problem, plan intervention. Do: Implement on small scale. Study: Analyze results. Act: Adopt, adapt, or abandon. Iterate cycles for continuous improvement.'
              },
              {
                title: 'Measuring Quality',
                content: 'Structure: resources and organization. Process: what is done. Outcome: patient results. Balance measures: unintended consequences.'
              }
            ]
          }
        ],
        keyPoints: [
          'Medical error is a leading cause of death',
          'Systems thinking: errors result from system failures',
          'Swiss cheese model: multiple defenses needed',
          'Just culture distinguishes error from recklessness',
          'WHO Surgical Safety Checklist reduces mortality 30%',
          'Root cause analysis investigates system failures',
          'PDSA cycles drive continuous improvement'
        ],
        examTips: [
          'Know the WHO Surgical Safety Checklist components',
          'Understand Swiss cheese model',
          'PDSA cycle steps',
          'Difference between active errors and latent conditions'
        ],
        clinicalPearls: [
          'The person who made the error is often the victim too—support them',
          'Near-misses are opportunities to learn before harm occurs',
          'Checklist compliance must be genuine, not tick-box',
          'Improvement is iterative—expect multiple PDSA cycles'
        ],
        commonMistakes: [
          'Blaming individuals without addressing systems',
          'Skipping checklist steps due to time pressure',
          'Not reporting near-misses',
          'Implementing changes without measuring effect'
        ],
        references: [
          'IOM. To Err is Human. National Academies Press 1999',
          'Haynes AB et al. Surgical Safety Checklist. NEJM 2009',
          'Reason J. Human error: models and management. BMJ 2000',
          'Langley GJ et al. The Improvement Guide. Jossey-Bass 2009'
        ],
        selfAssessment: [
          {
            id: 'jr-7-2-q1',
            question: 'According to the Swiss cheese model, what causes adverse events?',
            options: [
              'Individual incompetence',
              'Alignment of holes in multiple defensive layers',
              'Lack of protocols',
              'Equipment failure alone'
            ],
            correctAnswer: 1,
            explanation: 'The Swiss cheese model (Reason) proposes that adverse events occur when holes (weaknesses) in multiple defensive layers align, allowing a hazard to reach the patient. No single failure is usually sufficient.'
          },
          {
            id: 'jr-7-2-q2',
            question: 'What does "S" stand for in PDSA cycle?',
            options: [
              'Start',
              'Study',
              'Sustain',
              'Standardize'
            ],
            correctAnswer: 1,
            explanation: 'PDSA = Plan, Do, Study, Act. The Study phase involves analyzing results of the intervention implemented in the Do phase to determine if improvement occurred.'
          }
        ]
      }
    }
  ]
};

JUNIOR_RESIDENT_MODULES.push(JR_MODULE_5, JR_MODULE_6, JR_MODULE_7);

// ==================== SENIOR RESIDENT CME MODULES ====================

const SR_MODULE_1: CMEModule = {
  id: 'sr-module-1',
  title: 'Module 1: General Principles of Plastic Surgery',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-1-1',
      moduleId: 'sr-module-1',
      title: 'Flap Classification and Physiology',
      article: {
        title: 'Flap Classification and Physiology',
        overview: 'Flaps are the foundation of reconstructive surgery. Understanding flap classification, blood supply, and physiology is essential for planning and executing reliable tissue transfer. The senior resident must master flap selection and troubleshooting.',
        learningObjectives: [
          'Classify flaps by composition, blood supply, and movement',
          'Understand the physiology of flap perfusion',
          'Recognize and manage flap compromise',
          'Apply the reconstructive ladder and elevator concepts',
          'Know indications for different flap types'
        ],
        sections: [
          {
            title: 'Flap Classification',
            content: 'Flaps are classified by multiple characteristics, enabling precise description and communication.',
            subsections: [
              {
                title: 'By Tissue Composition',
                content: 'Cutaneous: skin and subcutaneous tissue. Fasciocutaneous: includes deep fascia. Muscle: muscle alone. Musculocutaneous: muscle with overlying skin. Osseocutaneous: bone with soft tissue. Composite: multiple tissue types.'
              },
              {
                title: 'By Blood Supply',
                content: 'Random pattern: perfused by subdermal plexus, no named vessel, limited length:width ratio. Axial pattern: contains a named vessel running along flap axis, can be longer. Perforator: based on perforating vessels from deep system.'
              },
              {
                title: 'By Movement',
                content: 'Local: advancement, rotation, transposition. Regional: interpolation (staged), pedicled (from adjacent region). Distant: pedicled requiring immobilization, or free (microvascular).'
              },
              {
                title: 'Mathes-Nahai Classification (Muscle Flaps)',
                content: 'Type I: Single vascular pedicle (TFL, gastrocnemius). Type II: Dominant + minor pedicles (gracilis, trapezius). Type III: Two dominant pedicles (gluteus maximus, rectus abdominis). Type IV: Segmental vessels (sartorius, tibialis anterior). Type V: One dominant + secondary segmental (latissimus dorsi, pectoralis major).'
              }
            ]
          },
          {
            title: 'Flap Physiology',
            content: 'Understanding perfusion helps predict viability and manage complications.',
            subsections: [
              {
                title: 'Blood Flow in Flaps',
                content: 'Flap elevation disrupts native blood supply. Perfusion pressure decreases distally. Choke vessels connect adjacent angiosomes. Flap delay: staged division increases choke vessel recruitment.'
              },
              {
                title: 'Angiosome Concept (Taylor)',
                content: '40 angiosomes in body, each supplied by source artery. Flaps can capture adjacent angiosomes via choke anastomoses. Safe to include one adjacent angiosome; two may be unreliable without delay.'
              },
              {
                title: 'Ischemia-Reperfusion Injury',
                content: 'Primary ischemia during elevation/transfer. Reperfusion generates free radicals, inflammation. Contributes to flap failure, especially in marginal flaps. Minimized by atraumatic technique, avoiding prolonged ischemia.'
              }
            ]
          },
          {
            title: 'Flap Monitoring and Complications',
            content: 'Early recognition of compromise enables salvage.',
            subsections: [
              {
                title: 'Clinical Monitoring',
                content: 'Color: pink (healthy), pale (arterial), congested/purple (venous). Capillary refill: brisk (normal), absent (arterial), rapid/purple (venous). Temperature: warm (healthy), cool (ischemic). Bleeding: bright red (healthy), dark (venous), none (arterial).'
              },
              {
                title: 'Adjuncts',
                content: 'Handheld Doppler: arterial signal presence. Implantable Doppler: continuous monitoring. Near-infrared spectroscopy. Fluorescent angiography (ICG).'
              },
              {
                title: 'Managing Compromise',
                content: 'Venous congestion: release sutures, elevate, leeches, heparin. Arterial: return to OR, check anastomosis, thrombectomy, revision. Prevention: avoid tension, kinking, compression, hematoma.'
              }
            ]
          },
          {
            title: 'Reconstructive Principles',
            content: 'Systematic approach to wound coverage.',
            subsections: [
              {
                title: 'Reconstructive Ladder',
                content: 'Simplest to complex: Secondary intention → Primary closure → Skin graft → Local flap → Regional flap → Free flap. Start simple, escalate if needed.'
              },
              {
                title: 'Reconstructive Elevator',
                content: 'Modern concept: Choose optimal technique for result, not necessarily simplest. Consider function, aesthetics, donor morbidity. May go directly to free flap if best option.'
              }
            ]
          }
        ],
        keyPoints: [
          'Flaps classified by composition, blood supply, and movement',
          'Random flaps limited by length:width; axial flaps follow named vessel',
          'Mathes-Nahai Types I-V describe muscle flap blood supply',
          'Angiosomes define tissue territories; choke vessels allow capture of adjacent zones',
          'Venous congestion: purple, rapid refill; Arterial: pale, no refill',
          'Reconstructive elevator: optimal reconstruction, not just simplest',
          'Flap delay increases reliability by recruiting choke vessels'
        ],
        examTips: [
          'Mathes-Nahai classification with examples is a common exam question',
          'Know clinical signs of arterial vs. venous compromise',
          'Understand angiosome concept and choke vessels',
          'Examples of each flap type should be memorized'
        ],
        clinicalPearls: [
          'When in doubt, check in OR—early return saves flaps',
          'Venous congestion is more common than arterial; release tight sutures first',
          'Smokers have impaired choke vessel dilation—counsel and use caution',
          'Free tissue transfer sometimes safer than long pedicled flap'
        ],
        commonMistakes: [
          'Ignoring early warning signs of compromise',
          'Closing skin too tight causing venous congestion',
          'Forgetting to check flap viability intraoperatively before closing',
          'Not having a backup plan before starting complex reconstruction'
        ],
        references: [
          'Taylor GI, Palmer JH. The vascular territories (angiosomes) of the body. Br J Plast Surg 1987',
          'Mathes SJ, Nahai F. Classification of the vascular anatomy of muscles. Plast Reconstr Surg 1981',
          'Gottlieb LJ, Krieger LM. From the reconstructive ladder to the reconstructive elevator. Plast Reconstr Surg 1994',
          'Cormack GC, Lamberty BGH. The Arterial Anatomy of Skin Flaps, 2nd Ed'
        ],
        selfAssessment: [
          {
            id: 'sr-1-1-q1',
            question: 'A muscle with one dominant pedicle and secondary segmental pedicles is classified as:',
            options: [
              'Type II',
              'Type III',
              'Type IV',
              'Type V'
            ],
            correctAnswer: 3,
            explanation: 'Type V muscles (e.g., latissimus dorsi, pectoralis major) have one dominant pedicle plus secondary segmental vessels, allowing survival on either.'
          },
          {
            id: 'sr-1-1-q2',
            question: 'A flap appears purple with rapid capillary refill and dark bleeding. What is the likely problem?',
            options: [
              'Arterial insufficiency',
              'Venous congestion',
              'Normal postoperative appearance',
              'Hematoma beneath flap'
            ],
            correctAnswer: 1,
            explanation: 'Purple color, rapid/brisk capillary refill, and dark blood indicate venous congestion—outflow obstruction with intact inflow. Arterial insufficiency shows pale flap, absent refill, no bleeding.'
          }
        ]
      }
    },
    {
      id: 'sr-1-2',
      moduleId: 'sr-module-1',
      title: 'Microsurgery Fundamentals',
      article: {
        title: 'Microsurgery Fundamentals',
        overview: 'Microsurgery enables free tissue transfer, replantation, and nerve repair. Mastery requires technical precision, understanding of physiology, and diligent postoperative monitoring. The senior resident must develop proficiency in microvascular techniques.',
        learningObjectives: [
          'Describe microsurgical instrumentation and technique',
          'Understand principles of microvascular anastomosis',
          'Know indications for free tissue transfer',
          'Manage microvascular complications',
          'Apply principles of nerve repair'
        ],
        sections: [
          {
            title: 'Microsurgical Equipment',
            content: 'Specialized instruments and magnification are essential.',
            subsections: [
              {
                title: 'Operating Microscope',
                content: 'Magnification typically 10-25×. Coaxial illumination. Foot controls for zoom, focus. Assistant\'s oculars for teaching. Some use loupes (2.5-4.5×) for larger vessel work.'
              },
              {
                title: 'Instruments',
                content: 'Jeweler\'s forceps (fine tip, minimal tissue trauma). Microscissors (straight, curved). Microneedle holders. Vessel dilators. Background material (colored plastic, rubber dam). Microvascular clamps (various sizes).'
              },
              {
                title: 'Suture Material',
                content: '8-0 to 11-0 nylon for vascular anastomoses. 9-0 to 10-0 for peripheral nerves. 8-0 for digital vessels. Needle: 50-150 microns, 3/8 circle.'
              }
            ]
          },
          {
            title: 'Microvascular Anastomosis',
            content: 'End-to-end or end-to-side anastomosis of vessels typically 1-4mm diameter.',
            subsections: [
              {
                title: 'Technique',
                content: '1. Prepare vessel ends (adventitia stripped). 2. Irrigate with heparinized saline. 3. Approximate with double clamp. 4. Place stay sutures (120° apart or 180°). 5. Complete front wall, then back wall. 6. Remove clamps, check patency.'
              },
              {
                title: 'Anastomosis Testing',
                content: 'Flicker test: occlude distal, strip vessel, release—should fill. Patency test: strip vessel, watch refill from both ends. Empty and refill sign (milking test).'
              },
              {
                title: 'End-to-Side Anastomosis',
                content: 'Indicated when donor vessel is end-artery. Preserves flow to distal tissues. Arteriotomy 1.5× vessel diameter. Ellipse may improve flow dynamics.'
              }
            ]
          },
          {
            title: 'Free Tissue Transfer',
            content: 'Flap moved to distant site with microvascular anastomosis.',
            subsections: [
              {
                title: 'Common Free Flaps',
                content: 'ALT (anterolateral thigh): workhorse, versatile, sensate option. Radial forearm: thin, pliable, good for intraoral. Fibula: vascularized bone for mandible, long bone. DIEP (deep inferior epigastric perforator): breast reconstruction. Gracilis: functional muscle transfer.'
              },
              {
                title: 'Recipient Vessel Selection',
                content: 'Size match with flap pedicle. Out of zone of injury. Adequate inflow and outflow. Common recipients: facial vessels, internal mammary, thoracodorsal, radial/ulnar, tibial vessels.'
              },
              {
                title: 'Ischemia Time',
                content: 'Warm ischemia: <2 hours for muscle flaps, 4-6 hours for fasciocutaneous. Cold ischemia extends safe time. Minimize ischemia by two-team approach.'
              }
            ]
          },
          {
            title: 'Complications and Salvage',
            content: 'Early recognition and intervention are critical.',
            subsections: [
              {
                title: 'Thrombosis',
                content: 'Usually occurs within 48-72 hours. Causes: technical error, kinking, vessel spasm, hematoma compression. Management: immediate re-exploration, thrombectomy, revision of anastomosis, vein grafts if needed.'
              },
              {
                title: 'Flap Salvage',
                content: 'Success decreases with time—operate urgently. Salvage rates: 50-80% if recognized early. Release constricting sutures/dressings first. Check for hematoma. Take to OR without delay.'
              }
            ]
          },
          {
            title: 'Nerve Repair Principles',
            content: 'Microsurgery enables primary repair and nerve grafting.',
            subsections: [
              {
                title: 'Technique',
                content: 'Tension-free epineurial or group fascicular repair. 9-0 or 10-0 nylon. Align fascicles (epineurial vessels as guide). Avoid excessive sutures. Nerve grafts (sural nerve) for gaps.'
              },
              {
                title: 'Outcomes',
                content: 'Axon regeneration: ~1mm/day. Better outcomes: young, sharp injury, early repair, distal repair. Sensory recovers better than motor. Nerve conduits for small gaps (<3cm).'
              }
            ]
          }
        ],
        keyPoints: [
          '8-0 to 11-0 nylon for microvascular anastomosis',
          'End-to-end: most common; end-to-side preserves distal flow',
          'Patency tests: flicker, empty-and-refill',
          'Warm ischemia: <2h muscle, 4-6h fasciocutaneous',
          'Thrombosis usually within 72h—return to OR immediately',
          'Nerve regeneration ~1mm/day',
          'Sural nerve is common graft donor'
        ],
        examTips: [
          'Know common free flaps and their indications',
          'Understand arterial vs. venous thrombosis presentation',
          'Ischemia time limits are commonly tested',
          'Nerve regeneration rate (1mm/day) is a classic answer'
        ],
        clinicalPearls: [
          'Better one good vein than two bad ones—quality over quantity',
          'Venous thrombosis more common than arterial in free flaps',
          'Position matters—avoid kinking, compression, dependency',
          'Two-team approach reduces ischemia time significantly'
        ],
        commonMistakes: [
          'Inadequate vessel preparation (leaving adventitia)',
          'Excessive tension on anastomosis',
          'Ignoring early signs of flap compromise',
          'Delaying return to OR when flap is compromised'
        ],
        references: [
          'Acland RD. Microsurgery Practice Manual. Mosby 1989',
          'Wei FC, Mardini S. Flaps and Reconstructive Surgery, 2nd Ed',
          'Khouri RK et al. A prospective study of microvascular free-flap surgery. Plast Reconstr Surg 1998',
          'Sunderland S. Nerve Injuries and Their Repair. Churchill Livingstone 1991'
        ],
        selfAssessment: [
          {
            id: 'sr-1-2-q1',
            question: 'What is the approximate rate of peripheral nerve axon regeneration?',
            options: [
              '0.1 mm/day',
              '1 mm/day',
              '1 cm/day',
              '5 mm/day'
            ],
            correctAnswer: 1,
            explanation: 'Peripheral nerve axons regenerate at approximately 1 mm/day (or ~1 inch/month). This rate is used to predict recovery time after nerve repair or injury.'
          },
          {
            id: 'sr-1-2-q2',
            question: 'Which finding suggests arterial thrombosis rather than venous congestion in a free flap?',
            options: [
              'Purple discoloration',
              'Rapid capillary refill',
              'Pale flap with absent capillary refill',
              'Dark blood on pinprick'
            ],
            correctAnswer: 2,
            explanation: 'Arterial thrombosis presents with pale/white flap, absent or very slow capillary refill, and no bleeding on pinprick. Venous congestion shows purple flap, rapid refill, and dark bleeding.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_2: CMEModule = {
  id: 'sr-module-2',
  title: 'Module 2: Trauma and Reconstruction',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-2-1',
      moduleId: 'sr-module-2',
      title: 'Lower Limb Reconstruction',
      article: {
        title: 'Lower Limb Reconstruction',
        overview: 'Lower limb trauma presents complex reconstructive challenges. Timing, wound bed preparation, and appropriate flap selection determine outcomes. The Gustilo classification guides management of open fractures, while the reconstructive ladder informs soft tissue coverage.',
        learningObjectives: [
          'Apply Gustilo classification to open fractures',
          'Understand the fix-and-flap principle',
          'Select appropriate flaps for different lower limb zones',
          'Know indications for amputation vs. reconstruction',
          'Manage the mangled extremity'
        ],
        sections: [
          {
            title: 'Gustilo Classification of Open Fractures',
            content: 'Guides treatment decisions and predicts outcomes.',
            subsections: [
              {
                title: 'Classification',
                content: 'Type I: Wound <1cm, minimal contamination, low energy. Type II: Wound 1-10cm, moderate soft tissue damage. Type IIIA: Adequate soft tissue coverage despite extensive injury. Type IIIB: Requires flap coverage. Type IIIC: Vascular injury requiring repair.'
              },
              {
                title: 'Implications',
                content: 'Type I/II: Often managed with local wound care, primary/delayed closure. Type IIIB: Flap coverage essential for bone healing. Type IIIC: Limb-threatening, high amputation rate. Classification is done intraoperatively after debridement.'
              }
            ]
          },
          {
            title: 'Fix and Flap',
            content: 'Orthoplastic approach: simultaneous skeletal fixation and soft tissue coverage.',
            subsections: [
              {
                title: 'Principles',
                content: 'Early definitive fixation within 72 hours when possible. Soft tissue coverage within 72 hours (early flap). Combined orthopedic-plastic surgery teams. Reduces infection, non-union, and hospital stay.'
              },
              {
                title: 'Timing Evidence',
                content: 'Godina (1986): flap within 72h—0.75% failure, 1.5% infection. After 72h: 12% failure, 17.5% infection. After 3 months: higher complication rates. Early flap is superior.'
              }
            ]
          },
          {
            title: 'Flap Selection by Anatomic Zone',
            content: 'Each zone has preferred local and free flap options.',
            subsections: [
              {
                title: 'Proximal Third (Zone 1)',
                content: 'Gastrocnemius muscle flap: reliable, pedicled, preserves function. Medial head for anteromedial defects. Lateral head for lateral defects. Large arc of rotation.'
              },
              {
                title: 'Middle Third (Zone 2)',
                content: 'Soleus muscle flap: pedicled, good coverage. May be used as hemisoleus (medial or lateral). Free flap often needed for larger defects.'
              },
              {
                title: 'Distal Third (Zone 3)',
                content: 'Free tissue transfer: ALT, gracilis, latissimus dorsi. Few local options. Propeller flaps (perforator-based) for smaller defects. Sural artery flap (distally based) limited use.'
              }
            ]
          },
          {
            title: 'Limb Salvage vs. Amputation',
            content: 'Decision requires multidisciplinary input and patient involvement.',
            subsections: [
              {
                title: 'Mangled Extremity Severity Score (MESS)',
                content: 'Scores: Skeletal/soft tissue, shock, ischemia, age. MESS ≥7 historically predicted amputation. Not absolute—clinical judgment essential. Modern microsurgery has improved salvage.'
              },
              {
                title: 'Considerations',
                content: 'Prolonged warm ischemia (>6h). Tibial nerve disruption. Multilevel injury. Patient factors: age, comorbidities, occupation, preference. Functional outcome of salvage vs. prosthesis. LEAP study: similar function at 2 years.'
              }
            ]
          }
        ],
        keyPoints: [
          'Gustilo classification: I, II, IIIA/B/C—determined intraoperatively',
          'Type IIIB requires flap coverage for bone healing',
          'Fix and flap within 72 hours improves outcomes',
          'Proximal third: gastrocnemius; Middle: soleus; Distal: free flap',
          'MESS ≥7 suggests amputation but is not absolute',
          'LEAP study: salvage and amputation have similar function at 2 years',
          'Orthoplastic collaboration is essential'
        ],
        examTips: [
          'Know Gustilo classification details',
          'Flap options by zone (proximal/middle/distal)',
          'Godina timing for flap coverage',
          'MESS score components and limitations'
        ],
        clinicalPearls: [
          'Classify Gustilo in OR after debridement, not in ED',
          'Don\'t delay flap for repeated debridements—72h is key',
          'Gastrocnemius is extremely reliable—use it',
          'Patient preference matters greatly in salvage vs. amputation'
        ],
        commonMistakes: [
          'Underestimating injury severity on initial assessment',
          'Delaying soft tissue coverage beyond 72 hours',
          'Using soleus for proximal defects (limited reach)',
          'Ignoring patient preference in amputation discussions'
        ],
        references: [
          'Gustilo RB et al. Open fractures: classification and management. J Bone Joint Surg 1984',
          'Godina M. Early microsurgical reconstruction of complex trauma. Plast Reconstr Surg 1986',
          'LEAP Study Group. Outcomes after amputation or reconstruction. NEJM 2002',
          'British Orthopaedic Association/BAPRAS Standards: Open Fractures 2020'
        ],
        selfAssessment: [
          {
            id: 'sr-2-1-q1',
            question: 'A Gustilo IIIB fracture is characterized by:',
            options: [
              'Wound <1cm with minimal contamination',
              'Adequate soft tissue coverage despite injury',
              'Extensive soft tissue loss requiring flap coverage',
              'Associated vascular injury requiring repair'
            ],
            correctAnswer: 2,
            explanation: 'Gustilo IIIB injuries have extensive soft tissue loss/damage that cannot be closed primarily and require flap coverage for bone healing. IIIC has vascular injury; IIIA has adequate coverage.'
          },
          {
            id: 'sr-2-1-q2',
            question: 'What is the preferred flap for proximal third tibial defect?',
            options: [
              'Free ALT flap',
              'Soleus muscle flap',
              'Gastrocnemius muscle flap',
              'Sural artery flap'
            ],
            correctAnswer: 2,
            explanation: 'Gastrocnemius muscle flap is the workhorse for proximal third tibial coverage. Medial or lateral head rotated to cover the defect. It is reliable, straightforward, and preserves function.'
          }
        ]
      }
    },
    {
      id: 'sr-2-2',
      moduleId: 'sr-module-2',
      title: 'Pressure Ulcer Reconstruction',
      article: {
        title: 'Pressure Ulcer Reconstruction',
        overview: 'Pressure ulcers represent a major healthcare burden, particularly in spinal cord injury patients. Surgical reconstruction must address the ulcer and underlying causes. Recurrence is common without comprehensive care.',
        learningObjectives: [
          'Classify pressure ulcers (NPUAP staging)',
          'Understand pathophysiology and prevention',
          'Optimize patients for surgical reconstruction',
          'Select appropriate flaps for each location',
          'Manage the high recurrence rate'
        ],
        sections: [
          {
            title: 'Staging and Pathophysiology',
            content: 'Pressure over bony prominences causes tissue ischemia and necrosis.',
            subsections: [
              {
                title: 'NPUAP Staging',
                content: 'Stage 1: Non-blanchable erythema, intact skin. Stage 2: Partial thickness, dermis exposed. Stage 3: Full thickness, fat visible. Stage 4: Full thickness with exposed bone, muscle, tendon. Unstageable: obscured by slough/eschar. Deep tissue injury: persistent non-blanchable erythema.'
              },
              {
                title: 'Pathophysiology',
                content: 'Pressure >32 mmHg (capillary closing pressure) causes ischemia. Time + pressure = necrosis. Muscle more susceptible than skin—ulcer is "iceberg" with larger deep component. Shear, friction, moisture contribute.'
              }
            ]
          },
          {
            title: 'Prevention and Optimization',
            content: 'Surgery without prevention leads to recurrence.',
            subsections: [
              {
                title: 'Prevention',
                content: 'Regular repositioning (2-hourly). Pressure-relieving mattresses/cushions. Skin care (moisture control). Nutrition optimization. Education and self-care when possible.'
              },
              {
                title: 'Preoperative Optimization',
                content: 'Nutrition: albumin >3, prealbumin >15, correct deficiencies. Spasm control: antispasmodics, botulinum toxin. Infection control: treat colonization vs. infection appropriately. Smoking cessation. Bowel/bladder management. Psychological preparation.'
              }
            ]
          },
          {
            title: 'Surgical Principles',
            content: 'Complete excision with durable reconstruction.',
            subsections: [
              {
                title: 'Operative Steps',
                content: '1. Excise ulcer, bursa, calcified tissue. 2. Remove bony prominence (ischiectomy for ischial, sacral shaving). 3. Adequate debridement to healthy tissue. 4. Flap reconstruction with padding. 5. Suction drains, tension-free closure. 6. Postoperative off-loading (6 weeks).'
              },
              {
                title: 'Ostectomy Considerations',
                content: 'Remove sufficient bone to eliminate pressure point. Over-resection risks: transfer to new area, urethral injury (ischiectomy). Bilateral ischiectomy risks perineal urethral fistula.'
              }
            ]
          },
          {
            title: 'Flaps by Location',
            content: 'Site-specific flap selection.',
            subsections: [
              {
                title: 'Sacral',
                content: 'Gluteus maximus musculocutaneous flap: V-Y advancement, rotation. Superior gluteal artery perforator (SGAP) flap. Lumbar artery perforator flap. Preserve options for future recurrences.'
              },
              {
                title: 'Ischial',
                content: 'Posterior thigh flap (inferior gluteal artery perforator). Gluteus maximus flap. Gracilis flap (can be sensate). V-Y hamstring advancement. Most common site, high recurrence.'
              },
              {
                title: 'Trochanteric',
                content: 'TFL (tensor fascia lata) flap. Vastus lateralis flap. ALT flap. Gluteus medius flap.'
              }
            ]
          },
          {
            title: 'Recurrence Prevention',
            content: 'Recurrence rates 25-80% despite successful surgery.',
            subsections: [
              {
                title: 'Strategies',
                content: 'Lifelong pressure relief. Specialized seating and mattresses. Regular skin checks. Smoking and nutrition counseling. Social support. Plan for future flap options.'
              }
            ]
          }
        ],
        keyPoints: [
          'Pressure ulcer is "iceberg"—deeper than surface appears',
          'Stage 3/4 require surgical reconstruction',
          'Optimize nutrition, spasm, infection before surgery',
          'Excise ulcer + bursa, remove bony prominence',
          'Sacral: gluteus maximus flap; Ischial: posterior thigh, hamstring',
          'Recurrence 25-80%—prevention is essential',
          'Preserve future flap options'
        ],
        examTips: [
          'Know NPUAP staging',
          'Flaps for each location (sacral, ischial, trochanteric)',
          'Preoperative optimization requirements',
          'Why recurrence is so common'
        ],
        clinicalPearls: [
          'If spasm is not controlled, the flap will fail',
          'Drains are essential—remove hematoma/seroma',
          'Sitting protocol: gradual increase over 4-6 weeks',
          'First flap best—preserve options for recurrences'
        ],
        commonMistakes: [
          'Operating on malnourished patient',
          'Inadequate debridement/bony resection',
          'Not planning for recurrences',
          'Ignoring underlying cause (spasm, poor pressure relief)'
        ],
        references: [
          'NPUAP/EPUAP International Pressure Ulcer Guidelines 2019',
          'Keys KA et al. Multivariate predictors of failure after flap coverage of pressure ulcers. Plast Reconstr Surg 2010',
          'Schryvers OI et al. Surgical treatment of pressure ulcers. Arch Phys Med Rehabil 2000',
          'Yamamoto Y et al. Pressures ulcer surgery. Clin Plast Surg 1998'
        ],
        selfAssessment: [
          {
            id: 'sr-2-2-q1',
            question: 'Which is the most appropriate flap for ischial pressure ulcer?',
            options: [
              'TFL flap',
              'Posterior thigh/hamstring flap',
              'Lumbar perforator flap',
              'Latissimus dorsi free flap'
            ],
            correctAnswer: 1,
            explanation: 'Posterior thigh flap (based on profunda artery perforators or inferior gluteal artery) and hamstring V-Y advancement are workhorse flaps for ischial pressure ulcers. TFL is used for trochanteric ulcers.'
          },
          {
            id: 'sr-2-2-q2',
            question: 'What is the minimum serum albumin level generally recommended before pressure ulcer flap surgery?',
            options: [
              '>2.0 g/dL',
              '>2.5 g/dL',
              '>3.0 g/dL',
              '>3.5 g/dL'
            ],
            correctAnswer: 2,
            explanation: 'Serum albumin >3.0 g/dL is generally recommended before flap surgery for pressure ulcers. Malnutrition is a major risk factor for flap failure and wound complications.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_3: CMEModule = {
  id: 'sr-module-3',
  title: 'Module 3: Burns and Reconstruction',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-3-1',
      moduleId: 'sr-module-3',
      title: 'Burn Scar Reconstruction',
      article: {
        title: 'Burn Scar Reconstruction',
        overview: 'Burn scar contractures cause significant functional and aesthetic impairment. Reconstruction aims to restore function, release contractures, and improve appearance. Timing, technique selection, and rehabilitation are critical for success.',
        learningObjectives: [
          'Classify burn scar contractures',
          'Understand timing of reconstruction',
          'Select appropriate surgical techniques',
          'Plan postoperative rehabilitation',
          'Manage hypertrophic scarring'
        ],
        sections: [
          {
            title: 'Scar Contracture Classification',
            content: 'Contractures limit range of motion and distort anatomy.',
            subsections: [
              {
                title: 'Anatomic Classification',
                content: 'Linear (band): single contracting band. Broad: wide area of scarring. Circumferential: encircling limb/digit. Web space: syndactyly-like. Regional: affecting specific functional unit.'
              },
              {
                title: 'Functional Impact',
                content: 'Mild: <25% ROM loss. Moderate: 25-50% ROM loss. Severe: >50% ROM loss. Complete: no ROM. Priorities: eyelids, mouth, hands, major joints.'
              }
            ]
          },
          {
            title: 'Timing of Reconstruction',
            content: 'Balance between early intervention and scar maturation.',
            subsections: [
              {
                title: 'Early Release',
                content: 'Indicated for: eyelid ectropion (corneal exposure), microstomia, severe functional limitation, growing children (prevent growth disturbance). Splinting and therapy may temporize.'
              },
              {
                title: 'Delayed Reconstruction',
                content: 'Most elective reconstruction: 6-12 months post-burn. Allows scar maturation. Hypertrophic scars may soften over 12-18 months. Serial assessment guides timing.'
              }
            ]
          },
          {
            title: 'Surgical Techniques',
            content: 'Technique selection based on contracture type and location.',
            subsections: [
              {
                title: 'Z-Plasty and Variants',
                content: 'Z-plasty: lengthens scar by 25-75% depending on angle. Multiple Z-plasties for longer scars. W-plasty: irregular scar revision. VY advancement: linear contractures.'
              },
              {
                title: 'Skin Grafts',
                content: 'Full thickness (FTSG): less contraction, better cosmesis, limited donor. Split thickness (STSG): larger areas, more contraction (30-40%). Sheet preferred over meshed for visible areas and joints.'
              },
              {
                title: 'Local Flaps',
                content: 'Provide like-for-like tissue. Transposition, rotation, advancement. Must be from outside scar zone. Limited by available normal tissue.'
              },
              {
                title: 'Free Tissue Transfer',
                content: 'For large defects, composite tissue needs, or when local tissue exhausted. ALT, radial forearm, parascapular common choices. Allows reconstruction in single stage.'
              },
              {
                title: 'Tissue Expansion',
                content: 'Generates additional normal skin. Useful for scalp, face, trunk. Time-intensive (2-3 months of expansion). Complications: infection, exposure, hematoma.'
              }
            ]
          },
          {
            title: 'Postoperative Care',
            content: 'Rehabilitation essential for maintaining surgical gains.',
            subsections: [
              {
                title: 'Splinting',
                content: 'Position of function during healing. Night splints long-term. Custom splints for specific deformities. Duration: 6-12 months or longer.'
              },
              {
                title: 'Physical Therapy',
                content: 'Early ROM exercises after graft take. Strengthening. Scar massage. Pressure garments (12-18 months). Silicone gel sheeting.'
              }
            ]
          }
        ],
        keyPoints: [
          'Early release for corneal exposure, microstomia, growth disturbance',
          'Most reconstruction at 6-12 months after scar maturation',
          'FTSG contracts less than STSG (30-40%)',
          'Z-plasty lengthens by 25-75% depending on limb angle',
          'Tissue expansion provides normal color/texture-matched skin',
          'Splinting and therapy essential post-reconstruction',
          'Pressure garments for 12-18 months'
        ],
        examTips: [
          'Know Z-plasty angles and length gain',
          'FTSG vs. STSG contraction rates',
          'Indications for early release',
          'Tissue expansion principles'
        ],
        clinicalPearls: [
          'Photograph and measure ROM preoperatively',
          'Therapy starts immediately post-op—not after healing',
          'Plan for multiple procedures—set expectations',
          'Immature red scars still changing—wait if possible'
        ],
        commonMistakes: [
          'Releasing contracture without adequate soft tissue coverage',
          'Using STSG where FTSG would be better (contraction)',
          'Inadequate splinting postoperatively',
          'Expecting single procedure to solve problem'
        ],
        references: [
          'Achauer BM et al. Burn Reconstruction. Thieme 1991',
          'Hudson DA, Renshaw A. An algorithm for release of burn contractures. Burns 2006',
          'Goel A, Shrivastava P. Post-burn scars and scar contractures. Indian J Plast Surg 2010',
          'Anzarut A et al. Quality of life after burn injury. J Burn Care Res 2005'
        ],
        selfAssessment: [
          {
            id: 'sr-3-1-q1',
            question: 'What is the expected contraction of a split thickness skin graft?',
            options: [
              '5-10%',
              '10-20%',
              '30-40%',
              '50-60%'
            ],
            correctAnswer: 2,
            explanation: 'Split thickness skin grafts contract approximately 30-40% due to myofibroblast activity in the wound bed. Full thickness grafts contract much less (5-10%).'
          },
          {
            id: 'sr-3-1-q2',
            question: 'Which condition requires early burn scar release?',
            options: [
              'Mild elbow contracture with 25% ROM loss',
              'Hypertrophic scarring of forearm',
              'Lower eyelid ectropion with corneal exposure',
              'Mature scar band across neck'
            ],
            correctAnswer: 2,
            explanation: 'Eyelid ectropion with corneal exposure requires urgent release to prevent corneal ulceration and blindness. Other conditions can wait for scar maturation.'
          }
        ]
      }
    }
  ]
};

export const SENIOR_RESIDENT_MODULES: CMEModule[] = [SR_MODULE_1, SR_MODULE_2, SR_MODULE_3];

const SR_MODULE_4: CMEModule = {
  id: 'sr-module-4',
  title: 'Module 4: Paediatric Plastic Surgery',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-4-1',
      moduleId: 'sr-module-4',
      title: 'Cleft Lip and Palate',
      article: {
        title: 'Cleft Lip and Palate',
        overview: 'Cleft lip and palate is the most common craniofacial anomaly. Comprehensive care requires a multidisciplinary team and staged surgical intervention from infancy through adolescence. Understanding embryology, classification, and treatment protocols is essential.',
        learningObjectives: [
          'Understand the embryology of cleft formation',
          'Classify clefts accurately',
          'Know the timing and goals of surgical repair',
          'Describe primary lip and palate repair techniques',
          'Understand long-term management and secondary procedures'
        ],
        sections: [
          {
            title: 'Embryology',
            content: 'Facial development involves fusion of facial prominences during weeks 4-12 of gestation.',
            subsections: [
              {
                title: 'Normal Development',
                content: 'Week 4-5: Frontonasal, maxillary, and mandibular prominences form. Week 6-7: Medial nasal prominences fuse (forms philtrum and primary palate). Week 7-12: Lateral palatal shelves elevate and fuse (secondary palate).'
              },
              {
                title: 'Cleft Formation',
                content: 'Cleft lip: failure of fusion between medial nasal and maxillary prominence. Cleft palate: failure of lateral palatal shelf fusion. May occur independently or together. Genetic and environmental factors contribute.'
              }
            ]
          },
          {
            title: 'Classification',
            content: 'Clefts are described by location and extent.',
            subsections: [
              {
                title: 'Anatomic Classification',
                content: 'Cleft lip only (CL): unilateral or bilateral. Cleft lip and palate (CLP): most common complete cleft. Cleft palate only (CP): involves secondary palate. Primary palate: lip, alveolus, hard palate anterior to incisive foramen. Secondary palate: posterior to incisive foramen.'
              },
              {
                title: 'Severity',
                content: 'Complete: full thickness through lip/palate. Incomplete: partial involvement. Microform/forme fruste: minimal external defect. Submucous cleft palate: bifid uvula, zona pellucida, notched hard palate.'
              }
            ]
          },
          {
            title: 'Treatment Timeline',
            content: 'Staged approach addressing different concerns at appropriate ages.',
            subsections: [
              {
                title: 'Rule of 10s (Traditional)',
                content: '10 weeks, 10 lbs, Hemoglobin 10 g/dL for lip repair. Modern practice may repair earlier (8-12 weeks). Palate repair: 9-12 months (before speech development).'
              },
              {
                title: 'Treatment Sequence',
                content: 'Birth: feeding support, NAM if used. 3 months: lip repair. 9-12 months: palate repair. 5-6 years: speech assessment, pharyngoplasty if VPI. 8-10 years: alveolar bone graft. Adolescence: rhinoplasty, orthognathic surgery if needed.'
              }
            ]
          },
          {
            title: 'Surgical Techniques',
            content: 'Multiple techniques exist for lip and palate repair.',
            subsections: [
              {
                title: 'Cleft Lip Repair',
                content: 'Millard rotation-advancement: most popular for unilateral. Preserves philtral column. Rotation flap from medial element, advancement from lateral. Mohler modification common. Bilateral: synchronous or staged repair.'
              },
              {
                title: 'Cleft Palate Repair',
                content: 'Von Langenbeck: bipedicled mucoperiosteal flaps. Bardach (two-flap): widely used. Furlow double-opposing Z-plasty: lengthens palate, good for VPI. Vomer flap: nasal layer closure. Intravelar veloplasty: muscle reconstruction critical.'
              },
              {
                title: 'Goals of Repair',
                content: 'Lip: restore orbicularis oris continuity, create philtral column, symmetric nostrils. Palate: watertight seal for speech, velopharyngeal competence, minimize fistula, preserve maxillary growth.'
              }
            ]
          },
          {
            title: 'Long-Term Management',
            content: 'Cleft care extends to adulthood.',
            subsections: [
              {
                title: 'Speech',
                content: 'Velopharyngeal insufficiency (VPI): hypernasality, nasal emission. Speech therapy first-line. Pharyngoplasty or pharyngeal flap if persistent VPI. Close follow-up with speech pathologist.'
              },
              {
                title: 'Dental and Maxillary',
                content: 'Alveolar bone graft at 8-10 years (mixed dentition). Orthodontics throughout. Orthognathic surgery for maxillary hypoplasia in 20-25%. Dental implants may be needed.'
              }
            ]
          }
        ],
        keyPoints: [
          'CLP incidence: ~1:700 births; isolated CP: ~1:2000',
          'Primary palate anterior to incisive foramen; secondary posterior',
          'Lip repair: 3 months; Palate: 9-12 months',
          'Millard rotation-advancement for unilateral cleft lip',
          'Furlow Z-plasty lengthens palate, good for VPI prevention',
          'Alveolar bone graft at 8-10 years (mixed dentition)',
          'Multidisciplinary team essential: plastic surgery, ENT, speech, orthodontics, psychology'
        ],
        examTips: [
          'Know embryology timing for cleft formation',
          'Treatment timeline (lip 3mo, palate 9-12mo, ABG 8-10yr)',
          'Millard vs. Furlow techniques and indications',
          'VPI assessment and management'
        ],
        clinicalPearls: [
          'Submucous cleft palate can be missed—check for bifid uvula, notched palate',
          'Intravelar veloplasty (muscle reconstruction) is key to speech outcomes',
          'Feeding difficulties common—specialized bottles (Haberman, Pigeon)',
          'Parent support and counseling from birth'
        ],
        commonMistakes: [
          'Missing submucous cleft palate',
          'Delaying palate repair past 12 months (speech consequences)',
          'Inadequate muscle repair in palatoplasty',
          'Not involving full multidisciplinary team'
        ],
        references: [
          'Millard DR. Cleft Craft. Little, Brown 1976-1980',
          'Furlow LT. Cleft palate repair by double opposing Z-plasty. Plast Reconstr Surg 1986',
          'ACPA Parameters for Evaluation and Treatment of Patients with Cleft Lip/Palate',
          'Mossey PA et al. Cleft lip and palate. Lancet 2009'
        ],
        selfAssessment: [
          {
            id: 'sr-4-1-q1',
            question: 'At what age is alveolar bone grafting typically performed?',
            options: [
              '3-4 years',
              '5-6 years',
              '8-10 years',
              '12-14 years'
            ],
            correctAnswer: 2,
            explanation: 'Alveolar bone grafting is performed at 8-10 years, during mixed dentition before eruption of the permanent canine. This provides bone support for tooth eruption.'
          },
          {
            id: 'sr-4-1-q2',
            question: 'Which palate repair technique lengthens the palate and is particularly useful for VPI prevention?',
            options: [
              'Von Langenbeck',
              'Bardach two-flap',
              'Furlow double-opposing Z-plasty',
              'Vomer flap'
            ],
            correctAnswer: 2,
            explanation: 'Furlow double-opposing Z-plasty lengthens the soft palate while reorienting the levator muscles. It is particularly effective for preventing velopharyngeal insufficiency.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_5: CMEModule = {
  id: 'sr-module-5',
  title: 'Module 5: Oncologic Reconstruction',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-5-1',
      moduleId: 'sr-module-5',
      title: 'Breast Reconstruction',
      article: {
        title: 'Breast Reconstruction',
        overview: 'Breast reconstruction is an integral part of breast cancer treatment. Options range from implant-based to autologous tissue reconstruction. The reconstructive surgeon must understand oncologic principles, patient factors, and the range of techniques available.',
        learningObjectives: [
          'Understand timing options for breast reconstruction',
          'Know implant-based reconstruction techniques',
          'Describe autologous tissue options',
          'Assess patients appropriately for reconstruction type',
          'Manage complications of breast reconstruction'
        ],
        sections: [
          {
            title: 'Timing of Reconstruction',
            content: 'Reconstruction can be performed at different time points relative to mastectomy.',
            subsections: [
              {
                title: 'Immediate Reconstruction',
                content: 'Performed at time of mastectomy. Advantages: preserved skin envelope, single anesthesia, psychological benefit. Disadvantages: longer initial surgery, may delay adjuvant therapy if complications.'
              },
              {
                title: 'Delayed Reconstruction',
                content: 'Performed after oncologic treatment complete. Advantages: clear oncologic picture, no interference with adjuvant therapy. Disadvantages: requires tissue expansion or more complex flap, psychological impact of mastectomy.'
              },
              {
                title: 'Delayed-Immediate',
                content: 'Tissue expander at mastectomy, exchange after adjuvant therapy. Preserves skin for easier definitive reconstruction. Useful when post-mastectomy radiation expected.'
              }
            ]
          },
          {
            title: 'Implant-Based Reconstruction',
            content: 'Uses tissue expanders and/or implants.',
            subsections: [
              {
                title: 'Two-Stage',
                content: 'Stage 1: Tissue expander placement submuscular or prepectoral. Serial expansions over weeks-months. Stage 2: Exchange to permanent implant. Most common approach.'
              },
              {
                title: 'Direct-to-Implant',
                content: 'Permanent implant at initial surgery. Requires adequate skin envelope and mastectomy flap perfusion. Often uses ADM (acellular dermal matrix) for lower pole support. Higher risk in some patients.'
              },
              {
                title: 'Prepectoral vs. Subpectoral',
                content: 'Prepectoral: above muscle, uses ADM for full coverage. Less animation deformity, faster recovery. Subpectoral: partial muscle coverage, traditional approach. Good for thin patients. Choice based on tissue quality and patient factors.'
              }
            ]
          },
          {
            title: 'Autologous Reconstruction',
            content: 'Uses patient\'s own tissue.',
            subsections: [
              {
                title: 'DIEP Flap',
                content: 'Deep inferior epigastric artery perforator flap. Abdominal tissue based on perforators, preserves rectus muscle. Gold standard for autologous breast reconstruction. Requires microsurgery. Abdominoplasty donor benefit.'
              },
              {
                title: 'TRAM Flap',
                content: 'Transverse rectus abdominis myocutaneous. Pedicled (superior epigastric) or free. Sacrifices rectus muscle—abdominal weakness risk. Free TRAM more reliable than pedicled.'
              },
              {
                title: 'Latissimus Dorsi Flap',
                content: 'Pedicled flap from back. Reliable blood supply. Often needs implant for volume. Good for salvage, partial breast reconstruction. Seroma common.'
              },
              {
                title: 'Other Options',
                content: 'PAP (profunda artery perforator): inner thigh. SGAP/IGAP: buttock tissue. TUG (transverse upper gracilis): thigh. For patients without suitable abdominal donor.'
              }
            ]
          },
          {
            title: 'Patient Selection',
            content: 'Factors influencing reconstruction choice.',
            subsections: [
              {
                title: 'Implant Candidates',
                content: 'Smaller breasts, no radiation, want shorter surgery. May combine with contralateral augmentation/mastopexy. Not ideal for large ptotic breasts, previous radiation.'
              },
              {
                title: 'Autologous Candidates',
                content: 'Adequate donor tissue. Post-radiation reconstruction. Desire natural feel. Willing to accept donor site scar. Failed implant reconstruction.'
              }
            ]
          },
          {
            title: 'Radiation and Reconstruction',
            content: 'Radiation significantly impacts reconstruction.',
            subsections: [
              {
                title: 'Effects',
                content: 'Capsular contracture higher with implants. Wound healing complications. Fat necrosis in autologous flaps. Delayed-immediate approach may be preferred.'
              },
              {
                title: 'Strategies',
                content: 'Autologous preferred in radiated field. If implant, delay until 6-12 months post-radiation. Radiate expander, exchange to implant. Or complete autologous reconstruction after radiation.'
              }
            ]
          }
        ],
        keyPoints: [
          'Immediate reconstruction: preserved envelope, psychological benefit',
          'Implant-based: two-stage (expander→implant) or direct-to-implant',
          'DIEP: gold standard autologous, preserves rectus muscle',
          'Autologous preferred in radiated field',
          'ADM provides support in prepectoral and direct-to-implant',
          'Patient selection based on body habitus, oncologic factors, preference',
          'Nipple reconstruction typically 3 months after mound'
        ],
        examTips: [
          'DIEP vs. TRAM: perforator preserves muscle',
          'Effects of radiation on reconstruction',
          'Two-stage vs. direct-to-implant indications',
          'Know flap options for different donor sites'
        ],
        clinicalPearls: [
          'Oncologic plan first—reconstruction follows',
          'Radiated tissue is unforgiving—autologous or delayed',
          'Symmetry procedures often needed on contralateral side',
          'Set realistic expectations—reconstruction, not restoration'
        ],
        commonMistakes: [
          'Direct-to-implant in thin patient with compromised flaps',
          'Implant reconstruction in planned radiation field',
          'Not discussing all options with patient',
          'Ignoring contralateral breast symmetry'
        ],
        references: [
          'Alderman AK et al. National trends in breast reconstruction. JAMA 2008',
          'Nahabedian MY et al. DIEP flap. Plast Reconstr Surg 2002',
          'Momoh AO et al. Current concepts in breast reconstruction. Plast Reconstr Surg 2014',
          'ASPS Evidence-Based Clinical Practice Guideline: Breast Reconstruction with Implants'
        ],
        selfAssessment: [
          {
            id: 'sr-5-1-q1',
            question: 'Which autologous breast reconstruction preserves the rectus abdominis muscle?',
            options: [
              'Pedicled TRAM',
              'Free TRAM',
              'DIEP flap',
              'Latissimus dorsi'
            ],
            correctAnswer: 2,
            explanation: 'DIEP (deep inferior epigastric perforator) flap harvests abdominal tissue based on perforating vessels while preserving the rectus abdominis muscle, reducing abdominal wall morbidity.'
          },
          {
            id: 'sr-5-1-q2',
            question: 'For a patient requiring post-mastectomy radiation, which reconstruction approach is most appropriate?',
            options: [
              'Immediate direct-to-implant',
              'Immediate prepectoral implant',
              'Delayed autologous reconstruction',
              'Immediate latissimus with permanent implant'
            ],
            correctAnswer: 2,
            explanation: 'Autologous reconstruction (e.g., DIEP) is preferred in the radiated field. Delayed reconstruction allows radiation to complete before introducing tissues. Implants have higher complication rates with radiation.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_6: CMEModule = {
  id: 'sr-module-6',
  title: 'Module 6: Head and Neck Reconstruction',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-6-1',
      moduleId: 'sr-module-6',
      title: 'Mandible and Oral Reconstruction',
      article: {
        title: 'Mandible and Oral Reconstruction',
        overview: 'Head and neck cancer ablation creates complex defects requiring functional and aesthetic reconstruction. Mandibular reconstruction restores oral competence, speech, and swallowing. Free tissue transfer has revolutionized outcomes.',
        learningObjectives: [
          'Classify mandibular defects',
          'Understand goals of mandibular reconstruction',
          'Know flap options for different defects',
          'Plan dental rehabilitation',
          'Manage complications'
        ],
        sections: [
          {
            title: 'Mandibular Defect Classification',
            content: 'Classification guides reconstruction planning.',
            subsections: [
              {
                title: 'HCL Classification (Jewer)',
                content: 'H: Lateral defect (hemimandible without anterior arch). C: Central defect (includes both canines). L: Lateral including canine. Combined: HC, LC, LCL. Central defects more challenging—loss of arch continuity.'
              },
              {
                title: 'Soft Tissue Considerations',
                content: 'Composite defects include: oral lining, tongue, floor of mouth, external skin. Each component must be reconstructed. Volume, sensation, and mobility considerations.'
              }
            ]
          },
          {
            title: 'Fibula Free Flap',
            content: 'Workhorse for mandibular reconstruction.',
            subsections: [
              {
                title: 'Anatomy',
                content: 'Peroneal artery supplies bone via periosteal and endosteal systems. 25cm bone available (preserve 6cm distally for ankle). Skin paddle based on septocutaneous perforators. Can include soleus/flexor hallucis longus muscle.'
              },
              {
                title: 'Advantages',
                content: 'Long bone segment for multiple osteotomies. Bicortical—accepts dental implants. Reliable skin paddle. Acceptable donor site morbidity. Two-team approach possible.'
              },
              {
                title: 'Technique',
                content: 'Virtual surgical planning increasingly used. Osteotomies to match defect. Plates fixed before flap insetting. Careful skin paddle positioning for oral lining. Dental implants primary or secondary.'
              }
            ]
          },
          {
            title: 'Other Options',
            content: 'Alternative flaps for specific situations.',
            subsections: [
              {
                title: 'Scapular/Parascapular',
                content: 'Based on circumflex scapular artery. Lateral scapular border provides bone. Large soft tissue options. Disadvantage: lateral decubitus positioning.'
              },
              {
                title: 'Iliac Crest',
                content: 'Deep circumflex iliac artery. Good for dental implants (curved bone). Matches mandible contour well. Donor site morbidity (gait, hernia).'
              },
              {
                title: 'Radial Forearm',
                content: 'Soft tissue only—no bone (unless osseocutaneous, limited bone). Thin, pliable for oral lining. Often combined with fibula for composite defects.'
              },
              {
                title: 'ALT Flap',
                content: 'Large soft tissue volume. Chimeric with vastus lateralis for bulk. No bone. Good for tongue/floor of mouth reconstruction.'
              }
            ]
          },
          {
            title: 'Dental Rehabilitation',
            content: 'Goal of reconstruction is often functional dentition.',
            subsections: [
              {
                title: 'Osseointegrated Implants',
                content: 'Can be placed primarily or secondarily. Fibula and iliac crest accommodate implants. CAD/CAM surgical planning facilitates placement. May need bone grafting for height.'
              },
              {
                title: 'Prosthetics',
                content: 'Implant-supported dentures or individual teeth. Conventional dentures possible. Obturators for maxillary defects. Collaboration with prosthodontist essential.'
              }
            ]
          }
        ],
        keyPoints: [
          'Fibula: workhorse for mandibular reconstruction',
          'Central defects (C) more challenging than lateral (H, L)',
          'Virtual surgical planning improves accuracy',
          'Fibula accepts dental implants (bicortical)',
          'Radial forearm for thin pliable oral lining',
          'ALT for tongue/floor of mouth volume',
          'Dental rehabilitation is the functional goal'
        ],
        examTips: [
          'Know fibula flap anatomy and blood supply',
          'HCL classification of mandibular defects',
          'Indications for different flaps',
          'Dental implant considerations'
        ],
        clinicalPearls: [
          'CT angiography of legs before fibula harvest',
          'Preserve 6cm distal fibula for ankle stability',
          'Position skin paddle for easy oral lining reach',
          'Two-team approach saves time'
        ],
        commonMistakes: [
          'Inadequate bone height for implants',
          'Poor skin paddle positioning',
          'Not planning for dental rehabilitation',
          'Ignoring peroneal vessel patency (check preop)'
        ],
        references: [
          'Hidalgo DA. Fibula free flap: a new method of mandible reconstruction. Plast Reconstr Surg 1989',
          'Jewer DD et al. Mandibular reconstruction classification. Plast Reconstr Surg 1989',
          'Pogrel MA et al. Virtual surgical planning for mandibular reconstruction. J Oral Maxillofac Surg 2014',
          'Cordeiro PG et al. Head and neck reconstruction. Plast Reconstr Surg 1999'
        ],
        selfAssessment: [
          {
            id: 'sr-6-1-q1',
            question: 'Which flap is the workhorse for composite mandibular reconstruction?',
            options: [
              'Radial forearm flap',
              'ALT flap',
              'Fibula free flap',
              'Pectoralis major flap'
            ],
            correctAnswer: 2,
            explanation: 'Fibula free flap is the workhorse for mandibular reconstruction—it provides up to 25cm of bone for multiple osteotomies, accepts dental implants, and has a reliable skin paddle.'
          },
          {
            id: 'sr-6-1-q2',
            question: 'In the HCL classification, which defect is most challenging to reconstruct?',
            options: [
              'H (hemimandible)',
              'C (central)',
              'L (lateral)',
              'All are equally challenging'
            ],
            correctAnswer: 1,
            explanation: 'Central (C) defects are most challenging as they disrupt the anterior arch, leading to loss of mandibular projection and "Andy Gump" deformity if not adequately reconstructed.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_7: CMEModule = {
  id: 'sr-module-7',
  title: 'Module 7: Hand Surgery',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-7-1',
      moduleId: 'sr-module-7',
      title: 'Flexor Tendon Injuries and Repair',
      article: {
        title: 'Flexor Tendon Injuries and Repair',
        overview: 'Flexor tendon injuries require precise surgical repair and structured rehabilitation for optimal outcomes. Understanding zones, repair techniques, and rehabilitation protocols is essential for the hand surgeon.',
        learningObjectives: [
          'Classify flexor tendon injuries by zone',
          'Understand tendon healing biology',
          'Describe modern repair techniques',
          'Apply appropriate rehabilitation protocols',
          'Manage complications'
        ],
        sections: [
          {
            title: 'Anatomy and Zones',
            content: 'The flexor apparatus has distinct anatomic zones with different surgical implications.',
            subsections: [
              {
                title: 'Flexor Tendons',
                content: 'FDP: flexes DIP joint, inserts at distal phalanx base. FDS: flexes PIP joint, splits to insert on middle phalanx. FPL: flexor pollicis longus (thumb). Lumbricals: arise from FDP, flex MCP, extend IP.'
              },
              {
                title: 'Zone Classification',
                content: 'Zone I: Distal to FDS insertion (FDP only). Zone II: A1 pulley to FDS insertion ("no man\'s land"). Zone III: Carpal tunnel to A1 pulley. Zone IV: Carpal tunnel. Zone V: Proximal to carpal tunnel.'
              },
              {
                title: 'Pulley System',
                content: 'A1-A5 annular pulleys (A2, A4 most critical). C1-C3 cruciate pulleys. A2 (proximal phalanx) and A4 (middle phalanx) prevent bowstringing. Must preserve or reconstruct if damaged.'
              }
            ]
          },
          {
            title: 'Tendon Healing',
            content: 'Tendons heal through intrinsic and extrinsic mechanisms.',
            subsections: [
              {
                title: 'Healing Phases',
                content: 'Inflammatory (0-5 days): hematoma, inflammatory infiltrate. Proliferative (5-28 days): fibroblast migration, collagen synthesis. Remodeling (28 days-1 year): collagen maturation, strength increases.'
              },
              {
                title: 'Intrinsic vs. Extrinsic',
                content: 'Intrinsic: tenocyte proliferation, less adhesion, better gliding. Extrinsic: from sheath/surrounding tissue, more adhesions. Early motion promotes intrinsic healing, reduces adhesions.'
              }
            ]
          },
          {
            title: 'Repair Techniques',
            content: 'Strong repair allows early motion protocols.',
            subsections: [
              {
                title: 'Core Suture',
                content: 'Multi-strand techniques: 4-strand (modified Kessler), 6-strand (cruciate). More strands = more strength. 3-0 or 4-0 braided polyester/nylon. Locking configurations preferred.'
              },
              {
                title: 'Epitendinous Suture',
                content: 'Continuous running suture to smooth repair. Adds 10-50% strength. Improves gliding. 6-0 monofilament typically.'
              },
              {
                title: 'Technical Principles',
                content: 'Atraumatic technique—minimize handling. Preserve pulleys (especially A2, A4). Purchase 7-10mm from cut end. Avoid gapping >3mm. Test repair with passive motion.'
              }
            ]
          },
          {
            title: 'Rehabilitation',
            content: 'Early motion is critical to prevent adhesions.',
            subsections: [
              {
                title: 'Protocols',
                content: 'Immobilization: historical, high adhesion rates. Duran passive motion: early controlled motion. Kleinert: rubber band traction, active extension/passive flexion. Modified Duran: place-and-hold. Active motion protocols: earliest motion, requires strong repair.'
              },
              {
                title: 'Splinting',
                content: 'Dorsal blocking splint: wrist 20° flexion, MCP 50-70° flexion, IP neutral. Prevents full extension (protects repair). Duration 4-6 weeks typically.'
              }
            ]
          },
          {
            title: 'Complications',
            content: 'Zone II injuries have highest complication rates.',
            subsections: [
              {
                title: 'Adhesions',
                content: 'Most common problem. Limit tendon excursion. Tenolysis if no improvement with therapy (wait 3-6 months).'
              },
              {
                title: 'Rupture',
                content: 'Occurs during rehabilitation if repair weak or overly aggressive therapy. Re-repair if acute. Staged reconstruction if delayed (silicone rod first, then graft).'
              },
              {
                title: 'Trigger Finger/Bowstringing',
                content: 'From pulley damage or reconstruction. May require secondary pulley reconstruction or release.'
              }
            ]
          }
        ],
        keyPoints: [
          'Zone II ("no man\'s land"): most challenging, highest adhesion risk',
          'A2 and A4 pulleys critical—preserve or reconstruct',
          'Multi-strand repair (4-6 strands) enables early motion',
          'Epitendinous suture adds strength and improves gliding',
          'Early motion protocols reduce adhesions',
          'Tenolysis for adhesions—wait 3-6 months after repair',
          'Staged reconstruction for chronic injuries'
        ],
        examTips: [
          'Know flexor tendon zones',
          'A2 and A4 pulley importance',
          'Repair strength vs. number of core strands',
          'Rehabilitation protocols and their principles'
        ],
        clinicalPearls: [
          'Don\'t repair if >3 weeks—scar tissue precludes primary repair',
          'FDS is expendable in Zone II if repair difficult',
          'Sheath irrigation with saline during repair',
          'Hand therapist is critical partner in outcomes'
        ],
        commonMistakes: [
          'Inadequate core purchase (<7mm)',
          'Bunching that causes triggering',
          'Excessive pulley resection',
          'Overly aggressive or too passive rehabilitation'
        ],
        references: [
          'Strickland JW. Development of flexor tendon surgery. J Hand Surg Am 2000',
          'Winters SC et al. Flexor tendon rehabilitation. J Hand Ther 1998',
          'Tang JB. Clinical outcomes of primary flexor tendon repair. J Hand Surg Eur 2014',
          'Amadio PC. Friction of the gliding surface. J Hand Surg Am 1995'
        ],
        selfAssessment: [
          {
            id: 'sr-7-1-q1',
            question: 'Which zone is known as "no man\'s land" for flexor tendon injuries?',
            options: [
              'Zone I',
              'Zone II',
              'Zone III',
              'Zone IV'
            ],
            correctAnswer: 1,
            explanation: 'Zone II (from A1 pulley to FDS insertion) is called "no man\'s land" because both FDS and FDP are in a narrow fibro-osseous tunnel, leading to high adhesion rates after repair.'
          },
          {
            id: 'sr-7-1-q2',
            question: 'Which pulleys are most critical to preserve or reconstruct?',
            options: [
              'A1 and A3',
              'A2 and A4',
              'A3 and A5',
              'C1 and C2'
            ],
            correctAnswer: 1,
            explanation: 'A2 (proximal phalanx) and A4 (middle phalanx) pulleys are biomechanically critical—loss causes bowstringing and loss of digital flexion power.'
          }
        ]
      }
    }
  ]
};

SENIOR_RESIDENT_MODULES.push(SR_MODULE_4, SR_MODULE_5, SR_MODULE_6, SR_MODULE_7);

const SR_MODULE_8: CMEModule = {
  id: 'sr-module-8',
  title: 'Module 8: Aesthetic Surgery Principles',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-8-1',
      moduleId: 'sr-module-8',
      title: 'Rhinoplasty Fundamentals',
      article: {
        title: 'Rhinoplasty Fundamentals',
        overview: 'Rhinoplasty is one of the most challenging aesthetic procedures, requiring understanding of nasal anatomy, aesthetics, and function. Analysis, surgical technique, and managing expectations are critical for success.',
        learningObjectives: [
          'Understand nasal anatomy relevant to rhinoplasty',
          'Perform systematic nasal analysis',
          'Know open vs. closed approach indications',
          'Describe key surgical maneuvers',
          'Manage complications and revision cases'
        ],
        sections: [
          {
            title: 'Nasal Anatomy',
            content: 'Detailed anatomic knowledge underlies all rhinoplasty.',
            subsections: [
              {
                title: 'External Framework',
                content: 'Bony vault: paired nasal bones, frontal process of maxilla. Upper lateral cartilages: fused to septum (keystone area). Lower lateral cartilages: medial, middle (dome), lateral crura. Tip-defining points: domes, infratip lobule, columella-lobular angle.'
              },
              {
                title: 'Internal Structures',
                content: 'Nasal septum: quadrangular cartilage, perpendicular plate of ethmoid, vomer. Internal nasal valve: angle between septum and ULC (10-15°). External nasal valve: alar rim, lateral crus, sill. Turbinates: inferior, middle, superior.'
              },
              {
                title: 'Blood Supply',
                content: 'External: branches from facial artery, ophthalmic artery. Internal: sphenopalatine artery (posteriorly), anterior ethmoid (anteriorly). Columella: septal branch of superior labial artery.'
              }
            ]
          },
          {
            title: 'Nasal Analysis',
            content: 'Systematic analysis identifies goals and surgical plan.',
            subsections: [
              {
                title: 'Frontal View',
                content: 'Facial symmetry and thirds. Brow-tip aesthetic lines. Nasal width (should equal intercanthal distance). Tip: shape, width, symmetry. Alar base width.'
              },
              {
                title: 'Lateral View',
                content: 'Nasofrontal angle (115-130°). Dorsum: straight or slight supratip break in females. Tip rotation: nasolabial angle (95-100° female, 90-95° male). Tip projection: Goode ratio 0.55-0.60. Alar-columellar relationship.'
              },
              {
                title: 'Base View',
                content: 'Triangular vs. trapezoidal tip. Columella:lobule ratio (2:1). Alar base symmetry. Nostril shape (pear-shaped ideal).'
              }
            ]
          },
          {
            title: 'Surgical Approaches',
            content: 'Choice based on complexity and surgeon experience.',
            subsections: [
              {
                title: 'Open (External) Approach',
                content: 'Transcolumellar incision connecting bilateral rim incisions. Complete visualization of framework. Preferred for complex tip work, revision, teaching. Disadvantage: columellar scar (rarely visible).'
              },
              {
                title: 'Closed (Endonasal) Approach',
                content: 'Incisions inside nose (intercartilaginous, transfixion, infracartilaginous). No external scar. Limited visualization. Good for dorsal work, minor tip modification. Faster healing.'
              }
            ]
          },
          {
            title: 'Key Surgical Techniques',
            content: 'Common maneuvers for different concerns.',
            subsections: [
              {
                title: 'Dorsal Reduction',
                content: 'Rasping (minor), osteotome/Rubin osteotome (moderate), en bloc (major). Component reduction: cartilaginous then bony. Spreader grafts if >3mm reduction (open roof).'
              },
              {
                title: 'Osteotomies',
                content: 'Medial, lateral, intermediate. Narrow bony base, close open roof. Lateral: low-to-high external or internal. Controlled greenstick fractures. Post-op splinting essential.'
              },
              {
                title: 'Tip Modification',
                content: 'Suture techniques: interdomal, transdomal, lateral crural steal. Cartilage grafts: shield, cap, columellar strut, alar contour. Cephalic trim: no more than 5-6mm residual lateral crus. Tongue-in-groove for rotation.'
              }
            ]
          }
        ],
        keyPoints: [
          'Systematic analysis: frontal, lateral, base views',
          'Internal valve angle 10-15°—preserve in rhinoplasty',
          'Open approach for complex tip work; closed for dorsum-only',
          'Spreader grafts for middle vault after significant reduction',
          'Preserve at least 5-6mm lateral crura in cephalic trim',
          'Columellar strut provides tip support',
          'Function and aesthetics must both be addressed'
        ],
        examTips: [
          'Know nasal analysis parameters and ideals',
          'Understand open vs. closed approach indications',
          'Spreader graft function (internal valve, dorsal lines)',
          'Tip suture techniques and their effects'
        ],
        clinicalPearls: [
          'Photos are essential—analyze before entering OR',
          'Thick skin limits tip refinement—counsel patients',
          'Revision is harder than primary—get it right the first time',
          'Computer imaging manages expectations'
        ],
        commonMistakes: [
          'Excessive cephalic trim causing alar collapse',
          'Ignoring functional concerns',
          'Over-reduction creating saddle nose',
          'Not using spreader grafts after dorsal reduction'
        ],
        references: [
          'Rohrich RJ, Adams WP. Dallas Rhinoplasty. Quality Medical Publishing',
          'Gunter JP, Rohrich RJ. Classification of nasal deformities. Plast Reconstr Surg 1996',
          'Toriumi DM. Rhinoplasty structural approach. Clin Plast Surg 2010',
          'Sheen JH. Rhinoplasty: personal evolution and milestones. Plast Reconstr Surg 2000'
        ],
        selfAssessment: [
          {
            id: 'sr-8-1-q1',
            question: 'What is the ideal nasolabial angle in females?',
            options: [
              '85-90°',
              '95-100°',
              '105-115°',
              '115-120°'
            ],
            correctAnswer: 1,
            explanation: 'The ideal nasolabial angle in females is 95-100° (slightly more rotated tip). In males, it is 90-95°. This angle determines tip rotation.'
          },
          {
            id: 'sr-8-1-q2',
            question: 'What is the primary function of spreader grafts?',
            options: [
              'Increase tip projection',
              'Widen the internal nasal valve',
              'Support the columella',
              'Reduce alar flare'
            ],
            correctAnswer: 1,
            explanation: 'Spreader grafts (placed between dorsal septum and upper lateral cartilages) widen the internal nasal valve angle and reconstruct the middle vault aesthetic lines after dorsal hump reduction.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_9: CMEModule = {
  id: 'sr-module-9',
  title: 'Module 9: Trunk and Extremity Reconstruction',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-9-1',
      moduleId: 'sr-module-9',
      title: 'Abdominal Wall Reconstruction',
      article: {
        title: 'Abdominal Wall Reconstruction',
        overview: 'Complex abdominal wall defects from trauma, surgery, or necrotizing infection require reconstructive expertise. Component separation techniques and mesh options have expanded our ability to restore abdominal wall integrity.',
        learningObjectives: [
          'Classify abdominal wall defects',
          'Understand component separation techniques',
          'Know mesh options and placement',
          'Plan flaps for contaminated fields',
          'Manage complications'
        ],
        sections: [
          {
            title: 'Defect Assessment',
            content: 'Characterizing the defect guides reconstruction planning.',
            subsections: [
              {
                title: 'Classification',
                content: 'Location: midline, lateral, combined. Size: small (<5cm), medium (5-10cm), large (>10cm). Layers involved: skin, fascia, muscle. Contamination: clean, contaminated, infected. Previous surgery: virgin, recurrent.'
              },
              {
                title: 'Hernia Classification (EHS)',
                content: 'M1-M5: midline hernias by location. L1-L4: lateral hernias. W1-W3: width categories (<4cm, 4-10cm, >10cm). Guides selection of repair technique.'
              }
            ]
          },
          {
            title: 'Component Separation',
            content: 'Releases allow fascial advancement for midline closure.',
            subsections: [
              {
                title: 'Anterior Component Separation (Ramirez)',
                content: 'Release external oblique lateral to rectus. Allows 3-5cm advancement per side (3cm upper, 5cm lower). Preserves perforators. Create subcutaneous flaps to access release site.'
              },
              {
                title: 'Posterior Component Separation (TAR)',
                content: 'Transversus abdominis release. Division of posterior rectus sheath and transversus. Greater advancement (8-10cm). Retromuscular plane for mesh. Preserves rectus blood supply.'
              },
              {
                title: 'Perforator-Sparing Techniques',
                content: 'Minimize subcutaneous dissection. Endoscopic or minimally invasive releases. Preserve periumbilical perforators. Lower wound complication rates.'
              }
            ]
          },
          {
            title: 'Mesh Selection and Placement',
            content: 'Mesh reinforcement reduces recurrence.',
            subsections: [
              {
                title: 'Mesh Types',
                content: 'Synthetic: polypropylene (lightweight, heavy), polyester, PTFE. Biologic: acellular dermal matrix (human, porcine, bovine). Biosynthetic: absorbable synthetic (GORE BIO-A, Phasix). Selection based on contamination level.'
              },
              {
                title: 'Mesh Position',
                content: 'Onlay: superficial to fascia—easiest, highest recurrence. Inlay: bridging defect—poor outcomes. Sublay/retrorectus: between rectus and posterior sheath—excellent. Preperitoneal/underlay: deep to transversalis fascia.'
              },
              {
                title: 'Contaminated Fields',
                content: 'Biologic mesh or biosynthetic for contaminated cases. Staged reconstruction may be required. Negative pressure wound therapy for open abdomen. Delayed mesh placement if severe infection.'
              }
            ]
          },
          {
            title: 'Flap Options',
            content: 'For soft tissue coverage or when fascia insufficient.',
            subsections: [
              {
                title: 'Pedicled Flaps',
                content: 'Anterolateral thigh (ALT): large, reliable. Rectus femoris: functional muscle. TFL: smaller defects. Latissimus dorsi: upper abdominal defects.'
              },
              {
                title: 'Free Flaps',
                content: 'Rarely needed—used when pedicled options exhausted. ALT, latissimus dorsi, TFL as free flaps. Recipient vessels: deep inferior epigastric, femoral.'
              }
            ]
          }
        ],
        keyPoints: [
          'Component separation: anterior (Ramirez) or posterior (TAR)',
          'TAR provides greater advancement (8-10cm vs 3-5cm)',
          'Retrorectus (sublay) mesh position has best outcomes',
          'Biologic/biosynthetic mesh for contaminated fields',
          'Lightweight mesh reduces stiffness and complications',
          'Perforator-sparing techniques reduce wound complications',
          'Staged reconstruction for severe contamination'
        ],
        examTips: [
          'Know anterior vs. posterior component separation',
          'Mesh positions and their pros/cons',
          'Mesh selection for contaminated fields',
          'Flap options for coverage'
        ],
        clinicalPearls: [
          'Optimize nutrition before elective repair',
          'CT scan defines defect and helps plan',
          'TAR for larger defects or lateral extension',
          'Obesity increases recurrence—counsel weight loss'
        ],
        commonMistakes: [
          'Bridging with mesh (high recurrence)',
          'Synthetic mesh in infected field',
          'Inadequate mesh overlap (<4-5cm)',
          'Ignoring domain loss issues'
        ],
        references: [
          'Ramirez OM et al. "Components separation" method. Plast Reconstr Surg 1990',
          'Novitsky YW et al. Transversus abdominis muscle release. Am J Surg 2012',
          'Rosen MJ et al. Abdominal wall reconstruction. J Am Coll Surg 2016',
          'Ventral Hernia Working Group. Surgical site infection and mesh. Surgery 2010'
        ],
        selfAssessment: [
          {
            id: 'sr-9-1-q1',
            question: 'Which component separation provides the greatest fascial advancement?',
            options: [
              'Anterior (Ramirez)',
              'Posterior (TAR)',
              'Both provide equal advancement',
              'Neither provides significant advancement'
            ],
            correctAnswer: 1,
            explanation: 'Posterior component separation (Transversus Abdominis Release/TAR) provides 8-10cm advancement per side, compared to 3-5cm with anterior component separation.'
          },
          {
            id: 'sr-9-1-q2',
            question: 'What is the optimal mesh position for lowest recurrence in ventral hernia repair?',
            options: [
              'Onlay',
              'Inlay/bridging',
              'Sublay/retrorectus',
              'All positions have equal outcomes'
            ],
            correctAnswer: 2,
            explanation: 'Sublay/retrorectus position has the lowest recurrence rates. The mesh is well-incorporated, protected from viscera, and benefits from Pascal\'s principle (intra-abdominal pressure holds it in place).'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_10: CMEModule = {
  id: 'sr-module-10',
  title: 'Module 10: Genitourinary Reconstruction',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-10-1',
      moduleId: 'sr-module-10',
      title: 'Hypospadias Repair',
      article: {
        title: 'Hypospadias Repair',
        overview: 'Hypospadias is one of the most common congenital anomalies in males. Repair aims to create a functional, cosmetically normal penis with a terminal meatus. Understanding classification, techniques, and complications is essential.',
        learningObjectives: [
          'Classify hypospadias by meatal position',
          'Understand goals of repair',
          'Describe common repair techniques',
          'Manage complications including fistula',
          'Know timing and associated anomalies'
        ],
        sections: [
          {
            title: 'Classification and Anatomy',
            content: 'Meatal position defines severity.',
            subsections: [
              {
                title: 'Classification',
                content: 'Anterior/distal (65-70%): glanular, subcoronal, distal shaft. Middle (10-15%): midshaft. Posterior/proximal (15-20%): penoscrotal, scrotal, perineal. Position assessed after chordee release (true hypospadias).'
              },
              {
                title: 'Associated Anomalies',
                content: 'Chordee: ventral curvature (may exist without hypospadias). Hooded foreskin: deficient ventrally. Undescended testis. Inguinal hernia. In severe cases: evaluate for DSD (intersex).'
              }
            ]
          },
          {
            title: 'Surgical Goals',
            content: 'The five Fs of hypospadias repair.',
            subsections: [
              {
                title: 'Goals',
                content: 'Functional meatus (adequate caliber). Forward-directed stream. Full straightening (correct chordee). Form (normal appearance). Fertility (preserve sexual function).'
              },
              {
                title: 'Timing',
                content: 'Optimal age: 6-18 months. Completed before toilet training. Single-stage preferred when possible. Penile size adequate after 6 months.'
              }
            ]
          },
          {
            title: 'Surgical Techniques',
            content: 'Technique selection based on meatal position and tissue available.',
            subsections: [
              {
                title: 'Distal Repairs',
                content: 'MAGPI (Meatal Advancement and Glanuloplasty): glanular/subcoronal, minimal chordee. Mathieu (flip-flap): subcoronal/distal shaft. TIP (Tubularized Incised Plate, Snodgrass): most versatile for distal/mid-shaft.'
              },
              {
                title: 'TIP Procedure',
                content: 'Incise urethral plate in midline (relaxing incision). Tubularize over stent. Glansplasty covers neourethra. Excellent results for most distal/middle hypospadias. Preserves native urethral plate.'
              },
              {
                title: 'Proximal Repairs',
                content: 'Two-stage Bracka: stage 1—inner prepuce or buccal graft to create plate. Stage 2—tubularize after graft take. Single-stage options: onlay, Koyanagi. Buccal mucosa for salvage/redo.'
              },
              {
                title: 'Chordee Correction',
                content: 'Skin chordee: skin degloving may suffice. Fascial: dartos excision. Corporal: plication (dorsal) or grafting. Artificial erection test intraoperatively.'
              }
            ]
          },
          {
            title: 'Complications',
            content: 'Complications occur in 5-15% of cases.',
            subsections: [
              {
                title: 'Fistula',
                content: 'Most common complication (5-10%). Usually at coronal junction. Wait 6 months before repair. Multiple-layer closure. May need buccal graft for large fistula.'
              },
              {
                title: 'Other Complications',
                content: 'Meatal stenosis: dilatation or meatoplasty. Urethral stricture: dilatation, internal urethrotomy. Residual chordee: further plication/grafting. Glans dehiscence: early complication.'
              }
            ]
          }
        ],
        keyPoints: [
          'Anterior hypospadias (65-70%) has best outcomes',
          'TIP (Snodgrass) is most versatile single-stage repair',
          'Two-stage repair for proximal cases with poor plate',
          'Correct chordee before urethroplasty',
          'Fistula is most common complication (5-10%)',
          'Wait 6 months before fistula repair',
          'Optimal timing: 6-18 months of age'
        ],
        examTips: [
          'Know classification by meatal position',
          'TIP procedure steps',
          'Indications for staged vs. single-stage repair',
          'Fistula management principles'
        ],
        clinicalPearls: [
          'Don\'t circumcise—need foreskin for reconstruction',
          'Testosterone stimulation may enlarge small penis preop',
          'Buccal mucosa is salvage tissue—reliable',
          'Stent for 7-10 days post-repair'
        ],
        commonMistakes: [
          'Attempting single-stage for severe proximal hypospadias',
          'Inadequate chordee assessment/correction',
          'Early fistula repair (wait 6 months)',
          'Circumcision destroying reconstructive tissue'
        ],
        references: [
          'Snodgrass W. Tubularized incised plate urethroplasty. J Urol 1994',
          'Bracka A. A versatile two-stage hypospadias repair. Br J Plast Surg 1995',
          'Duckett JW. Hypospadias. In: Campbell\'s Urology',
          'Manzoni G et al. Hypospadias surgery: when, what and by whom? BJU Int 2004'
        ],
        selfAssessment: [
          {
            id: 'sr-10-1-q1',
            question: 'Which is the most versatile single-stage repair for distal hypospadias?',
            options: [
              'MAGPI',
              'Mathieu flip-flap',
              'TIP (Snodgrass)',
              'Onlay flap'
            ],
            correctAnswer: 2,
            explanation: 'TIP (Tubularized Incised Plate) is the most versatile technique for distal and mid-shaft hypospadias, preserving the native urethral plate while creating a slit-like meatus.'
          },
          {
            id: 'sr-10-1-q2',
            question: 'What is the recommended timing for fistula repair after hypospadias surgery?',
            options: [
              'Immediately if recognized',
              '6 weeks',
              '6 months',
              '1 year'
            ],
            correctAnswer: 2,
            explanation: 'Wait at least 6 months before fistula repair to allow tissues to mature, inflammation to subside, and blood supply to recover. Earlier repair has higher failure rates.'
          }
        ]
      }
    }
  ]
};

const SR_MODULE_11: CMEModule = {
  id: 'sr-module-11',
  title: 'Module 11: Research and Academic Surgery',
  level: 'senior_resident',
  topics: [
    {
      id: 'sr-11-1',
      moduleId: 'sr-module-11',
      title: 'Research Methodology and Academic Writing',
      article: {
        title: 'Research Methodology and Academic Writing',
        overview: 'Academic contribution is essential for advancing plastic surgery. Understanding research design, statistical analysis, and scientific writing enables surgeons to contribute to the evidence base and critically evaluate literature.',
        learningObjectives: [
          'Design appropriate clinical studies',
          'Understand basic statistical concepts',
          'Write effective scientific manuscripts',
          'Navigate the publication process',
          'Recognize research ethics requirements'
        ],
        sections: [
          {
            title: 'Study Design',
            content: 'Appropriate design answers the research question.',
            subsections: [
              {
                title: 'Experimental Studies',
                content: 'RCT: gold standard for treatment comparison. Cluster RCT: randomize groups, not individuals. Crossover: each participant receives both treatments. Reduces confounding, establishes causation.'
              },
              {
                title: 'Observational Studies',
                content: 'Cohort: follow groups over time (prospective or retrospective). Case-control: cases vs. controls, assess past exposure. Cross-sectional: snapshot at one time point. Cannot establish causation directly.'
              },
              {
                title: 'Sample Size and Power',
                content: 'Power: probability of detecting true effect (usually 80%). Alpha: acceptable false-positive rate (usually 5%). Effect size: clinically meaningful difference. Larger effect or more power = smaller sample needed.'
              }
            ]
          },
          {
            title: 'Basic Statistics',
            content: 'Selecting appropriate tests and interpreting results.',
            subsections: [
              {
                title: 'Descriptive Statistics',
                content: 'Mean (parametric) vs. median (non-parametric). Standard deviation vs. interquartile range. Proportions, rates, ratios. Data visualization: tables, graphs, charts.'
              },
              {
                title: 'Inferential Statistics',
                content: 'T-test: comparing two means (continuous, normal). Chi-square: comparing proportions. ANOVA: comparing multiple means. Regression: relationship between variables. Non-parametric alternatives when assumptions not met.'
              },
              {
                title: 'Interpreting Results',
                content: 'P-value: probability of result if null hypothesis true. Confidence interval: range of plausible values. Effect size: magnitude of difference. Statistical vs. clinical significance.'
              }
            ]
          },
          {
            title: 'Scientific Writing',
            content: 'Effective communication of research findings.',
            subsections: [
              {
                title: 'Manuscript Structure (IMRAD)',
                content: 'Introduction: what question and why important. Methods: how you did it (reproducible). Results: what you found (no interpretation). Discussion: what it means, limitations, conclusions. Abstract: summary of all sections.'
              },
              {
                title: 'Writing Tips',
                content: 'Clear, concise language. Active voice preferred. Logical flow within and between sections. Tables/figures complement text. Reference appropriately (Vancouver or Harvard). Follow journal guidelines.'
              }
            ]
          },
          {
            title: 'Publication Process',
            content: 'Navigating from submission to publication.',
            subsections: [
              {
                title: 'Journal Selection',
                content: 'Impact factor and readership. Scope and fit. Open access considerations. Publication time and acceptance rates. Predatory journals to avoid.'
              },
              {
                title: 'Peer Review',
                content: 'Reviewers provide critical feedback. Revision is normal and expected. Address all comments systematically. Point-by-point response letter. May require multiple revisions.'
              }
            ]
          },
          {
            title: 'Research Ethics',
            content: 'Ethical conduct is non-negotiable.',
            subsections: [
              {
                title: 'Key Principles',
                content: 'Informed consent. IRB/ethics committee approval. Confidentiality and data protection. Declaration of conflicts of interest. Authorship criteria (ICMJE). Research integrity: no fabrication, falsification, plagiarism.'
              }
            ]
          }
        ],
        keyPoints: [
          'RCT is gold standard for establishing treatment effect',
          'Power analysis determines sample size before study',
          'P<0.05 is convention, but clinical significance matters more',
          'IMRAD structure: Introduction, Methods, Results, Discussion',
          'Peer review improves manuscript quality',
          'Ethics approval required for human subjects research',
          'ICMJE criteria define authorship'
        ],
        examTips: [
          'Know study design hierarchy',
          'Understand when to use different statistical tests',
          'IMRAD structure components',
          'Research ethics basics'
        ],
        clinicalPearls: [
          'Start with a clear, answerable question',
          'Involve a statistician early, not after data collection',
          'Negative results are still valuable—publish them',
          'Writing is iterative—expect multiple drafts'
        ],
        commonMistakes: [
          'Inadequate sample size',
          'Using wrong statistical test',
          'P-hacking and multiple comparisons',
          'Plagiarism and citation errors'
        ],
        references: [
          'Hulley SB et al. Designing Clinical Research, 4th Ed. Lippincott',
          'ICMJE Recommendations for Conduct and Reporting of Medical Research',
          'CONSORT, STROBE, PRISMA reporting guidelines',
          'Greenhalgh T. How to Read a Paper, 6th Ed. Wiley-Blackwell'
        ],
        selfAssessment: [
          {
            id: 'sr-11-1-q1',
            question: 'What is the appropriate test to compare means between two independent groups with normally distributed continuous data?',
            options: [
              'Chi-square test',
              'Independent samples t-test',
              'Mann-Whitney U test',
              'ANOVA'
            ],
            correctAnswer: 1,
            explanation: 'Independent samples t-test compares means between two groups with continuous, normally distributed data. Chi-square is for proportions, Mann-Whitney for non-parametric data, ANOVA for >2 groups.'
          },
          {
            id: 'sr-11-1-q2',
            question: 'Which section of a manuscript interprets the findings and acknowledges limitations?',
            options: [
              'Introduction',
              'Methods',
              'Results',
              'Discussion'
            ],
            correctAnswer: 3,
            explanation: 'The Discussion section interprets findings, relates them to existing literature, acknowledges limitations, and draws conclusions. Results should present findings without interpretation.'
          }
        ]
      }
    }
  ]
};

SENIOR_RESIDENT_MODULES.push(SR_MODULE_8, SR_MODULE_9, SR_MODULE_10, SR_MODULE_11);

// Export the service class
class MedicalTrainingService {
  getHouseOfficerModules(): CMEModule[] {
    return HOUSE_OFFICER_MODULES;
  }

  getJuniorResidentModules(): CMEModule[] {
    return JUNIOR_RESIDENT_MODULES;
  }

  getSeniorResidentModules(): CMEModule[] {
    return SENIOR_RESIDENT_MODULES;
  }

  getModulesByLevel(level: TrainingLevel): CMEModule[] {
    switch (level) {
      case 'house_officer':
        return HOUSE_OFFICER_MODULES;
      case 'junior_resident':
        return JUNIOR_RESIDENT_MODULES;
      case 'senior_resident':
        return SENIOR_RESIDENT_MODULES;
      default:
        return [];
    }
  }

  getModuleById(moduleId: string): CMEModule | undefined {
    const allModules = [...HOUSE_OFFICER_MODULES, ...JUNIOR_RESIDENT_MODULES, ...SENIOR_RESIDENT_MODULES];
    return allModules.find(m => m.id === moduleId);
  }

  getTopicById(topicId: string): CMETopic | undefined {
    const allModules = [...HOUSE_OFFICER_MODULES, ...JUNIOR_RESIDENT_MODULES, ...SENIOR_RESIDENT_MODULES];
    for (const module of allModules) {
      const topic = module.topics.find(t => t.id === topicId);
      if (topic) return topic;
    }
    return undefined;
  }

  getAllTopics(level: TrainingLevel): CMETopic[] {
    const modules = this.getModulesByLevel(level);
    return modules.flatMap(m => m.topics);
  }
}

export const medicalTrainingService = new MedicalTrainingService();
