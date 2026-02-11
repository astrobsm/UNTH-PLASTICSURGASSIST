import { Medication } from '../../services/preSurgicalConferenceService';
import { Pill, Calendar, User, Clock, AlertTriangle } from 'lucide-react';

interface Props {
  medications: Medication[];
  categorizedMedications: Record<string, Medication[]>;
}

export default function MedicationsSlide({ medications, categorizedMedications }: Props) {
  const categories = Object.keys(categorizedMedications).sort();
  const activeMedications = medications.filter(m => m.status === 'active');

  if (medications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Pill className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-400">No Current Medications</h2>
        <p className="text-gray-500 mt-2">No medications have been prescribed for this patient</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Pill className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold">Current Medications</h1>
        <p className="text-gray-400 mt-2">
          {activeMedications.length} active medications across {categories.length} categories
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category) => (
          <CategoryCard key={category} category={category} medications={categorizedMedications[category]} />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ category, medications }: { category: string; medications: Medication[] }) {
  const getCategoryColor = (cat: string): string => {
    const colors: Record<string, string> = {
      'Antibiotics': 'bg-red-600/30 text-red-300',
      'Analgesics': 'bg-orange-600/30 text-orange-300',
      'Antihypertensives': 'bg-blue-600/30 text-blue-300',
      'Antidiabetics': 'bg-purple-600/30 text-purple-300',
      'Anticoagulants/Antiplatelets': 'bg-pink-600/30 text-pink-300',
      'GI Medications': 'bg-green-600/30 text-green-300',
      'Sedatives/Anaesthetic Agents': 'bg-indigo-600/30 text-indigo-300',
      'Steroids': 'bg-yellow-600/30 text-yellow-300',
      'Respiratory': 'bg-cyan-600/30 text-cyan-300',
      'Supplements': 'bg-teal-600/30 text-teal-300',
    };
    return colors[cat] || 'bg-gray-600/30 text-gray-300';
  };

  return (
    <div className="bg-white/10 rounded-xl overflow-hidden">
      <div className={`${getCategoryColor(category).split(' ')[0]} px-5 py-3 border-b border-white/10`}>
        <h3 className={`text-lg font-bold ${getCategoryColor(category).split(' ')[1]}`}>{category}</h3>
        <p className="text-sm text-gray-400">{medications.length} medication(s)</p>
      </div>
      <div className="divide-y divide-white/10">
        {medications.map((med) => (
          <MedicationRow key={med.id} medication={med} />
        ))}
      </div>
    </div>
  );
}

function MedicationRow({ medication }: { medication: Medication }) {
  const isActive = medication.status === 'active';
  const needsAttention = medication.route?.toLowerCase().includes('iv') || 
                         medication.medication_name.toLowerCase().includes('anticoagulant');

  return (
    <div className={`px-5 py-4 ${!isActive ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            {needsAttention && <AlertTriangle className="h-4 w-4 text-yellow-400" />}
            <span className="font-semibold text-lg">{medication.medication_name}</span>
            {!isActive && (
              <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">{medication.status}</span>
            )}
          </div>
          <div className="text-gray-300 mt-1 space-y-1">
            <p className="text-sm">
              <span className="text-green-400 font-medium">{medication.dosage}</span>
              {' • '}
              <span>{medication.frequency}</span>
              {medication.duration && ` • ${medication.duration}`}
            </p>
            <p className="text-sm flex items-center space-x-2">
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{medication.route}</span>
              {medication.instructions && (
                <span className="text-gray-400 italic text-xs">{medication.instructions}</span>
              )}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(medication.prescribed_at).toLocaleDateString()}</span>
          </div>
          {medication.prescribed_by_name && (
            <div className="flex items-center space-x-1 mt-1">
              <User className="h-3 w-3" />
              <span>{medication.prescribed_by_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
