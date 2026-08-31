import React, { useState, useEffect } from 'react';
import { Droplet, Plus, Eye, AlertCircle, Activity, Calendar } from 'lucide-react';
import BloodTransfusionForm from '../components/BloodTransfusionForm';
import { bloodTransfusionService, BloodTransfusion } from '../services/bloodTransfusionService';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
import { format } from 'date-fns';

export default function BloodTransfusionPage() {
  const [transfusions, setTransfusions] = useState<BloodTransfusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTransfusionId, setSelectedTransfusionId] = useState<string | undefined>();
  const [prefilledPatientId, setPrefilledPatientId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<'all' | 'planned' | 'in-progress' | 'completed' | 'stopped'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useOnSelectedPatient((p) => {
    setPrefilledPatientId(String(p.id));
    setSelectedTransfusionId(undefined);
    setShowForm(true);
  });

  useEffect(() => {
    loadTransfusions();
  }, []);

  const loadTransfusions = async () => {
    try {
      setLoading(true);
      const data = await bloodTransfusionService.getAllTransfusions();
      setTransfusions(data);
    } catch (error) {
      console.error('Error loading transfusions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewTransfusion = () => {
    setSelectedTransfusionId(undefined);
    setShowForm(true);
  };

  const handleEditTransfusion = (id: string) => {
    setSelectedTransfusionId(id);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedTransfusionId(undefined);
  };

  const handleSaveForm = () => {
    loadTransfusions();
  };

  const filteredTransfusions = transfusions.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesSearch = !searchTerm || 
      t.hospital_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.indication?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3 flex-wrap">
              <Droplet className="h-8 w-8 text-red-600 flex-shrink-0" />
              <span>Blood Transfusion Module</span>
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive blood transfusion tracking, monitoring, and documentation
            </p>
          </div>
          <button
            onClick={handleNewTransfusion}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 flex-shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-5 w-5" />
            <span>New Transfusion</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by hospital number or indication..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Statuses</option>
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Planned</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-900">
                {transfusions.filter(t => t.status === 'planned').length}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">In Progress</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-900">
                {transfusions.filter(t => t.status === 'in-progress').length}
              </p>
            </div>
            <Activity className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Completed</p>
              <p className="text-lg sm:text-2xl font-bold text-green-900">
                {transfusions.filter(t => t.status === 'completed').length}
              </p>
            </div>
            <Droplet className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">With Complications</p>
              <p className="text-lg sm:text-2xl font-bold text-red-900">
                {transfusions.filter(t => t.adverse_events).length}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Transfusions List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      ) : filteredTransfusions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Droplet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No transfusions found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Start by creating a new transfusion record'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <button
              onClick={handleNewTransfusion}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>New Transfusion</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Indication
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Baseline Hb
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Units
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransfusions.map((transfusion) => (
                  <tr key={transfusion.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(transfusion.transfusion_date), 'MMM d, yyyy')}
                      {transfusion.start_time && (
                        <div className="text-xs text-gray-500">Started: {transfusion.start_time}</div>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{transfusion.hospital_number}</div>
                      {transfusion.urgent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Urgent
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-4 text-sm text-gray-900 max-w-xs truncate">
                      {transfusion.indication}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfusion.baseline_hb} g/dL
                      {transfusion.post_hb && (
                        <div className="text-xs text-green-600">Post: {transfusion.post_hb} g/dL</div>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfusion.total_units} unit(s)
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transfusion.status)}`}>
                        {transfusion.status.replace('-', ' ').toUpperCase()}
                      </span>
                      {transfusion.adverse_events && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Complications
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditTransfusion(transfusion.id!)}
                        className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfusion Form Modal */}
      {showForm && (
        <BloodTransfusionForm
          transfusionId={selectedTransfusionId}
          patientId={prefilledPatientId}
          onClose={() => { handleCloseForm(); setPrefilledPatientId(undefined); }}
          onSave={handleSaveForm}
        />
      )}
    </div>
  );
}
