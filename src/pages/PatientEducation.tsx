import { useState, useEffect } from 'react';
import { Download, BookOpen, AlertCircle, Info, FileText, Heart, Activity, User, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import { patientService } from '../services/patientService';

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
  full_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
}

export default function PatientEducation() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [pendingTopicForPDF, setPendingTopicForPDF] = useState<EducationTopic | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);

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

  const filteredPatients = patients.filter(patient =>
    (patient.full_name || '').toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
    (patient.hospital_number || '').toLowerCase().includes(patientSearchTerm.toLowerCase())
  );

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
              'Fever above 38°C (100.4°F)'
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
              'Fever above 38°C (100.4°F)',
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
              'Fever above 38°C (100.4°F)',
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
    }
  ];

  const filteredTopics = educationTopics.filter(topic =>
    (topic.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (topic.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(educationTopics.map(t => t.category)));

  const handleDownloadClick = (topic: EducationTopic) => {
    setPendingTopicForPDF(topic);
    setShowPatientSelector(true);
  };

  const generatePDF = (topic: EducationTopic, patient: Patient) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Header
    doc.setFillColor(14, 159, 110); // Green color
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Education Material', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Burns Plastic and Reconstructive Surgery Unit', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.text('Drs Okwesili / Nnadi / Eze', pageWidth / 2, 26, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Department of Surgery, University of Nigeria Teaching Hospital', pageWidth / 2, 32, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Enugu, Nigeria', pageWidth / 2, 37, { align: 'center' });

    yPos = 50;
    doc.setTextColor(0, 0, 0);

    // Patient Information Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(14, 159, 110);
    doc.rect(margin, yPos, maxWidth, 25, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Information:', margin + 3, yPos + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${patient.full_name}`, margin + 3, yPos + 11);
    doc.text(`Hospital Number: ${patient.hospital_number}`, margin + 3, yPos + 17);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + 3, yPos + 23);
    
    yPos += 35;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(topic.title, margin, yPos);
    yPos += 10;

    // Category
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Category: ${topic.category}`, margin, yPos);
    yPos += 15;

    doc.setTextColor(0, 0, 0);

    // Introduction
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const introLines = doc.splitTextToSize(topic.content.introduction, maxWidth);
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
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(14, 159, 110);
      doc.text(section.title, margin, yPos);
      yPos += 8;
      doc.setTextColor(0, 0, 0);

      // Section points
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      section.points.forEach((point) => {
        const bulletPoint = `• ${point}`;
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
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(14, 159, 110);
    doc.text('Key Points to Remember:', margin + 3, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    topic.content.keyPoints.forEach((point) => {
      doc.text(`✓ ${point}`, margin + 5, yPos);
      yPos += 5;
    });
    yPos += 10;

    // References
    if (yPos > pageHeight - margin - 30) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('References:', margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    topic.content.references.forEach((ref) => {
      const lines = doc.splitTextToSize(ref, maxWidth);
      lines.forEach((line: string) => {
        doc.text(line, margin + 3, yPos);
        yPos += 4;
      });
    });

    // Footer
    const footerY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} | UNTH Plastic Surgery | Patient: ${patient.full_name}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    // Save with patient name in filename
    const sanitizedPatientName = patient.full_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const sanitizedTopicName = topic.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `${sanitizedPatientName}_${sanitizedTopicName}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    // Close patient selector
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Education Center</h1>
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadClick(topic);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
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
                  ✕
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
                        <span className="text-green-600 mt-1">•</span>
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
                      <span>✓</span>
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

              <button
                onClick={() => handleDownloadClick(selectedTopicData)}
                className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download as PDF
              </button>
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
                  ✕
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
                      onClick={() => generatePDF(pendingTopicForPDF, patient)}
                      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{patient.full_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Hospital #:</span> {patient.hospital_number}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>{patient.gender}</span>
                            {patient.phone && <span>📞 {patient.phone}</span>}
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
