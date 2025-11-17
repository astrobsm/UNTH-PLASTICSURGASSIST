import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import SurgeryBookingEnhanced from '../components/SurgeryBookingEnhanced';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  User, 
  AlertCircle, 
  CheckCircle, 
  Download,
  Plus,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { 
  schedulingService, 
  WardRound, 
  ClinicSession, 
  SurgeryBooking,
  WardRoundPatient,
  ClinicAppointment,
  OperationList,
  ClinicTaskType,
  ClinicTaskAssignment
} from '../services/schedulingService';

type SchedulingTab = 'ward_rounds' | 'clinics' | 'surgery';

export default function Scheduling() {
  const [activeTab, setActiveTab] = useState<SchedulingTab>('ward_rounds');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [wardRounds, setWardRounds] = useState<WardRound[]>([]);
  const [clinics, setClinics] = useState<ClinicSession[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryBooking[]>([]);
  const [showWardRoundForm, setShowWardRoundForm] = useState(false);
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [showSurgeryForm, setShowSurgeryForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSchedulingData();
  }, [selectedDate]);

  const loadSchedulingData = async () => {
    setLoading(true);
    try {
      const [wardRoundsData, clinicsData, surgeriesData] = await Promise.all([
        schedulingService.getWardRounds(selectedDate),
        schedulingService.getClinicSessions(selectedDate),
        schedulingService.getSurgeryBookings(selectedDate)
      ]);
      
      setWardRounds(wardRoundsData);
      setClinics(clinicsData);
      setSurgeries(surgeriesData);
    } catch (error) {
      console.error('Error loading scheduling data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateOperationList = async () => {
    try {
      const operationList = await schedulingService.generateOperationList(selectedDate, 'Main Theatre Complex');
      await schedulingService.generateOperationListPDF(operationList);
    } catch (error) {
      console.error('Error generating operation list:', error);
    }
  };

  const getWeekDates = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const TabButton = ({ tab, label, icon: Icon }: { tab: SchedulingTab; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
        activeTab === tab
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Scheduling Management</h1>
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(parseISO(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Select schedule date"
            />
            <button
              onClick={generateOperationList}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Operation List PDF</span>
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center space-x-2 mb-6 overflow-x-auto">
          {getWeekDates().map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="text-xs">{format(date, 'EEE')}</div>
              <div>{format(date, 'd')}</div>
            </button>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4">
          <TabButton tab="ward_rounds" label="Ward Rounds" icon={Users} />
          <TabButton tab="clinics" label="Clinics" icon={MapPin} />
          <TabButton tab="surgery" label="Surgery" icon={Clock} />
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'ward_rounds' && (
        <WardRoundsSection 
          wardRounds={wardRounds}
          selectedDate={selectedDate}
          onRefresh={loadSchedulingData}
          showForm={showWardRoundForm}
          setShowForm={setShowWardRoundForm}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
        />
      )}

      {activeTab === 'clinics' && (
        <ClinicsSection 
          clinics={clinics}
          selectedDate={selectedDate}
          onRefresh={loadSchedulingData}
          showForm={showClinicForm}
          setShowForm={setShowClinicForm}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
        />
      )}

      {activeTab === 'surgery' && (
        <SurgeryBookingEnhanced 
          selectedDate={selectedDate}
          onRefresh={loadSchedulingData}
        />
      )}
    </div>
  );
}

// Ward Rounds Section Component
const WardRoundsSection = ({ 
  wardRounds, 
  selectedDate, 
  onRefresh, 
  showForm, 
  setShowForm, 
  editingItem, 
  setEditingItem 
}: any) => {
  const [formData, setFormData] = useState({
    ward_name: '',
    start_time: '08:00',
    end_time: '10:00',
    consultant: '',
    registrar: '',
    intern: '',
    notes: '',
    patients: []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await schedulingService.createWardRound({
        date: selectedDate,
        ...formData,
        status: 'scheduled'
      });
      setShowForm(false);
      setFormData({
        ward_name: '',
        start_time: '08:00',
        end_time: '10:00',
        consultant: '',
        registrar: '',
        intern: '',
        notes: '',
        patients: []
      });
      onRefresh();
    } catch (error) {
      console.error('Error creating ward round:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Ward Rounds - {format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Ward Round</span>
        </button>
      </div>

      {/* Ward Rounds List */}
      <div className="space-y-4">
  {wardRounds.map((round: WardRound) => (
          <div key={round.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getStatusIcon(round.status)}
                <div>
                  <h3 className="font-semibold text-gray-900">{round.ward_name}</h3>
                  <p className="text-sm text-gray-600">{round.start_time} - {round.end_time}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-600 hover:text-blue-600 transition-colors" title="View ward round details" aria-label="View ward round details">
                  <Eye className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-600 hover:text-green-600 transition-colors" title="Edit ward round" aria-label="Edit ward round">
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Consultant:</span>
                <p className="text-sm text-gray-900">{round.consultant}</p>
              </div>
              {round.registrar && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Registrar:</span>
                  <p className="text-sm text-gray-900">{round.registrar}</p>
                </div>
              )}
              {round.intern && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Intern:</span>
                  <p className="text-sm text-gray-900">{round.intern}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {round.patients.length} patients • {round.patients.filter((p: WardRoundPatient) => p.seen).length} seen
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                round.status === 'completed' ? 'bg-green-100 text-green-800' :
                round.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                round.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {round.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Ward Round Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Ward Round</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ward Name</label>
                  <input
                    type="text"
                    value={formData.ward_name}
                    onChange={(e) => setFormData({ ...formData, ward_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Ward Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consultant</label>
                  <input
                    type="text"
                    value={formData.consultant}
                    onChange={(e) => setFormData({ ...formData, consultant: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Consultant"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Start Time"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="End Time"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registrar (Optional)</label>
                  <input
                    type="text"
                    value={formData.registrar}
                    onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Registrar (Optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intern (Optional)</label>
                  <input
                    type="text"
                    value={formData.intern}
                    onChange={(e) => setFormData({ ...formData, intern: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Intern (Optional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  title="Notes"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Schedule Ward Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Clinics Section Component
const ClinicsSection = ({ 
  clinics, 
  selectedDate, 
  onRefresh, 
  showForm, 
  setShowForm, 
  editingItem, 
  setEditingItem 
}: any) => {
  const [formData, setFormData] = useState({
    clinic_type: 'general_plastic',
    location: '',
    start_time: '08:00',
    end_time: '17:00',
    consultant: '',
    max_patients: 20,
    notes: '',
    task_assignments: [] as any[]
  });

  const [newTask, setNewTask] = useState({
    task_type: 'clerking_new_patients' as any,
    task_description: '',
    assigned_to: '',
    assigned_role: 'registrar' as any,
    priority: 'medium' as any,
    estimated_duration_minutes: 30
  });

  const clinicTypes = [
    { value: 'general_plastic', label: 'General Plastic Surgery' },
    { value: 'reconstructive', label: 'Reconstructive Surgery' },
    { value: 'aesthetic', label: 'Aesthetic Surgery' },
    { value: 'hand_surgery', label: 'Hand Surgery' },
    { value: 'burn_clinic', label: 'Burn Clinic' },
    { value: 'follow_up', label: 'Follow-up Clinic' }
  ];

  const taskTypes = [
    { value: 'surgery_scheduling', label: 'Surgery Scheduling' },
    { value: 'clerking_new_patients', label: 'Clerking New Patients' },
    { value: 'follow_up_old_patients', label: 'Follow-up Old Patients' },
    { value: 'wound_dressing_supervision', label: 'Wound Dressing Supervision' },
    { value: 'intralesional_injection', label: 'Intralesional Triamcinolone Injection' },
    { value: 'prescription_writing', label: 'Prescription Writing' },
    { value: 'surgical_shopping_list', label: 'Surgical Shopping List' },
    { value: 'documentation', label: 'Documentation' }
  ];

  const roleOptions = [
    { value: 'consultant', label: 'Consultant' },
    { value: 'senior_registrar', label: 'Senior Registrar' },
    { value: 'registrar', label: 'Registrar' },
    { value: 'house_officer', label: 'House Officer' }
  ];

  const addTask = () => {
    if (!newTask.task_description || !newTask.assigned_to) {
      alert('Please fill in task description and assign to a doctor');
      return;
    }

    const task = {
      id: `task_${Date.now()}`,
      ...newTask,
      status: 'pending',
      completed_at: undefined,
      notes: ''
    };

    setFormData(prev => ({
      ...prev,
      task_assignments: [...prev.task_assignments, task]
    }));

    setNewTask({
      task_type: 'clerking_new_patients',
      task_description: '',
      assigned_to: '',
      assigned_role: 'registrar',
      priority: 'medium',
      estimated_duration_minutes: 30
    });
  };

  const removeTask = (taskId: string) => {
    setFormData(prev => ({
      ...prev,
      task_assignments: prev.task_assignments.filter((t: any) => t.id !== taskId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await schedulingService.createClinicSession({
        date: selectedDate,
        ...formData,
        clinic_type: formData.clinic_type as any,
        appointments: [],
        task_assignments: formData.task_assignments,
        status: 'scheduled'
      });
      setShowForm(false);
      setFormData({
        clinic_type: 'general_plastic',
        location: '',
        start_time: '08:00',
        end_time: '17:00',
        consultant: '',
        max_patients: 20,
        notes: '',
        task_assignments: []
      });
      onRefresh();
    } catch (error) {
      console.error('Error creating clinic session:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Clinic Sessions - {format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Clinic Session</span>
        </button>
      </div>

      {/* Clinic Sessions List */}
      <div className="space-y-4">
  {clinics.map((clinic: ClinicSession) => (
          <div key={clinic.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {clinicTypes.find(t => t.value === clinic.clinic_type)?.label}
                  </h3>
                  <p className="text-sm text-gray-600">{clinic.location}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-600 hover:text-blue-600 transition-colors" title="View clinic session details" aria-label="View clinic session details">
                  <Eye className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-600 hover:text-green-600 transition-colors" title="Edit clinic session" aria-label="Edit clinic session">
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Time:</span>
                <p className="text-sm text-gray-900">{clinic.start_time} - {clinic.end_time}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Consultant:</span>
                <p className="text-sm text-gray-900">{clinic.consultant}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Capacity:</span>
                <p className="text-sm text-gray-900">{clinic.appointments.length}/{clinic.max_patients}</p>
              </div>
            </div>

            {/* Task Assignments Display */}
            {clinic.task_assignments && clinic.task_assignments.length > 0 && (
              <div className="mb-3 border-l-4 border-blue-500 pl-3">
                <span className="text-sm font-medium text-gray-700">Assigned Tasks ({clinic.task_assignments.length}):</span>
                <div className="mt-2 space-y-1">
                  {clinic.task_assignments.map((task: any, idx: number) => (
                    <div key={idx} className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1">
                      <span className="font-medium">{task.task_type.replace(/_/g, ' ').toUpperCase()}</span>
                      {' → '}
                      <span className="text-blue-700">{task.assigned_to}</span>
                      {' '}
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        task.assigned_role === 'consultant' ? 'bg-green-100 text-green-800' :
                        task.assigned_role === 'senior_registrar' ? 'bg-blue-100 text-blue-800' :
                        task.assigned_role === 'registrar' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        ({task.assigned_role.replace(/_/g, ' ')})
                      </span>
                      {task.task_description && (
                        <span className="text-gray-600 ml-1">- {task.task_description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {clinic.appointments.filter((a: ClinicAppointment) => a.status === 'completed').length} completed appointments
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                clinic.status === 'completed' ? 'bg-green-100 text-green-800' :
                clinic.status === 'active' ? 'bg-blue-100 text-blue-800' :
                clinic.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {clinic.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Clinic Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Clinic Session</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Type</label>
                  <select
                    value={formData.clinic_type}
                    onChange={(e) => setFormData({ ...formData, clinic_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Clinic Type"
                    required
                  >
                    {clinicTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Location"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Start Time"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="End Time"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consultant</label>
                  <input
                    type="text"
                    value={formData.consultant}
                    onChange={(e) => setFormData({ ...formData, consultant: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Consultant"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Patients</label>
                  <input
                    type="number"
                    value={formData.max_patients}
                    onChange={(e) => setFormData({ ...formData, max_patients: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Max Patients"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Task Assignment Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Clinic Task Assignments</h4>
                
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Task Type</label>
                      <select
                        value={newTask.task_type}
                        onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {taskTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Assign To (Doctor Name)</label>
                      <input
                        type="text"
                        value={newTask.assigned_to}
                        onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                        placeholder="Enter doctor name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={newTask.assigned_role}
                        onChange={(e) => setNewTask({ ...newTask, assigned_role: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {roleOptions.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Duration (minutes)</label>
                      <input
                        type="number"
                        value={newTask.estimated_duration_minutes}
                        onChange={(e) => setNewTask({ ...newTask, estimated_duration_minutes: parseInt(e.target.value) || 30 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        min="5"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Task Description</label>
                      <input
                        type="text"
                        value={newTask.task_description}
                        onChange={(e) => setNewTask({ ...newTask, task_description: e.target.value })}
                        placeholder="E.g., Clerk 5 new trauma patients"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addTask}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Add Task Assignment
                  </button>
                </div>

                {/* Task Assignments List */}
                {formData.task_assignments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-700">Assigned Tasks ({formData.task_assignments.length}):</p>
                    {formData.task_assignments.map((task: any) => (
                      <div key={task.id} className="flex items-start justify-between bg-white border border-gray-200 rounded-md p-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              task.assigned_role === 'consultant' ? 'bg-green-100 text-green-800' :
                              task.assigned_role === 'senior_registrar' ? 'bg-blue-100 text-blue-800' :
                              task.assigned_role === 'registrar' ? 'bg-purple-100 text-purple-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {roleOptions.find(r => r.value === task.assigned_role)?.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {task.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{taskTypes.find(t => t.value === task.task_type)?.label}</p>
                          <p className="text-xs text-gray-600">{task.task_description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Assigned to: <span className="font-medium">{task.assigned_to}</span> • Duration: {task.estimated_duration_minutes} min
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTask(task.id)}
                          className="ml-3 text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  title="Notes"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Schedule Clinic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Surgery Section Component
const SurgerySection = ({ 
  surgeries, 
  selectedDate, 
  onRefresh, 
  showForm, 
  setShowForm, 
  editingItem, 
  setEditingItem 
}: any) => {
  // New booking form focused on requested fields
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    hospital_number: '',
    patient_age: undefined as number | undefined,
    patient_gender: '',
    indication: '',
    ward: '',
    procedure_name: '',
    anaesthesia_type: 'general' as 'general' | 'regional' | 'local' | 'sedation',
    remarks: [] as string[],
    date: format(selectedDate, 'yyyy-MM-dd'),
    surgeon_team: [] as string[],
    consultants: [] as string[],
    senior_registrars: [] as string[],
    registrars: [] as string[],
    house_officers: [] as string[],
    operation_site_image: undefined as string | undefined,
    // retained internal scheduling essentials
    start_time: '08:00',
    estimated_duration_minutes: 120,
    theatre_number: '',
    primary_surgeon: '',
  });

  const [newSurgeonName, setNewSurgeonName] = useState('');
  const [newConsultant, setNewConsultant] = useState('');
  const [newSeniorRegistrar, setNewSeniorRegistrar] = useState('');
  const [newRegistrar, setNewRegistrar] = useState('');
  const [newHouseOfficer, setNewHouseOfficer] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [manualEntry, setManualEntry] = useState(false);

  useEffect(() => {
    // Load patients from API for selection
    const loadPatients = async () => {
      try {
        const list = await patientService.getAllPatients();
        setPatients(list);
      } catch (err) {
        console.error('Failed to load patients', err);
      }
    };
    loadPatients();
  }, []);

  // Update date field when selectedDate changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
  }, [selectedDate]);

  const remarkOptions = [
    'Crossmatch Blood',
    'Use Diathermy',
    'Need Tourniquet',
    'Need Dermatome',
    'Need Montrel Mattress',
    'Need Stirrup',
    'Need Armored ETT'
  ];

  const handlePatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    if (!pid) return;
    const patient = patients.find((p) => String(p.id) === pid);
    if (patient) {
      // Compute age
      let age: number | undefined = undefined;
      try {
        const dob = new Date(patient.dob);
        if (!isNaN(dob.getTime())) {
          const diff = Date.now() - dob.getTime();
          age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }
      } catch {}
      setFormData(prev => ({
        ...prev,
        patient_id: String(patient.id),
        patient_name: `${patient.first_name} ${patient.last_name}`,
        hospital_number: patient.hospital_number,
        patient_age: age,
        patient_gender: patient.sex,
        ward: patient.ward_id || '',
      }));
    }
  };

  const toggleRemark = (remark: string) => {
    setFormData(prev => ({
      ...prev,
      remarks: prev.remarks.includes(remark)
        ? prev.remarks.filter(r => r !== remark)
        : [...prev.remarks, remark]
    }));
  };

  const addSurgeonToTeam = () => {
    if (newSurgeonName.trim()) {
      setFormData(prev => ({
        ...prev,
        surgeon_team: [...prev.surgeon_team, newSurgeonName.trim()],
        primary_surgeon: prev.primary_surgeon || newSurgeonName.trim() // first entry becomes primary if unset
      }));
      setNewSurgeonName('');
    }
  };

  const removeSurgeon = (name: string) => {
    setFormData(prev => {
      const updated = prev.surgeon_team.filter(s => s !== name);
      return {
        ...prev,
        surgeon_team: updated,
        primary_surgeon: prev.primary_surgeon === name ? (updated[0] || '') : prev.primary_surgeon
      };
    });
  };

  // Hierarchical team management functions
  const addConsultant = () => {
    if (newConsultant.trim()) {
      setFormData(prev => ({
        ...prev,
        consultants: [...prev.consultants, newConsultant.trim()],
        primary_surgeon: prev.primary_surgeon || newConsultant.trim()
      }));
      setNewConsultant('');
    }
  };

  const removeConsultant = (name: string) => {
    setFormData(prev => ({
      ...prev,
      consultants: prev.consultants.filter(c => c !== name),
      primary_surgeon: prev.primary_surgeon === name ? '' : prev.primary_surgeon
    }));
  };

  const addSeniorRegistrar = () => {
    if (newSeniorRegistrar.trim()) {
      setFormData(prev => ({
        ...prev,
        senior_registrars: [...prev.senior_registrars, newSeniorRegistrar.trim()]
      }));
      setNewSeniorRegistrar('');
    }
  };

  const removeSeniorRegistrar = (name: string) => {
    setFormData(prev => ({
      ...prev,
      senior_registrars: prev.senior_registrars.filter(sr => sr !== name)
    }));
  };

  const addRegistrar = () => {
    if (newRegistrar.trim()) {
      setFormData(prev => ({
        ...prev,
        registrars: [...prev.registrars, newRegistrar.trim()]
      }));
      setNewRegistrar('');
    }
  };

  const removeRegistrar = (name: string) => {
    setFormData(prev => ({
      ...prev,
      registrars: prev.registrars.filter(r => r !== name)
    }));
  };

  const addHouseOfficer = () => {
    if (newHouseOfficer.trim()) {
      setFormData(prev => ({
        ...prev,
        house_officers: [...prev.house_officers, newHouseOfficer.trim()]
      }));
      setNewHouseOfficer('');
    }
  };

  const removeHouseOfficer = (name: string) => {
    setFormData(prev => ({
      ...prev,
      house_officers: prev.house_officers.filter(ho => ho !== name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Updated validation: at least one remark OR at least one consultant
      const totalStaff = formData.consultants.length + formData.senior_registrars.length + 
                        formData.registrars.length + formData.house_officers.length;
      
      if (formData.remarks.length === 0 && formData.consultants.length === 0) {
        alert('Please add at least one remark OR at least one consultant before booking.');
        return;
      }
      // Map to booking shape; keep optional fields for compatibility
      const bookingPayload: any = {
        date: selectedDate,
        theatre_number: formData.theatre_number || 'TBD',
        start_time: formData.start_time,
        estimated_end_time: '',
        primary_surgeon: formData.primary_surgeon,
        anaesthetist: '',
        scrub_nurse: '',
        circulating_nurse: '',
        patient_id: formData.patient_id,
        patient_name: formData.patient_name,
        hospital_number: formData.hospital_number,
        patient_age: formData.patient_age,
        patient_gender: formData.patient_gender,
        indication: formData.indication,
        ward: formData.ward,
        procedure_name: formData.procedure_name,
        procedure_code: '',
        urgency: 'elective' as 'elective',
        anaesthesia_type: formData.anaesthesia_type,
        estimated_duration_minutes: formData.estimated_duration_minutes,
        status: 'scheduled',
        remarks: formData.remarks,
        surgeon_team: formData.surgeon_team,
        consultants: formData.consultants,
        senior_registrars: formData.senior_registrars,
        registrars: formData.registrars,
        house_officers: formData.house_officers,
        operation_site_image: formData.operation_site_image,
        special_requirements: [],
        equipment_needed: [],
        implants_needed: [],
        allergies: [],
        medical_conditions: [],
        pre_op_checklist_completed: false,
        consent_obtained: false,
        notes: ''
      };
      const id = await schedulingService.createSurgeryBooking(bookingPayload);
      console.log('Surgery booking created:', id, bookingPayload);
      setShowForm(false);
      onRefresh();
      // Reset minimal form
      setFormData(prev => ({
        ...prev,
        patient_id: '',
        patient_name: '',
        hospital_number: '',
        patient_age: undefined,
        patient_gender: '',
        indication: '',
        ward: '',
        procedure_name: '',
        remarks: [],
        surgeon_team: [],
        consultants: [],
        senior_registrars: [],
        registrars: [],
        house_officers: [],
        operation_site_image: undefined,
        primary_surgeon: ''
      }));
    } catch (error) {
      console.error('Error creating surgery booking:', error);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return 'text-red-600';
      case 'urgent':
        return 'text-orange-600';
      default:
        return 'text-green-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Surgery Schedule - {format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Book Surgery</span>
        </button>
      </div>

      {/* Surgery List */}
      <div className="space-y-4">
  {surgeries.map((surgery: SurgeryBooking) => (
          <div key={surgery.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{surgery.procedure_name}</h3>
                  <p className="text-sm text-gray-600">Theatre {surgery.theatre_number} • {surgery.start_time}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${getUrgencyColor(surgery.urgency)}`}>
                  {surgery.urgency.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Patient:</span>
                <p className="text-sm text-gray-900">{surgery.patient_name}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Primary Surgeon:</span>
                <p className="text-sm text-gray-900">{surgery.primary_surgeon}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Duration:</span>
                <p className="text-sm text-gray-900">{surgery.estimated_duration_minutes} minutes</p>
              </div>
            </div>

            {/* Hierarchical Surgical Team Display */}
            {((surgery.consultants && surgery.consultants.length > 0) ||
              (surgery.senior_registrars && surgery.senior_registrars.length > 0) ||
              (surgery.registrars && surgery.registrars.length > 0) ||
              (surgery.house_officers && surgery.house_officers.length > 0)) && (
              <div className="mb-3 border-l-4 border-green-500 pl-3">
                <span className="text-sm font-medium text-gray-700">Surgical Team:</span>
                <div className="mt-2 space-y-2">
                  {surgery.consultants && surgery.consultants.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-green-700">Consultants:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {surgery.consultants.map((c, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-green-100 border border-green-300 text-green-800 font-medium"
                          >
                            {c}{c === surgery.primary_surgeon ? ' ★' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {surgery.senior_registrars && surgery.senior_registrars.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-blue-700">Senior Registrars:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {surgery.senior_registrars.map((sr, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-800"
                          >
                            {sr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {surgery.registrars && surgery.registrars.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-purple-700">Registrars:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {surgery.registrars.map((r, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-purple-100 border border-purple-300 text-purple-800"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {surgery.house_officers && surgery.house_officers.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-orange-700">House Officers:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {surgery.house_officers.map((ho, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-800"
                          >
                            {ho}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {surgery.surgeon_team && surgery.surgeon_team.length > 0 && (
              <div className="mb-3">
                <span className="text-sm font-medium text-gray-500">Additional Team Members:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {surgery.surgeon_team.map((member, idx) => (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded-full border ${member === surgery.primary_surgeon ? 'bg-green-100 border-green-300 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-800'}`}
                      aria-label={member === surgery.primary_surgeon ? 'Primary Surgeon' : 'Assistant Surgeon'}
                    >
                      {member}{member === surgery.primary_surgeon ? ' (Primary)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {surgery.remarks && surgery.remarks.length > 0 && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Remarks:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {surgery.remarks.map((remark, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-300"
                      aria-label="Surgery preparation remark"
                    >
                      {remark}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {surgery.anaesthesia_type} anaesthesia
                </span>
                {surgery.pre_op_checklist_completed && (
                  <span className="flex items-center text-sm text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Pre-op completed
                  </span>
                )}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                surgery.status === 'completed' ? 'bg-green-100 text-green-800' :
                surgery.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                surgery.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {surgery.status ? surgery.status.replace('_', ' ').toUpperCase() : 'SCHEDULED'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Surgery Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Book Surgery</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient</label>
                  <select
                    value={formData.patient_id}
                    onChange={handlePatientSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Select Patient"
                    required
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.hospital_number} - {p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                  {patients.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No patients found. You can register a patient in Patients page, or add sample data.</p>
                  )}
                  <div className="mt-2 flex items-center space-x-2">
                    <input id="manualEntry" type="checkbox" checked={manualEntry} onChange={(e) => setManualEntry(e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
                    <label htmlFor="manualEntry" className="text-sm text-gray-700">Enter patient details manually</label>
                  </div>
                  {patients.length === 0 && (
                    <button type="button" onClick={() => window.open('/add-test-patients.html', '_blank')} className="mt-2 text-blue-600 hover:underline text-sm">Open Add Test Patients</button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PT-Number</label>
                  <input
                    type="text"
                    value={formData.hospital_number}
                    readOnly={!manualEntry}
                    onChange={(e) => setFormData({ ...formData, hospital_number: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${manualEntry ? 'border-gray-300' : 'border-gray-200 bg-gray-50'}`}
                    title="PT-Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                  <input
                    type="text"
                    value={formData.patient_name}
                    readOnly={!manualEntry}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${manualEntry ? 'border-gray-300' : 'border-gray-2 00 bg-gray-50'}`}
                    title="Patient Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input
                    type="text"
                    value={formData.patient_age !== undefined ? formData.patient_age : ''}
                    readOnly={!manualEntry}
                    onChange={(e) => setFormData({ ...formData, patient_age: e.target.value ? parseInt(e.target.value) : undefined })}
                    className={`w-full px-3 py-2 border rounded-md ${manualEntry ? 'border-gray-300' : 'border-gray-200 bg-gray-50'}`}
                    title="Age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  {manualEntry ? (
                    <select
                      value={formData.patient_gender}
                      onChange={(e) => setFormData({ ...formData, patient_gender: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      title="Gender"
                    >
                      <option value="">-- Select Gender --</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.patient_gender}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md"
                      title="Gender"
                    />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
                  <textarea
                    value={formData.indication}
                    onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Indication"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ward</label>
                  <input
                    type="text"
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Ward"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name of Procedure</label>
                  <input
                    type="text"
                    value={formData.procedure_name}
                    onChange={(e) => setFormData({ ...formData, procedure_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Name of Procedure"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anaesthesia Type</label>
                  <select
                    value={formData.anaesthesia_type}
                    onChange={(e) => setFormData({ ...formData, anaesthesia_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Anaesthesia Type"
                    required
                  >
                    <option value="general">General</option>
                    <option value="regional">Regional</option>
                    <option value="local">Local</option>
                    <option value="sedation">Sedation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Date"
                    required
                  />
                </div>
              </div>

              {/* Remarks Checklist */}
              <fieldset className="border border-gray-200 rounded-md p-4">
                <legend className="text-sm font-semibold text-gray-700 px-2">Remarks (Tick all needed)</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {remarkOptions.map(r => (
                    <label key={r} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.remarks.includes(r)}
                        onChange={() => toggleRemark(r)}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Hierarchical Surgical Team */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-800">Surgical Team</h3>
                
                {/* Consultants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consultants</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newConsultant}
                      onChange={(e) => setNewConsultant(e.target.value)}
                      placeholder="Add consultant name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={addConsultant}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >Add</button>
                  </div>
                  {formData.consultants.length > 0 && (
                    <ul className="space-y-1">
                      {formData.consultants.map((c, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-2 py-1 text-sm">
                          <span className="font-medium">{c}{formData.primary_surgeon === c ? ' (Primary)' : ''}</span>
                          <button
                            type="button"
                            onClick={() => removeConsultant(c)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Senior Registrars */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senior Registrars</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newSeniorRegistrar}
                      onChange={(e) => setNewSeniorRegistrar(e.target.value)}
                      placeholder="Add senior registrar name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={addSeniorRegistrar}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >Add</button>
                  </div>
                  {formData.senior_registrars.length > 0 && (
                    <ul className="space-y-1">
                      {formData.senior_registrars.map((sr, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-2 py-1 text-sm">
                          <span>{sr}</span>
                          <button
                            type="button"
                            onClick={() => removeSeniorRegistrar(sr)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Registrars */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registrars</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newRegistrar}
                      onChange={(e) => setNewRegistrar(e.target.value)}
                      placeholder="Add registrar name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={addRegistrar}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >Add</button>
                  </div>
                  {formData.registrars.length > 0 && (
                    <ul className="space-y-1">
                      {formData.registrars.map((r, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded px-2 py-1 text-sm">
                          <span>{r}</span>
                          <button
                            type="button"
                            onClick={() => removeRegistrar(r)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* House Officers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">House Officers</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newHouseOfficer}
                      onChange={(e) => setNewHouseOfficer(e.target.value)}
                      placeholder="Add house officer name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={addHouseOfficer}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    >Add</button>
                  </div>
                  {formData.house_officers.length > 0 && (
                    <ul className="space-y-1">
                      {formData.house_officers.map((ho, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded px-2 py-1 text-sm">
                          <span>{ho}</span>
                          <button
                            type="button"
                            onClick={() => removeHouseOfficer(ho)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Legacy Team of Surgeons (kept for backward compatibility) */}
                <div className="border-t pt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Team Members (Legacy)</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newSurgeonName}
                      onChange={(e) => setNewSurgeonName(e.target.value)}
                      placeholder="Add team member"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={addSurgeonToTeam}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >Add</button>
                  </div>
                  {formData.surgeon_team.length > 0 && (
                    <ul className="space-y-1">
                      {formData.surgeon_team.map((s, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm">
                          <span>{s}{formData.primary_surgeon === s ? ' (Primary)' : ''}</span>
                          <button
                            type="button"
                            onClick={() => removeSurgeon(s)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Operation Site Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Operation Site Image (Optional)
                  <span className="ml-2 text-xs text-gray-500">This will not appear in PDF</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Image file size must be less than 5MB');
                        e.target.value = '';
                        return;
                      }
                      // Convert to base64
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData(prev => ({
                          ...prev,
                          operation_site_image: reader.result as string
                        }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {formData.operation_site_image && (
                  <div className="mt-2 relative">
                    <img
                      src={formData.operation_site_image}
                      alt="Operation site preview"
                      className="max-w-xs max-h-48 rounded-md border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, operation_site_image: undefined }))}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                      title="Remove image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Upload a photo of the operation site. Max file size: 5MB. Accepted formats: JPG, PNG, GIF, WebP</p>
              </div>

              {/* Internal scheduling essentials (optional / advanced) */}
              <details className="border border-gray-200 rounded-md p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">Advanced Scheduling Fields</summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      title="Start Time"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      value={formData.estimated_duration_minutes}
                      onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) })}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      title="Duration (mins)"
                      min={30}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Theatre Number</label>
                    <input
                      type="text"
                      value={formData.theatre_number}
                      onChange={(e) => setFormData({ ...formData, theatre_number: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      title="Theatre Number"
                    />
                  </div>
                </div>
              </details>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <div className="flex flex-col items-end space-y-1">
                  {(!formData.patient_id || !formData.procedure_name || !formData.primary_surgeon) && (
                    <p className="text-xs text-red-600">Patient, procedure and a primary surgeon are required.</p>
                  )}
                  {(formData.remarks.length === 0 && formData.surgeon_team.length <= 1) && (
                    <p className="text-xs text-orange-600">Add a remark or at least two surgeons.</p>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={
                      !formData.patient_id ||
                      !formData.procedure_name ||
                      !formData.primary_surgeon ||
                      (formData.remarks.length === 0 && formData.surgeon_team.length <= 1)
                    }
                  >
                    Book Surgery
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};