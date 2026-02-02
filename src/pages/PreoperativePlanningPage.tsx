import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PreoperativePlanningModule } from '../components/procedures/PreoperativePlanningModule';
import { patientService } from '../services/patientService';
import { ArrowLeft, ClipboardCheck, Users, Search, User, Calendar, Loader2 } from 'lucide-react';

interface Patient {
  id: string;
  hospital_number: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
}

const PreoperativePlanningPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientIdFromUrl = searchParams.get('patientId');
  
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientIdFromUrl);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPatientSelector, setShowPatientSelector] = useState(!patientIdFromUrl);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredPatients(
        patients.filter(p => {
          const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
          const hospitalNumber = p.hospital_number || '';
          return (
            fullName.toLowerCase().includes(query) ||
            hospitalNumber.toLowerCase().includes(query)
          );
        })
      );
    } else {
      setFilteredPatients(patients.slice(0, 20)); // Show first 20 by default
    }
  }, [searchQuery, patients]);

  const loadPatients = async () => {
    try {
      setIsLoading(true);
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
      setFilteredPatients(allPatients.slice(0, 20));
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    setShowPatientSelector(false);
    navigate(`/preoperative-planning?patientId=${patientId}`, { replace: true });
  };

  const handleComplete = (data: any) => {
    console.log('Pre-operative assessment completed:', data);
    // Save to database or navigate
    navigate('/procedures');
  };

  const handleCancel = () => {
    if (selectedPatientId) {
      setShowPatientSelector(true);
      setSelectedPatientId(null);
    } else {
      navigate('/procedures');
    }
  };

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading && !patientIdFromUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Patient selector view
  if (showPatientSelector) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/procedures')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back to Procedures
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <ClipboardCheck className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-operative Planning</h1>
              <p className="text-gray-500">Select a patient to begin pre-operative assessment</p>
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name or hospital number..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Patient List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-gray-700">
                  {searchQuery ? `${filteredPatients.length} results` : `${patients.length} patients`}
                </span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No patients found</p>
              </div>
            ) : (
              filteredPatients.map((patient) => {
                const displayName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown';
                return (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient.id)}
                    className="w-full p-4 hover:bg-gray-50 text-left transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{displayName}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>#{patient.hospital_number || 'N/A'}</span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {patient.date_of_birth ? `${calculateAge(patient.date_of_birth)} years` : 'N/A'}
                          </span>
                          <span className="capitalize">{patient.gender || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-primary-600">
                      <ArrowLeft className="w-5 h-5 transform rotate-180" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pre-operative Planning Module view
  return (
    <div className="p-6">
      <PreoperativePlanningModule
        patientId={selectedPatientId || undefined}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default PreoperativePlanningPage;
