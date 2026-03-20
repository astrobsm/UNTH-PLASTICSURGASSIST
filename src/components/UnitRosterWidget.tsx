import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, Shield, UserCheck, Settings, Plus, RotateCcw, Wand2, Phone, MessageCircle } from 'lucide-react';
import { db } from '../db/database';
import { PS_UNITS, getCurrentAssignments, getTodaySchedule, UnitRosterConfig } from '../config/psUnits';
import { useAuthStore } from '../store/authStore';
import { userManagementService, ApprovedUser } from '../services/userManagementService';
import { apiClient } from '../services/apiClient';

export default function UnitRosterWidget() {
  const { user } = useAuthStore();
  const [rosterConfig, setRosterConfig] = useState<UnitRosterConfig | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [availableSeniorRegistrars, setAvailableSeniorRegistrars] = useState<ApprovedUser[]>([]);
  const [availableHouseOfficers, setAvailableHouseOfficers] = useState<ApprovedUser[]>([]);
  const [allActiveUsers, setAllActiveUsers] = useState<ApprovedUser[]>([]);

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    seniorRegistrar1: '',
    seniorRegistrar2: '',
    houseOfficer1: '',
    houseOfficer2: '',
  });

  const [autoSetupDone, setAutoSetupDone] = useState(false);

  useEffect(() => {
    loadRosterConfig();
    loadAvailableStaff();
  }, []);

  // Auto-setup roster only when BOTH roster config AND staff have finished loading
  useEffect(() => {
    if (!autoSetupDone && !loading && !staffLoading && !rosterConfig) {
      autoSetupRoster();
    }
  }, [autoSetupDone, loading, staffLoading, rosterConfig, availableSeniorRegistrars, availableHouseOfficers]);

  const loadRosterConfig = async () => {
    try {
      // Try fetching from server first for cross-device sync
      try {
        const serverRosters = await apiClient.request('/sync/ps-unit-rosters');
        if (Array.isArray(serverRosters) && serverRosters.length > 0) {
          const active = serverRosters.find((r: any) => r.is_active);
          if (active) {
            const config: UnitRosterConfig = {
              startDate: active.start_date,
              rotationWeeks: active.rotation_weeks || 2,
              seniorRegistrars: active.senior_registrars || [],
              houseOfficers: active.house_officers || [],
              isActive: active.is_active,
              createdAt: active.created_at,
              updatedAt: active.updated_at,
            };
            // Save to local DB for offline access
            const existing = await db.ps_unit_rosters.toArray();
            for (const c of existing) {
              await db.ps_unit_rosters.update(c.id!, { isActive: false });
            }
            const localId = await db.ps_unit_rosters.add(config);
            config.id = localId as number;
            setRosterConfig(config);
            setLoading(false);
            return;
          }
        }
      } catch (serverErr) {
        console.log('Server roster fetch failed, falling back to local:', serverErr);
      }

      // Fall back to local IndexedDB
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

  const loadAvailableStaff = async () => {
    try {
      const allUsers = await userManagementService.getAllApprovedUsers();
      const activeUsers = allUsers.filter(u => u.is_active);
      setAllActiveUsers(activeUsers);
      setAvailableSeniorRegistrars(activeUsers.filter(u => u.role === 'senior_registrar' || u.role === 'junior_registrar'));
      setAvailableHouseOfficers(activeUsers.filter(u => u.role === 'house_officer'));
    } catch (err) {
      console.error('Error loading available staff:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  // Format phone number for tel: and wa.me links
  const formatPhoneForLink = (phone: string): string => {
    return phone.replace(/[\s\-()]/g, '').replace(/^0/, '+234');
  };

  const PhoneLinks = ({ phone }: { phone: string }) => {
    const cleaned = formatPhoneForLink(phone);
    return (
      <span className="inline-flex items-center gap-1.5 ml-1">
        <a
          href={`tel:${cleaned}`}
          className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          title={`Call ${phone}`}
        >
          <Phone className="h-3 w-3" />
          {phone}
        </a>
        <a
          href={`https://wa.me/${cleaned.replace('+', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs text-green-600 hover:text-green-800"
          title={`WhatsApp ${phone}`}
        >
          <MessageCircle className="h-3 w-3" />
        </a>
      </span>
    );
  };

  const pushRosterToServer = async (config: UnitRosterConfig) => {
    try {
      await apiClient.request('/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          changes: [{
            entityType: 'ps_unit_rosters',
            entityId: `roster-${config.startDate}`,
            action: 'upsert',
            payload: {
              start_date: config.startDate,
              rotation_weeks: config.rotationWeeks,
              senior_registrars: config.seniorRegistrars,
              house_officers: config.houseOfficers,
              is_active: config.isActive,
            }
          }]
        })
      });
    } catch (err) {
      console.warn('Failed to push roster to server:', err);
    }
  };

  const handleAutoAssign = () => {
    const srs = availableSeniorRegistrars;
    const hos = availableHouseOfficers;
    setSetupForm(prev => ({
      ...prev,
      seniorRegistrar1: srs.length > 0 ? srs[0].full_name : prev.seniorRegistrar1,
      seniorRegistrar2: srs.length > 1 ? srs[1].full_name : prev.seniorRegistrar2,
      houseOfficer1: hos.length > 0 ? hos[0].full_name : prev.houseOfficer1,
      houseOfficer2: hos.length > 1 ? hos[1].full_name : prev.houseOfficer2,
    }));
  };

  const autoSetupRoster = async () => {
    setAutoSetupDone(true);
    try {
      // Deactivate any existing configs
      const existing = await db.ps_unit_rosters.toArray();
      for (const config of existing) {
        await db.ps_unit_rosters.update(config.id!, { isActive: false, updatedAt: new Date().toISOString() });
      }

      const srs = availableSeniorRegistrars;
      const hos = availableHouseOfficers;

      // Only auto-setup if we have real staff — never create TBD entries
      if (srs.length === 0 && hos.length === 0) {
        return; // Don't create a roster with TBD values
      }

      const newConfig: UnitRosterConfig = {
        startDate: new Date().toISOString().split('T')[0],
        rotationWeeks: 2,
        seniorRegistrars: srs.length > 0 
          ? srs.slice(0, 2).map(u => u.full_name)
          : [],
        houseOfficers: hos.length > 0
          ? hos.slice(0, 2).map(u => u.full_name)
          : [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.ps_unit_rosters.add(newConfig);
      setRosterConfig(newConfig);
      pushRosterToServer(newConfig);
    } catch (err) {
      console.error('Auto-setup roster error:', err);
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
      pushRosterToServer(newConfig);
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
  const rawAssignments = rosterConfig?.isActive ? getCurrentAssignments(rosterConfig) : null;

  // Filter out deactivated staff from assignments (only after staff list has loaded)
  const assignments = rawAssignments && !staffLoading ? {
    unit1: {
      ...rawAssignments.unit1,
      seniorRegistrar: availableSeniorRegistrars.some(u => u.full_name === rawAssignments.unit1.seniorRegistrar)
        ? rawAssignments.unit1.seniorRegistrar : '',
      houseOfficer: availableHouseOfficers.some(u => u.full_name === rawAssignments.unit1.houseOfficer)
        ? rawAssignments.unit1.houseOfficer : '',
    },
    unit2: {
      ...rawAssignments.unit2,
      seniorRegistrar: availableSeniorRegistrars.some(u => u.full_name === rawAssignments.unit2.seniorRegistrar)
        ? rawAssignments.unit2.seniorRegistrar : '',
      houseOfficer: availableHouseOfficers.some(u => u.full_name === rawAssignments.unit2.houseOfficer)
        ? rawAssignments.unit2.houseOfficer : '',
    },
  } : rawAssignments;

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
            <div className="flex items-end">
              <button
                onClick={handleAutoAssign}
                className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 flex items-center gap-1"
                title="Auto-assign available registrars and house officers to units"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Auto-Assign Staff
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senior Registrar (Group A)</label>
              <select
                value={setupForm.seniorRegistrar1}
                onChange={(e) => setSetupForm({ ...setupForm, seniorRegistrar1: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">-- Select --</option>
                {availableSeniorRegistrars.map(u => (
                  <option key={u.id} value={u.full_name} disabled={u.full_name === setupForm.seniorRegistrar2}>
                    {u.full_name} ({u.role === 'senior_registrar' ? 'SR' : 'JR'}){u.phone ? ` — ${u.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senior Registrar (Group B)</label>
              <select
                value={setupForm.seniorRegistrar2}
                onChange={(e) => setSetupForm({ ...setupForm, seniorRegistrar2: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">-- Select --</option>
                {availableSeniorRegistrars.map(u => (
                  <option key={u.id} value={u.full_name} disabled={u.full_name === setupForm.seniorRegistrar1}>
                    {u.full_name} ({u.role === 'senior_registrar' ? 'SR' : 'JR'}){u.phone ? ` — ${u.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">House Officer (Group A)</label>
              <select
                value={setupForm.houseOfficer1}
                onChange={(e) => setSetupForm({ ...setupForm, houseOfficer1: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">-- Select --</option>
                {availableHouseOfficers.map(u => (
                  <option key={u.id} value={u.full_name} disabled={u.full_name === setupForm.houseOfficer2}>
                    {u.full_name}{u.phone ? ` — ${u.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">House Officer (Group B)</label>
              <select
                value={setupForm.houseOfficer2}
                onChange={(e) => setSetupForm({ ...setupForm, houseOfficer2: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">-- Select --</option>
                {availableHouseOfficers.map(u => (
                  <option key={u.id} value={u.full_name} disabled={u.full_name === setupForm.houseOfficer1}>
                    {u.full_name}{u.phone ? ` — ${u.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Group A starts in PS-UNIT 1 and Group B in PS-UNIT 2. They swap every 2 weeks. Click "Auto-Assign Staff" to automatically populate from registered users.
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
                {unit.consultants.map((c, i) => {
                  const consultantUser = allActiveUsers.find(u => u.full_name === c);
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-1.5 text-sm text-gray-800">
                        <UserCheck className="h-3.5 w-3.5 text-primary-500" />
                        {c}
                      </div>
                      {consultantUser?.phone && (
                        <div className="ml-5">
                          <PhoneLinks phone={consultantUser.phone} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rotating Staff */}
              <div className="mb-2 space-y-1">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Senior Registrar</p>
                  <p className="text-sm text-gray-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-orange-500" />
                    {assignment?.seniorRegistrar || 'Not assigned'}
                  </p>
                  {assignment?.seniorRegistrar && (() => {
                    const sr = availableSeniorRegistrars.find(u => u.full_name === assignment.seniorRegistrar);
                    return sr?.phone ? <div className="ml-5"><PhoneLinks phone={sr.phone} /></div> : null;
                  })()}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">House Officer</p>
                  <p className="text-sm text-gray-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-purple-500" />
                    {assignment?.houseOfficer || 'Not assigned'}
                  </p>
                  {assignment?.houseOfficer && (() => {
                    const ho = availableHouseOfficers.find(u => u.full_name === assignment.houseOfficer);
                    return ho?.phone ? <div className="ml-5"><PhoneLinks phone={ho.phone} /></div> : null;
                  })()}
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
