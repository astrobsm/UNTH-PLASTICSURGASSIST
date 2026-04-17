import { ConferencePatient } from '../../services/preSurgicalConferenceService';
import { User, Calendar, Droplet, AlertTriangle, FileText } from 'lucide-react';
import { displayArrayField } from '../../services/patientService';

interface Props {
  patient: ConferencePatient;
}

export default function ClinicalSummarySlide({ patient }: Props) {
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 'N/A';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Patient Header */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold">{patient.full_name || `${patient.first_name} ${patient.last_name}`}</h1>
        <p className="text-xl text-gray-300 mt-1">Hospital No: {patient.hospital_number}</p>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InfoCard
          icon={<Calendar className="h-6 w-6" />}
          label="Age / DOB"
          value={`${age} years (${patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'})`}
        />
        <InfoCard
          icon={<User className="h-6 w-6" />}
          label="Gender"
          value={patient.gender || 'N/A'}
        />
        <InfoCard
          icon={<Droplet className="h-6 w-6" />}
          label="Blood Group"
          value={patient.blood_group || 'N/A'}
        />
        <InfoCard
          icon={<AlertTriangle className="h-6 w-6 text-red-400" />}
          label="Allergies"
          value={displayArrayField(patient.allergies, 'No known allergies')}
          highlight={!!patient.allergies}
        />
        <InfoCard
          icon={<FileText className="h-6 w-6" />}
          label="Ward / Bed"
          value={`${patient.ward || 'N/A'} / Bed ${patient.bed_number || 'N/A'}`}
        />
        <InfoCard
          icon={<FileText className="h-6 w-6" />}
          label="Primary Diagnosis"
          value={patient.primary_diagnosis || 'N/A'}
        />
      </div>

      {/* Medical History */}
      {patient.medical_history && (
        <div className="bg-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-3">Medical History</h3>
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{patient.medical_history}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`${highlight ? 'bg-red-900/40 border-red-500' : 'bg-white/10 border-white/10'} border rounded-xl p-5`}>
      <div className="flex items-center space-x-3 mb-2">
        <span className="text-green-400">{icon}</span>
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
