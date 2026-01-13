import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/database';
import { Patient } from '../db/database';
import { PatientRegistrationForm } from '../components/PatientRegistrationForm';
import patientService from '../services/patientService';

export const Patients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'discharged'>('all');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      // Fetch from server API first (includes ALL patients from all users)
      // This also updates local IndexedDB for offline access
      let patientData = await patientService.getAllPatients();
      
      // Filter out deleted patients
      const activePatients = patientData.filter((p: any) => !p.deleted);
      setPatients(activePatients);
    } catch (error) {
      console.error('Error loading patients:', error);
      
      // Fallback to local IndexedDB if API fails
      const localPatients = await db.patients
        .orderBy('created_at')
        .reverse()
        .toArray();
      setPatients(localPatients.filter(p => !p.deleted));
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = searchTerm === '' || 
      (patient.first_name && patient.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.last_name && patient.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.hospital_number && patient.hospital_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.phone && patient.phone.includes(searchTerm));
    
    // For now, treating all patients as active since we don't have discharge status in the schema
    const matchesFilter = filterStatus === 'all' || filterStatus === 'active';
    
    return matchesSearch && matchesFilter;
  });

  const handleRegistrationSuccess = (patientId: string) => {
    setShowRegistrationForm(false);
    loadPatients(); // Refresh the patient list
    alert(`Patient registered successfully! Patient ID: ${patientId}`);
  };

  if (showRegistrationForm) {
    return (
      <div>
        <PatientRegistrationForm 
          onSuccess={handleRegistrationSuccess}
          onCancel={() => setShowRegistrationForm(false)}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title">Patients - UNTH</h1>
          <p className="page-subtitle">Manage patient records and registrations</p>
        </div>
        <button
          onClick={() => setShowRegistrationForm(true)}
          className="btn-primary w-full sm:w-auto"
        >
          + Register New Patient
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card p-3 sm:p-4 mb-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="form-select sm:w-48"
            >
              <option value="all">All Patients</option>
              <option value="active">Active</option>
              <option value="discharged">Discharged</option>
            </select>
            
            <span className="text-sm text-gray-500 text-center sm:text-right">
              {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No patients found' : 'No patients registered'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria.' 
                : 'Get started by registering your first patient.'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowRegistrationForm(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Register First Patient
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredPatients.map((patient) => (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className="block hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="p-3 sm:p-4">
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Patient Avatar */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                      {patient.first_name?.[0]}{patient.last_name?.[0]}
                    </div>
                    
                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {patient.first_name} {patient.last_name}
                        </h3>
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Active
                        </span>
                      </div>
                      
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
                        <span className="flex items-center">
                          <svg className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {patient.hospital_number}
                        </span>
                        
                        <span className="flex items-center">
                          <svg className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {patient.phone}
                        </span>
                        
                        <span className="flex items-center hidden sm:flex">
                          <svg className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4h6m-6 4h6m-6 4h6M3 7h18" />
                          </svg>
                          DOB: {patient.dob}
                        </span>
                        
                        <span className="flex items-center capitalize">
                          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {patient.sex}
                        </span>
                      </div>

                      {/* Allergies and Comorbidities */}
                      {(patient.allergies?.length || patient.comorbidities?.length) && (
                        <div className="mt-2 flex items-center space-x-4">
                          {patient.allergies && Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-red-600 font-medium">Allergies:</span>
                              <div className="flex space-x-1">
                                {patient.allergies.slice(0, 2).map((allergy, index) => (
                                  <span key={index} className="inline-block bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                    {allergy}
                                  </span>
                                ))}
                                {patient.allergies.length > 2 && (
                                  <span className="text-xs text-red-600">
                                    +{patient.allergies.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {patient.comorbidities && patient.comorbidities.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-yellow-600 font-medium">Conditions:</span>
                              <div className="flex space-x-1">
                                {patient.comorbidities.slice(0, 2).map((condition, index) => (
                                  <span key={index} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                                    {condition}
                                  </span>
                                ))}
                                {patient.comorbidities.length > 2 && (
                                  <span className="text-xs text-yellow-600">
                                    +{patient.comorbidities.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Indicator */}
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Statistics Footer */}
      {!loading && filteredPatients.length > 0 && (
        <div className="mt-4 sm:mt-6 card p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="stat-value text-green-600">{filteredPatients.length}</div>
              <div className="stat-label">Total Patients</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-blue-600">
                {filteredPatients.filter(p => p.sex === 'male').length}
              </div>
              <div className="stat-label">Male</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-pink-600">
                {filteredPatients.filter(p => p.sex === 'female').length}
              </div>
              <div className="stat-label">Female</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-purple-600">
                {filteredPatients.filter(p => p.allergies && p.allergies.length > 0).length}
              </div>
              <div className="stat-label">With Allergies</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;