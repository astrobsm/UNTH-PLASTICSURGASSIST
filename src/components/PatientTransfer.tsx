import React, { useState, useEffect } from 'react';
import { unthPatientService, PatientTransfer, Ward } from '../services/unthPatientService';

interface PatientTransferFormProps {
  patientId: string;
  currentWard?: string;
  onSuccess?: (transfer: PatientTransfer) => void;
  onCancel?: () => void;
}

export const PatientTransferForm: React.FC<PatientTransferFormProps> = ({
  patientId,
  currentWard,
  onSuccess,
  onCancel
}) => {
  const [transferData, setTransferData] = useState({
    patient_id: patientId,
    from_ward: currentWard || '',
    to_ward: '',
    from_bed: '',
    to_bed: '',
    transfer_type: 'ward_transfer' as PatientTransfer['transfer_type'],
    reason: '',
    authorized_by: '',
    receiving_team: ''
  });

  const [availableWards, setAvailableWards] = useState<Ward[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fromWardInfo, setFromWardInfo] = useState<Ward | null>(null);
  const [toWardInfo, setToWardInfo] = useState<Ward | null>(null);

  useEffect(() => {
    setAvailableWards(unthPatientService.getAvailableWards());
    
    if (currentWard) {
      const wardInfo = unthPatientService.getWardInfo(currentWard);
      setFromWardInfo(wardInfo || null);
    }
  }, [currentWard]);

  useEffect(() => {
    if (transferData.to_ward) {
      const wardInfo = unthPatientService.getWardInfo(transferData.to_ward);
      setToWardInfo(wardInfo || null);
    }
  }, [transferData.to_ward]);

  const handleInputChange = (field: string, value: any) => {
    setTransferData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const transfer = await unthPatientService.transferPatient(transferData);
      onSuccess?.(transfer);
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransferTypeLabel = (type: string) => {
    switch (type) {
      case 'ward_transfer': return 'Ward Transfer';
      case 'emergency_admission': return 'Emergency Admission';
      case 'clinic_admission': return 'Clinic Admission';
      case 'inter_hospital': return 'Inter-Hospital Transfer';
      default: return type;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Patient Transfer - UNTH</h2>
          <p className="text-sm text-gray-600 mt-1">
            Transfer patient between wards or admit from emergency/clinic
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Transfer Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transfer Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['ward_transfer', 'emergency_admission', 'clinic_admission', 'inter_hospital'] as const).map(type => (
                <label
                  key={type}
                  className={`relative flex items-center p-3 border rounded-lg cursor-pointer ${
                    transferData.transfer_type === type
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="transfer_type"
                    value={type}
                    checked={transferData.transfer_type === type}
                    onChange={(e) => handleInputChange('transfer_type', e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {getTransferTypeLabel(type)}
                    </div>
                  </div>
                  {transferData.transfer_type === type && (
                    <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Ward Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Ward/Location
              </label>
              <select
                value={transferData.from_ward}
                onChange={(e) => handleInputChange('from_ward', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                aria-label="From Ward/Location"
                required
              >
                <option value="">Select source location</option>
                <option value="em">Emergency Ward</option>
                <option value="sw1">Surgical Ward 1</option>
                <option value="sw2">Surgical Ward 2</option>
                <option value="mw">Medical Ward</option>
                <option value="icu">ICU</option>
                <option value="pw">Private Ward</option>
                <option value="clinic">Outpatient Clinic</option>
                <option value="theater">Operating Theater</option>
              </select>
              {fromWardInfo && (
                <p className="text-xs text-gray-500 mt-1">
                  Supervisor: {fromWardInfo.supervisor}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Ward *
              </label>
              <select
                value={transferData.to_ward}
                onChange={(e) => handleInputChange('to_ward', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                aria-label="To Ward"
                required
              >
                <option value="">Select destination ward</option>
                {availableWards.map(ward => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name} - {ward.currentOccupancy}/{ward.capacity} beds
                  </option>
                ))}
              </select>
              {toWardInfo && (
                <div className="text-xs text-gray-500 mt-1">
                  <p>Supervisor: {toWardInfo.supervisor}</p>
                  <p>Available beds: {toWardInfo.capacity - toWardInfo.currentOccupancy}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bed Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Bed Number
              </label>
              <input
                type="text"
                value={transferData.from_bed}
                onChange={(e) => handleInputChange('from_bed', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., A1, B5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Bed Number
              </label>
              <input
                type="text"
                value={transferData.to_bed}
                onChange={(e) => handleInputChange('to_bed', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., C3, D7"
              />
            </div>
          </div>

          {/* Transfer Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Transfer *
            </label>
            <textarea
              value={transferData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Describe the clinical reason for transfer..."
              required
            />
          </div>

          {/* Authorization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Authorized By *
              </label>
              <select
                value={transferData.authorized_by}
                onChange={(e) => handleInputChange('authorized_by', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                aria-label="Authorized By"
                required
              >
                <option value="">Select authorizing doctor</option>
                <option value="Prof. A. B. Chukwu">Prof. A. B. Chukwu</option>
                <option value="Dr. C. D. Okafor">Dr. C. D. Okafor</option>
                <option value="Dr. E. F. Adaeze">Dr. E. F. Adaeze</option>
                <option value="Dr. G. H. Emeka">Dr. G. H. Emeka</option>
                <option value="Dr. Registrar On Call">Dr. Registrar On Call</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receiving Team
              </label>
              <input
                type="text"
                value={transferData.receiving_team}
                onChange={(e) => handleInputChange('receiving_team', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., General Surgery Team"
              />
            </div>
          </div>

          {/* Transfer Checklist */}
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Transfer Checklist</h4>
            <div className="space-y-2 text-sm text-yellow-700">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" aria-label="Patient vital signs stable" />
                <span>Patient vital signs stable</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" aria-label="Medical records prepared" />
                <span>Medical records prepared</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" aria-label="Receiving team notified" />
                <span>Receiving team notified</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" aria-label="Family/next of kin informed" />
                <span>Family/next of kin informed</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" aria-label="Medications transferred" />
                <span>Medications transferred</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing Transfer...' : 'Initiate Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Transfer History Component
export const TransferHistory: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [transfers, setTransfers] = useState<PatientTransfer[]>([]);

  // In a real implementation, this would fetch from the database
  useEffect(() => {
    // Mock data for demonstration
    setTransfers([
      {
        id: '1',
        patient_id: patientId,
        from_ward: 'Emergency Ward',
        to_ward: 'Surgical Ward 1',
        transfer_type: 'emergency_admission',
        reason: 'Acute appendicitis requiring surgical intervention',
        authorized_by: 'Dr. C. D. Okafor',
        transfer_date: new Date('2024-01-15T10:30:00'),
        completion_date: new Date('2024-01-15T11:15:00'),
        status: 'completed',
        receiving_team: 'General Surgery Team'
      }
    ]);
  }, [patientId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">In Progress</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Pending</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Cancelled</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Transfer History</h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {transfers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transfer history available
          </div>
        ) : (
          transfers.map(transfer => (
            <div key={transfer.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">
                      {transfer.from_ward} → {transfer.to_ward}
                    </h4>
                    {getStatusBadge(transfer.status)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{transfer.reason}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    <p>Authorized by: {transfer.authorized_by}</p>
                    <p>Date: {transfer.transfer_date.toLocaleDateString()} at {transfer.transfer_date.toLocaleTimeString()}</p>
                    {transfer.receiving_team && (
                      <p>Receiving team: {transfer.receiving_team}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};