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
  MapPin,
  RefreshCw,
  Scan,
  FileDown,
  Layers,
  X
} from 'lucide-react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { 
  mdtService, 
  MDTPatientTeam, 
  MDTSpecialty, 
  MDTMeeting,
  MDTContactLog,
  MDTTeamReview,
  MDTWeeklyHarmonization
} from '../services/mdtService';
import { format } from 'date-fns';
import { safeFormatDate } from '../utils/dateUtils';
import { useAuthStore } from '../store/authStore';
import { DocumentScannerModal } from '../components/DocumentScannerModal';

const MDTPage: React.FC = () => {
  const { user } = useAuthStore();
  const [mdtPatients, setMdtPatients] = useState<MDTPatientTeam[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<MDTPatientTeam | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<MDTMeeting[]>([]);
  const [contactLogs, setContactLogs] = useState<MDTContactLog[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'team' | 'reviews' | 'meetings' | 'contacts'>('team');
  
  // Modal states
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddSpecialty, setShowAddSpecialty] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [showLogContact, setShowLogContact] = useState(false);
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<MDTSpecialty | null>(null);
  const [showOCRScan, setShowOCRScan] = useState(false);
  const [showAddReview, setShowAddReview] = useState(false);
  const [showHarmonizationResult, setShowHarmonizationResult] = useState<string | null>(null);
  const [harmonizing, setHarmonizing] = useState(false);

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
      setUpcomingMeetings(meetings);
      setContactLogs(contacts);
    } catch (error) {
      console.error('Error loading patient data:', error);
    }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      // First push local changes to server
      console.log('[MDT SYNC] Starting push to server...');
      const pushResult = await mdtService.pushToServer() as any;
      console.log('[MDT SYNC] Push result:', pushResult);
      
      // Check for errors
      if (pushResult?.results) {
        const errors = pushResult.results.filter((r: any) => r.status === 'error');
        if (errors.length > 0) {
          const errorMsg = errors.map((e: any) => `${e.error || 'Unknown error'}`).join('\n');
          alert(`Some records failed to sync:\n${errorMsg}\n\nCheck console for details.`);
        }
      }
      
      // Then pull latest from server
      console.log('[MDT SYNC] Starting pull from server...');
      await mdtService.syncFromServer();
      
      // Reload the data
      await loadData();
      
      if (!pushResult?.results?.some((r: any) => r.status === 'error')) {
        alert('MDT data synced successfully!');
      }
    } catch (error) {
      console.error('Error syncing MDT data:', error);
      alert(`Sync failed: ${error}`);
    } finally {
      setSyncing(false);
    }
  };

  const AddPatientModal = () => {
    const [selectedPatientId, setSelectedPatientId] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const patient = patients.find(p => String(p.id) === selectedPatientId);
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Specialty to Team</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
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

  const ScheduleMeetingModal = () => {
    const [formData, setFormData] = useState({
      meeting_title: '',
      meeting_date: '',
      meeting_time: '',
      location: '',
      meeting_type: 'routine' as 'routine' | 'urgent' | 'emergency',
      agenda: '',
      selected_specialties: [] as string[]
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPatient) return;

      try {
        const attendingSpecialties = formData.selected_specialties.map(specId => {
          const specialty = selectedPatient.specialties?.find((s: any) => s.id === specId);
          return {
            specialty_id: specId,
            specialty_name: specialty?.specialty_name || '',
            consultant_name: specialty?.consultant_name || '',
            attendance_status: 'invited' as const
          };
        });

        await mdtService.scheduleMeeting({
          patient_id: selectedPatient.patient_id,
          patient_name: selectedPatient.patient_name,
          hospital_number: selectedPatient.hospital_number,
          meeting_title: formData.meeting_title,
          meeting_date: new Date(formData.meeting_date),
          meeting_time: formData.meeting_time,
          location: formData.location,
          meeting_type: formData.meeting_type,
          status: 'scheduled',
          agenda: formData.agenda,
          attending_specialties: attendingSpecialties,
          created_by: user?.email || 'Unknown'
        });

        setShowScheduleMeeting(false);
        loadData();
      } catch (error) {
        console.error('Error scheduling meeting:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule MDT Meeting</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  value={formData.meeting_title}
                  onChange={(e) => setFormData({ ...formData, meeting_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., MDT Review - Complex Case Discussion"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.meeting_type}
                    onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Meeting room or virtual link"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attending Specialties</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {selectedPatient?.specialties?.map((spec: any) => (
                    <label key={spec.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.selected_specialties.includes(spec.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              selected_specialties: [...formData.selected_specialties, spec.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selected_specialties: formData.selected_specialties.filter(id => id !== spec.id)
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-900">{spec.specialty_name} - {spec.consultant_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agenda</label>
                <textarea
                  required
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Meeting objectives and discussion points..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleMeeting(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const LogContactModal = () => {
    const [formData, setFormData] = useState({
      specialty_id: selectedSpecialty?.id || '',
      contact_type: 'phone' as 'phone' | 'email' | 'in_person' | 'referral',
      contact_date: format(new Date(), 'yyyy-MM-dd'),
      contact_time: format(new Date(), 'HH:mm'),
      contacted_person: selectedSpecialty?.consultant_name || '',
      reason: '',
      discussion_summary: '',
      outcome: '',
      follow_up_required: false,
      follow_up_date: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPatient) return;

      try {
        const specialty = selectedPatient.specialties?.find((s: any) => s.id === formData.specialty_id);
        
        await mdtService.logContact({
          patient_id: selectedPatient.patient_id,
          patient_name: selectedPatient.patient_name,
          hospital_number: selectedPatient.hospital_number,
          specialty_id: formData.specialty_id,
          specialty_name: specialty?.specialty_name || '',
          contact_type: formData.contact_type,
          contact_date: new Date(formData.contact_date),
          contact_time: formData.contact_time,
          contacted_person: formData.contacted_person,
          reason: formData.reason,
          discussion_summary: formData.discussion_summary,
          outcome: formData.outcome,
          follow_up_required: formData.follow_up_required,
          follow_up_date: formData.follow_up_date ? new Date(formData.follow_up_date) : undefined,
          created_by: user?.email || 'Unknown'
        });

        setShowLogContact(false);
        setSelectedSpecialty(null);
        loadPatientData();
      } catch (error) {
        console.error('Error logging contact:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Contact</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <select
                  required
                  value={formData.specialty_id}
                  onChange={(e) => {
                    const spec = selectedPatient?.specialties?.find((s: any) => s.id === e.target.value);
                    setFormData({
                      ...formData,
                      specialty_id: e.target.value,
                      contacted_person: spec?.consultant_name || ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select specialty...</option>
                  {selectedPatient?.specialties?.map((spec: any) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.specialty_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Type</label>
                  <select
                    value={formData.contact_type}
                    onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="in_person">In Person</option>
                    <option value="referral">Referral Letter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Person Contacted</label>
                  <input
                    type="text"
                    required
                    value={formData.contacted_person}
                    onChange={(e) => setFormData({ ...formData, contacted_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Date</label>
                  <input
                    type="date"
                    required
                    value={formData.contact_date}
                    onChange={(e) => setFormData({ ...formData, contact_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Time</label>
                  <input
                    type="time"
                    required
                    value={formData.contact_time}
                    onChange={(e) => setFormData({ ...formData, contact_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Contact</label>
                <input
                  type="text"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Brief reason for contacting this specialty"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discussion Summary</label>
                <textarea
                  required
                  value={formData.discussion_summary}
                  onChange={(e) => setFormData({ ...formData, discussion_summary: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="What was discussed..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome/Decision</label>
                <textarea
                  required
                  value={formData.outcome}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="What was decided or recommended..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.follow_up_required}
                  onChange={(e) => setFormData({ ...formData, follow_up_required: e.target.checked })}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label className="text-sm font-medium text-gray-700">Follow-up required</label>
              </div>

              {formData.follow_up_required && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowLogContact(false);
                    setSelectedSpecialty(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Log Contact
                </button>
              </div>
            </form>
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
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Multidisciplinary Team (MDT)</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleForceSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Force Sync'}
            </button>
            <button
              onClick={() => setShowAddPatient(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Add Patient to MDT
            </button>
          </div>
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
            <p className="text-lg sm:text-2xl font-bold text-blue-700">{statistics.totalMDTPatients}</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Upcoming Meetings</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-700">{statistics.upcomingMeetings}</p>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Pending Follow-ups</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-yellow-700">{statistics.pendingFollowUps}</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Active Specialties</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-purple-700">{statistics.activeSpecialties.size}</p>
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
                { id: 'reviews', label: 'Team Reviews', icon: FileText },
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Team Member Reviews</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowOCRScan(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >
                      <Scan className="w-4 h-4" />
                      OCR Scan Review
                    </button>
                    <button
                      onClick={() => setShowAddReview(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Review
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedPatient) return;
                        setHarmonizing(true);
                        try {
                          const result = await mdtService.harmonizeWeeklyPlans(selectedPatient.id, user?.email || 'Unknown');
                          if (result) {
                            setShowHarmonizationResult(result.harmonized_plan);
                          } else {
                            alert('No reviews found in the past week to harmonize.');
                          }
                        } catch (error) {
                          console.error('Error harmonizing:', error);
                          alert('Error generating weekly harmonization');
                        } finally {
                          setHarmonizing(false);
                        }
                      }}
                      disabled={harmonizing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Layers className="w-4 h-4" />
                      {harmonizing ? 'Harmonizing...' : 'Harmonize Weekly'}
                    </button>
                  </div>
                </div>

                {/* Team Reviews List */}
                {selectedPatient.team_reviews && selectedPatient.team_reviews.length > 0 ? (
                  selectedPatient.team_reviews.sort((a: any, b: any) => 
                    new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                  ).map((review: any) => (
                    <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{review.specialty_name}</h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {safeFormatDate(review.review_date, 'MMM dd, yyyy')}
                            </span>
                            <span>By: {review.reviewer_name}</span>
                          </div>
                        </div>
                        {review.scanned_via_ocr && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                            <Scan className="w-3 h-3" />
                            OCR Scanned
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Findings:</span>
                          <p className="text-gray-900 mt-1 whitespace-pre-wrap">{review.review_text}</p>
                        </div>
                        {review.plan_text && (
                          <div>
                            <span className="text-gray-600 font-medium">Plan:</span>
                            <p className="text-gray-900 mt-1 whitespace-pre-wrap">{review.plan_text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-3">No team reviews yet</p>
                    <p className="text-sm text-gray-500">Scan physical folder reviews via OCR or add manually</p>
                  </div>
                )}

                {/* Weekly Harmonizations */}
                {selectedPatient.weekly_harmonizations && selectedPatient.weekly_harmonizations.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      Weekly Harmonizations
                    </h4>
                    {selectedPatient.weekly_harmonizations.sort((a: any, b: any) =>
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    ).map((h: any) => (
                      <div key={h.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-900">
                            Week: {safeFormatDate(h.week_start, 'MMM dd')} - {safeFormatDate(h.week_end, 'MMM dd, yyyy')}
                          </span>
                          <span className="text-xs text-blue-600">
                            {h.reviews_included?.length || 0} reviews harmonized
                          </span>
                        </div>
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans bg-white p-3 rounded border border-blue-100 max-h-60 overflow-y-auto">
                          {h.harmonized_plan}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'meetings' && (
              <div className="space-y-4">
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowScheduleMeeting(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Meeting
                  </button>
                </div>

                {upcomingMeetings.length > 0 ? (
                  upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{meeting.meeting_title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {safeFormatDate(meeting.meeting_date, 'MMM dd, yyyy')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {meeting.meeting_time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {meeting.location}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                          meeting.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {meeting.status}
                        </span>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-600 font-medium mb-1">Agenda:</p>
                        <p className="text-sm text-gray-700">{meeting.agenda}</p>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-600 font-medium mb-2">Attending Specialties:</p>
                        <div className="flex flex-wrap gap-2">
                          {meeting.attending_specialties.map((spec, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 text-xs rounded ${
                                spec.attendance_status === 'attended' ? 'bg-green-100 text-green-700' :
                                spec.attendance_status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                                spec.attendance_status === 'declined' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {spec.specialty_name} - {spec.attendance_status}
                            </span>
                          ))}
                        </div>
                      </div>

                      {meeting.discussion_points && (
                        <div className="mb-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-600 font-medium mb-1">Discussion:</p>
                          <p className="text-sm text-gray-700">{meeting.discussion_points}</p>
                        </div>
                      )}

                      {meeting.decisions_made && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600 font-medium mb-1">Decisions:</p>
                          <p className="text-sm text-gray-700">{meeting.decisions_made}</p>
                        </div>
                      )}

                      {meeting.action_items && meeting.action_items.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 font-medium mb-2">Action Items:</p>
                          <div className="space-y-2">
                            {meeting.action_items.map((action) => (
                              <div key={action.id} className="flex items-start gap-2 text-sm">
                                <CheckCircle className={`w-4 h-4 mt-0.5 ${
                                  action.status === 'completed' ? 'text-green-600' : 'text-gray-400'
                                }`} />
                                <div className="flex-1">
                                  <p className="text-gray-900">{action.action}</p>
                                  <p className="text-xs text-gray-600">
                                    Assigned to: {action.assigned_to} ({action.specialty}) - 
                                    Due: {safeFormatDate(action.due_date, 'MMM dd, yyyy')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-3">No meetings scheduled yet</p>
                    <button
                      onClick={() => setShowScheduleMeeting(true)}
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      Schedule first meeting
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowLogContact(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Log Contact
                  </button>
                </div>

                {contactLogs.length > 0 ? (
                  contactLogs.map((contact) => (
                    <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{contact.specialty_name}</h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                            <span>{safeFormatDate(contact.contact_date, 'MMM dd, yyyy')} at {contact.contact_time}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                              {contact.contact_type}
                            </span>
                          </div>
                        </div>
                        {contact.follow_up_required && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Follow-up needed
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Contacted:</span>
                          <span className="text-gray-900 ml-1">{contact.contacted_person}</span>
                        </div>

                        <div>
                          <span className="text-gray-600 font-medium">Reason:</span>
                          <p className="text-gray-900 mt-1">{contact.reason}</p>
                        </div>

                        <div>
                          <span className="text-gray-600 font-medium">Discussion:</span>
                          <p className="text-gray-700 mt-1">{contact.discussion_summary}</p>
                        </div>

                        <div>
                          <span className="text-gray-600 font-medium">Outcome:</span>
                          <p className="text-gray-700 mt-1">{contact.outcome}</p>
                        </div>

                        {contact.follow_up_required && contact.follow_up_date && (
                          <div className="pt-2 border-t border-gray-100">
                            <span className="text-gray-600 font-medium">Follow-up by:</span>
                            <span className="text-gray-900 ml-1">
                              {safeFormatDate(contact.follow_up_date, 'MMM dd, yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-3">No contact logs yet</p>
                    <button
                      onClick={() => setShowLogContact(true)}
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      Log first contact
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddPatient && <AddPatientModal />}
      {showAddSpecialty && <AddSpecialtyModal />}
      {showQuickContact && <QuickContactModal />}
      {showScheduleMeeting && <ScheduleMeetingModal />}
      {showLogContact && <LogContactModal />}

      {/* OCR Scan Review Modal */}
      {showOCRScan && selectedPatient && (
        <DocumentScannerModal
          isOpen={showOCRScan}
          onClose={() => setShowOCRScan(false)}
          onFieldsExtracted={async (fields: any) => {
            try {
              const review: any = {
                specialty_name: fields.specialty_name || fields.specialty || fields.department || 'General',
                reviewer_name: fields.reviewer_name || fields.doctor_name || fields.consultant || 'Unknown',
                review_date: fields.review_date || fields.date || new Date().toISOString(),
                review_text: fields.review_text || fields.findings || fields.notes || fields.content || JSON.stringify(fields, null, 2),
                plan_text: fields.plan_text || fields.plan || fields.management || '',
                scanned_via_ocr: true,
              };
              await mdtService.addTeamReview(selectedPatient.id, review);
              // Refresh patient data
              const updatedTeam = await mdtService.getPatientTeam(selectedPatient.patient_id);
              if (updatedTeam) {
                setSelectedPatient(updatedTeam);
              }
              setShowOCRScan(false);
            } catch (error) {
              console.error('Error saving OCR review:', error);
              alert('Error saving scanned review');
            }
          }}
          documentType="general"
          patientContext={{
            name: selectedPatient.patient_name || '',
            id: selectedPatient.patient_id || '',
          } as any}
        />
      )}

      {/* Add Review Manually Modal */}
      {showAddReview && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-lg">Add Team Review</h3>
              <button onClick={() => setShowAddReview(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                try {
                  await mdtService.addTeamReview(selectedPatient.id, {
                    specialty_name: formData.get('specialty_name') as string,
                    reviewer_name: formData.get('reviewer_name') as string,
                    review_date: (formData.get('review_date') as string || new Date().toISOString()) as any,
                    review_text: formData.get('review_text') as string,
                    plan_text: formData.get('plan_text') as string,
                    scanned_via_ocr: false,
                  });
                  const updatedTeam = await mdtService.getPatientTeam(selectedPatient.patient_id);
                  if (updatedTeam) {
                    setSelectedPatient(updatedTeam);
                  }
                  setShowAddReview(false);
                } catch (error) {
                  console.error('Error adding review:', error);
                  alert('Error saving review');
                }
              }}
              className="p-4 space-y-4 overflow-y-auto flex-1"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input name="specialty_name" required className="w-full px-3 py-2 border rounded-md" placeholder="e.g., Orthopedics" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Name</label>
                <input name="reviewer_name" required className="w-full px-3 py-2 border rounded-md" placeholder="Dr. Name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Date</label>
                <input name="review_date" type="date" required className="w-full px-3 py-2 border rounded-md" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Findings / Review</label>
                <textarea name="review_text" required rows={4} className="w-full px-3 py-2 border rounded-md" placeholder="Clinical findings and assessment..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <textarea name="plan_text" rows={3} className="w-full px-3 py-2 border rounded-md" placeholder="Recommended management plan..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddReview(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Save Review</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Harmonization Result Modal */}
      {showHarmonizationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Weekly Plan Harmonization
              </h3>
              <button onClick={() => setShowHarmonizationResult(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans bg-blue-50 p-4 rounded-lg border border-blue-200">
                {showHarmonizationResult}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowHarmonizationResult(null)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MDTPage;
