import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Users
} from 'lucide-react';
import { userManagementService, BulkImportUser, BulkImportResult } from '../services/userManagementService';

interface ManualUserEntry {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
}

export default function BulkUserImport() {
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('csv');
  const [csvContent, setCsvContent] = useState('');
  const [parsedUsers, setParsedUsers] = useState<BulkImportUser[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualUserEntry[]>([
    { id: '1', fullName: '', email: '', role: 'house_officer', department: '' }
  ]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roles = [
    { value: 'house_officer', label: 'House Officer' },
    { value: 'junior_registrar', label: 'Junior Registrar' },
    { value: 'senior_registrar', label: 'Senior Registrar' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'admin', label: 'Admin' }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      parseCSVContent(content);
    };
    reader.readAsText(file);
  };

  const parseCSVContent = (content: string) => {
    try {
      setParseError(null);
      const users = userManagementService.parseCSV(content);
      setParsedUsers(users);
    } catch (err: any) {
      setParseError(err.message);
      setParsedUsers([]);
    }
  };

  const handleCSVChange = (content: string) => {
    setCsvContent(content);
    if (content.trim()) {
      parseCSVContent(content);
    } else {
      setParsedUsers([]);
      setParseError(null);
    }
  };

  const addManualEntry = () => {
    setManualEntries([
      ...manualEntries,
      { id: Date.now().toString(), fullName: '', email: '', role: 'house_officer', department: '' }
    ]);
  };

  const updateManualEntry = (id: string, field: keyof ManualUserEntry, value: string) => {
    setManualEntries(manualEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const removeManualEntry = (id: string) => {
    if (manualEntries.length > 1) {
      setManualEntries(manualEntries.filter(entry => entry.id !== id));
    }
  };

  const getValidManualEntries = (): BulkImportUser[] => {
    return manualEntries
      .filter(entry => entry.fullName.trim() && entry.email.trim())
      .map(entry => ({
        fullName: entry.fullName.trim(),
        email: entry.email.trim(),
        role: entry.role,
        department: entry.department.trim()
      }));
  };

  const handleImport = async () => {
    setError(null);
    setImportResult(null);
    setImporting(true);

    try {
      const usersToImport = activeTab === 'csv' ? parsedUsers : getValidManualEntries();
      
      if (usersToImport.length === 0) {
        throw new Error('No valid users to import. Please add at least one user with name and email.');
      }

      const result = await userManagementService.bulkImportUsers(usersToImport);
      // Ensure result has required arrays with defaults
      setImportResult({
        success: result?.success || [],
        failed: result?.failed || [],
        credentials: result?.credentials || []
      });

      // Clear the form on success
      if (result.success.length > 0) {
        if (activeTab === 'csv') {
          setCsvContent('');
          setParsedUsers([]);
        } else {
          setManualEntries([{ id: '1', fullName: '', email: '', role: 'house_officer', department: '' }]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import users');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadCredentials = () => {
    if (importResult?.credentials && importResult.credentials.length > 0) {
      const timestamp = new Date().toISOString().split('T')[0];
      userManagementService.downloadCredentials(importResult.credentials, `user_credentials_${timestamp}.csv`);
    }
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `fullName,email,role,department
John Doe,john.doe@hospital.com,intern,Surgery
Jane Smith,jane.smith@hospital.com,registrar,Plastic Surgery
Dr. Mike Johnson,mike.johnson@hospital.com,consultant,Plastic Surgery`;
    
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bulk_import_template.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Users className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Bulk User Import</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Import multiple users at once with auto-generated credentials. 
          Users will be required to change their password on first login (except admin users).
        </p>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Important Notes</h3>
              <ul className="text-sm text-blue-700 mt-1 list-disc list-inside">
                <li>Temporary passwords will be auto-generated for each user</li>
                <li>All imported users will be <strong>approved</strong> and <strong>active</strong> immediately</li>
                <li>Non-admin users must change their password on first login</li>
                <li>Admin users (super_admin) will NOT need to change their password</li>
                <li>Download the credentials file to distribute to users securely</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-2 border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'csv'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            CSV Upload
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Manual Entry
          </button>
        </div>

        {/* CSV Upload Tab */}
        {activeTab === 'csv' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Upload a CSV file with columns: fullName, email, role (optional), department (optional)
              </p>
              <button
                onClick={downloadSampleCSV}
                className="text-sm text-green-600 hover:text-green-700 flex items-center"
              >
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </button>
            </div>

            {/* File Upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 transition-colors"
            >
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-400 mt-1">CSV files only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Or paste CSV */}
            <div className="relative">
              <div className="absolute inset-x-0 top-1/2 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-sm text-gray-500">or paste CSV content</span>
              </div>
            </div>

            <textarea
              value={csvContent}
              onChange={(e) => handleCSVChange(e.target.value)}
              placeholder="fullName,email,role,department&#10;John Doe,john@example.com,intern,Surgery"
              className="w-full h-40 border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />

            {parseError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="ml-2 text-sm text-red-700">{parseError}</p>
              </div>
            )}

            {parsedUsers.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="ml-2 text-sm text-green-700">
                    Found {parsedUsers.length} valid user(s) ready to import
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Entry Tab */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Add users manually by filling in the form below.
            </p>

            <div className="space-y-3">
              {manualEntries.map((entry, index) => (
                <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={entry.fullName}
                      onChange={(e) => updateManualEntry(entry.id, 'fullName', e.target.value)}
                      placeholder="John Doe"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                    <input
                      type="email"
                      value={entry.email}
                      onChange={(e) => updateManualEntry(entry.id, 'email', e.target.value)}
                      placeholder="john@hospital.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                    <select
                      value={entry.role}
                      onChange={(e) => updateManualEntry(entry.id, 'role', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {roles.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                    <input
                      type="text"
                      value={entry.department}
                      onChange={(e) => updateManualEntry(entry.id, 'department', e.target.value)}
                      placeholder="Plastic Surgery"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      onClick={() => removeManualEntry(entry.id)}
                      disabled={manualEntries.length === 1}
                      className={`p-2 rounded-lg ${
                        manualEntries.length === 1
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addManualEntry}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another User
            </button>

            {getValidManualEntries().length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="ml-2 text-sm text-green-700">
                    {getValidManualEntries().length} valid user(s) ready to import
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="ml-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Import Button */}
        <div className="mt-6">
          <button
            onClick={handleImport}
            disabled={importing || (activeTab === 'csv' ? parsedUsers.length === 0 : getValidManualEntries().length === 0)}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
              importing || (activeTab === 'csv' ? parsedUsers.length === 0 : getValidManualEntries().length === 0)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Importing Users...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span>Import Users</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Results</h3>
          
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">{importResult.success.length}</p>
              <p className="text-sm text-green-600">Successfully Imported</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700">{importResult.failed.length}</p>
              <p className="text-sm text-red-600">Failed</p>
            </div>
          </div>

          {/* Download Credentials Button */}
          {importResult.credentials.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-yellow-800">Download User Credentials</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Download the credentials file now to distribute to users. 
                    This is the only time you can access the temporary passwords.
                  </p>
                  <button
                    onClick={handleDownloadCredentials}
                    className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Credentials CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Successfully Created Users */}
          {importResult.success.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Successfully Created Users</h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {importResult.success.map(user => (
                      <tr key={user.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{user.fullName}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{user.email}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{user.username}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 capitalize">{user.role.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Failed Imports */}
          {importResult.failed.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Failed Imports</h4>
              <div className="bg-red-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-red-200">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-200">
                    {importResult.failed.map((failure, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-red-800">{failure.fullName}</td>
                        <td className="px-4 py-2 text-sm text-red-700">{failure.email}</td>
                        <td className="px-4 py-2 text-sm text-red-600">{failure.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Close Results Button */}
          <button
            onClick={() => setImportResult(null)}
            className="mt-4 w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center"
          >
            <X className="h-4 w-4 mr-2" />
            Close Results
          </button>
        </div>
      )}
    </div>
  );
}
