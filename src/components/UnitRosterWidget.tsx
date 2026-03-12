import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, Shield, UserCheck, Settings, Plus, RotateCcw } from 'lucide-react';
import { db } from '../db/database';
import { PS_UNITS, getCurrentAssignments, getTodaySchedule, UnitRosterConfig } from '../config/psUnits';
import { useAuthStore } from '../store/authStore';

export default function UnitRosterWidget() {
  const { user } = useAuthStore();
  const [rosterConfig, setRosterConfig] = useState<UnitRosterConfig | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    seniorRegistrar1: '',
    seniorRegistrar2: '',
    houseOfficer1: '',
    houseOfficer2: '',
  });

  useEffect(() => {
    loadRosterConfig();
  }, []);

  const loadRosterConfig = async () => {
    try {
      const configs = await db.ps_unit_rosters.toArray();
      const active = configs.find((c: UnitRosterConfig) => c.isActive);
      if (active) {
        setRosterConfig(active);
      }
    } catch (err) {
      console.error('Error loading roster config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoster = async () => {
    if (!setupForm.seniorRegistrar1 || !setupForm.houseOfficer1) {
      alert('Please fill in at least one Senior Registrar and one House Officer.');
      return;
    }

    try {
      // Deactivate existing configs
      const existing = await db.ps_unit_rosters.toArray();
      for (const config of existing) {
        await db.ps_unit_rosters.update(config.id!, { isActive: false, updatedAt: new Date().toISOString() });
      }

      const newConfig: UnitRosterConfig = {
        startDate: setupForm.startDate,
        rotationWeeks: 2,
        seniorRegistrars: [setupForm.seniorRegistrar1, setupForm.seniorRegistrar2].filter(Boolean),
        houseOfficers: [setupForm.houseOfficer1, setupForm.houseOfficer2].filter(Boolean),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.ps_unit_rosters.add(newConfig);
      setRosterConfig(newConfig);
      setShowSetup(false);
    } catch (err) {
      console.error('Error saving roster:', err);
      alert('Failed to save roster configuration.');
    }
  };

  const handleDeactivate = async () => {
    if (!rosterConfig?.id) return;
    if (!confirm('Deactivate the current rotation roster?')) return;
    try {
      await db.ps_unit_rosters.update(rosterConfig.id, { isActive: false, updatedAt: new Date().toISOString() });
      setRosterConfig(null);
    } catch (err) {
      console.error('Error deactivating:', err);
    }
  };

  const todaySchedule = getTodaySchedule();
  const assignments = rosterConfig?.isActive ? getCurrentAssignments(rosterConfig) : null;

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="card p-4 sm:p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-600" />
          PS Unit Roster & Schedule
        </h3>
        {isAdmin && (
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100 flex items-center gap-1"
          >
            <Settings className="h-3.5 w-3.5" />
            {showSetup ? 'Close' : 'Manage'}
          </button>
        )}
      </div>

      {/* Setup Form (Admin only) */}
      {showSetup && isAdmin && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
          <h4 className="font-semibold text-sm text-yellow-800 flex items-center gap-1">
            <Plus className="h-4 w-4" />
            Configure Rotation Roster
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rotation Start Date</label>
              <input
                type="date"
                value={setupForm.startDate}
                onChange={(e) => setSetupForm({ ...setupForm, startDate: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="hidden sm:block" />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senior Registrar (Group A)</label>
              <input
                type="text"
                value={setupForm.seniorRegistrar1}
                onChange={(e) => setSetupForm({ ...setupForm, seniorRegistrar1: e.target.value })}
                placeholder="e.g. Dr. Smith"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senior Registrar (Group B)</label>
              <input
                type="text"
                value={setupForm.seniorRegistrar2}
                onChange={(e) => setSetupForm({ ...setupForm, seniorRegistrar2: e.target.value })}
                placeholder="e.g. Dr. Jones"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">House Officer (Group A)</label>
              <input
                type="text"
                value={setupForm.houseOfficer1}
                onChange={(e) => setSetupForm({ ...setupForm, houseOfficer1: e.target.value })}
                placeholder="e.g. Dr. Ade"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">House Officer (Group B)</label>
              <input
                type="text"
                value={setupForm.houseOfficer2}
                onChange={(e) => setSetupForm({ ...setupForm, houseOfficer2: e.target.value })}
                placeholder="e.g. Dr. Bello"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Group A starts in PS-UNIT 1 and Group B in PS-UNIT 2. They swap every 2 weeks.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSaveRoster}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Save & Activate
            </button>
            {rosterConfig?.isActive && (
              <button
                onClick={handleDeactivate}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Deactivate
              </button>
            )}
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      {todaySchedule.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Today's Schedule
          </h4>
          <div className="space-y-1">
            {todaySchedule.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  item.activity === 'Theatre' ? 'bg-red-500' : item.activity === 'Clinic' ? 'bg-green-500' : 'bg-blue-500'
                }`} />
                <span className="font-medium text-gray-800">{item.unit}</span>
                <span className="text-gray-600">— {item.activity}</span>
                {item.time && <span className="text-gray-500 text-xs">({item.time})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PS_UNITS.map((unit, unitIdx) => {
          const assignment = assignments ? (unitIdx === 0 ? assignments.unit1 : assignments.unit2) : null;

          return (
            <div key={unit.id} className={`border rounded-lg p-3 ${
              unitIdx === 0 ? 'border-green-200 bg-green-50/50' : 'border-blue-200 bg-blue-50/50'
            }`}>
              <h4 className={`font-bold text-sm mb-2 ${unitIdx === 0 ? 'text-green-800' : 'text-blue-800'}`}>
                {unit.name}
              </h4>

              {/* Consultants */}
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Consultants</p>
                {unit.consultants.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm text-gray-800">
                    <UserCheck className="h-3.5 w-3.5 text-primary-500" />
                    {c}
                  </div>
                ))}
              </div>

              {/* Rotating Staff */}
              <div className="mb-2 space-y-1">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Senior Registrar</p>
                  <p className="text-sm text-gray-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-orange-500" />
                    {assignment?.seniorRegistrar || 'Not assigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">House Officer</p>
                  <p className="text-sm text-gray-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-purple-500" />
                    {assignment?.houseOfficer || 'Not assigned'}
                  </p>
                </div>
              </div>

              {/* Rotation Period */}
              {assignment && (
                <p className="text-xs text-gray-500 border-t pt-1 mt-1">
                  Rotation: {assignment.rotationStartDate} to {assignment.rotationEndDate}
                </p>
              )}

              {/* Schedule */}
              <div className="mt-2 border-t pt-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Weekly Schedule</p>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <Calendar className="h-3 w-3 text-blue-500" />
                    <span>Ward Rounds: {unit.schedule.wardRounds.day}
                      {unit.schedule.wardRounds.startTime ? ` (${unit.schedule.wardRounds.startTime} – ${unit.schedule.wardRounds.endTime})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <Calendar className="h-3 w-3 text-green-500" />
                    <span>Clinic: {unit.schedule.clinic.day}
                      {unit.schedule.clinic.startTime ? ` (${unit.schedule.clinic.startTime} – ${unit.schedule.clinic.endTime})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <Calendar className="h-3 w-3 text-red-500" />
                    <span>Theatre: {unit.schedule.theatre.day}
                      {unit.schedule.theatre.startTime ? ` (${unit.schedule.theatre.startTime} – ${unit.schedule.theatre.endTime})` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No roster configured message */}
      {!rosterConfig && (
        <p className="text-xs text-center text-gray-400 mt-3">
          No rotation roster is active. {isAdmin ? 'Click "Manage" to set one up.' : 'Contact admin to configure.'}
        </p>
      )}
    </div>
  );
}
