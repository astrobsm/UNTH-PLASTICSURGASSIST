import React from 'react';
import { X, User, Calendar, Droplet, AlertTriangle, FileText, MapPin, BedDouble } from 'lucide-react';
import { ConferencePatient } from '../../services/preSurgicalConferenceService';

interface Props {
  patient: ConferencePatient;
  onExit: () => void;
}

const PatientSummarySlide: React.FC<Props> = ({ patient, onExit }) => {
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
    : 'N/A';

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <User className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Patient Clinical Summary</h1>
            <p className="text-green-100 text-sm">Pre-Surgical Conference Presentation</p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          title="Exit Presentation"
        >
          <X className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="max-w-5xl mx-auto">
          {/* Patient Identity Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-green-700">
                    {patient.full_name?.[0] || patient.first_name?.[0] || '?'}
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                  </h2>
                  <p className="text-lg text-gray-500 font-mono">{patient.hospital_number}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-lg font-semibold">
                  {patient.gender || 'N/A'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <InfoCard icon={Calendar} label="Age" value={`${age} years`} color="blue" />
              <InfoCard icon={Calendar} label="DOB" value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'} color="purple" />
              <InfoCard icon={Droplet} label="Blood Group" value={patient.blood_group || 'N/A'} color="red" />
              <InfoCard icon={MapPin} label="Ward / Bed" value={`${patient.ward || 'N/A'} / ${patient.bed_number || 'N/A'}`} color="orange" />
            </div>
          </div>

          {/* Primary Diagnosis */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="h-7 w-7 text-green-600" />
              <h3 className="text-2xl font-bold text-gray-900">Primary Diagnosis</h3>
            </div>
            <p className="text-xl text-gray-800 bg-green-50 p-4 rounded-xl border-l-4 border-green-500">
              {patient.primary_diagnosis || 'Not specified'}
            </p>
          </div>

          {/* Allergies */}
          {patient.allergies && (
            <div className="bg-red-50 rounded-2xl shadow-2xl p-8 mb-6 border-2 border-red-200">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-7 w-7 text-red-600" />
                <h3 className="text-2xl font-bold text-red-700">⚠️ Allergies</h3>
              </div>
              <p className="text-xl text-red-800 font-semibold">{patient.allergies}</p>
            </div>
          )}

          {/* Medical History */}
          {patient.medical_history && (
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <div className="flex items-center space-x-3 mb-4">
                <BedDouble className="h-7 w-7 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">Medical History</h3>
              </div>
              <p className="text-lg text-gray-700 whitespace-pre-wrap leading-relaxed">
                {patient.medical_history}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm">Slide 1 of 9</span>
        <span className="text-gray-400 text-sm">Press Exit or ESC to return</span>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({ icon: Icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <div className={`p-4 rounded-xl border-2 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center space-x-2 mb-1">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

export default PatientSummarySlide;
