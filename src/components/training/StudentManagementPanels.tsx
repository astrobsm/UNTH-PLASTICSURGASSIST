/**
 * Clinical student management: the five posting groups, and the student roster.
 *
 * Lifted out of Admin.tsx so that Training Admin and the Admin console show
 * the same panels instead of each growing its own. Admin -> Students and
 * Training Admin were two screens tracking one cohort against one set of
 * requirements; this is the single copy they both render.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, Copy, Eye, GraduationCap, Loader2, Plus, RefreshCw,
  Star, UserPlus, Users, X, XCircle,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

// ── Clinical posting groups (5 even groups + activities + sign-out eligibility) ──
const GROUP_ACTS: { type: string; label: string }[] = [
  { type: 'topic_presentation', label: 'Topic presentation' },
  { type: 'patient_clerking', label: 'Clerk & present patient' },
  { type: 'wound_dressing', label: 'Wound dressing (clinic)' },
  { type: 'wound_inspection', label: 'Wound inspection (Tue)' },
];

export function StudentGroupsPanel() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const d = await apiClient.get('/students/groups'); setGroups(d.groups || []); }
    catch (e) { console.error('load groups failed', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const run = async (key: string, fn: () => Promise<any>) => {
    setWorking(key);
    try { await fn(); await load(); } catch (e: any) { alert(e.message || 'Action failed'); }
    finally { setWorking(null); }
  };
  const assignGroups = () => run('groups', () => apiClient.post('/students/assign-groups', {}));
  const assignPatients = () => run('patients', () => apiClient.post('/students/assign-group-patients', {}));
  const logActivity = (groupNumber: number, activityType: string) => {
    const title = window.prompt(`Record "${GROUP_ACTS.find(a => a.type === activityType)?.label}" for Group ${groupNumber}. Enter a note / patient / topic:`, '');
    if (title === null) return;
    run(`act-${groupNumber}-${activityType}`, () => apiClient.post('/students/group-activity', { groupNumber, activityType, title }));
  };
  const setTopic = (groupNumber: number, current: string) => {
    const t = window.prompt(`Presentation topic for Group ${groupNumber}:`, current || '');
    if (t === null) return;
    run(`topic-${groupNumber}`, () => apiClient.put('/students/group-topic', { groupNumber, topicTitle: t }));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-green-600" /> Clinical Posting Groups (5)</h3>
        <div className="flex gap-2">
          <button onClick={assignGroups} disabled={!!working}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
            {working === 'groups' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Auto-Assign into 5 Groups
          </button>
          <button onClick={assignPatients} disabled={!!working}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
            {working === 'patients' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Assign Patients to Groups
          </button>
          <button onClick={load} disabled={!!working} className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-green-600" /></div>
      ) : groups.every(g => g.memberCount === 0) ? (
        <p className="text-sm text-gray-500 py-4 text-center">No students in groups yet. Approve students, then click <b>Auto-Assign into 5 Groups</b>.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {groups.map(g => {
            const elig = g.groupEligibility || { eligible: false };
            const eligibleMembers = (g.members || []).filter((m: any) => m.signOutEligible).length;
            return (
              <div key={g.groupNumber} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800">Group {g.groupNumber}
                    <span className="ml-2 text-xs font-normal text-gray-500">{g.memberCount} students · {g.patientCount} patients</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${elig.eligible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {elig.eligible ? 'Activities complete' : 'Activities pending'}
                  </span>
                </div>

                <div className="text-xs text-gray-600 mb-2">
                  <button onClick={() => setTopic(g.groupNumber, g.topicTitle)} className="text-green-700 hover:underline">
                    Topic: {g.topicTitle || <span className="italic text-gray-400">set topic</span>}{g.topicPresented ? ' ✓' : ''}
                  </button>
                </div>

                {/* Activity checklist + quick record */}
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {GROUP_ACTS.map(a => {
                    const need = a.type === 'patient_clerking' ? 2 : 1;
                    const have = g.activityCounts?.[a.type] || 0;
                    const done = have >= need;
                    return (
                      <button key={a.type} onClick={() => logActivity(g.groupNumber, a.type)} disabled={!!working}
                        className={`text-left text-[11px] px-2 py-1 rounded border flex items-center gap-1 ${done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                        {done ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <Plus className="w-3 h-3 flex-shrink-0" />}
                        <span className="truncate">{a.label} {have}/{need}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Members */}
                {g.members?.length > 0 && (
                  <div className="text-[11px] text-gray-600">
                    <span className="text-gray-400">Sign-out eligible: {eligibleMembers}/{g.memberCount}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {g.members.map((m: any) => (
                        <span key={m.id} title={`CBT ${m.cbtCount} · CME ${m.cmeCount} · Self-assess ${m.selfAssessmentCount}`}
                          className={`px-1.5 py-0.5 rounded ${m.signOutEligible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {m.full_name.split(' ')[0]}{m.signOutEligible ? ' ✓' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400">
        Sign-out per student = group activities (topic + ≥2 clerked patients + wound dressing + Tuesday wound inspection) AND individual CBT + CME reading + self-assessment.
      </p>
    </div>
  );
}

export function StudentManagementTab() {
  const [students, setStudents] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [evalModal, setEvalModal] = useState<{ type: 'clerking' | 'plan'; id: number } | null>(null);
  const [evalScore, setEvalScore] = useState('');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [evalSaving, setEvalSaving] = useState(false);
  const [assigningPatients, setAssigningPatients] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);

  // One joining link for the whole unit. It used to point at a student-only
  // form; /join takes students, house officers, registrars, senior registrars
  // and consultants, sets the rotation dates, and offers to install the app.
  const shareLink = `${window.location.origin}/join`;

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentList, overviewData] = await Promise.all([
        apiClient.get('/students'),
        apiClient.get('/students/overview'),
      ]);
      setStudents(studentList);
      setOverview(overviewData.stats);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetail = async (id: number) => {
    try {
      const data = await apiClient.get(`/students/${id}`);
      setDetail(data);
      setSelectedStudent(data.student);
    } catch (err) {
      console.error('Failed to load student detail:', err);
    }
  };

  const approveStudent = async (id: number, approved: boolean) => {
    try {
      await apiClient.put('/students/approve', { studentId: id, approved });
      await loadData();
      if (detail?.student?.id === id) await loadStudentDetail(id);
    } catch (err: any) {
      alert(err.message || 'Failed');
    }
  };

  const deactivateStudent = async (id: number, active: boolean) => {
    try {
      await apiClient.put('/students/deactivate', { studentId: id, active });
      await loadData();
      if (detail?.student?.id === id) await loadStudentDetail(id);
    } catch (err: any) {
      alert(err.message || 'Failed');
    }
  };

  const submitEvaluation = async () => {
    if (!evalModal || !evalScore) return;
    setEvalSaving(true);
    try {
      const body: any = { score: parseInt(evalScore), feedback: evalFeedback };
      if (evalModal.type === 'clerking') body.clerkingId = evalModal.id;
      else body.treatmentPlanId = evalModal.id;
      await apiClient.put('/students/evaluate', body);
      setEvalModal(null);
      setEvalScore('');
      setEvalFeedback('');
      if (selectedStudent) await loadStudentDetail(selectedStudent.id);
    } catch (err: any) {
      alert(err.message || 'Evaluation failed');
    } finally {
      setEvalSaving(false);
    }
  };

  // Bulk approve all pending students
  const bulkApproveAll = async () => {
    if (!confirm('Approve ALL pending students and auto-assign patients?')) return;
    setBulkApproving(true);
    try {
      const result = await apiClient.post('/students/bulk-approve', {});
      alert(result.message || 'Students approved');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Bulk approve failed');
    } finally {
      setBulkApproving(false);
    }
  };

  // Auto-assign patients for all active students
  const autoAssignAll = async () => {
    setAssigningPatients(true);
    try {
      const result = await apiClient.post('/students/auto-assign-all', {});
      alert(result.message || 'Patients assigned');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Auto-assign failed');
    } finally {
      setAssigningPatients(false);
    }
  };

  // Auto-assign patients to a student
  const autoAssignPatients = async (studentId: number) => {
    setAssigningPatients(true);
    try {
      const result = await apiClient.post('/students/assign-patients', { studentId });
      alert(result.message || `${result.assigned} patients assigned`);
      await loadData();
      if (detail?.student?.id === studentId) await loadStudentDetail(studentId);
    } catch (err: any) {
      alert(err.message || 'Failed to assign patients');
    } finally {
      setAssigningPatients(false);
    }
  };

  // Open patient picker for manual assignment
  const openPatientPicker = async (studentId: number) => {
    setPatientPickerOpen(true);
    setPatientSearch('');
    await searchAvailablePatients(studentId, '');
  };

  // Search available patients
  const searchAvailablePatients = async (studentId: number, search: string) => {
    setLoadingPatients(true);
    try {
      const params = new URLSearchParams({ studentId: String(studentId) });
      if (search) params.set('search', search);
      const patients = await apiClient.get(`/students/available-patients?${params}`);
      setAvailablePatients(patients);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setAvailablePatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  // Manually assign a single patient
  const assignSinglePatient = async (studentId: number, patientId: number) => {
    try {
      await apiClient.post('/students/assign-patient', { studentId, patientId });
      await loadStudentDetail(studentId);
      await loadData();
      // Refresh available patients
      await searchAvailablePatients(studentId, patientSearch);
    } catch (err: any) {
      alert(err.message || 'Failed to assign patient');
    }
  };

  // Unassign a patient
  const unassignPatient = async (studentId: number, patientId: string) => {
    if (!confirm('Remove this patient from the student?')) return;
    try {
      await apiClient.put('/students/unassign-patient', { studentId, patientId });
      await loadStudentDetail(studentId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to unassign patient');
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + Share Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Student Management</h2>
          <p className="text-sm text-gray-500">Manage clinical posting students</p>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={shareLink} className="text-xs border border-gray-300 rounded-lg px-3 py-2 w-64 bg-gray-50" onClick={e => (e.target as HTMLInputElement).select()} title="Profile creation link — students and staff alike" />
          <button onClick={() => { navigator.clipboard.writeText(shareLink); alert('Link copied!'); }}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1">
            <Copy className="w-4 h-4" /> Copy Link
          </button>
        </div>
      </div>

      {/* Learning material students can reach.
          These modules keep their content in the browser and treat the server
          as a top-up, so they work on a student account. The staff training
          page is not here: it reads trainee analytics and rotations, which are
          not a student's to see. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-green-700" />
              Learning material
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Open these yourself, or send a student the link — both work on a student login.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { href: '/training', label: 'CME articles, CBT & progress' },
            ].map(link => (
              <span key={link.href} className="flex items-center gap-1">
                <Link
                  to={link.href}
                  className="px-3 py-2 text-sm rounded-lg border border-green-300 text-green-800 bg-green-50 hover:bg-green-100"
                >
                  {link.label}
                </Link>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${link.href}`);
                    alert('Link copied!');
                  }}
                  title={`Copy the ${link.label} link`}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Clinical posting groups (5) */}
      <StudentGroupsPanel />

      {/* Bulk Actions */}
      {overview && (parseInt(overview.pending_approval) > 0 || parseInt(overview.active_students) > 0) && (
        <div className="flex flex-wrap gap-2">
          {parseInt(overview.pending_approval) > 0 && (
            <button onClick={bulkApproveAll} disabled={bulkApproving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
              {bulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve All Pending ({overview.pending_approval})
            </button>
          )}
          <button onClick={autoAssignAll} disabled={assigningPatients}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            {assigningPatients ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Auto-Assign Patients to All
          </button>
        </div>
      )}

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: overview.total_students, color: 'blue' },
            { label: 'Active', value: overview.active_students, color: 'green' },
            { label: 'Pending Approval', value: overview.pending_approval, color: 'yellow' },
            { label: 'Expired Postings', value: overview.expired_postings, color: 'red' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold text-${s.color}-600`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Back button when viewing detail */}
      {selectedStudent && (
        <button onClick={() => { setSelectedStudent(null); setDetail(null); }}
          className="text-sm text-blue-600 hover:underline">&larr; Back to student list</button>
      )}

      {/* Student Detail View */}
      {selectedStudent && detail ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedStudent.full_name}</h3>
                <p className="text-sm text-gray-500">{selectedStudent.email} · {selectedStudent.university || 'N/A'} · {selectedStudent.matric_number || 'N/A'}</p>
                <p className="text-sm text-gray-500">Posting: {new Date(selectedStudent.posting_start).toLocaleDateString()} – {new Date(selectedStudent.posting_end).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                {!selectedStudent.is_approved ? (
                  <button onClick={() => approveStudent(selectedStudent.id, true)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Approve</button>
                ) : (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Approved</span>
                )}
                <button onClick={() => deactivateStudent(selectedStudent.id, !selectedStudent.is_active)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${selectedStudent.is_active ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-600 text-white hover:bg-gray-700'}`}>
                  {selectedStudent.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>

            {/* Assigned Patients */}
            <div className="flex items-center justify-between mb-2 mt-4">
              <h4 className="font-semibold text-gray-800">Assigned Patients ({detail.patients?.length || 0}/5)</h4>
              <div className="flex gap-2">
                {(detail.patients?.length || 0) < 5 && (
                  <>
                    <button onClick={() => autoAssignPatients(selectedStudent.id)} disabled={assigningPatients}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                      {assigningPatients ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Auto-Assign
                    </button>
                    <button onClick={() => openPatientPicker(selectedStudent.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Patient
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {(detail.patients || []).map((p: any) => (
                <div key={p.patient_id} className="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-500">
                      {p.hospital_number ? `HN: ${p.hospital_number} · ` : ''}Ward: {p.ward_id || 'N/A'} · Bed: {p.bed_number || 'N/A'}
                    </p>
                  </div>
                  <button onClick={() => unassignPatient(selectedStudent.id, p.patient_id)}
                    className="p-1 hover:bg-red-100 rounded" title="Remove patient">
                    <XCircle className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              {(!detail.patients || detail.patients.length === 0) && (
                <p className="text-sm text-gray-400 col-span-2">No patients assigned. Click "Auto-Assign" or "Add Patient" above.</p>
              )}
            </div>

            {/* Patient Picker Modal */}
            {patientPickerOpen && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900">Select Patient to Assign</h4>
                  <button onClick={() => setPatientPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input type="text" placeholder="Search by name or hospital number..." value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); searchAvailablePatients(selectedStudent.id, e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" />
                {loadingPatients ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                ) : availablePatients.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {availablePatients.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm hover:bg-blue-50">
                        <div>
                          <span className="font-medium">{p.first_name || ''} {p.last_name || ''}</span>
                          {p.full_name && !p.first_name && <span className="font-medium">{p.full_name}</span>}
                          <span className="text-xs text-gray-500 ml-2">{p.hospital_number || ''} {p.ward_id ? `· Ward ${p.ward_id}` : ''}</span>
                        </div>
                        <button onClick={() => assignSinglePatient(selectedStudent.id, p.id)}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Assign</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">No available patients found</p>
                )}
              </div>
            )}

            {/* Clerkings */}
            <h4 className="font-semibold text-gray-800 mb-2">Clerkings ({detail.clerkings?.length || 0})</h4>
            <div className="space-y-2 mb-4">
              {(detail.clerkings || []).map((c: any) => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.provisional_diagnosis || 'Draft'}</p>
                      <p className="text-xs text-gray-500">{c.first_name} {c.last_name} · {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.evaluation_score != null ? (
                        <span className={`text-sm font-bold ${c.evaluation_score >= 70 ? 'text-green-600' : c.evaluation_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{c.evaluation_score}/100</span>
                      ) : (
                        <button onClick={() => { setEvalModal({ type: 'clerking', id: c.id }); setEvalScore(''); setEvalFeedback(''); }}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                          <Star className="w-3 h-3" /> Evaluate
                        </button>
                      )}
                    </div>
                  </div>
                  {c.chief_complaint && <p className="text-xs text-gray-600 mt-1 truncate">CC: {c.chief_complaint}</p>}
                </div>
              ))}
              {(!detail.clerkings || detail.clerkings.length === 0) && <p className="text-sm text-gray-400">No clerkings yet</p>}
            </div>

            {/* Treatment Plans */}
            <h4 className="font-semibold text-gray-800 mb-2">Treatment Plans ({detail.treatmentPlans?.length || 0})</h4>
            <div className="space-y-2">
              {(detail.treatmentPlans || []).map((p: any) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.diagnosis || 'Draft'}</p>
                      <p className="text-xs text-gray-500">{p.first_name} {p.last_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.evaluation_score != null ? (
                        <span className={`text-sm font-bold ${p.evaluation_score >= 70 ? 'text-green-600' : p.evaluation_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{p.evaluation_score}/100</span>
                      ) : (
                        <button onClick={() => { setEvalModal({ type: 'plan', id: p.id }); setEvalScore(''); setEvalFeedback(''); }}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1">
                          <Star className="w-3 h-3" /> Evaluate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!detail.treatmentPlans || detail.treatmentPlans.length === 0) && <p className="text-sm text-gray-400">No treatment plans yet</p>}
            </div>
          </div>
        </div>
      ) : (
        /* Student List */
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">University</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Posting</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Patients</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Clerkings</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Avg Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => {
                const expired = new Date(s.posting_end) < new Date();
                const avgScore = s.avg_clerking_score ? Math.round(Number(s.avg_clerking_score)) : null;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.university || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(s.posting_start).toLocaleDateString()} – {new Date(s.posting_end).toLocaleDateString()}
                      {expired && <span className="ml-1 text-red-500 font-medium">(Expired)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">{s.assigned_patients || 0}/5</td>
                    <td className="px-4 py-3 text-center">{s.total_clerkings || 0}</td>
                    <td className="px-4 py-3 text-center">
                      {avgScore != null ? <span className={`font-medium ${avgScore >= 70 ? 'text-green-600' : avgScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{avgScore}%</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!s.is_approved ? (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">Pending</span>
                      ) : !s.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Inactive</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => loadStudentDetail(s.id)} className="p-1.5 hover:bg-gray-100 rounded" title="View detail">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {s.is_approved && s.is_active && (s.assigned_patients || 0) < 5 && (
                          <button onClick={() => autoAssignPatients(s.id)} disabled={assigningPatients}
                            className="p-1.5 hover:bg-green-100 rounded" title="Auto-assign patients">
                            <UserPlus className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        {!s.is_approved && (
                          <button onClick={() => approveStudent(s.id, true)} className="p-1.5 hover:bg-green-100 rounded" title="Approve">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        <button onClick={() => deactivateStudent(s.id, !s.is_active)}
                          className="p-1.5 hover:bg-red-100 rounded" title={s.is_active ? 'Deactivate' : 'Reactivate'}>
                          {s.is_active ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No students registered yet. Share the registration link above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Evaluation Modal */}
      {evalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Evaluate {evalModal.type === 'clerking' ? 'Clerking' : 'Treatment Plan'}</h3>
              <button onClick={() => setEvalModal(null)} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score (0–100) *</label>
              <input type="number" min="0" max="100" value={evalScore} onChange={e => setEvalScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. 75" title="Evaluation score" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
              <textarea rows={3} value={evalFeedback} onChange={e => setEvalFeedback(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Comments on strengths, areas for improvement..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEvalModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={submitEvaluation} disabled={!evalScore || evalSaving}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1">
                {evalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} Submit Score
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
