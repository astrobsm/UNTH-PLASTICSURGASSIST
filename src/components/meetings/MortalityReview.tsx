import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Activity,
  FlaskConical,
  HeartPulse,
  FileText,
  User,
  Clock,
} from 'lucide-react';
import PresentationSlide, { SlideData } from './PresentationSlide';
import { patientService } from '../../services/patientService';
import { admissionDischargeService, Admission } from '../../services/admissionDischargeService';
import { labService } from '../../services/labService';
import { wardRoundsService } from '../../services/wardRoundsService';

export default function MortalityReview() {
  // ─── State ──────────────────────────────────────────
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [logoUrl] = useState(localStorage.getItem('meeting_logo') || '');
  const [clinicalImages, setClinicalImages] = useState<Record<string, string>>({});
  const [presentationDate] = useState(
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  );

  // ─── Fetch patients ─────────────────────────────────
  useEffect(() => {
    patientService.getAllPatients().then((p) => setPatients(p || [])).catch(() => {});
  }, []);

  const filteredPatients = patients.filter((p) => {
    const s = patientSearch.toLowerCase();
    return (
      (p.full_name || p.name || '').toLowerCase().includes(s) ||
      (p.hospital_number || '').toLowerCase().includes(s)
    );
  });

  // ─── Image attachment ───────────────────────────────
  const attachImage = (slideId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => setClinicalImages((prev) => ({ ...prev, [slideId]: reader.result as string }));
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // ─── Helpers ────────────────────────────────────────
  const calcAge = (dob: string | undefined) => {
    if (!dob) return 'N/A';
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const daysBetween = (a: Date | string, b: Date | string) =>
    Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));

  const formatDate = (d: Date | string | undefined) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ─── Generate Slides ───────────────────────────────
  const generateSlides = async () => {
    if (!selectedPatientId) return;
    setLoading(true);

    try {
      const patient = patients.find((p) => String(p.id) === selectedPatientId);
      if (!patient) return;

      // Fetch clinical data
      let admissions: Admission[] = [];
      let wardRounds: any[] = [];
      let labs: any[] = [];

      try { admissions = await admissionDischargeService.getPatientAdmissions(Number(selectedPatientId)); } catch {}
      try { wardRounds = await wardRoundsService.getPatientWardRounds(selectedPatientId); } catch {}
      try { labs = await labService.getLabInvestigations(selectedPatientId); } catch {}

      // Sort chronologically
      wardRounds.sort((a: any, b: any) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
      labs.sort((a: any, b: any) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());

      const admissionDate = admissions[0]?.admission_date
        ? new Date(admissions[0].admission_date)
        : wardRounds.length > 0
        ? new Date(wardRounds[0].created_at || wardRounds[0].date)
        : new Date();

      const generatedSlides: SlideData[] = [];

      // ── 1. Title Slide ──
      generatedSlides.push({
        id: 'title',
        title: 'MORTALITY REVIEW',
        subtitle: `${patient.full_name || patient.name}`,
        type: 'title',
        content: (
          <div className="text-gray-500 space-y-1" style={{ fontSize: '16px' }}>
            <p>Burns, Plastic & Reconstructive Surgery UNIT</p>
            <p>Department of Surgery</p>
            <p>University of Nigeria Teaching Hospital, Enugu</p>
            <p className="mt-2 text-red-600 font-semibold">{presentationDate}</p>
          </div>
        ),
      });

      // ── 2. Patient Summary ──
      generatedSlides.push({
        id: 'patient-summary',
        title: 'Patient Summary',
        type: 'content',
        content: (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-bold text-red-800 mb-2" style={{ fontSize: '22px' }}>Biodata</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: '18px' }}>
                <p><strong>Name:</strong> {patient.full_name || patient.name}</p>
                <p><strong>Hospital No:</strong> {patient.hospital_number || 'N/A'}</p>
                <p><strong>Age:</strong> {calcAge(patient.date_of_birth)} years</p>
                <p><strong>Gender:</strong> {patient.gender || 'N/A'}</p>
                {admissions[0] && (
                  <>
                    <p><strong>Admitted:</strong> {formatDate(admissions[0].admission_date)}</p>
                    <p><strong>Ward:</strong> {admissions[0].ward_location || 'N/A'}</p>
                    <p><strong>Diagnosis:</strong> {admissions[0].provisional_diagnosis || 'N/A'}</p>
                    <p><strong>Route:</strong> {admissions[0].route_of_admission || 'N/A'}</p>
                  </>
                )}
              </div>
            </div>
            {admissions[0]?.presenting_complaint && (
              <div>
                <h4 className="font-bold text-gray-700" style={{ fontSize: '18px' }}>Presenting Complaint</h4>
                <p style={{ fontSize: '18px' }}>{admissions[0].presenting_complaint}</p>
              </div>
            )}
            {(patient.comorbidities?.length > 0 || patient.allergies?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {patient.comorbidities?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-orange-700" style={{ fontSize: '18px' }}>Comorbidities</h4>
                    <ul className="list-disc list-inside" style={{ fontSize: '16px' }}>
                      {patient.comorbidities.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {patient.allergies?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-red-700" style={{ fontSize: '18px' }}>Allergies</h4>
                    <ul className="list-disc list-inside text-red-600" style={{ fontSize: '16px' }}>
                      {patient.allergies.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ),
      });

      // ── 3. Day-by-Day Clinical Details ──
      // Group ward rounds by day relative to admission
      const roundsByDay: Record<number, any[]> = {};
      wardRounds.forEach((wr: any) => {
        const dayNum = daysBetween(admissionDate, new Date(wr.created_at || wr.date));
        const day = Math.max(dayNum, 0);
        if (!roundsByDay[day]) roundsByDay[day] = [];
        roundsByDay[day].push(wr);
      });

      const sortedDays = Object.keys(roundsByDay).map(Number).sort((a, b) => a - b);

      // Create a slide for each day (batch if many days)
      const maxDaySlides = 15;
      const daysToShow = sortedDays.slice(0, maxDaySlides);

      daysToShow.forEach((dayNum) => {
        const dayRounds = roundsByDay[dayNum];
        generatedSlides.push({
          id: `day-${dayNum}`,
          title: `Day ${dayNum} — ${formatDate(new Date(admissionDate.getTime() + dayNum * 86400000))}`,
          type: 'content',
          content: (
            <div className="space-y-3">
              {dayRounds.map((wr: any, idx: number) => (
                <div key={idx} className="border-l-4 border-green-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                  {wr.chief_complaint && (
                    <p style={{ fontSize: '18px' }}>
                      <strong className="text-gray-700">Complaint:</strong> {wr.chief_complaint}
                    </p>
                  )}
                  {wr.examination_findings && (
                    <p style={{ fontSize: '16px' }} className="mt-1">
                      <strong className="text-gray-700">Examination:</strong> {wr.examination_findings}
                    </p>
                  )}
                  {wr.clinical_notes && (
                    <p style={{ fontSize: '16px' }} className="mt-1">
                      <strong className="text-gray-700">Notes:</strong> {wr.clinical_notes}
                    </p>
                  )}
                  {wr.management_plan && (
                    <p style={{ fontSize: '16px' }} className="mt-1">
                      <strong className="text-green-700">Plan:</strong> {wr.management_plan}
                    </p>
                  )}
                  {/* Vital signs if available */}
                  {wr.vital_signs && (
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {wr.vital_signs.temperature && (
                        <span className="bg-yellow-50 px-2 py-0.5 rounded text-yellow-800">
                          Temp: {wr.vital_signs.temperature}°C
                        </span>
                      )}
                      {wr.vital_signs.blood_pressure && (
                        <span className="bg-red-50 px-2 py-0.5 rounded text-red-800">
                          BP: {wr.vital_signs.blood_pressure}
                        </span>
                      )}
                      {wr.vital_signs.pulse && (
                        <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-800">
                          PR: {wr.vital_signs.pulse}
                        </span>
                      )}
                      {wr.vital_signs.respiratory_rate && (
                        <span className="bg-purple-50 px-2 py-0.5 rounded text-purple-800">
                          RR: {wr.vital_signs.respiratory_rate}
                        </span>
                      )}
                      {wr.vital_signs.oxygen_saturation && (
                        <span className="bg-green-50 px-2 py-0.5 rounded text-green-800">
                          SpO₂: {wr.vital_signs.oxygen_saturation}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ),
        });
      });

      if (sortedDays.length === 0) {
        generatedSlides.push({
          id: 'day-none',
          title: 'Clinical Course',
          type: 'content',
          content: (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p style={{ fontSize: '20px' }}>No ward round records found</p>
                <p style={{ fontSize: '16px' }}>Ward round data will auto-populate when available</p>
              </div>
            </div>
          ),
        });
      }

      // ── 4. Laboratory Results ──
      if (labs.length > 0) {
        // Split into pages of 6 results each
        const labsPerSlide = 6;
        for (let i = 0; i < labs.length; i += labsPerSlide) {
          const chunk = labs.slice(i, i + labsPerSlide);
          const pageNum = Math.floor(i / labsPerSlide) + 1;
          const totalPages = Math.ceil(labs.length / labsPerSlide);
          generatedSlides.push({
            id: `labs-${pageNum}`,
            title: `Laboratory Results${totalPages > 1 ? ` (${pageNum}/${totalPages})` : ''}`,
            type: 'content',
            content: (
              <div className="space-y-3">
                {chunk.map((lab: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div>
                      <p className="font-medium" style={{ fontSize: '18px' }}>
                        {lab.clinical_indication || lab.tests?.[0]?.test_name || 'Lab Order'}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {formatDate(lab.created_at || lab.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          lab.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : lab.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {lab.status || 'Pending'}
                      </span>
                      {lab.result && (
                        <p className="text-gray-600 mt-1" style={{ fontSize: '14px' }}>
                          {lab.result}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ),
          });
        }
      } else {
        generatedSlides.push({
          id: 'labs-none',
          title: 'Laboratory Results',
          type: 'content',
          content: (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <FlaskConical className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p style={{ fontSize: '20px' }}>No laboratory results found</p>
              </div>
            </div>
          ),
        });
      }

      // ── 5. Vital Signs Trend (last recorded) ──
      const roundsWithVitals = wardRounds.filter((wr: any) => wr.vital_signs);
      if (roundsWithVitals.length > 0) {
        generatedSlides.push({
          id: 'vitals-trend',
          title: 'Vital Signs — Chronological Record',
          type: 'content',
          content: (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: '16px' }}>
                <thead>
                  <tr className="bg-green-50 border-b border-green-200">
                    <th className="px-3 py-2 font-bold text-green-800">Date</th>
                    <th className="px-3 py-2 font-bold text-green-800">Temp</th>
                    <th className="px-3 py-2 font-bold text-green-800">BP</th>
                    <th className="px-3 py-2 font-bold text-green-800">PR</th>
                    <th className="px-3 py-2 font-bold text-green-800">RR</th>
                    <th className="px-3 py-2 font-bold text-green-800">SpO₂</th>
                  </tr>
                </thead>
                <tbody>
                  {roundsWithVitals.slice(0, 12).map((wr: any, i: number) => {
                    const vs = wr.vital_signs || {};
                    return (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-2 text-gray-600">
                          {formatDate(wr.created_at || wr.date)}
                        </td>
                        <td className="px-3 py-2">{vs.temperature || '—'}</td>
                        <td className="px-3 py-2">{vs.blood_pressure || '—'}</td>
                        <td className="px-3 py-2">{vs.pulse || '—'}</td>
                        <td className="px-3 py-2">{vs.respiratory_rate || '—'}</td>
                        <td className="px-3 py-2">{vs.oxygen_saturation || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ),
        });
      }

      // ── 6. Last Events Before Death ──
      const lastRound = wardRounds[wardRounds.length - 1];
      generatedSlides.push({
        id: 'last-events',
        title: 'Events Preceding Death',
        type: 'content',
        content: lastRound ? (
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
              <h3 className="font-bold text-red-800 mb-2" style={{ fontSize: '22px' }}>
                Last Documented Encounter
              </h3>
              <p className="text-gray-600 mb-2" style={{ fontSize: '14px' }}>
                <Clock className="inline w-4 h-4 mr-1" />
                {formatDate(lastRound.created_at || lastRound.date)}
              </p>
              {lastRound.chief_complaint && (
                <p style={{ fontSize: '18px' }}><strong>Complaint:</strong> {lastRound.chief_complaint}</p>
              )}
              {lastRound.examination_findings && (
                <p style={{ fontSize: '18px' }}><strong>Findings:</strong> {lastRound.examination_findings}</p>
              )}
              {lastRound.clinical_notes && (
                <p style={{ fontSize: '18px' }}><strong>Notes:</strong> {lastRound.clinical_notes}</p>
              )}
              {lastRound.management_plan && (
                <p style={{ fontSize: '18px' }}><strong>Plan:</strong> {lastRound.management_plan}</p>
              )}
            </div>
            {lastRound.vital_signs && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold text-yellow-800 mb-2" style={{ fontSize: '18px' }}>
                  Last Vital Signs
                </h4>
                <div className="flex flex-wrap gap-4" style={{ fontSize: '16px' }}>
                  {lastRound.vital_signs.temperature && <span>Temp: {lastRound.vital_signs.temperature}°C</span>}
                  {lastRound.vital_signs.blood_pressure && <span>BP: {lastRound.vital_signs.blood_pressure}</span>}
                  {lastRound.vital_signs.pulse && <span>PR: {lastRound.vital_signs.pulse}</span>}
                  {lastRound.vital_signs.respiratory_rate && <span>RR: {lastRound.vital_signs.respiratory_rate}</span>}
                  {lastRound.vital_signs.oxygen_saturation && <span>SpO₂: {lastRound.vital_signs.oxygen_saturation}%</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p style={{ fontSize: '20px' }}>No encounter records found</p>
          </div>
        ),
      });

      // ── 7. Take-Home Summary / Learning Points ──
      const totalDays = wardRounds.length > 0
        ? daysBetween(admissionDate, new Date(wardRounds[wardRounds.length - 1].created_at || wardRounds[wardRounds.length - 1].date))
        : admissions[0]?.discharge_date
        ? daysBetween(admissionDate, admissions[0].discharge_date)
        : 'N/A';

      generatedSlides.push({
        id: 'summary',
        title: 'Take-Home Summary',
        type: 'summary',
        content: (
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
              <h3 className="font-bold text-red-800 mb-3" style={{ fontSize: '22px' }}>Case Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: '18px' }}>
                <p><strong>Patient:</strong> {patient.full_name || patient.name}</p>
                <p><strong>Age:</strong> {calcAge(patient.date_of_birth)} years</p>
                <p><strong>Diagnosis:</strong> {admissions[0]?.provisional_diagnosis || 'N/A'}</p>
                <p><strong>Duration of Admission:</strong> {totalDays} days</p>
                <p><strong>Total Encounters:</strong> {wardRounds.length}</p>
                <p><strong>Lab Orders:</strong> {labs.length}</p>
              </div>
            </div>
          </div>
        ),
      });

      // ── 8. Learning Points ──
      generatedSlides.push({
        id: 'learning-points',
        title: 'Learning Points',
        type: 'content',
        content: (
          <div className="space-y-4">
            {[
              'Early recognition of clinical deterioration and timely escalation',
              'Adherence to WHO Surgical Safety Checklist and protocols',
              'Importance of multidisciplinary team involvement',
              'Timely laboratory investigations and result review',
              'Documentation quality and continuity of care during handovers',
              'Family communication and informed consent practices',
              'Root cause analysis as a quality improvement tool',
            ].map((point, i) => (
              <div
                key={i}
                className="flex gap-4 items-start bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-r-lg"
              >
                <span
                  className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold flex-shrink-0"
                  style={{ fontSize: '14px' }}
                >
                  {i + 1}
                </span>
                <span className="text-gray-800" style={{ fontSize: '20px' }}>{point}</span>
              </div>
            ))}
          </div>
        ),
      });

      // ── 9. Thank You ──
      generatedSlides.push({
        id: 'thankyou',
        title: 'Thank You',
        subtitle: 'Discussion & Recommendations',
        type: 'divider',
        content: <></>,
      });

      // Apply any clinical images
      const finalSlides = generatedSlides.map((s) => ({
        ...s,
        image: clinicalImages[s.id] || s.image,
      }));

      setSlides(finalSlides);
      setShowPresentation(true);
    } catch (error) {
      console.error('Error generating mortality review slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => String(p.id) === selectedPatientId);

  // ─── Presentation Mode ──────────────────────────────
  if (showPresentation && slides.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => setShowPresentation(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition text-sm font-medium"
          >
            ← Back to Editor
          </button>
          <div className="flex flex-wrap gap-2">
            {slides.slice(0, 8).map((s, i) => (
              <button
                key={i}
                onClick={() => attachImage(s.id)}
                className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded text-blue-600 transition"
                title={`Attach image to: ${s.title}`}
              >
                📷 {s.title.slice(0, 12)}
              </button>
            ))}
          </div>
        </div>
        <PresentationSlide
          slides={slides.map((s) => ({ ...s, image: clinicalImages[s.id] || s.image }))}
          onSlidesChange={(updated) => setSlides(updated)}
          institutionName="Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery, UNTH"
          logoUrl={logoUrl}
          watermarkText="UNTH Plastic Surgery"
          presentationDate={presentationDate}
        />
      </div>
    );
  }

  // ─── Editor Mode ────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-7 h-7" />
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
            Mortality Review
          </h2>
        </div>
        <p className="text-red-100 text-sm">
          Generate a day-by-day clinical timeline presentation for mortality case review.
          Select a patient to auto-populate clinical encounters, lab results, and vital signs.
        </p>
      </div>

      {/* Patient Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-red-600" />
          Select Patient
        </h3>

        {selectedPatient ? (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3">
            <div>
              <p className="font-medium text-red-800">{selectedPatient.full_name || selectedPatient.name}</p>
              <p className="text-sm text-red-600">
                {selectedPatient.hospital_number || 'No hospital number'} • {selectedPatient.gender || 'N/A'}
              </p>
            </div>
            <button
              onClick={() => setSelectedPatientId('')}
              className="text-red-500 hover:text-red-700 px-3 py-1 text-sm bg-white rounded-lg border border-red-200"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search patients by name or hospital number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              />
            </div>
            {patientSearch && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {filteredPatients.length === 0 ? (
                  <p className="p-3 text-center text-gray-400 text-sm">No patients found</p>
                ) : (
                  filteredPatients.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPatientId(String(p.id)); setPatientSearch(''); }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 transition text-sm"
                    >
                      <span className="font-medium">{p.full_name || p.name}</span>
                      <span className="text-gray-400 ml-2">{p.hospital_number}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={generateSlides}
        disabled={!selectedPatientId || loading}
        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Generating Review...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            Generate Mortality Review
          </>
        )}
      </button>
    </div>
  );
}
