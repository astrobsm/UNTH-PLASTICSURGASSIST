import { useState, useEffect, useRef } from 'react';
import { Download, BookOpen, AlertCircle, Info, FileText, Heart, Activity, User, Search, MessageCircle, Loader2, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import { sanitizePdfDocument } from '../utils/pdfSafeText';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  addFooter,
  sharePDFViaWhatsApp
} from '../utils/pdfUtils';
import { patientService } from '../services/patientService';
import { calculateAge } from '../utils/dateUtils';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';

interface EducationTopic {
  id: string;
  title: string;
  icon: React.ReactNode;
  category: string;
  content: {
    introduction: string;
    sections: {
      title: string;
      points: string[];
    }[];
    keyPoints: string[];
    references: string[];
  };
}

interface Patient {
  id: string;
  hospital_number: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  date_of_birth?: string;
  dob?: string;
  gender?: string;
  sex?: string;
  phone?: string;
}

export default function PatientEducation() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [pendingTopicForPDF, setPendingTopicForPDF] = useState<EducationTopic | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  useOnSelectedPatient((p) => {
    setPatientSearchTerm(((p as any).hospital_number || '').toString());
  });
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareAction, setShareAction] = useState<'download' | 'whatsapp' | 'thermal'>('download');
  const lastGeneratedPdfRef = useRef<{ pdf: jsPDF; filename: string } | null>(null);

  // Fetch patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const fetchedPatients = await patientService.getAllPatients();
      setPatients(fetchedPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const searchLower = patientSearchTerm.toLowerCase();
    const fullName = patient.full_name || 
      `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    return (
      fullName.toLowerCase().includes(searchLower) ||
      (patient.hospital_number || '').toLowerCase().includes(searchLower)
    );
  });

  const educationTopics: EducationTopic[] = [
    {
      id: 'diabetic-foot-care',
      title: 'Diabetic Foot Care',
      icon: <Heart className="w-6 h-6" />,
      category: 'Chronic Care',
      content: {
        introduction: 'Proper foot care is essential for people with diabetes to prevent serious complications. This guide provides comprehensive instructions based on WHO guidelines.',
        sections: [
          {
            title: 'Daily Foot Inspection',
            points: [
              'Check your feet daily for cuts, blisters, redness, swelling, or nail problems',
              'Use a mirror to check the bottom of your feet if needed',
              'Look between your toes for cracks or signs of fungal infection',
              'Report any changes or problems to your healthcare provider immediately'
            ]
          },
          {
            title: 'Proper Foot Hygiene',
            points: [
              'Wash your feet daily with lukewarm water and mild soap',
              'Dry your feet thoroughly, especially between the toes',
              'Apply moisturizer to prevent dry, cracked skin (avoid between toes)',
              'Never soak your feet as this can lead to skin breakdown'
            ]
          },
          {
            title: 'Nail Care',
            points: [
              'Cut toenails straight across and file the edges',
              'Do not cut into the corners of nails',
              'If you have difficulty, ask a podiatrist to trim your nails',
              'Never use sharp objects to clean under nails'
            ]
          },
          {
            title: 'Footwear Guidelines',
            points: [
              'Always wear shoes or slippers - never walk barefoot, even indoors',
              'Check inside shoes for foreign objects before wearing',
              'Wear well-fitting shoes that do not cause pressure points',
              'Break in new shoes gradually (wear for 1-2 hours initially)',
              'Wear clean, dry socks daily - avoid tight elastic tops',
              'Choose seamless socks to prevent irritation'
            ]
          },
          {
            title: 'Blood Sugar Control',
            points: [
              'Maintain good blood glucose control to promote healing',
              'Monitor blood sugar levels as directed by your doctor',
              'Take diabetes medications as prescribed',
              'Follow your recommended diet plan'
            ]
          },
          {
            title: 'Warning Signs - Seek Immediate Medical Care If:',
            points: [
              'You notice a cut, blister, or bruise that does not heal',
              'Your foot becomes red, warm, or swollen',
              'You develop a fever with foot problems',
              'You notice drainage, pus, or foul odor from a wound',
              'You experience numbness, tingling, or loss of sensation',
              'You notice color changes in your foot (pale, blue, or black areas)'
            ]
          }
        ],
        keyPoints: [
          'Inspect feet daily',
          'Keep feet clean and moisturized',
          'Wear proper footwear always',
          'Control blood sugar levels',
          'Seek immediate care for any foot problems',
          'Have regular check-ups with your healthcare provider'
        ],
        references: [
          'WHO Guidelines on the Management of Diabetic Foot',
          'International Diabetes Federation - Foot Care Guidelines',
          'Standards of Medical Care in Diabetes - Foot Care Section'
        ]
      }
    },
    {
      id: 'leg-ulcer-positioning',
      title: 'Positioning & Limb Elevation for Leg Ulcers',
      icon: <Activity className="w-6 h-6" />,
      category: 'Wound Care',
      content: {
        introduction: 'Proper positioning and limb elevation are crucial for healing leg ulcers by improving blood circulation and reducing swelling.',
        sections: [
          {
            title: 'Leg Elevation Technique',
            points: [
              'Elevate your leg above the level of your heart when sitting or lying down',
              'Use pillows or a foam wedge to support your entire leg, not just the ankle',
              'Aim to elevate your leg for at least 30 minutes, 3-4 times daily',
              'Elevate your legs while sleeping by raising the foot of your bed 4-6 inches'
            ]
          },
          {
            title: 'Proper Positioning While Sitting',
            points: [
              'Avoid sitting with legs hanging down for prolonged periods',
              'Use a footstool or ottoman to elevate your feet when sitting',
              'Do not cross your legs as this restricts blood flow',
              'Change position every 30-60 minutes to prevent stiffness',
              'If possible, recline in a chair with leg support'
            ]
          },
          {
            title: 'Positioning While Lying Down',
            points: [
              'Lie on your back or side with affected leg elevated',
              'Place pillows under the entire length of your leg',
              'Ensure the ulcer is not under pressure',
              'Use soft, breathable bedding materials',
              'Avoid tight sheets that compress the wound'
            ]
          },
          {
            title: 'Exercise and Movement',
            points: [
              'Perform ankle pumps (flex and point your foot) 10 times every hour',
              'Do gentle leg exercises as recommended by your physiotherapist',
              'Walk short distances regularly to improve circulation',
              'Avoid prolonged standing in one position',
              'Wear compression stockings if prescribed by your doctor'
            ]
          },
          {
            title: 'What to Avoid',
            points: [
              'Do not let your leg hang down for more than 30 minutes at a time',
              'Avoid tight clothing around the legs',
              'Do not apply heat directly to the ulcer',
              'Avoid crossing your legs when sitting',
              'Do not massage directly over or around the ulcer'
            ]
          }
        ],
        keyPoints: [
          'Elevate legs above heart level regularly',
          'Avoid prolonged sitting with legs down',
          'Perform ankle exercises hourly',
          'Use proper support when elevating',
          'Follow prescribed compression therapy',
          'Keep ulcer clean and dressed'
        ],
        references: [
          'WHO Guidelines for Chronic Wound Management',
          'Evidence-Based Guidelines for Leg Ulcer Management',
          'Venous Leg Ulcer Clinical Practice Guidelines'
        ]
      }
    },
    {
      id: 'postop-spinal-anaesthesia',
      title: 'Post-Operative Care After Spinal Anaesthesia',
      icon: <AlertCircle className="w-6 h-6" />,
      category: 'Post-Operative',
      content: {
        introduction: 'Following these instructions after spinal anaesthesia will help ensure a safe and comfortable recovery.',
        sections: [
          {
            title: 'Immediate Post-Operative Period (First 6-8 Hours)',
            points: [
              'You will remain flat on your back or with minimal head elevation for 6-8 hours',
              'You will not be able to move your legs initially - this is normal',
              'Sensation and movement will gradually return over 2-4 hours',
              'Nurses will monitor your vital signs regularly',
              'You may feel numbness or tingling as the anaesthetic wears off'
            ]
          },
          {
            title: 'Preventing Headaches',
            points: [
              'Remain lying flat for the recommended time period',
              'Drink plenty of fluids once permitted (at least 2-3 liters in 24 hours)',
              'Avoid sudden head elevation or sitting up quickly',
              'Use extra pillows only when specifically authorized by nursing staff',
              'If headache develops, inform nursing staff immediately'
            ]
          },
          {
            title: 'Mobilization',
            points: [
              'Do not attempt to stand or walk until cleared by nursing staff',
              'When permitted, get up slowly with assistance',
              'First sit on the edge of the bed for a few minutes',
              'Stand slowly and wait before attempting to walk',
              'Always have assistance for your first few times out of bed',
              'Report any dizziness, weakness, or lightheadedness immediately'
            ]
          },
          {
            title: 'Bladder Function',
            points: [
              'You may have difficulty urinating for several hours',
              'Inform nursing staff if you cannot urinate within 6-8 hours',
              'A temporary catheter may be needed if you cannot void',
              'Drink adequate fluids to promote bladder function',
              'Report any burning or difficulty urinating'
            ]
          },
          {
            title: 'Back Care',
            points: [
              'Some back soreness at the injection site is normal',
              'Apply ice packs if recommended by your doctor',
              'Avoid strenuous activities for 24 hours',
              'Mild over-the-counter pain relief may be used as directed'
            ]
          },
          {
            title: 'Warning Signs - Contact Medical Staff If:',
            points: [
              'Severe headache that worsens when sitting or standing',
              'Persistent numbness or weakness in legs beyond expected time',
              'Severe back pain at injection site',
              'Difficulty breathing or chest pain',
              'Inability to urinate after 8 hours',
              'Severe nausea or vomiting',
              'Loss of bowel or bladder control',
              'Fever above 38�C (100.4�F)'
            ]
          }
        ],
        keyPoints: [
          'Lie flat for 6-8 hours post-procedure',
          'Drink plenty of fluids',
          'Mobilize slowly with assistance',
          'Monitor for headache development',
          'Report any concerns immediately',
          'Follow all nursing instructions carefully'
        ],
        references: [
          'WHO Safe Surgery Guidelines - Anaesthesia Section',
          'Post-Spinal Anaesthesia Care Protocols',
          'Anaesthesia Recovery Guidelines'
        ]
      }
    },
    {
      id: 'postop-general-anaesthesia',
      title: 'Post-Operative Care After General Anaesthesia',
      icon: <FileText className="w-6 h-6" />,
      category: 'Post-Operative',
      content: {
        introduction: 'Recovery from general anaesthesia requires careful monitoring and following specific instructions to ensure safety.',
        sections: [
          {
            title: 'Recovery Room Period',
            points: [
              'You will wake up in the recovery room with specialized nursing care',
              'You may feel drowsy, confused, or disoriented initially - this is normal',
              'An oxygen mask or nasal prongs may be in place',
              'Your vital signs will be monitored continuously',
              'You will not be allowed to eat or drink until fully awake'
            ]
          },
          {
            title: 'Common Side Effects (First 24 Hours)',
            points: [
              'Drowsiness and fatigue',
              'Nausea or vomiting (medication can be given)',
              'Sore throat from breathing tube',
              'Dry mouth or thirst',
              'Shivering or feeling cold',
              'Confusion or memory gaps',
              'Muscle aches'
            ]
          },
          {
            title: 'Activity Restrictions (First 24 Hours)',
            points: [
              'Do not drive or operate machinery for 24 hours',
              'Do not make important decisions or sign legal documents',
              'Do not drink alcohol',
              'Do not take sleeping pills unless approved by your doctor',
              'Have a responsible adult stay with you',
              'Avoid strenuous activities'
            ]
          },
          {
            title: 'Eating and Drinking',
            points: [
              'Start with small sips of water when permitted',
              'Progress to light foods (crackers, toast) if tolerated',
              'Avoid heavy, fatty, or spicy foods for 24 hours',
              'If nausea occurs, stop eating and notify nursing staff',
              'Continue clear fluids until nausea resolves'
            ]
          },
          {
            title: 'Pain Management',
            points: [
              'Take prescribed pain medication as directed',
              'Do not wait for severe pain - take medication as scheduled',
              'Report inadequate pain control to nursing staff',
              'Use non-medication strategies: ice, positioning, deep breathing',
              'Keep a pain diary if recommended'
            ]
          },
          {
            title: 'Breathing Exercises',
            points: [
              'Take 10 deep breaths every hour while awake',
              'Use incentive spirometer if provided',
              'Cough gently to clear secretions (support incision)',
              'Change position in bed every 2 hours',
              'Sit up in chair as soon as permitted'
            ]
          },
          {
            title: 'Warning Signs - Seek Immediate Medical Care:',
            points: [
              'Difficulty breathing or shortness of breath',
              'Chest pain or rapid heartbeat',
              'Persistent vomiting',
              'Severe abdominal pain',
              'Inability to urinate',
              'Confusion or inability to wake fully',
              'Seizures or loss of consciousness',
              'Allergic reaction (rash, swelling, difficulty breathing)'
            ]
          }
        ],
        keyPoints: [
          'Have adult supervision for 24 hours',
          'No driving or important decisions for 24 hours',
          'Start diet slowly as tolerated',
          'Take pain medication as prescribed',
          'Perform breathing exercises regularly',
          'Report concerning symptoms immediately'
        ],
        references: [
          'WHO Safe Surgery Checklist - Recovery Guidelines',
          'Post-Anaesthesia Care Standards',
          'General Anaesthesia Recovery Protocols'
        ]
      }
    },
    {
      id: 'postop-skin-grafting',
      title: 'Post-Operative Care After Skin Grafting',
      icon: <Heart className="w-6 h-6" />,
      category: 'Post-Operative',
      content: {
        introduction: 'Proper post-operative care is essential for successful skin graft healing and optimal outcomes.',
        sections: [
          {
            title: 'Immediate Post-Operative Care (First 48-72 Hours)',
            points: [
              'The graft site will be covered with a pressure dressing',
              'Do not remove or disturb the dressing unless instructed',
              'Keep the grafted area completely immobile',
              'Elevate the grafted area above heart level if possible',
              'You may have a vacuum dressing (negative pressure therapy)'
            ]
          },
          {
            title: 'Activity Restrictions',
            points: [
              'Strict bed rest or limited activity as directed by your surgeon',
              'Do not put weight or pressure on the grafted area',
              'Avoid stretching or movement that could disrupt the graft',
              'Keep grafted limbs elevated on pillows',
              'Follow specific positioning instructions from your surgeon',
              'Gradual mobilization will begin only when approved'
            ]
          },
          {
            title: 'Donor Site Care',
            points: [
              'The donor site (where skin was taken) also requires care',
              'Keep donor site dressing clean and dry',
              'Donor site often hurts more than graft site initially',
              'Take prescribed pain medication regularly',
              'Donor site dressing will be changed as directed',
              'Report any signs of infection at donor site'
            ]
          },
          {
            title: 'Wound Care After Initial Dressing Removal',
            points: [
              'Gently clean the graft with prescribed solution',
              'Pat dry gently - do not rub',
              'Apply prescribed ointment or dressing',
              'Protect from sun exposure (use SPF 30+ for 6-12 months)',
              'Keep the area moisturized with recommended products',
              'Avoid scratching or picking at the graft'
            ]
          },
          {
            title: 'Pain Management',
            points: [
              'Take pain medication as prescribed (both sites may be painful)',
              'Donor site pain typically peaks at 24-48 hours',
              'Use cold therapy if approved by surgeon',
              'Elevate grafted area to reduce pain and swelling',
              'Report severe or increasing pain'
            ]
          },
          {
            title: 'Nutrition for Healing',
            points: [
              'Eat a high-protein diet to promote healing',
              'Include vitamin C rich foods (citrus, berries)',
              'Stay well-hydrated (8-10 glasses of water daily)',
              'Take vitamin supplements if prescribed',
              'Avoid smoking - it impairs healing',
              'Limit alcohol consumption'
            ]
          },
          {
            title: 'Long-Term Graft Care',
            points: [
              'Protect from sun exposure for at least one year',
              'Massage the graft gently once healed (as instructed)',
              'Use pressure garments if prescribed',
              'Keep skin moisturized daily',
              'Avoid trauma to the grafted area',
              'Attend all follow-up appointments'
            ]
          },
          {
            title: 'Warning Signs - Contact Surgeon Immediately:',
            points: [
              'Foul-smelling drainage from graft or donor site',
              'Increasing redness, warmth, or swelling',
              'Fever above 38�C (100.4�F)',
              'Graft appears dark, black, or blue',
              'Separation of graft from wound bed',
              'Severe or worsening pain not controlled by medication',
              'Bleeding that does not stop with gentle pressure'
            ]
          }
        ],
        keyPoints: [
          'Keep graft immobile for first 5-7 days',
          'Elevate grafted area consistently',
          'Care for both graft and donor sites',
          'Take pain medication regularly',
          'Eat high-protein diet',
          'Protect from sun exposure',
          'Attend all follow-up appointments'
        ],
        references: [
          'WHO Surgical Care Guidelines - Skin Grafting',
          'Plastic Surgery Post-Operative Protocols',
          'Skin Graft Management Best Practices'
        ]
      }
    },
    {
      id: 'postop-non-abdominal',
      title: 'Post-Operative Care After Non-Abdominal Surgery',
      icon: <Info className="w-6 h-6" />,
      category: 'Post-Operative',
      content: {
        introduction: 'General post-operative instructions for non-abdominal surgical procedures.',
        sections: [
          {
            title: 'Wound Care',
            points: [
              'Keep surgical dressing clean and dry for 24-48 hours',
              'Do not remove initial dressing unless instructed',
              'After dressing removal, gently clean with mild soap and water',
              'Pat dry - do not rub the incision',
              'Apply new dressing as instructed',
              'Look for signs of infection daily'
            ]
          },
          {
            title: 'Pain Management',
            points: [
              'Take prescribed pain medication as directed',
              'Do not wait for pain to become severe',
              'Use ice packs (wrapped in towel) for 15-20 minutes at a time',
              'Keep surgical area elevated if applicable',
              'Report inadequate pain control to your doctor'
            ]
          },
          {
            title: 'Activity Guidelines',
            points: [
              'Rest for the first 24-48 hours',
              'Gradually increase activity as tolerated',
              'Avoid strenuous activity for 2-4 weeks (or as directed)',
              'Do not lift anything heavier than 5kg for specified period',
              'Follow specific restrictions for your type of surgery',
              'Return to work only when cleared by your surgeon'
            ]
          },
          {
            title: 'Bathing and Hygiene',
            points: [
              'Keep incision dry for first 24-48 hours',
              'Sponge bath until cleared for shower',
              'When permitted, let water run over incision (no soaking)',
              'Do not submerge incision in bath or pool for 2-3 weeks',
              'Gently pat incision dry after showering',
              'Do not apply lotions, creams, or powders to incision unless prescribed'
            ]
          },
          {
            title: 'Diet and Nutrition',
            points: [
              'Return to normal diet as tolerated',
              'Eat high-protein foods to promote healing',
              'Stay well-hydrated (8-10 glasses of water daily)',
              'Include fruits and vegetables for vitamins',
              'Avoid alcohol for 24-48 hours or while taking pain medication',
              'Take prescribed vitamins or supplements'
            ]
          },
          {
            title: 'Medication Management',
            points: [
              'Take all prescribed medications as directed',
              'Complete full course of antibiotics if prescribed',
              'Take pain medication with food to prevent stomach upset',
              'Do not take aspirin or anti-inflammatory drugs unless approved',
              'Continue your regular medications unless told otherwise',
              'Ask about when to resume blood thinners if applicable'
            ]
          },
          {
            title: 'Follow-Up Care',
            points: [
              'Attend all scheduled follow-up appointments',
              'Suture or staple removal typically at 7-14 days',
              'Bring list of questions to follow-up visits',
              'Report any concerns between appointments',
              'Keep a record of your recovery progress'
            ]
          },
          {
            title: 'Warning Signs - Seek Medical Attention:',
            points: [
              'Fever above 38�C (100.4�F)',
              'Increasing redness, warmth, or swelling at incision',
              'Pus or foul-smelling drainage from wound',
              'Wound edges separating or opening',
              'Increasing pain not relieved by medication',
              'Numbness or tingling in affected area',
              'Excessive bleeding from incision',
              'Difficulty breathing or chest pain'
            ]
          }
        ],
        keyPoints: [
          'Keep incision clean and dry',
          'Take pain medication as prescribed',
          'Gradually increase activity',
          'Watch for signs of infection',
          'Attend follow-up appointments',
          'Report concerning symptoms promptly'
        ],
        references: [
          'WHO Safe Surgery Post-Operative Guidelines',
          'Standard Post-Operative Care Protocols',
          'Surgical Wound Management Guidelines'
        ]
      }
    },
    {
      id: 'preop-general-anaesthesia',
      title: 'Pre-Operative Instructions for General Anaesthesia',
      icon: <BookOpen className="w-6 h-6" />,
      category: 'Pre-Operative',
      content: {
        introduction: 'Proper preparation for general anaesthesia is essential for your safety and successful surgery.',
        sections: [
          {
            title: 'Fasting Requirements (NPO - Nothing By Mouth)',
            points: [
              'No solid foods for 8 hours before surgery',
              'No milk, juice with pulp, or opaque liquids for 6 hours before',
              'Clear liquids (water, clear juice, black tea/coffee) up to 2 hours before',
              'No chewing gum or candy',
              'Do not smoke for at least 8 hours before surgery',
              'If you accidentally eat/drink, inform the anaesthetist immediately'
            ]
          },
          {
            title: 'Medications',
            points: [
              'Take prescribed heart and blood pressure medications with small sip of water',
              'Continue diabetes medications only as specifically instructed',
              'Stop blood thinners (aspirin, warfarin) as directed (usually 5-7 days before)',
              'Stop herbal supplements 7 days before surgery',
              'Bring list of all medications including over-the-counter drugs',
              'Bring your regular medications to the hospital'
            ]
          },
          {
            title: 'Pre-Operative Hygiene',
            points: [
              'Shower or bathe the night before and morning of surgery',
              'Use antibacterial soap if provided',
              'Wash hair and keep it loose (no clips, pins, or ties)',
              'Remove all makeup, nail polish, and artificial nails',
              'Do not apply lotions, creams, or deodorant',
              'Brush teeth but do not swallow water'
            ]
          },
          {
            title: 'What to Remove',
            points: [
              'All jewelry (including rings, even wedding bands)',
              'Piercings of all types',
              'Contact lenses or glasses (bring case)',
              'Dentures, bridges, or removable dental work',
              'Hearing aids (bring case to keep them safe)',
              'Wigs or hairpieces',
              'Prosthetics if removable'
            ]
          },
          {
            title: 'What to Wear',
            points: [
              'Wear comfortable, loose-fitting clothing',
              'Avoid clothing that needs to be pulled over your head',
              'Do not wear underwire bras',
              'Leave valuables at home',
              'Wear flat, comfortable shoes',
              'You will change into a hospital gown'
            ]
          },
          {
            title: 'Transportation and Support',
            points: [
              'Arrange for a responsible adult to drive you home',
              'You cannot drive yourself or take public transport alone',
              'Your escort must stay at the hospital during your surgery',
              'Someone should stay with you for 24 hours after surgery',
              'Make arrangements for childcare and pet care',
              'Prepare your home for recovery before admission'
            ]
          },
          {
            title: 'Medical Clearance',
            points: [
              'Complete all required pre-operative tests (blood work, ECG, X-rays)',
              'Bring test results if done elsewhere',
              'Inform doctor of any recent illness, fever, or infection',
              'Report any dental infections or loose teeth',
              'Pregnancy test may be required for women of childbearing age',
              'Update medical team on any changes to your health'
            ]
          },
          {
            title: 'Special Considerations',
            points: [
              'If you have diabetes, discuss blood sugar management plan',
              'If you have sleep apnea, bring your CPAP machine',
              'Inform team if you have difficult veins or previous anaesthesia problems',
              'Discuss any allergies (medications, latex, food)',
              'Inform if you have loose teeth, caps, or crowns',
              'Report history of malignant hyperthermia in family'
            ]
          },
          {
            title: 'Day of Surgery Checklist',
            points: [
              'Arrive at designated time (usually 2 hours before surgery)',
              'Bring ID and insurance information',
              'Bring list of medications and allergies',
              'Complete fasting requirements',
              'Take only approved medications with small sip of water',
              'Do not bring valuables',
              'Have responsible adult accompany you'
            ]
          }
        ],
        keyPoints: [
          'Nothing to eat 8 hours before surgery',
          'Clear liquids up to 2 hours before',
          'Take approved medications with small sip of water',
          'Remove all jewelry, makeup, and nail polish',
          'Arrange transportation and 24-hour supervision',
          'Complete all pre-operative tests',
          'Arrive 2 hours before scheduled surgery time'
        ],
        references: [
          'WHO Safe Surgery Checklist - Pre-Operative Section',
          'ASA Fasting Guidelines',
          'Pre-Anaesthesia Assessment Standards'
        ]
      }
    },
    {
      id: 'preop-spinal-anaesthesia',
      title: 'Pre-Operative Instructions for Spinal Anaesthesia',
      icon: <BookOpen className="w-6 h-6" />,
      category: 'Pre-Operative',
      content: {
        introduction: 'Spinal anaesthesia numbs the lower half of your body while you remain awake. Proper preparation ensures safety and comfort.',
        sections: [
          {
            title: 'Fasting Requirements',
            points: [
              'No solid foods for 6 hours before procedure',
              'Clear liquids allowed up to 2 hours before',
              'Empty bladder before going to operating room',
              'Follow specific instructions given by your anaesthetist',
              'If emergency surgery, inform team when you last ate/drank'
            ]
          },
          {
            title: 'Medications',
            points: [
              'Take heart and blood pressure medications with small sip of water',
              'Stop blood thinners as directed (usually 5-7 days before)',
              'Inform anaesthetist of all medications including supplements',
              'Discuss aspirin use with your surgeon',
              'Continue or adjust diabetes medications as specifically instructed',
              'Bring medication list to hospital'
            ]
          },
          {
            title: 'Pre-Procedure Preparation',
            points: [
              'Shower with antibacterial soap if provided',
              'Wear clean, comfortable clothing to hospital',
              'Remove jewelry, watches, and piercings',
              'Remove contact lenses (bring glasses if needed)',
              'Do not apply lotions or creams to lower back area',
              'Empty bowels if possible before procedure'
            ]
          },
          {
            title: 'What to Expect During Spinal Placement',
            points: [
              'You will sit or lie on your side with back curved',
              'Back will be cleaned with antiseptic solution',
              'Local anaesthetic will numb the injection site',
              'You will feel pressure but should not feel sharp pain',
              'Must remain very still during injection',
              'Procedure takes 5-10 minutes'
            ]
          },
          {
            title: 'After Spinal Injection',
            points: [
              'Legs will become numb and heavy within minutes',
              'You will not be able to move your legs',
              'Feeling will gradually return over 2-4 hours',
              'You will remain awake during surgery (unless sedation given)',
              'You may feel pulling or pressure but no pain',
              'Numbness is temporary and expected'
            ]
          },
          {
            title: 'Post-Procedure Requirements',
            points: [
              'Must lie flat for 6-8 hours after spinal',
              'Arrange for someone to stay with you for 24 hours',
              'You cannot drive for 24 hours',
              'Need responsible adult to take you home',
              'Plan for assistance at home',
              'Avoid strenuous activity for 24 hours'
            ]
          },
          {
            title: 'Conditions to Report',
            points: [
              'History of back surgery or spine problems',
              'Previous problems with spinal anaesthesia',
              'Blood clotting disorders',
              'Taking blood thinners',
              'Skin infection on lower back',
              'Neurological conditions',
              'Severe headaches or migraines'
            ]
          },
          {
            title: 'Day of Procedure',
            points: [
              'Arrive at designated time',
              'Bring ID and insurance information',
              'Wear loose, comfortable clothing',
              'Have responsible adult accompany you',
              'Complete fasting requirements',
              'Empty bladder before procedure',
              'Inform staff of any last-minute concerns'
            ]
          }
        ],
        keyPoints: [
          'Fast for 6 hours (clear liquids up to 2 hours)',
          'Take approved medications only',
          'Must lie flat for 6-8 hours after procedure',
          'Arrange 24-hour adult supervision',
          'No driving for 24 hours',
          'Inform staff of back problems or previous spinal issues',
          'Hydrate well before and after procedure'
        ],
        references: [
          'WHO Anaesthesia Safety Guidelines',
          'Spinal Anaesthesia Practice Standards',
          'Regional Anaesthesia Pre-Procedure Protocols'
        ]
      }
    },
    {
      id: 'preop-local-anaesthesia',
      title: 'Pre-Operative Instructions for Local Anaesthesia',
      icon: <BookOpen className="w-6 h-6" />,
      category: 'Pre-Operative',
      content: {
        introduction: 'Local anaesthesia numbs only the specific area being operated on. These instructions will help ensure a safe procedure.',
        sections: [
          {
            title: 'Fasting (Usually Not Required)',
            points: [
              'For minor procedures, eating is usually allowed',
              'Follow specific instructions from your surgeon',
              'Eat a light meal 2-3 hours before if permitted',
              'Avoid heavy, fatty foods on procedure day',
              'Stay well-hydrated unless instructed otherwise',
              'If sedation will also be given, different fasting rules apply'
            ]
          },
          {
            title: 'Medications',
            points: [
              'Take all regular medications unless specifically told otherwise',
              'Inform doctor of all medications including over-the-counter',
              'Discuss blood thinners with your surgeon',
              'Report any allergies to local anaesthetics (lidocaine, novocaine)',
              'Bring list of allergies and medications',
              'Ask if you should take regular medications with food'
            ]
          },
          {
            title: 'Before the Procedure',
            points: [
              'Shower and clean the area to be operated on',
              'Wear clean, comfortable, loose-fitting clothing',
              'Avoid applying lotions, creams, or makeup to surgical area',
              'Remove jewelry near the surgical site',
              'Arrive at scheduled time',
              'Bring a list of questions or concerns'
            ]
          },
          {
            title: 'What to Expect',
            points: [
              'Surgical area will be cleaned with antiseptic',
              'You will feel a small needle prick and burning sensation',
              'Area will become numb within 5-10 minutes',
              'You will be awake during the procedure',
              'You may feel pressure or pulling but no pain',
              'Procedure length varies depending on surgery type',
              'Numbness will wear off in 1-4 hours'
            ]
          },
          {
            title: 'Transportation',
            points: [
              'Usually you can drive yourself home',
              'If sedation is also given, you MUST have a driver',
              'Confirm driving restrictions with your surgeon',
              'Consider having someone accompany you for support',
              'Arrange ride if procedure is on hand/arm and you cannot drive',
              'Plan transportation based on procedure location'
            ]
          },
          {
            title: 'After the Procedure',
            points: [
              'Follow all wound care instructions',
              'Take prescribed pain medication before numbness wears off',
              'Keep bandage clean and dry as instructed',
              'Avoid using the area until numbness resolves',
              'Be careful not to bite tongue or cheek if mouth/face is numb',
              'Watch for any allergic reactions'
            ]
          },
          {
            title: 'Allergies and Previous Reactions',
            points: [
              'Inform doctor of any previous reactions to local anaesthetics',
              'Report allergies to dental anaesthetics',
              'Mention allergies to "-caine" medications',
              'Inform about latex allergies',
              'Report previous fainting during injections',
              'Alternative anaesthetics available if needed'
            ]
          },
          {
            title: 'Special Situations',
            points: [
              'Inform if you are pregnant or might be pregnant',
              'Report if you are breastfeeding',
              'Mention if you have heart disease or irregular heartbeat',
              'Inform about liver or kidney disease',
              'Report seizure disorders',
              'Discuss anxiety or fear about needles/procedures'
            ]
          }
        ],
        keyPoints: [
          'Fasting usually not required (confirm with surgeon)',
          'Take regular medications unless told otherwise',
          'Report allergies to local anaesthetics',
          'Clean surgical area before arrival',
          'Usually can drive yourself (unless sedation given)',
          'Numbness wears off in 1-4 hours',
          'Take pain medication before numbness resolves'
        ],
        references: [
          'WHO Surgical Safety Standards',
          'Local Anaesthesia Practice Guidelines',
          'Safe Minor Surgery Protocols'
        ]
      }
    },
    // ============================================
    // NEW COMPREHENSIVE PATIENT EDUCATION TOPICS
    // ============================================
    {
      id: 'understanding-condition-treatment',
      title: 'Understanding Your Condition and Treatment Plan',
      icon: <BookOpen className="w-6 h-6" />,
      category: 'General Education',
      content: {
        introduction: 'Understanding your diagnosis and treatment plan is essential for your recovery. This guide explains plastic, reconstructive, and burn conditions to help you participate actively in your care.',
        sections: [
          {
            title: 'Overview of Plastic, Reconstructive, and Burn Conditions',
            points: [
              'Plastic surgery includes reconstructive procedures to restore function and appearance',
              'Burns are classified by depth: superficial (1st degree), partial thickness (2nd degree), and full thickness (3rd degree)',
              'Reconstructive surgery addresses congenital defects, trauma, cancer removal, and chronic wounds',
              'Treatment goals include restoring function, preventing complications, and improving quality of life',
              'Each condition requires individualized treatment based on severity and location'
            ]
          },
          {
            title: 'Understanding Your Specific Diagnosis',
            points: [
              'Ask your doctor to explain your specific condition in terms you understand',
              'Know the extent and severity of your injury or condition',
              'Understand which body areas are affected and how',
              'Learn about the cause of your condition if known',
              'Ask about the expected impact on your daily activities'
            ]
          },
          {
            title: 'Phases of Care',
            points: [
              'Acute phase: Initial emergency care and stabilization (hours to days)',
              'Subacute phase: Active treatment, wound healing, and early rehabilitation (weeks)',
              'Chronic phase: Long-term management, scar care, and functional recovery (months to years)',
              'Reconstructive phase: Additional surgeries to improve function or appearance',
              'Each phase has specific goals and requires different types of care'
            ]
          },
          {
            title: 'Expected Course of Treatment and Timelines',
            points: [
              'Initial treatment focuses on wound closure and infection prevention',
              'Healing times vary: Minor wounds (1-2 weeks), major burns (months)',
              'Multiple surgeries may be needed over time',
              'Rehabilitation continues long after wounds heal',
              'Final results may take 1-2 years to fully mature'
            ]
          },
          {
            title: 'Your Multidisciplinary Care Team',
            points: [
              'Plastic surgeon: Leads surgical treatment and reconstructive planning',
              'Nurses: Provide daily wound care and patient education',
              'Physiotherapist: Helps restore movement and prevent contractures',
              'Occupational therapist: Assists with daily activities and hand function',
              'Psychologist/counselor: Supports emotional well-being and coping',
              'Nutritionist: Ensures adequate nutrition for healing',
              'Social worker: Assists with discharge planning and support services'
            ]
          },
          {
            title: 'Importance of Follow-Up Care',
            points: [
              'Regular follow-up visits are essential for monitoring healing',
              'Early detection of complications leads to better outcomes',
              'Treatment plans may be adjusted based on your progress',
              'Scar management requires ongoing professional guidance',
              'Keep all scheduled appointments even when feeling well',
              'Contact your team if you notice any changes or concerns'
            ]
          }
        ],
        keyPoints: [
          'Understand your specific diagnosis and treatment plan',
          'Know the different phases of care and what to expect',
          'Your care team includes many specialists working together',
          'Recovery takes time - be patient with the process',
          'Regular follow-up visits are essential',
          'Ask questions whenever you are unsure'
        ],
        references: [
          'WHO Burns Management Guidelines',
          'International Society of Burn Injuries - Patient Education Standards',
          'American Society of Plastic Surgeons - Patient Information'
        ]
      }
    },
    {
      id: 'wound-burn-care-education',
      title: 'Wound and Burn Care Education',
      icon: <Heart className="w-6 h-6" />,
      category: 'Wound Care',
      content: {
        introduction: 'Understanding how wounds and burns heal will help you participate effectively in your care. This guide explains the healing process and how to care for different types of injuries.',
        sections: [
          {
            title: 'Basic Wound and Burn Healing Process',
            points: [
              'Inflammation phase (days 1-5): Redness, swelling, warmth as body fights infection',
              'Proliferation phase (days 5-21): New tissue forms, wound contracts',
              'Remodeling phase (weeks to years): Scar strengthens and matures',
              'Burns heal differently based on depth - superficial burns heal fastest',
              'Deep wounds require new skin growth from edges or skin grafting',
              'Complete healing takes months to years for significant injuries'
            ]
          },
          {
            title: 'Types of Wounds and Burns',
            points: [
              'Thermal burns: Caused by fire, hot liquids, steam, or hot objects',
              'Chemical burns: Caused by acids, alkalis, or caustic substances',
              'Electrical burns: Often deeper than they appear on surface',
              'Pressure wounds: Result from prolonged pressure on skin (bedsores)',
              'Traumatic wounds: From accidents, cuts, crush injuries',
              'Each type requires specific treatment approaches'
            ]
          },
          {
            title: 'Daily Wound Care and Dressing Techniques',
            points: [
              'Always wash hands thoroughly before touching wounds',
              'Remove old dressings gently - soak if stuck',
              'Clean wounds as instructed (usually with saline or clean water)',
              'Pat dry gently with clean gauze - do not rub',
              'Apply prescribed medications or ointments',
              'Apply new dressing as demonstrated by your nurse',
              'Dispose of old dressings properly'
            ]
          },
          {
            title: 'Signs of Normal Healing',
            points: [
              'Pink, healthy tissue at wound edges',
              'Gradual decrease in wound size',
              'Less drainage over time',
              'Mild itching as healing progresses',
              'New skin appears pink or red initially',
              'Scars may be raised and firm initially'
            ]
          },
          {
            title: 'Signs of Complications - Seek Medical Care If:',
            points: [
              'Increasing pain, redness, or swelling around wound',
              'Yellow, green, or foul-smelling discharge',
              'Fever above 38�C (100.4�F)',
              'Wound edges separating or opening',
              'Black or dark tissue appearing in wound',
              'Excessive bleeding that does not stop',
              'Red streaks spreading from wound'
            ]
          },
          {
            title: 'Infection Prevention and Hygiene',
            points: [
              'Keep wounds covered and protected',
              'Change dressings regularly as instructed',
              'Never touch wounds with dirty hands',
              'Keep wound area clean and dry between dressing changes',
              'Avoid submerging wounds in water (baths, pools)',
              'Do not apply traditional remedies or unprescribed substances',
              'Complete all prescribed antibiotics if given'
            ]
          }
        ],
        keyPoints: [
          'Wounds heal in stages over weeks to months',
          'Different injury types require different care',
          'Clean hands are essential before wound care',
          'Know the signs of normal healing vs complications',
          'Keep wounds clean, covered, and dry',
          'Report any concerning changes promptly'
        ],
        references: [
          'WHO Guidelines on Wound Management',
          'International Wound Care Guidelines',
          'Burn Care Standards - WHO/ISBI'
        ]
      }
    },
    {
      id: 'pain-symptom-management',
      title: 'Pain and Symptom Management',
      icon: <Activity className="w-6 h-6" />,
      category: 'Symptom Management',
      content: {
        introduction: 'Pain is a normal part of recovery from injury or surgery. Understanding how to manage pain and other symptoms will help you heal more comfortably.',
        sections: [
          {
            title: 'Understanding Pain After Injury or Surgery',
            points: [
              'Pain is your body\'s natural response to tissue damage',
              'Pain is usually worst in the first few days and gradually improves',
              'Burn and wound pain can be severe and requires adequate treatment',
              'Pain during dressing changes is common and can be managed',
              'Chronic pain may persist in some cases and requires ongoing management',
              'Everyone experiences pain differently - your pain is valid'
            ]
          },
          {
            title: 'Proper Use of Pain Medications',
            points: [
              'Take medications exactly as prescribed by your doctor',
              'Do not wait until pain is severe - take medication on schedule',
              'Take pain medication 30-60 minutes before dressing changes',
              'Never take more than the prescribed dose',
              'Do not mix pain medications without doctor approval',
              'Report if medications are not controlling your pain',
              'Some medications may cause constipation - drink fluids, eat fiber'
            ]
          },
          {
            title: 'Non-Drug Pain Relief Methods',
            points: [
              'Positioning: Elevate injured area to reduce swelling and pain',
              'Splinting: Immobilize affected area as prescribed',
              'Relaxation techniques: Deep breathing, meditation, visualization',
              'Distraction: Music, television, conversation during procedures',
              'Cold therapy: Ice packs (wrapped in cloth) may help some conditions',
              'Gentle movement: Light exercise as approved by physiotherapy',
              'Adequate rest and sleep'
            ]
          },
          {
            title: 'Managing Itching',
            points: [
              'Itching is common during healing - it\'s often a good sign',
              'Keep skin moisturized with approved products',
              'Avoid scratching - it can damage healing tissue',
              'Antihistamines may be prescribed for severe itching',
              'Cool compresses may provide temporary relief',
              'Wear loose, soft, cotton clothing',
              'Report severe or unrelenting itching to your doctor'
            ]
          },
          {
            title: 'Managing Swelling and Discomfort',
            points: [
              'Elevate affected limbs above heart level when possible',
              'Wear compression garments if prescribed',
              'Avoid prolonged standing or sitting',
              'Move and exercise gently as advised',
              'Drink adequate fluids',
              'Limit salt intake to reduce swelling',
              'Report sudden or severe swelling immediately'
            ]
          },
          {
            title: 'When to Report Worsening Symptoms',
            points: [
              'Pain that suddenly worsens or changes in character',
              'New pain in areas not previously affected',
              'Pain not controlled by prescribed medication',
              'Symptoms of medication side effects (nausea, drowsiness, confusion)',
              'Signs of infection (fever, increased redness, discharge)',
              'Numbness, tingling, or loss of sensation',
              'Difficulty breathing or chest pain'
            ]
          }
        ],
        keyPoints: [
          'Pain is normal and can be effectively managed',
          'Take medications as prescribed - don\'t wait for severe pain',
          'Use non-drug methods to complement medication',
          'Itching during healing is usually normal',
          'Elevate affected areas to reduce swelling',
          'Report any concerning symptoms promptly'
        ],
        references: [
          'WHO Pain Management Guidelines',
          'International Association for the Study of Pain - Patient Resources',
          'Burn Pain Management Protocols'
        ]
      }
    },
    {
      id: 'surgical-procedures-expectations',
      title: 'Surgical Procedures and Expectations',
      icon: <FileText className="w-6 h-6" />,
      category: 'Surgical Care',
      content: {
        introduction: 'Understanding your planned surgical procedures helps you prepare mentally and physically. This guide explains common plastic surgery procedures and what to expect.',
        sections: [
          {
            title: 'Explanation of Planned Surgical Procedures',
            points: [
              'Your surgeon will explain the specific procedure planned for you',
              'Ask questions until you fully understand what will be done',
              'Understand the goals: wound closure, reconstruction, or cosmetic improvement',
              'Know approximately how long the surgery will take',
              'Understand the type of anaesthesia that will be used',
              'Ask about hospital stay - same day or admission required'
            ]
          },
          {
            title: 'Skin Grafts: Purpose and Care',
            points: [
              'Skin grafts take skin from one area (donor site) to cover a wound',
              'Split-thickness grafts: Thin layer of skin, donor site heals on its own',
              'Full-thickness grafts: All skin layers, donor site is closed with stitches',
              'Graft site must remain immobile for 5-7 days for graft to "take"',
              'Donor site often hurts more than graft site initially',
              'Both sites require careful wound care'
            ]
          },
          {
            title: 'Flap Surgery and Reconstructive Options',
            points: [
              'Flaps move tissue with its own blood supply to cover defects',
              'Local flaps: Nearby tissue moved to cover wound',
              'Regional flaps: Tissue from same body region with attached blood vessel',
              'Free flaps: Tissue transferred from distant site with microsurgery',
              'Flap surgery is more complex but provides better quality tissue',
              'Recovery is longer but results are often superior'
            ]
          },
          {
            title: 'Understanding Scars',
            points: [
              'All healing wounds produce scars - this is normal',
              'Scars are red, raised, and firm initially (immature scars)',
              'Scar maturation takes 12-18 months',
              'Mature scars are paler, flatter, and softer',
              'Some people develop abnormal scars (hypertrophic or keloid)',
              'Scar appearance can be improved with proper care'
            ]
          },
          {
            title: 'Possible Risks and Complications',
            points: [
              'Infection: Can occur in any surgical wound',
              'Bleeding or hematoma: Collection of blood under skin',
              'Graft or flap failure: Partial or complete loss of transferred tissue',
              'Wound breakdown: Wound opens after surgery',
              'Nerve damage: Numbness or altered sensation',
              'Poor scarring: Hypertrophic scars or keloids',
              'Need for additional surgery'
            ]
          },
          {
            title: 'Expected Outcomes',
            points: [
              'Discuss realistic expectations with your surgeon',
              'Reconstructive surgery aims to restore function first, then appearance',
              'Complete restoration to pre-injury state may not be possible',
              'Multiple surgeries may be needed over time',
              'Final results may take 1-2 years to appreciate',
              'Photographs document progress over time',
              'Patient satisfaction depends on realistic expectations'
            ]
          }
        ],
        keyPoints: [
          'Understand your specific planned procedure',
          'Skin grafts require careful immobilization to heal',
          'Flaps provide higher quality tissue coverage',
          'All wounds produce scars that mature over 12-18 months',
          'Know the potential risks and complications',
          'Have realistic expectations about outcomes'
        ],
        references: [
          'Principles of Reconstructive Surgery - Patient Guide',
          'American Society of Plastic Surgeons - Procedure Information',
          'WHO Surgical Care Guidelines'
        ]
      }
    },
    {
      id: 'postop-hospital-care',
      title: 'Post-Operative and In-Hospital Care',
      icon: <Info className="w-6 h-6" />,
      category: 'Post-Operative',
      content: {
        introduction: 'Your care in the hospital after surgery is crucial for successful recovery. Understanding what to expect and how to participate in your care will help you heal faster.',
        sections: [
          {
            title: 'Bed Rest or Mobilization',
            points: [
              'Follow your surgeon\'s specific instructions about movement',
              'Some procedures require strict bed rest to protect grafts or flaps',
              'Position changes help prevent pressure sores and blood clots',
              'Early mobilization (when allowed) speeds recovery',
              'Ask for assistance when moving initially',
              'Gradually increase activity as directed'
            ]
          },
          {
            title: 'Care of Surgical Drains',
            points: [
              'Drains remove excess fluid from surgical sites',
              'Keep drain tubing secure and not kinked',
              'Empty drains as taught by nursing staff',
              'Record the amount and color of drainage',
              'Report sudden increase in drainage or blood',
              'Drains are removed when output decreases (usually 2-7 days)',
              'Do not pull on or accidentally remove drains'
            ]
          },
          {
            title: 'Care of Splints and Dressings',
            points: [
              'Splints protect wounds and prevent movement',
              'Do not remove or adjust splints unless instructed',
              'Report any pain, numbness, or color changes in splinted limbs',
              'Keep dressings clean and dry',
              'Do not get dressings wet unless waterproof',
              'Follow specific dressing change schedules',
              'Inform staff if dressings become soiled or loose'
            ]
          },
          {
            title: 'Nutrition During Recovery',
            points: [
              'Good nutrition is essential for healing',
              'Eat a high-protein diet (eggs, meat, fish, beans, dairy)',
              'Include vitamin C foods (citrus, berries, peppers)',
              'Stay well-hydrated (8-10 glasses of water daily)',
              'Small, frequent meals may be easier than large ones',
              'Nutritional supplements may be prescribed',
              'Inform staff if you have difficulty eating'
            ]
          },
          {
            title: 'Prevention of Pressure Sores',
            points: [
              'Change position every 2 hours when in bed',
              'Use pressure-relieving mattress if provided',
              'Keep skin clean and dry',
              'Report any red, sore, or broken areas of skin',
              'Sit in chair as soon as permitted',
              'Inspect skin daily, especially over bony areas',
              'Adequate nutrition helps prevent pressure sores'
            ]
          },
          {
            title: 'Importance of Physiotherapy and Occupational Therapy',
            points: [
              'Physiotherapy prevents stiffness and maintains strength',
              'Exercises prevent contractures (permanent tightening)',
              'Occupational therapy helps with daily activities',
              'Follow exercise programs even when uncomfortable',
              'Practice exercises between therapy sessions',
              'Report any difficulties with prescribed exercises',
              'Therapy is essential for optimal functional recovery'
            ]
          }
        ],
        keyPoints: [
          'Follow mobility instructions carefully',
          'Care for drains, splints, and dressings as instructed',
          'Eat a nutritious diet high in protein',
          'Prevent pressure sores by changing position regularly',
          'Participate actively in physiotherapy',
          'Ask questions if you don\'t understand your care'
        ],
        references: [
          'WHO Surgical Care at Hospital Level',
          'Nursing Standards for Post-Operative Care',
          'Prevention of Hospital-Acquired Pressure Injuries'
        ]
      }
    },
    {
      id: 'scar-care-skin-management',
      title: 'Scar Care and Long-Term Skin Management',
      icon: <Heart className="w-6 h-6" />,
      category: 'Scar Care',
      content: {
        introduction: 'Proper scar care can significantly improve the final appearance and comfort of your scars. This guide explains how scars mature and how to care for them.',
        sections: [
          {
            title: 'Normal Scar Maturation Process',
            points: [
              'Scars are red, raised, and firm for the first 3-6 months (immature phase)',
              'Active scar maturation occurs between 6-18 months',
              'Mature scars are paler, flatter, softer, and more flexible',
              'Complete maturation may take 2 years or longer',
              'Scars over joints may take longer to mature',
              'During maturation, scars respond well to treatment'
            ]
          },
          {
            title: 'Scar Massage Techniques',
            points: [
              'Begin massage only when wounds are fully healed (no scabs or open areas)',
              'Apply moisturizer or prescribed cream to reduce friction',
              'Use firm, circular pressure for 5-10 minutes, 2-3 times daily',
              'Massage in all directions - up/down, side to side, circular',
              'Include stretching of scar if over a joint',
              'Massage should be uncomfortable but not painful',
              'Continue for at least 6-12 months'
            ]
          },
          {
            title: 'Silicone Products',
            points: [
              'Silicone gel or sheets are the gold standard for scar treatment',
              'Apply silicone gel twice daily after washing and drying scar',
              'Silicone sheets should be worn 12-24 hours daily',
              'Wash and reuse silicone sheets according to instructions',
              'Continue use for at least 3-6 months',
              'Silicone helps flatten, soften, and fade scars',
              'Available as sheets, gels, sprays, or creams'
            ]
          },
          {
            title: 'Pressure Garments',
            points: [
              'Prescribed for large burns or extensive scars',
              'Should fit snugly but not cut off circulation',
              'Wear 23 hours per day for best results',
              'Remove only for bathing and skin care',
              'Replace when garments lose elasticity',
              'May be needed for 12-18 months or longer',
              'Custom-fitted garments work best'
            ]
          },
          {
            title: 'Sun Protection for Healing Skin',
            points: [
              'New scars are very sensitive to sun damage',
              'Sun exposure can cause permanent darkening of scars',
              'Use SPF 30+ sunscreen on all healed scars',
              'Reapply sunscreen every 2 hours when outdoors',
              'Wear protective clothing and hats',
              'Avoid direct sun exposure for at least 1 year',
              'Even cloudy days require sun protection'
            ]
          },
          {
            title: 'Management of Problematic Scars',
            points: [
              'Hypertrophic scars: Raised, red, stay within original wound boundaries',
              'Keloid scars: Grow beyond original wound, more common in darker skin',
              'Treatment options include steroid injections, laser therapy, surgery',
              'Pressure therapy and silicone help prevent and treat abnormal scars',
              'Report worsening or symptomatic scars to your doctor',
              'Some scars may require multiple treatment approaches'
            ]
          },
          {
            title: 'When to Seek Medical Review',
            points: [
              'Scars that continue to grow after initial healing',
              'Increasingly painful, itchy, or uncomfortable scars',
              'Scars that restrict movement or function',
              'Signs of wound breakdown or infection',
              'Scars that are cosmetically distressing',
              'Any concerns about scar progression'
            ]
          }
        ],
        keyPoints: [
          'Scars mature over 12-18 months - be patient',
          'Massage scars daily once fully healed',
          'Use silicone products consistently',
          'Wear pressure garments as prescribed',
          'Protect scars from sun for at least 1 year',
          'Report problematic or worsening scars'
        ],
        references: [
          'International Scar Management Guidelines',
          'WHO Burn Rehabilitation Standards',
          'Evidence-Based Scar Treatment Protocols'
        ]
      }
    },
    {
      id: 'rehabilitation-functional-recovery',
      title: 'Rehabilitation and Functional Recovery',
      icon: <Activity className="w-6 h-6" />,
      category: 'Rehabilitation',
      content: {
        introduction: 'Rehabilitation is essential for regaining function and independence after injury or surgery. Active participation in your rehabilitation program leads to the best outcomes.',
        sections: [
          {
            title: 'Importance of Early and Continued Physiotherapy',
            points: [
              'Physiotherapy should begin as soon as medically safe',
              'Early movement prevents muscle wasting and stiffness',
              'Regular exercise maintains joint range of motion',
              'Therapy continues throughout healing and scar maturation',
              'Active participation is essential for best results',
              'Missing therapy sessions can set back your progress'
            ]
          },
          {
            title: 'Prevention and Treatment of Contractures',
            points: [
              'Contractures are permanent tightening of skin, muscles, or joints',
              'Burns and wounds over joints are at highest risk',
              'Stretching exercises prevent contracture formation',
              'Splints hold joints in proper position',
              'Wear splints as prescribed (often at night)',
              'Established contractures may require surgery to release',
              'Prevention is much easier than treatment'
            ]
          },
          {
            title: 'Hand Therapy and Limb Rehabilitation',
            points: [
              'Hand injuries require specialized therapy',
              'Fine motor skills need specific exercises',
              'Sensory retraining helps with nerve recovery',
              'Custom splints may be made for your hand',
              'Daily exercises are essential',
              'Practice functional tasks (buttons, writing, gripping)',
              'Report any numbness, weakness, or stiffness'
            ]
          },
          {
            title: 'Exercises to Improve Strength and Mobility',
            points: [
              'Range of motion exercises: Move joints through full arc',
              'Strengthening exercises: Use resistance bands or weights',
              'Stretching exercises: Gentle sustained stretches',
              'Endurance exercises: Walking, stationary cycling',
              'Exercise frequency: Usually 2-3 times daily',
              'Increase intensity gradually',
              'Some discomfort is normal, severe pain is not'
            ]
          },
          {
            title: 'Adapting Daily Activities During Recovery',
            points: [
              'Use adaptive equipment if recommended (long-handled tools, button hooks)',
              'Modify tasks to reduce strain on healing areas',
              'Pace yourself - take rest breaks',
              'Accept help with difficult tasks initially',
              'Gradually resume normal activities as healing allows',
              'Occupational therapist can suggest modifications',
              'Safety first - avoid activities that could cause re-injury'
            ]
          },
          {
            title: 'Returning to Work and Normal Life',
            points: [
              'Discuss return to work timeline with your doctor',
              'Some jobs may require modified duties initially',
              'Driving restrictions depend on your injury and surgery',
              'Sports and exercise: Follow specific guidance',
              'Set realistic goals and celebrate progress',
              'Recovery is a marathon, not a sprint'
            ]
          }
        ],
        keyPoints: [
          'Start physiotherapy early and continue consistently',
          'Prevent contractures with stretching and splinting',
          'Do prescribed exercises regularly between therapy',
          'Adapt activities to protect healing areas',
          'Be patient - functional recovery takes time',
          'Report any concerns to your therapy team'
        ],
        references: [
          'WHO Rehabilitation Guidelines',
          'Burn Rehabilitation Standards',
          'Evidence-Based Physical Therapy Protocols'
        ]
      }
    },
    {
      id: 'nutrition-healing',
      title: 'Nutrition and Healing',
      icon: <Heart className="w-6 h-6" />,
      category: 'Nutrition',
      content: {
        introduction: 'Good nutrition is essential for wound healing and recovery. Your body needs extra nutrients to repair damaged tissue. This guide explains how to eat for optimal healing.',
        sections: [
          {
            title: 'Role of Nutrition in Wound and Burn Healing',
            points: [
              'Healing requires significantly more energy (calories) than normal',
              'Protein is essential for building new tissue',
              'Vitamins and minerals support every stage of healing',
              'Inadequate nutrition delays healing and increases infection risk',
              'Burns and large wounds may triple calorie needs',
              'Your nutritional needs will be assessed by the care team'
            ]
          },
          {
            title: 'Protein Requirements',
            points: [
              'Protein needs increase dramatically during healing',
              'Aim for protein with every meal and snack',
              'Good sources: Eggs, meat, fish, poultry, beans, lentils, dairy',
              'High-protein drinks or supplements may be prescribed',
              'Spread protein intake throughout the day',
              'Target may be 1.5-2 times normal protein intake'
            ]
          },
          {
            title: 'Important Vitamins and Minerals',
            points: [
              'Vitamin C: Essential for collagen formation (citrus, berries, peppers)',
              'Vitamin A: Supports skin healing (carrots, sweet potatoes, eggs)',
              'Zinc: Critical for wound healing (meat, shellfish, seeds)',
              'Iron: Prevents anemia and supports oxygen delivery (meat, beans, greens)',
              'B vitamins: Support energy and healing (whole grains, meat, eggs)',
              'Supplements may be prescribed based on your needs'
            ]
          },
          {
            title: 'Foods That Support Healing',
            points: [
              'Lean meats: Chicken, fish, beef, pork',
              'Eggs: Complete protein, easy to eat',
              'Dairy: Milk, cheese, yogurt',
              'Legumes: Beans, lentils, chickpeas',
              'Nuts and seeds: Almonds, sunflower seeds',
              'Fruits: Citrus, berries, papaya',
              'Vegetables: Leafy greens, carrots, peppers',
              'Whole grains: Brown rice, oats, whole wheat'
            ]
          },
          {
            title: 'Staying Well-Hydrated',
            points: [
              'Drink at least 8-10 glasses of water daily',
              'More fluids needed if you have fever or large wounds',
              'Signs of dehydration: Dark urine, dry mouth, dizziness',
              'Water is best, but milk, juice, and soup also count',
              'Limit caffeine and alcohol - they can dehydrate',
              'Set reminders to drink if you forget'
            ]
          },
          {
            title: 'Avoiding Harmful Substances',
            points: [
              'Stop smoking: Smoking severely impairs healing',
              'Nicotine reduces blood flow to healing tissue',
              'Even secondhand smoke can slow healing',
              'Limit alcohol: Alcohol impairs immune function',
              'Avoid sugary drinks and processed foods',
              'Ask for help to quit smoking if needed'
            ]
          },
          {
            title: 'Managing Appetite Changes',
            points: [
              'Loss of appetite is common during illness and recovery',
              'Eat small, frequent meals instead of large ones',
              'Choose nutrient-dense foods when appetite is low',
              'Use protein supplements if unable to eat enough',
              'Eat when you feel best (often morning)',
              'Make meals enjoyable - good presentation helps',
              'Report significant weight loss to your care team'
            ]
          }
        ],
        keyPoints: [
          'Good nutrition is essential for healing',
          'Eat high-protein foods at every meal',
          'Include fruits and vegetables daily',
          'Stay well-hydrated with adequate fluids',
          'Stop smoking - it severely impairs healing',
          'Report appetite problems to your care team'
        ],
        references: [
          'WHO Nutrition Guidelines for Surgical Patients',
          'Clinical Nutrition in Burns',
          'Evidence-Based Nutrition for Wound Healing'
        ]
      }
    },
    {
      id: 'psychological-wellbeing',
      title: 'Psychological and Emotional Well-Being',
      icon: <User className="w-6 h-6" />,
      category: 'Mental Health',
      content: {
        introduction: 'Coping with injury, burns, or changes to your appearance is challenging. Emotional responses are normal and support is available. This guide addresses the psychological aspects of recovery.',
        sections: [
          {
            title: 'Common Emotional Responses',
            points: [
              'Shock and disbelief immediately after injury',
              'Grief for lost function or changed appearance',
              'Anger about the injury or circumstances',
              'Fear about the future and recovery',
              'Frustration with slow healing or limitations',
              'Sadness or depression during prolonged treatment',
              'All of these feelings are normal and valid'
            ]
          },
          {
            title: 'Coping with Body Image Changes',
            points: [
              'Changes to appearance after burns or surgery are significant',
              'Allow yourself time to adjust to your new appearance',
              'Avoid comparing yourself to before the injury',
              'Focus on what your body can do, not just how it looks',
              'Gradual exposure to mirrors and photos may help',
              'Connect with others who have similar experiences',
              'Professional support can help with adjustment'
            ]
          },
          {
            title: 'Managing Anxiety and Fear',
            points: [
              'Anxiety about procedures, pain, or the future is normal',
              'Deep breathing exercises can reduce anxiety',
              'Ask questions - understanding reduces fear',
              'Request medication before painful procedures if needed',
              'Relaxation techniques: Meditation, visualization, music',
              'Talk to staff about your fears - they can help',
              'Professional counseling is available if needed'
            ]
          },
          {
            title: 'Recognizing Depression',
            points: [
              'Persistent sadness lasting more than 2 weeks',
              'Loss of interest in activities you used to enjoy',
              'Changes in sleep - too much or too little',
              'Changes in appetite and weight',
              'Difficulty concentrating or making decisions',
              'Feelings of worthlessness or excessive guilt',
              'Thoughts of death or suicide - seek help immediately',
              'Depression is treatable - tell your care team'
            ]
          },
          {
            title: 'Family and Caregiver Support',
            points: [
              'Family members also experience emotional stress',
              'Include family in education about your care',
              'Accept help from family and friends',
              'Communicate openly about your needs',
              'Family counseling may be helpful',
              'Caregivers need breaks and support too',
              'Support groups exist for families as well'
            ]
          },
          {
            title: 'Available Support Services',
            points: [
              'Psychologist or counselor: Individual therapy',
              'Psychiatrist: Medication management if needed',
              'Social worker: Practical support and resources',
              'Peer support: Connect with other patients',
              'Support groups: Share experiences with others',
              'Chaplain services: Spiritual support if desired',
              'Ask your care team for referrals'
            ]
          }
        ],
        keyPoints: [
          'Emotional responses to injury are normal',
          'Body image adjustment takes time',
          'Anxiety and depression are common and treatable',
          'Ask for help when struggling emotionally',
          'Family members also need support',
          'Professional counseling services are available'
        ],
        references: [
          'WHO Mental Health in Burns Care',
          'Psychological Care of Burn Patients - Guidelines',
          'Trauma-Informed Care Standards'
        ]
      }
    },
    {
      id: 'infection-prevention-safety',
      title: 'Infection Prevention and Safety',
      icon: <AlertCircle className="w-6 h-6" />,
      category: 'Infection Prevention',
      content: {
        introduction: 'Preventing infection is crucial during wound healing. Infections can delay healing, require additional treatment, and cause serious complications. This guide explains how to prevent and recognize infection.',
        sections: [
          {
            title: 'Hand Hygiene for Patients and Caregivers',
            points: [
              'Hand washing is the most important infection prevention measure',
              'Wash hands with soap and water for at least 20 seconds',
              'Use alcohol hand sanitizer when soap is not available',
              'Wash hands BEFORE and AFTER touching wounds',
              'Wash after using the toilet, eating, or coughing/sneezing',
              'Keep fingernails short and clean',
              'Teach family members proper hand hygiene'
            ]
          },
          {
            title: 'Safe Handling of Dressings and Wound Materials',
            points: [
              'Use clean or sterile supplies as instructed',
              'Do not touch the wound side of dressings',
              'Dispose of used dressings in sealed bags',
              'Clean any surfaces used for dressing changes',
              'Do not reuse single-use dressing materials',
              'Store unused dressings in clean, dry place',
              'Report if supplies appear contaminated'
            ]
          },
          {
            title: 'Avoiding Harmful Traditional Treatments',
            points: [
              'Do NOT apply honey, palm oil, or cooking oil to wounds',
              'Do NOT apply cow dung, soil, or plant materials',
              'Do NOT use toothpaste, egg whites, or traditional herbs on wounds',
              'These substances can cause severe infection',
              'Use only medications prescribed by your doctor',
              'Ask your care team before trying any traditional remedies',
              'Inform staff if you have used any substances on wounds'
            ]
          },
          {
            title: 'Recognizing Early Signs of Infection',
            points: [
              'Increasing pain, especially if it was improving',
              'Increased redness or warmth around wound',
              'Swelling that is worsening',
              'Yellow, green, or foul-smelling drainage',
              'Fever above 38�C (100.4�F)',
              'Red streaks spreading from wound',
              'Feeling generally unwell or weak'
            ]
          },
          {
            title: 'Recognizing Signs of Sepsis - Medical Emergency',
            points: [
              'Sepsis is life-threatening infection spread through blood',
              'High fever or abnormally low temperature',
              'Rapid breathing or difficulty breathing',
              'Fast heartbeat',
              'Confusion or disorientation',
              'Cold, clammy, or mottled skin',
              'Decreased urination',
              'SEEK IMMEDIATE MEDICAL CARE if these occur'
            ]
          },
          {
            title: 'Importance of Vaccinations',
            points: [
              'Tetanus vaccination is important for wound care',
              'Tell staff your tetanus vaccination status',
              'Tetanus booster may be given if overdue',
              'Other vaccinations may be recommended based on your condition',
              'Burn patients may need additional immunizations',
              'Keep vaccination records updated'
            ]
          }
        ],
        keyPoints: [
          'Hand washing is the most important prevention measure',
          'Handle dressings and wound materials safely',
          'Never apply traditional or unprescribed substances to wounds',
          'Know the signs of infection and sepsis',
          'Report any signs of infection immediately',
          'Keep tetanus vaccination up to date'
        ],
        references: [
          'WHO Guidelines on Hand Hygiene in Healthcare',
          'Infection Prevention in Wound Care',
          'WHO Burn Care Standards'
        ]
      }
    },
    {
      id: 'home-care-discharge',
      title: 'Home Care and Discharge Planning',
      icon: <Info className="w-6 h-6" />,
      category: 'Discharge Planning',
      content: {
        introduction: 'Preparing for discharge from hospital is an important step in your recovery. Proper planning ensures you can continue healing safely at home.',
        sections: [
          {
            title: 'Preparing Your Home Environment',
            points: [
              'Ensure clean, safe environment for wound care',
              'Remove tripping hazards (rugs, cords)',
              'Arrange furniture for easy movement',
              'Ensure adequate lighting, especially in bathroom',
              'Stock supplies: Dressings, medications, healthy foods',
              'Set up a comfortable rest area',
              'Consider temporary modifications (handrails, shower seat)'
            ]
          },
          {
            title: 'Caregiver Education and Involvement',
            points: [
              'Identify a primary caregiver before discharge',
              'Caregivers should attend wound care teaching sessions',
              'Practice dressing changes before going home',
              'Caregivers should know signs of complications',
              'Plan for caregiver breaks and support',
              'Ensure caregiver has contact numbers for questions',
              'Written instructions will be provided'
            ]
          },
          {
            title: 'Medication Adherence',
            points: [
              'Understand all medications: Name, dose, frequency, purpose',
              'Take medications exactly as prescribed',
              'Complete full course of antibiotics if prescribed',
              'Know side effects to watch for',
              'Use pill organizers or alarms if helpful',
              'Refill prescriptions before running out',
              'Never stop medications without consulting doctor'
            ]
          },
          {
            title: 'Follow-Up Appointment Schedule',
            points: [
              'Know dates and times of all follow-up appointments',
              'Understand purpose of each appointment',
              'Plan transportation to appointments',
              'Bring list of questions to appointments',
              'Bring current medication list',
              'Keep appointments even if feeling well',
              'Call to reschedule if unable to attend'
            ]
          },
          {
            title: 'Daily Care Routine at Home',
            points: [
              'Follow wound care schedule as taught',
              'Take medications at prescribed times',
              'Do exercises and physiotherapy as instructed',
              'Wear splints and pressure garments as prescribed',
              'Rest adequately but move regularly',
              'Eat nutritious meals and stay hydrated',
              'Monitor for signs of complications daily'
            ]
          },
          {
            title: 'Emergency Warning Signs - Return to Hospital If:',
            points: [
              'Fever above 38�C (100.4�F) that does not resolve',
              'Increasing pain not controlled by medication',
              'Signs of wound infection (redness, swelling, discharge)',
              'Graft or flap appears dark, blue, or black',
              'Sudden heavy bleeding from wound',
              'Difficulty breathing or chest pain',
              'Confusion or altered mental state',
              'Inability to eat or drink for 24 hours'
            ]
          },
          {
            title: 'Contact Information',
            points: [
              'You will receive contact numbers for your care team',
              'Know when and who to call for different problems',
              'Save emergency numbers in your phone',
              'Call before coming to hospital for non-emergencies',
              'Use emergency services (ambulance) for life-threatening situations',
              'Keep hospital discharge papers accessible'
            ]
          }
        ],
        keyPoints: [
          'Prepare your home before discharge',
          'Caregivers should be trained in wound care',
          'Take all medications exactly as prescribed',
          'Keep all follow-up appointments',
          'Know the emergency warning signs',
          'Have contact numbers readily available'
        ],
        references: [
          'WHO Discharge Planning Standards',
          'Hospital to Home Transition Guidelines',
          'Patient Safety in Discharge Planning'
        ]
      }
    },
    {
      id: 'special-patient-groups',
      title: 'Special Patient Groups Education',
      icon: <User className="w-6 h-6" />,
      category: 'Special Populations',
      content: {
        introduction: 'Certain patient groups have unique needs that require special attention during wound and burn care. This guide provides information for children, elderly patients, and those with specific conditions.',
        sections: [
          {
            title: 'Burn Care in Children',
            points: [
              'Children have thinner skin and burns may be deeper',
              'Fluid requirements are calculated differently for children',
              'Pain management must be carefully adjusted for weight',
              'Children may not be able to describe symptoms',
              'Play therapy helps children cope with treatment',
              'Parents should be involved in care and education',
              'Growth and development must be monitored during recovery',
              'Scars in children need long-term follow-up as they grow'
            ]
          },
          {
            title: 'Elderly Patients and Delayed Healing',
            points: [
              'Skin becomes thinner and more fragile with age',
              'Healing is slower in elderly patients',
              'Nutritional needs may be higher',
              'Multiple medications may affect healing',
              'Fall prevention is especially important',
              'Pressure sore prevention requires extra attention',
              'Monitor for confusion or delirium during hospital stay',
              'Family involvement in care planning is essential'
            ]
          },
          {
            title: 'Diabetic Patients and Wound Care',
            points: [
              'Diabetes significantly delays wound healing',
              'Blood sugar control is essential for healing',
              'Monitor blood glucose more frequently during recovery',
              'Feet require special attention and daily inspection',
              'Proper footwear is essential at all times',
              'Small injuries can become serious quickly',
              'Follow diabetic diet recommendations',
              'Report any foot problems immediately'
            ]
          },
          {
            title: 'Patients with Chronic Wounds',
            points: [
              'Chronic wounds last more than 3 months without healing',
              'Underlying cause must be identified and treated',
              'Compression therapy is essential for venous ulcers',
              'Pressure relief is essential for pressure sores',
              'Nutrition optimization is critical',
              'Patience is needed - healing may take months',
              'Regular follow-up monitors progress',
              'Advanced wound therapies may be needed'
            ]
          },
          {
            title: 'Patients with Pressure Sores',
            points: [
              'Pressure sores result from prolonged pressure on skin',
              'Prevention is better than treatment',
              'Turn and reposition every 2 hours',
              'Use pressure-relieving mattresses and cushions',
              'Keep skin clean and dry',
              'Ensure adequate nutrition',
              'Inspect skin daily, especially over bony areas',
              'Report new red or broken areas immediately'
            ]
          },
          {
            title: 'Patients Requiring Long-Term Reconstructive Follow-Up',
            points: [
              'Multiple surgeries may be needed over years',
              'Scar management continues for 12-18 months minimum',
              'Growth in children may require revision surgeries',
              'Functional improvement often requires staged procedures',
              'Keep all long-term follow-up appointments',
              'Document changes with photographs',
              'Discuss concerns about appearance or function',
              'Psychological support should continue as needed'
            ]
          }
        ],
        keyPoints: [
          'Children, elderly, and diabetic patients have special needs',
          'Blood sugar control is essential for diabetic wound healing',
          'Chronic wounds require patience and consistent care',
          'Pressure sore prevention is critical for all patients',
          'Long-term follow-up is essential for complete recovery',
          'Ask about specific care needs for your situation'
        ],
        references: [
          'WHO Guidelines for Special Patient Populations',
          'Pediatric Burn Care Standards',
          'Wound Care in Elderly and Diabetic Patients'
        ]
      }
    },
    {
      id: 'patient-rights-consent',
      title: 'Patient Rights, Responsibilities, and Consent',
      icon: <BookOpen className="w-6 h-6" />,
      category: 'Patient Rights',
      content: {
        introduction: 'Understanding your rights and responsibilities as a patient helps you participate actively in your care. This guide explains informed consent and your role in the healthcare process.',
        sections: [
          {
            title: 'Understanding Informed Consent',
            points: [
              'Informed consent means you agree to treatment after understanding it',
              'You have the right to know: The diagnosis, proposed treatment, risks, benefits, and alternatives',
              'Consent must be given freely without pressure',
              'You can ask questions until you understand',
              'You have the right to refuse treatment',
              'Consent can be withdrawn at any time',
              'For emergencies, treatment may proceed without written consent',
              'Parents/guardians consent for children'
            ]
          },
          {
            title: 'Your Rights as a Patient',
            points: [
              'Right to be treated with dignity and respect',
              'Right to privacy and confidentiality of medical information',
              'Right to receive information in language you understand',
              'Right to ask questions and receive answers',
              'Right to refuse treatment or request a second opinion',
              'Right to know who is providing your care',
              'Right to access your medical records',
              'Right to complain if unsatisfied with care'
            ]
          },
          {
            title: 'Confidentiality of Your Medical Information',
            points: [
              'Your medical information is private and protected',
              'Information is shared only with those providing your care',
              'You can choose who else receives your information',
              'Medical students must ask your permission before participating',
              'Photography requires your written consent',
              'Information may be used anonymously for teaching/research',
              'Report any concerns about privacy to staff'
            ]
          },
          {
            title: 'Your Responsibilities as a Patient',
            points: [
              'Provide accurate and complete health information',
              'Ask questions if you do not understand instructions',
              'Follow the agreed treatment plan',
              'Keep scheduled appointments or cancel in advance',
              'Inform staff of changes in your condition',
              'Treat healthcare staff with respect',
              'Follow hospital rules and policies',
              'Be considerate of other patients'
            ]
          },
          {
            title: 'Asking Questions and Understanding Your Care',
            points: [
              'Never hesitate to ask questions - there are no silly questions',
              'Write down questions before appointments',
              'Ask for explanations in simple language',
              'Repeat back what you understood to confirm',
              'Ask about written materials or resources',
              'Bring a family member to help remember information',
              'Ask for an interpreter if needed'
            ]
          },
          {
            title: 'Hospital Rules and Safety',
            points: [
              'Follow visiting hours and policies',
              'No smoking anywhere in hospital premises',
              'Inform staff before eating or drinking (especially before procedures)',
              'Use call bell for assistance - do not get up unsafely',
              'Keep personal belongings secure',
              'Follow infection control rules',
              'Report safety concerns to staff'
            ]
          }
        ],
        keyPoints: [
          'Informed consent means understanding before agreeing',
          'You have the right to information, privacy, and respect',
          'Your medical information is confidential',
          'You have responsibilities as well as rights',
          'Ask questions until you understand your care',
          'Follow hospital rules for everyone\'s safety'
        ],
        references: [
          'WHO Patient Rights Charter',
          'Medical Ethics and Informed Consent',
          'Healthcare Rights and Responsibilities'
        ]
      }
    }
  ];

  const filteredTopics = educationTopics.filter(topic =>
    (topic.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (topic.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(educationTopics.map(t => t.category)));

  const handleDownloadClick = (topic: EducationTopic, action: 'download' | 'whatsapp' | 'thermal' = 'download') => {
    setShareAction(action);
    setPendingTopicForPDF(topic);
    setShowPatientSelector(true);
  };

  const generatePDF = async (topic: EducationTopic, patient: Patient) => {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = PDF_MARGINS.left + 5;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;
    
    // Helper to sanitize text
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    // Header
    doc.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(PDF_FONT_SIZES.title);
    doc.setFont('times', 'bold');
    doc.text('Patient Education Material', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'normal');
    doc.text('Burns Plastic and Reconstructive Surgery Unit', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.small);
    doc.text('Drs Okwesili / Nnadi / Eze', pageWidth / 2, 26, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.footer);
    doc.text('Department of Surgery, University of Nigeria Teaching Hospital', pageWidth / 2, 32, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Enugu, Nigeria', pageWidth / 2, 37, { align: 'center' });

    yPos = 50;
    doc.setTextColor(0, 0, 0);

    // Patient Information Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(margin, yPos, maxWidth, 31, 'FD');
    
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'bold');
    doc.text('Patient Information:', margin + 3, yPos + 5);
    
    doc.setFont('times', 'normal');
    
    // Handle different name formats
    const patientName = patient.full_name || 
      `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim() ||
      'N/A';
    
    doc.text('Name: ' + clean(patientName), margin + 3, yPos + 11);
    doc.text('Hospital Number: ' + clean(patient.hospital_number), margin + 3, yPos + 17);
    
    // Calculate and display age from date of birth
    const patientAge = calculateAge(patient.date_of_birth || patient.dob);
    const ageText = patientAge !== null ? `${patientAge} years` : 'N/A';
    doc.text('Age: ' + ageText, margin + 3, yPos + 23);
    
    doc.text('Date: ' + new Date().toLocaleDateString(), margin + 3, yPos + 29);
    
    yPos += 41;

    // Title
    doc.setFontSize(PDF_FONT_SIZES.title);
    doc.setFont('times', 'bold');
    doc.text(clean(topic.title), margin, yPos);
    yPos += 10;

    // Category
    doc.setFontSize(10);
    doc.setFont('times', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(clean(`Category: ${topic.category}`), margin, yPos);
    yPos += 15;

    doc.setTextColor(0, 0, 0);

    // Introduction
    doc.setFontSize(11);
    doc.setFont('times', 'normal');
    const introLines = doc.splitTextToSize(clean(topic.content.introduction), maxWidth);
    introLines.forEach((line: string) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += 5;

    // Sections
    topic.content.sections.forEach((section) => {
      if (yPos > pageHeight - margin - 20) {
        doc.addPage();
        yPos = margin;
      }

      // Section title
      doc.setFontSize(12);
      doc.setFont('times', 'bold');
      doc.setTextColor(14, 159, 110);
      doc.text(clean(section.title), margin, yPos);
      yPos += 8;
      doc.setTextColor(0, 0, 0);

      // Section points
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      section.points.forEach((point) => {
        const bulletPoint = clean(`- ${point}`);
        const lines = doc.splitTextToSize(bulletPoint, maxWidth - 5);
        lines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin + 5, yPos);
          yPos += 5;
        });
        yPos += 1;
      });
      yPos += 5;
    });

    // Key Points Box
    if (yPos > pageHeight - margin - 40) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(14, 159, 110);
    const boxHeight = 8 + (topic.content.keyPoints.length * 6);
    doc.rect(margin, yPos, maxWidth, boxHeight, 'FD');
    yPos += 6;

    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.setTextColor(14, 159, 110);
    doc.text('Key Points to Remember:', margin + 3, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);
    topic.content.keyPoints.forEach((point) => {
      doc.text(clean(`${point}`), margin + 5, yPos);
      yPos += 5;
    });
    yPos += 10;

    // References
    if (yPos > pageHeight - margin - 30) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text('References:', margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setFont('times', 'italic');
    doc.setTextColor(100, 100, 100);
    topic.content.references.forEach((ref) => {
      const lines = doc.splitTextToSize(clean(ref), maxWidth);
      lines.forEach((line: string) => {
        doc.text(line, margin + 3, yPos);
        yPos += 4;
      });
    });

    // Add professional footer with page numbers and timestamp
    addFooter(doc);

    // Save with patient name in filename (reuse patientName from earlier)
    const sanitizedPatientName = patientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const sanitizedTopicName = (topic.title || 'Education_Material').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `${sanitizedPatientName}_${sanitizedTopicName}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Handle download or WhatsApp share
    if (shareAction === 'whatsapp') {
      setIsSharing(true);
      try {
        const patientDisplayName = patient.full_name || 
          `${patient.first_name || ''} ${patient.last_name || ''}`.trim() ||
          'Patient';
        const message = `Patient Education: ${topic.title || 'Education Material'} for ${patientDisplayName} (${patient.hospital_number || ''})`;
        await sharePDFViaWhatsApp(doc, filename, message);
      } catch (error) {
        console.error('Failed to share via WhatsApp:', error);
        // Fall back to download
        doc.save(filename);
      } finally {
        setIsSharing(false);
      }
    } else {
      doc.save(filename);
    }
    
    // Close patient selector
    setShowPatientSelector(false);
    setPendingTopicForPDF(null);
    setPatientSearchTerm('');
    setShareAction('download');
  };

  // Generate Thermal 80mm PDF for patient education
  const generateThermalPDF = async (topic: EducationTopic, patient: Patient) => {
    const { jsPDF } = await import('jspdf');
    const thermalWidth = 80;
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    // Estimate height
    let estHeight = 120;
    estHeight += (topic.content.introduction?.length || 0) * 0.15;
    topic.content.sections.forEach(s => {
      estHeight += 10 + s.points.length * 6;
    });
    estHeight += topic.content.keyPoints.length * 5;
    estHeight = Math.max(estHeight, 200);

    const doc = sanitizePdfDocument(new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] }));
    const margin = 3;
    let yPos = margin;

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('PATIENT EDUCATION', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont('times', 'normal');
    doc.text('UNTH Plastic Surgery Unit', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 4;

    doc.setLineWidth(0.3);
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Patient info
    doc.setFontSize(9);
    const patientName = patient.full_name ||
      `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim() || 'N/A';
    doc.text(`Patient: ${clean(patientName)}`, margin, yPos);
    yPos += 3.5;
    doc.text(`Hosp #: ${clean(patient.hospital_number)}`, margin, yPos);
    yPos += 3.5;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += 4;

    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Title
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    const titleLines = doc.splitTextToSize(clean(topic.title), thermalWidth - margin * 2);
    titleLines.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 4.5;
    });
    yPos += 3;

    // Introduction
    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    const introLines = doc.splitTextToSize(clean(topic.content.introduction), thermalWidth - margin * 2);
    introLines.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 3.5;
    });
    yPos += 3;

    // Sections
    topic.content.sections.forEach((section) => {
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text(clean(section.title), margin, yPos);
      yPos += 4;

      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      section.points.forEach((point) => {
        const lines = doc.splitTextToSize(`- ${clean(point)}`, thermalWidth - margin * 2 - 2);
        lines.forEach((line: string) => {
          doc.text(line, margin + 1, yPos);
          yPos += 3.5;
        });
      });
      yPos += 2;
    });

    // Key Points
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 3;
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text('KEY POINTS', margin, yPos);
    yPos += 4;
    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    topic.content.keyPoints.forEach((point) => {
      const lines = doc.splitTextToSize(`- ${clean(point)}`, thermalWidth - margin * 2);
      lines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 3.5;
      });
    });

    const sanitizedPatientName = patientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const sanitizedTopicName = (topic.title || 'Education').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    doc.save(`${sanitizedPatientName}_${sanitizedTopicName}_Thermal_${new Date().toISOString().split('T')[0]}.pdf`);

    setShowPatientSelector(false);
    setPendingTopicForPDF(null);
    setPatientSearchTerm('');
  };

  const selectedTopicData = selectedTopic
    ? educationTopics.find(t => t.id === selectedTopic)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Patient Education Center</h1>
        <p className="text-gray-600">
          Evidence-based educational materials and instructions based on WHO guidelines
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search education topics..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((category) => (
          <button
            key={category}
            className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            {category}
          </button>
        ))}
      </div>

      {/* Topic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredTopics.map((topic) => (
          <div
            key={topic.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedTopic(topic.id)}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-green-100 rounded-lg text-green-600">
                {topic.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{topic.title}</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {topic.category}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadClick(topic, 'download');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadClick(topic, 'thermal');
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                title="Thermal Print (80mm)"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadClick(topic, 'whatsapp');
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                title="Share via WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedTopicData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">
                    {selectedTopicData.title}
                  </h2>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                    {selectedTopicData.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-6">{selectedTopicData.content.introduction}</p>

              {selectedTopicData.content.sections.map((section, idx) => (
                <div key={idx} className="mb-6">
                  <h3 className="text-lg font-semibold text-green-600 mb-3">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.points.map((point, pidx) => (
                      <li key={pidx} className="flex gap-2 text-gray-700">
                        <span className="text-green-600 mt-1"></span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-green-800 mb-3">Key Points to Remember:</h3>
                <ul className="space-y-1">
                  {selectedTopicData.content.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex gap-2 text-green-700 text-sm">
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">References:</h4>
                <ul className="space-y-1">
                  {selectedTopicData.content.references.map((ref, idx) => (
                    <li key={idx} className="text-xs text-gray-600 italic">
                      {ref}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleDownloadClick(selectedTopicData, 'download')}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download as PDF
                </button>
                <button
                  onClick={() => handleDownloadClick(selectedTopicData, 'thermal')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  title="Thermal Print (80mm)"
                >
                  <Printer className="w-5 h-5" />
                  Thermal Print
                </button>
                <button
                  onClick={() => handleDownloadClick(selectedTopicData, 'whatsapp')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  title="Share via WhatsApp"
                >
                  <MessageCircle className="w-5 h-5" />
                  Share via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Selector Modal */}
      {showPatientSelector && pendingTopicForPDF && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-green-600 text-white p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold mb-1">Select Patient</h2>
                  <p className="text-green-100 text-sm">
                    Choose a patient to personalize the educational material
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPatientSelector(false);
                    setPendingTopicForPDF(null);
                    setPatientSearchTerm('');
                  }}
                  className="text-white hover:text-green-100"
                >
                  </button>
              </div>
              <div className="mt-4 text-sm text-green-100">
                <strong>Topic:</strong> {pendingTopicForPDF.title}
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or hospital number..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingPatients ? (
                <div className="text-center py-8 text-gray-500">
                  Loading patients...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {patientSearchTerm ? 'No patients found matching your search' : 'No patients available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => shareAction === 'thermal' ? generateThermalPDF(pendingTopicForPDF, patient) : generatePDF(pendingTopicForPDF, patient)}
                      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">
                            {patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Hospital #:</span> {patient.hospital_number}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>{patient.gender || patient.sex || 'N/A'}</span>
                            {patient.phone && <span>{patient.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                The selected patient's information will be included in the PDF document
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
