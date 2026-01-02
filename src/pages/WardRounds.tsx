import React, { useState, useEffect } from 'react';
import { Calendar, User, Activity, FileText, Plus, Search, Filter, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import WardRoundForm from '../components/WardRoundForm';
import { wardRoundsService, WardRound } from '../services/wardRoundsService';
import { db } from '../db/database';
import { format } from 'date-fns';

interface Patient {
  id: string;
  name: string;
  hospital_number: string;
}

export default function WardRounds() {
  const [rounds, setRounds] = useState<WardRound[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedRound, setSelectedRound] = useState<WardRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'stable' | 'deteriorating' | 'critical'>('all');
  const [filterDate, setFilterDate] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roundsData, patientsData] = await Promise.all([
        wardRoundsService.getAllWardRounds(),
        db.patients.toArray()
      ]);
      setRounds(roundsData);
      setPatients(patientsData.map(p => ({
        id: p.id?.toString() || '',
        name: `${p.first_name} ${p.last_name}`,
        hospital_number: p.hospital_number
      })));
    } catch (error) {
      console.error('Error loading ward rounds data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = () => {
    setSelectedRound(null);
    setShowForm(true);
  };

  const handleEditRound = (round: WardRound) => {
    setSelectedRound(round);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedRound(null);
    loadData();
  };

  const handleDeleteRound = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this ward round entry?')) {
      try {
        await wardRoundsService.deleteRound(id);
        loadData();
      } catch (error) {
        console.error('Error deleting ward round:', error);
        alert('Failed to delete ward round entry');
      }
    }
  };

  const getFilteredRounds = () => {
    let filtered = rounds;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.clinical_status === filterStatus);
    }

    // Filter by date
    const now = new Date();
    if (filterDate !== 'all') {
      filtered = filtered.filter(r => {
        const roundDate = new Date(r.round_date);
        const diffTime = Math.abs(now.getTime() - roundDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (filterDate === 'today') return diffDays === 0;
        if (filterDate === 'week') return diffDays <= 7;
        if (filterDate === 'month') return diffDays <= 30;
        return true;
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(r => {
        const patient = patients.find(p => p.id === r.patient_id);
        const patientName = patient?.name.toLowerCase() || '';
        const hospitalNumber = patient?.hospital_number.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return patientName.includes(search) || 
               hospitalNumber.includes(search) ||
               r.chief_complaint.toLowerCase().includes(search);
      });
    }

    return filtered.sort((a, b) => new Date(b.round_date).getTime() - new Date(a.round_date).getTime());
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'stable': return 'bg-green-100 text-green-800';
      case 'improving': return 'bg-blue-100 text-blue-800';
      case 'deteriorating': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRounds = rounds.filter(r => {
      const roundDate = new Date(r.round_date);
      roundDate.setHours(0, 0, 0, 0);
      return roundDate.getTime() === today.getTime();
    });

    return {
      total: rounds.length,
      today: todayRounds.length,
      stable: rounds.filter(r => r.clinical_status === 'stable').length,
      critical: rounds.filter(r => r.clinical_status === 'critical').length,
      deteriorating: rounds.filter(r => r.clinical_status === 'deteriorating').length
    };
  };

  const stats = getStats();
  const filteredRounds = getFilteredRounds();

  if (showForm) {
    return (
      <WardRoundForm
        round={selectedRound}
        onClose={handleCloseForm}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            Ward Rounds
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Daily patient reviews and clinical updates</p>
        </div>
        <button
          onClick={handleCreateRound}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          New Ward Round
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Total Rounds</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Today</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.today}</p>
            </div>
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Stable</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.stable}</p>
            </div>
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Deteriorating</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.deteriorating}</p>
            </div>
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Critical</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.critical}</p>
            </div>
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="form-select"
          >
            <option value="all">All Status</option>
            <option value="stable">Stable</option>
            <option value="deteriorating">Deteriorating</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value as any)}
            className="form-select"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Ward Rounds List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">Loading ward rounds...</div>
        ) : filteredRounds.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <Activity className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-base sm:text-lg font-medium">No ward rounds found</p>
            <p className="text-sm mt-2">Create your first ward round entry to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRounds.map((round) => {
              const patient = patients.find(p => p.id === round.patient_id);
              return (
                <div
                  key={round.id}
                  className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer active:bg-gray-100"
                  onClick={() => handleEditRound(round)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {patient?.name || 'Unknown Patient'}
                        </h3>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {patient?.hospital_number}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(round.clinical_status)}`}>
                          {round.clinical_status.charAt(0).toUpperCase() + round.clinical_status.slice(1)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{format(new Date(round.round_date), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{round.reviewed_by}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{round.chief_complaint}</span>
                        </div>
                      </div>

                      {round.assessment_notes && (
                        <p className="mt-2 text-xs sm:text-sm text-gray-700 line-clamp-2">
                          {round.assessment_notes}
                        </p>
                      )}

                      {round.plan_changes && round.plan_changes.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm">
                          <span className="font-medium text-gray-700">Plan Changes:</span>
                          <span className="text-gray-600">{round.plan_changes.length} updates</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRound(round.id!);
                      }}
                      className="self-start sm:ml-4 text-red-600 hover:text-red-800 text-sm px-3 py-1.5 border border-red-200 rounded-lg sm:border-0 sm:p-0"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
