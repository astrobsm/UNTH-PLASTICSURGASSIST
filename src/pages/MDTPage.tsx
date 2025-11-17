import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  Clock,
  UserPlus,
  Trash2,
  Edit,
  FileText,
  AlertCircle,
  MapPin
} from 'lucide-react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { 
  mdtService, 
  MDTPatientTeam, 
  MDTSpecialty, 
  MDTMeeting,
  MDTContactLog
} from '../services/mdtService';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

const MDTPage: React.FC = () => {
  const { user } = useAuthStore();
  const [mdtPatients, setMdtPatients] = useState<MDTPatientTeam[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<MDTPatientTeam | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<MDTMeeting[]>([]);
  const [contactLogs, setContactLogs] = useState<MDTContactLog[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'team' | 'meetings' | 'contacts'>('team');
  
  // Modal states
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddSpecialty, setShowAddSpecialty] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [showLogContact, setShowLogContact] = useState(false);
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<MDTSpecialty | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientData();
    }
  }, [selectedPatient]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mdtPatientsData, allPatients, meetings, stats] = await Promise.all([
        mdtService.getAllActiveMDTPatients(),
        patientService.getAllPatients(),
        mdtService.getUpcomingMeetings(),
        mdtService.getMDTStatistics()
      ]);
      setMdtPatients(mdtPatientsData);
      setPatients(allPatients);
      setUpcomingMeetings(meetings);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading MDT data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientData = async () => {
    if (!selectedPatient) return;
    
    try {
      const [meetings, contacts] = await Promise.all([
        mdtService.getPatientMeetings(selectedPatient.patient_id),
        mdtService.getPatientContactHistory(selectedPatient.patient_id)
      ]);
      // Update state if needed
    } catch (error) {
      console.error('Error loading patient data:', error);
    }
  };

  const AddPatientModal = () => {
    const [selectedPatientId, setSelectedPatientId] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const patient = patients.find(p => p.id === parseInt(selectedPatientId));
        if (!patient) return;

        await mdtService.createPatientTeam(
          selectedPatientId,
          `${patient.first_name} ${patient.last_name}`,
          patient.hospital_number
        );

        setShowAddPatient(false);
        loadData();
      } catch (error) {
        console.error('Error adding patient to MDT:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Patient to MDT</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient</label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose patient...</option>
                  {patients
                    .filter(p => !mdtPatients.some(mdt => mdt.patient_id === p.id.toString()))
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.hospital_number})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPatient(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Add to MDT
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const AddSpecialtyModal = () => {
    const [formData, setFormData] = useState({
      specialty_name: '',
      unit_name: '',
      consultant_name: '',
      contact_phone: '',
      contact_email: '',
      ward_location: '',
      notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPatient) return;

      try {
        await mdtService.addSpecialtyToTeam(selectedPatient.id, formData);
        setShowAddSpecialty(false);
        
        // Refresh patient data
        const updated = await mdtService.getPatientTeam(selectedPatient.patient_id);
        if (updated) setSelectedPatient(updated);
        loadData();
      } catch (error) {
        console.error('Error adding specialty:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Specialty to Team</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specialty Name</label>
                  <input
                    type="text"
                    required
                    value={formData.specialty_name}
                    onChange={(e) => setFormData({ ...formData, specialty_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Cardiology"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Name</label>
                  <input
                    type="text"
                    required
                    value={formData.unit_name}
                    onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Cardiology Unit, UNTH"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultant Name</label>
                <input
                  type="text"
                  required
                  value={formData.consultant_name}
                  onChange={(e) => setFormData({ ...formData, consultant_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Dr. Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="+234 XXX XXX XXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="email@unth.edu.ng"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ward Location (Optional)</label>
                <input
                  type="text"
                  value={formData.ward_location}
                  onChange={(e) => setFormData({ ...formData, ward_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ward/Office location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Additional notes about this specialty involvement..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSpecialty(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Add Specialty
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const QuickContactModal = () => {
    if (!selectedSpecialty) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Contact</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Specialty</p>
                <p className="font-semibold text-gray-900">{selectedSpecialty.specialty_name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Unit</p>
                <p className="font-semibold text-gray-900">{selectedSpecialty.unit_name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Consultant</p>
                <p className="font-semibold text-gray-900">{selectedSpecialty.consultant_name}</p>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <a
                  href={`tel:${selectedSpecialty.contact_phone}`}
                  className="flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Call</p>
                    <p className="text-sm">{selectedSpecialty.contact_phone}</p>
                  </div>
                </a>

                <a
                  href={`mailto:${selectedSpecialty.contact_email}`}
                  className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm">{selectedSpecialty.contact_email}</p>
                  </div>
                </a>

                {selectedSpecialty.ward_location && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 text-gray-700 rounded-lg">
                    <MapPin className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm">{selectedSpecialty.ward_location}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowQuickContact(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowQuickContact(false);
                    setShowLogContact(true);
                  }}
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Log Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Multidisciplinary Team (MDT)</h1>
          <button
            onClick={() => setShowAddPatient(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            Add Patient to MDT
          </button>
        </div>
        <p className="text-gray-600">Manage patients with multiple specialty involvement</p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">MDT Patients</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{statistics.totalMDTPatients}</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Upcoming Meetings</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{statistics.upcomingMeetings}</p>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Pending Follow-ups</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{statistics.pendingFollowUps}</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Active Specialties</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{statistics.activeSpecialties.size}</p>
          </div>
        </div>
      )}

      {/* MDT Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {mdtPatients.map(patient => (
          <div
            key={patient.id}
            onClick={() => setSelectedPatient(patient)}
            className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
              selectedPatient?.id === patient.id ? 'ring-2 ring-green-600' : 'hover:shadow-md'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{patient.patient_name}</h3>
                <p className="text-sm text-gray-600">{patient.hospital_number}</p>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                {patient.specialties?.length || 0} specialties
              </span>
            </div>

            {patient.specialties && patient.specialties.length > 0 && (
              <div className="space-y-1">
                {patient.specialties.slice(0, 3).map((spec: any) => (
                  <div key={spec.id} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    {spec.specialty_name}
                  </div>
                ))}
                {patient.specialties.length > 3 && (
                  <p className="text-xs text-gray-500 italic">
                    +{patient.specialties.length - 3} more
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {mdtPatients.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No MDT patients yet</p>
            <button
              onClick={() => setShowAddPatient(true)}
              className="mt-3 text-green-600 hover:text-green-700 font-medium"
            >
              Add your first MDT patient
            </button>
          </div>
        )}
      </div>

      {/* Selected Patient Details */}
      {selectedPatient && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPatient.patient_name}</h2>
                <p className="text-gray-600">{selectedPatient.hospital_number}</p>
              </div>
              <button
                onClick={() => setShowAddSpecialty(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                Add Specialty
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              {[
                { id: 'team', label: 'Team Members', icon: Users },
                { id: 'meetings', label: 'MDT Meetings', icon: Calendar },
                { id: 'contacts', label: 'Contact Log', icon: MessageSquare }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'team' && (
              <div className="space-y-4">
                {selectedPatient.specialties && selectedPatient.specialties.length > 0 ? (
                  selectedPatient.specialties.map((spec: any) => (
                    <div key={spec.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{spec.specialty_name}</h4>
                          <p className="text-sm text-gray-600">{spec.unit_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedSpecialty(spec);
                              setShowQuickContact(true);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                            title="Quick Contact"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Remove this specialty from the team?')) {
                                await mdtService.removeSpecialtyFromTeam(selectedPatient.id, spec.id);
                                const updated = await mdtService.getPatientTeam(selectedPatient.patient_id);
                                if (updated) setSelectedPatient(updated);
                                loadData();
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Consultant</p>
                          <p className="font-medium text-gray-900">{spec.consultant_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Phone</p>
                          <a href={`tel:${spec.contact_phone}`} className="font-medium text-green-600 hover:text-green-700">
                            {spec.contact_phone}
                          </a>
                        </div>
                        <div>
                          <p className="text-gray-600">Email</p>
                          <a href={`mailto:${spec.contact_email}`} className="font-medium text-blue-600 hover:text-blue-700">
                            {spec.contact_email}
                          </a>
                        </div>
                        {spec.ward_location && (
                          <div>
                            <p className="text-gray-600">Location</p>
                            <p className="font-medium text-gray-900">{spec.ward_location}</p>
                          </div>
                        )}
                      </div>

                      {spec.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-600 italic">{spec.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-3">No specialties added yet</p>
                    <button
                      onClick={() => setShowAddSpecialty(true)}
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      Add first specialty
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'meetings' && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">MDT meeting scheduling coming soon</p>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Contact logging coming soon</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddPatient && <AddPatientModal />}
      {showAddSpecialty && <AddSpecialtyModal />}
      {showQuickContact && <QuickContactModal />}
    </div>
  );
};

export default MDTPage;
