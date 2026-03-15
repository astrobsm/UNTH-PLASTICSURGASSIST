// Medication Ordering Modal with Drug Database and Interaction Checking
import React, { useState } from 'react';
import { X, Plus, Pill, AlertTriangle, Search, Trash2, Info } from 'lucide-react';
import { format } from 'date-fns';
import {
  MEDICATIONS,
  MEDICATION_CATEGORIES,
  MEDICATION_FREQUENCIES,
  MEDICATION_ROUTES,
  searchMedications,
  getMedicationsByCategory,
  getMedicationById
} from '../data/medications';

interface Medication {
  id: string;
  medication_name: string;
  generic_name?: string;
  dosage: string;
  route: 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'rectal' | 'sublingual' | 'inhalation';
  frequency: string;
  duration: string;
  start_date: Date;
  indication: string;
  special_instructions?: string;
  status: 'active' | 'discontinued' | 'completed';
  prescriber: string;
}

interface MedicationOrderingModalProps {
  patientId: string;
  patientName: string;
  existingMedications?: Medication[];
  onSave: (medications: Medication[]) => void;
  onClose: () => void;
}

// Comprehensive drug database for plastic surgery and general medical practice
const DRUG_DATABASE = {
  analgesics: {
    name: 'Analgesics',
    drugs: [
      {
        name: 'Paracetamol',
        generic: 'Acetaminophen',
        common_doses: ['500mg', '1000mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['QID', 'TDS', 'PRN'],
        max_daily_dose: '4000mg',
        cautions: ['Liver disease', 'Chronic alcohol use'],
        interactions: ['Warfarin (increased bleeding risk)']
      },
      {
        name: 'Tramadol',
        generic: 'Tramadol HCl',
        common_doses: ['50mg', '100mg'],
        routes: ['oral', 'IV', 'IM'],
        common_frequencies: ['QID', 'TDS', 'BD', 'PRN'],
        max_daily_dose: '400mg',
        cautions: ['Seizure disorder', 'Respiratory depression'],
        interactions: ['SSRIs (serotonin syndrome)', 'MAOIs', 'Sedatives']
      },
      {
        name: 'Morphine',
        generic: 'Morphine Sulfate',
        common_doses: ['5mg', '10mg', '15mg'],
        routes: ['oral', 'IV', 'IM', 'SC'],
        common_frequencies: ['QID', 'Q4H', 'PRN'],
        cautions: ['Respiratory depression', 'Constipation', 'Addiction potential'],
        interactions: ['CNS depressants', 'Benzodiazepines']
      },
      {
        name: 'Diclofenac',
        generic: 'Diclofenac Sodium',
        common_doses: ['50mg', '75mg', '100mg'],
        routes: ['oral', 'IM', 'topical'],
        common_frequencies: ['BD', 'TDS'],
        max_daily_dose: '150mg',
        cautions: ['GI bleeding', 'Renal impairment', 'Cardiovascular disease'],
        interactions: ['Warfarin', 'Aspirin', 'ACE inhibitors', 'Diuretics']
      }
    ]
  },
  antibiotics: {
    name: 'Antibiotics',
    drugs: [
      {
        name: 'Amoxicillin-Clavulanate',
        generic: 'Co-Amoxiclav',
        common_doses: ['625mg', '1000mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['BD', 'TDS'],
        cautions: ['Penicillin allergy', 'Liver dysfunction'],
        interactions: ['Warfarin', 'Methotrexate']
      },
      {
        name: 'Ciprofloxacin',
        generic: 'Ciprofloxacin HCl',
        common_doses: ['500mg', '750mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['BD'],
        cautions: ['Tendon rupture', 'QT prolongation', 'Pregnancy'],
        interactions: ['Theophylline', 'Warfarin', 'Antacids']
      },
      {
        name: 'Metronidazole',
        generic: 'Metronidazole',
        common_doses: ['400mg', '500mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['TDS', 'BD'],
        cautions: ['Alcohol (disulfiram reaction)', 'Neurological disorders'],
        interactions: ['Warfarin', 'Lithium', 'Alcohol']
      },
      {
        name: 'Ceftriaxone',
        generic: 'Ceftriaxone Sodium',
        common_doses: ['1g', '2g'],
        routes: ['IV', 'IM'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Cephalosporin allergy', 'Neonates with hyperbilirubinemia'],
        interactions: ['Calcium-containing solutions']
      },
      {
        name: 'Flucloxacillin',
        generic: 'Flucloxacillin Sodium',
        common_doses: ['500mg', '1000mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['QID'],
        cautions: ['Penicillin allergy', 'Cholestatic jaundice'],
        interactions: ['Methotrexate']
      }
    ]
  },
  anticoagulants: {
    name: 'Anticoagulants/Antiplatelets',
    drugs: [
      {
        name: 'Enoxaparin',
        generic: 'Low Molecular Weight Heparin',
        common_doses: ['40mg', '60mg', '80mg', '20mg'],
        routes: ['SC'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Active bleeding', 'Thrombocytopenia', 'Spinal/epidural anesthesia'],
        interactions: ['NSAIDs', 'Aspirin', 'Other anticoagulants']
      },
      {
        name: 'Warfarin',
        generic: 'Warfarin Sodium',
        common_doses: ['1mg', '2mg', '3mg', '5mg'],
        routes: ['oral'],
        common_frequencies: ['OD (evening)'],
        cautions: ['Regular INR monitoring required', 'Bleeding risk'],
        interactions: ['Numerous drug interactions - check database']
      },
      {
        name: 'Aspirin',
        generic: 'Acetylsalicylic Acid',
        common_doses: ['75mg', '100mg', '300mg'],
        routes: ['oral'],
        common_frequencies: ['OD'],
        cautions: ['GI bleeding', 'Asthma', 'Children (Reye syndrome)'],
        interactions: ['Warfarin', 'NSAIDs', 'Methotrexate']
      }
    ]
  },
  gastrointestinal: {
    name: 'Gastrointestinal',
    drugs: [
      {
        name: 'Omeprazole',
        generic: 'Omeprazole',
        common_doses: ['20mg', '40mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Long-term use (osteoporosis, B12 deficiency)'],
        interactions: ['Clopidogrel', 'Warfarin']
      },
      {
        name: 'Metoclopramide',
        generic: 'Metoclopramide HCl',
        common_doses: ['10mg'],
        routes: ['oral', 'IV', 'IM'],
        common_frequencies: ['TDS', 'PRN'],
        max_daily_dose: '30mg',
        cautions: ['Extrapyramidal effects', 'GI obstruction'],
        interactions: ['Dopamine antagonists']
      },
      {
        name: 'Lactulose',
        generic: 'Lactulose',
        common_doses: ['15ml', '30ml'],
        routes: ['oral'],
        common_frequencies: ['BD', 'TDS'],
        cautions: ['Diabetes', 'Lactose intolerance'],
        interactions: ['Minimal']
      }
    ]
  },
  cardiovascular: {
    name: 'Cardiovascular',
    drugs: [
      {
        name: 'Amlodipine',
        generic: 'Amlodipine Besylate',
        common_doses: ['5mg', '10mg'],
        routes: ['oral'],
        common_frequencies: ['OD'],
        cautions: ['Hypotension', 'Peripheral edema'],
        interactions: ['Simvastatin', 'Diltiazem']
      },
      {
        name: 'Enalapril',
        generic: 'Enalapril Maleate',
        common_doses: ['5mg', '10mg', '20mg'],
        routes: ['oral'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Renal impairment', 'Hyperkalemia', 'Pregnancy'],
        interactions: ['Potassium supplements', 'NSAIDs', 'Diuretics']
      },
      {
        name: 'Furosemide',
        generic: 'Furosemide',
        common_doses: ['20mg', '40mg', '80mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Electrolyte monitoring', 'Dehydration'],
        interactions: ['Digoxin', 'Aminoglycosides', 'NSAIDs']
      }
    ]
  },
  diabetes: {
    name: 'Diabetes Medications',
    drugs: [
      {
        name: 'Metformin',
        generic: 'Metformin HCl',
        common_doses: ['500mg', '850mg', '1000mg'],
        routes: ['oral'],
        common_frequencies: ['BD', 'TDS'],
        max_daily_dose: '2550mg',
        cautions: ['Renal impairment', 'Lactic acidosis', 'Hold before contrast studies'],
        interactions: ['Alcohol', 'Cimetidine']
      },
      {
        name: 'Insulin (Actrapid)',
        generic: 'Regular Insulin',
        common_doses: ['Variable - see sliding scale'],
        routes: ['SC', 'IV'],
        common_frequencies: ['TDS-QID', 'Infusion'],
        cautions: ['Hypoglycemia', 'Hypokalemia'],
        interactions: ['Beta-blockers (mask hypoglycemia)']
      },
      {
        name: 'Glibenclamide',
        generic: 'Glibenclamide',
        common_doses: ['2.5mg', '5mg'],
        routes: ['oral'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Hypoglycemia', 'Renal/hepatic impairment'],
        interactions: ['Beta-blockers', 'Warfarin']
      }
    ]
  },
  wound_care: {
    name: 'Wound Care & Topicals',
    drugs: [
      {
        name: 'Silver Sulfadiazine Cream',
        generic: 'Silver Sulfadiazine',
        common_doses: ['1% cream'],
        routes: ['topical'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Sulfonamide allergy', 'Not for extensive burns'],
        interactions: ['Proteolytic enzymes']
      },
      {
        name: 'Fusidic Acid',
        generic: 'Sodium Fusidate',
        common_doses: ['2% cream/ointment'],
        routes: ['topical'],
        common_frequencies: ['TDS', 'QID'],
        cautions: ['Not for eyes'],
        interactions: ['Minimal']
      },
      {
        name: 'Betadine',
        generic: 'Povidone-Iodine',
        common_doses: ['10% solution'],
        routes: ['topical'],
        common_frequencies: ['As needed'],
        cautions: ['Iodine allergy', 'Thyroid disorders'],
        interactions: ['Minimal']
      }
    ]
  },
  steroids: {
    name: 'Corticosteroids',
    drugs: [
      {
        name: 'Hydrocortisone',
        generic: 'Hydrocortisone',
        common_doses: ['100mg', '200mg'],
        routes: ['IV', 'IM'],
        common_frequencies: ['QID', 'TDS', 'BD'],
        cautions: ['Infection risk', 'Glucose intolerance', 'Adrenal suppression'],
        interactions: ['NSAIDs', 'Warfarin', 'Diuretics']
      },
      {
        name: 'Dexamethasone',
        generic: 'Dexamethasone',
        common_doses: ['4mg', '8mg'],
        routes: ['oral', 'IV'],
        common_frequencies: ['OD', 'BD', 'TDS'],
        cautions: ['Infection risk', 'Glucose intolerance'],
        interactions: ['NSAIDs', 'Warfarin']
      },
      {
        name: 'Prednisolone',
        generic: 'Prednisolone',
        common_doses: ['5mg', '10mg', '20mg'],
        routes: ['oral'],
        common_frequencies: ['OD (morning)', 'BD'],
        cautions: ['Adrenal suppression with long-term use', 'Taper gradually'],
        interactions: ['NSAIDs', 'Warfarin', 'Diuretics']
      }
    ]
  },
  supplements: {
    name: 'Vitamins & Supplements',
    drugs: [
      {
        name: 'Vitamin C',
        generic: 'Ascorbic Acid',
        common_doses: ['500mg', '1000mg'],
        routes: ['oral'],
        common_frequencies: ['OD', 'BD'],
        cautions: ['Kidney stones', 'Iron overload'],
        interactions: ['Minimal']
      },
      {
        name: 'Zinc Sulfate',
        generic: 'Zinc Sulfate',
        common_doses: ['200mg', '220mg'],
        routes: ['oral'],
        common_frequencies: ['OD'],
        cautions: ['GI upset', 'Copper deficiency with long-term use'],
        interactions: ['Antibiotics (reduce absorption)']
      },
      {
        name: 'Multivitamin',
        generic: 'Multivitamin Complex',
        common_doses: ['1 tablet'],
        routes: ['oral'],
        common_frequencies: ['OD'],
        cautions: ['Hypervitaminosis with overdose'],
        interactions: ['Iron absorption affected by tea/coffee']
      }
    ]
  }
};

const FREQUENCY_OPTIONS = [
  { value: 'OD', label: 'OD (Once Daily)' },
  { value: 'BD', label: 'BD (Twice Daily)' },
  { value: 'TDS', label: 'TDS (Three Times Daily)' },
  { value: 'QID', label: 'QID (Four Times Daily)' },
  { value: 'Q4H', label: 'Q4H (Every 4 hours)' },
  { value: 'Q6H', label: 'Q6H (Every 6 hours)' },
  { value: 'Q8H', label: 'Q8H (Every 8 hours)' },
  { value: 'Q12H', label: 'Q12H (Every 12 hours)' },
  { value: 'PRN', label: 'PRN (As Needed)' },
  { value: 'STAT', label: 'STAT (Immediately)' },
  { value: 'ON', label: 'ON (Once at Night)' },
  { value: 'OM', label: 'OM (Once in Morning)' }
];

export const MedicationOrderingModal: React.FC<MedicationOrderingModalProps> = ({
  patientId,
  patientName,
  existingMedications = [],
  onSave,
  onClose
}) => {
  const [medications, setMedications] = useState<Medication[]>(existingMedications);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInteractions, setShowInteractions] = useState(false);

  const [newMedication, setNewMedication] = useState({
    medication_name: '',
    generic_name: '',
    dosage: '',
    route: 'oral' as 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'rectal' | 'sublingual' | 'inhalation',
    frequency: '',
    duration: '',
    indication: '',
    special_instructions: '',
    prescriber: localStorage.getItem('userName') || 'Doctor'
  });

  // Get filtered drugs
  const getFilteredDrugs = () => {
    if (!selectedCategory) return [];
    const category = DRUG_DATABASE[selectedCategory as keyof typeof DRUG_DATABASE];
    if (!category) return [];

    if (searchQuery) {
      return category.drugs.filter(drug =>
        drug.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drug.generic.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return category.drugs;
  };

  // Select drug from database
  const selectDrug = (drug: any) => {
    setSelectedDrug(drug);
    setNewMedication({
      ...newMedication,
      medication_name: drug.name,
      generic_name: drug.generic,
      // Preset first common dose if available
      dosage: drug.common_doses?.[0] || '',
      route: drug.routes?.[0] || 'oral',
      frequency: drug.common_frequencies?.[0] || ''
    });
  };

  // Add medication
  const addMedication = () => {
    if (!newMedication.medication_name || !newMedication.dosage || !newMedication.frequency) {
      alert('Please fill in medication name, dosage, and frequency');
      return;
    }

    const medication: Medication = {
      id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      medication_name: newMedication.medication_name,
      generic_name: newMedication.generic_name,
      dosage: newMedication.dosage,
      route: newMedication.route,
      frequency: newMedication.frequency,
      duration: newMedication.duration,
      start_date: new Date(),
      indication: newMedication.indication,
      special_instructions: newMedication.special_instructions,
      status: 'active',
      prescriber: newMedication.prescriber
    };

    setMedications([...medications, medication]);
    
    // Reset form
    setNewMedication({
      medication_name: '',
      generic_name: '',
      dosage: '',
      route: 'oral',
      frequency: '',
      duration: '',
      indication: '',
      special_instructions: '',
      prescriber: localStorage.getItem('userName') || 'Doctor'
    });
    setSelectedDrug(null);
    setSelectedCategory('');
  };

  // Remove medication
  const removeMedication = (id: string) => {
    setMedications(medications.filter(med => med.id !== id));
  };

  // Check for drug interactions
  const checkInteractions = (): string[] => {
    const interactions: string[] = [];
    const medicationNames = medications.map(m => m.medication_name);

    // Simple interaction checking logic
    // In a real system, this would query a comprehensive drug interaction database
    if (medicationNames.includes('Warfarin')) {
      const interactingDrugs = ['Aspirin', 'Diclofenac', 'Ciprofloxacin', 'Metronidazole', 'Omeprazole'];
      interactingDrugs.forEach(drug => {
        if (medicationNames.includes(drug)) {
          interactions.push(`⚠️ Warfarin + ${drug}: Increased bleeding risk. Monitor INR closely.`);
        }
      });
    }

    if (medicationNames.includes('Tramadol') && medicationNames.some(m => m.includes('Fluoxetine') || m.includes('Sertraline'))) {
      interactions.push(`⚠️ Tramadol + SSRI: Risk of serotonin syndrome. Monitor closely.`);
    }

    if (medicationNames.includes('Metformin') && medicationNames.includes('Furosemide')) {
      interactions.push(`⚠️ Metformin + Furosemide: Increased risk of lactic acidosis.`);
    }

    return interactions;
  };

  const interactions = checkInteractions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Medication Ordering</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">{patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Interaction Warning */}
        {interactions.length > 0 && (
          <div className="mx-6 mt-4 bg-red-50 border-2 border-red-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">⚠️ Drug Interactions Detected</h3>
                <ul className="space-y-1 text-sm text-red-800">
                  {interactions.map((interaction, idx) => (
                    <li key={idx}>{interaction}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 scroll-touch">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left: Order Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Order New Medication</h3>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(DRUG_DATABASE).map(([key, category]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setSelectedDrug(null);
                      }}
                      className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                        selectedCategory === key
                          ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drug Selection */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Drug
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search drugs..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {getFilteredDrugs().map((drug, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectDrug(drug)}
                        className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                          selectedDrug?.name === drug.name
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        <div className="font-medium">{drug.name}</div>
                        <div className="text-xs text-gray-600">{drug.generic}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Drug Details */}
              {selectedDrug && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-900 mb-2">Drug Information</h4>
                  <div className="text-sm space-y-1 text-blue-800">
                    {selectedDrug.common_doses && (
                      <p><span className="font-medium">Common Doses:</span> {selectedDrug.common_doses.join(', ')}</p>
                    )}
                    {selectedDrug.max_daily_dose && (
                      <p><span className="font-medium">Max Daily:</span> {selectedDrug.max_daily_dose}</p>
                    )}
                    {selectedDrug.cautions && selectedDrug.cautions.length > 0 && (
                      <div>
                        <span className="font-medium">Cautions:</span>
                        <ul className="list-disc list-inside ml-2">
                          {selectedDrug.cautions.map((caution: string, idx: number) => (
                            <li key={idx}>{caution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prescription Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dosage *
                    </label>
                    <input
                      type="text"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route *
                    </label>
                    <select
                      value={newMedication.route}
                      onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="oral">Oral</option>
                      <option value="IV">IV</option>
                      <option value="IM">IM</option>
                      <option value="SC">SC</option>
                      <option value="topical">Topical</option>
                      <option value="rectal">Rectal</option>
                      <option value="sublingual">Sublingual</option>
                      <option value="inhalation">Inhalation</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency *
                    </label>
                    <select
                      value={newMedication.frequency}
                      onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select...</option>
                      {FREQUENCY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <input
                      type="text"
                      value={newMedication.duration}
                      onChange={(e) => setNewMedication({ ...newMedication, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 7 days"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Indication
                  </label>
                  <input
                    type="text"
                    value={newMedication.indication}
                    onChange={(e) => setNewMedication({ ...newMedication, indication: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Reason for prescription"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Instructions
                  </label>
                  <textarea
                    value={newMedication.special_instructions}
                    onChange={(e) => setNewMedication({ ...newMedication, special_instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={2}
                    placeholder="e.g., Take with food, Avoid alcohol"
                  />
                </div>

                <button
                  onClick={addMedication}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Medication
                </button>
              </div>
            </div>

            {/* Right: Current Medications */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Current Medications ({medications.length})
              </h3>
              <div className="space-y-3">
                {medications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Pill className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No medications ordered yet</p>
                  </div>
                ) : (
                  medications.map((med) => (
                    <div key={med.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{med.medication_name}</h4>
                          {med.generic_name && (
                            <p className="text-xs text-gray-600">({med.generic_name})</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeMedication(med.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Dose:</span> {med.dosage} {med.route.toUpperCase()} {med.frequency}
                        </p>
                        {med.duration && (
                          <p><span className="font-medium">Duration:</span> {med.duration}</p>
                        )}
                        {med.indication && (
                          <p><span className="font-medium">Indication:</span> {med.indication}</p>
                        )}
                        {med.special_instructions && (
                          <p className="text-gray-600 italic">{med.special_instructions}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Prescribed by {med.prescriber} on {format(med.start_date, 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(medications);
              onClose();
            }}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Save Medications ({medications.length})
          </button>
        </div>
      </div>
    </div>
  );
};
