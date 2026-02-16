import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileText,
  Activity,
} from 'lucide-react';
import PresentationSlide, { SlideData } from './PresentationSlide';
import { admissionService, Admission } from '../../services/admissionService';
import { riskAssessmentService, DVTRiskAssessment } from '../../services/riskAssessmentService';
import { patientService } from '../../services/patientService';

interface PatientVTEData {
  patient: any;
  admission: Admission;
  dvtAssessment?: DVTRiskAssessment;
  capriniScore: number;
  riskLevel: string;
  interpretation: string;
  daysAdmitted: number;
}

export default function VTEAudit() {
  // ─── State ──────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [showPresentation, setShowPresentation] = useState(false);
  const [logoUrl] = useState(localStorage.getItem('meeting_logo') || '');
  const [clinicalImages, setClinicalImages] = useState<Record<string, string>>({});
  const [vteData, setVteData] = useState<PatientVTEData[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [presentationDate] = useState(
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  );

  // ─── Image attachment ───────────────────────────────
  const attachImage = (slideId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () =>
          setClinicalImages((prev) => ({ ...prev, [slideId]: reader.result as string }));
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // ─── Helpers ────────────────────────────────────────
  const daysBetween = (a: Date | string, b: Date | string) =>
    Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)));

  const formatDate = (d: Date | string | undefined) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const riskColor = (level: string) => {
    const l = level.toLowerCase();
    if (l.includes('high')) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
    if (l.includes('moderate')) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' };
    if (l.includes('low') && !l.includes('very')) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
    return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
  };

  // ─── Fetch VTE Data ─────────────────────────────────
  const fetchVTEData = async () => {
    setFetching(true);
    setErrorMsg('');
    try {
      // Get active admissions
      let admissions: Admission[] = [];
      try {
        admissions = await admissionService.getActiveAdmissions();
      } catch {
        admissions = [];
      }

      if (admissions.length === 0) {
        setErrorMsg('No active admissions found.');
        setFetching(false);
        return;
      }

      // For each admission, get DVT risk assessment
      const data: PatientVTEData[] = [];
      for (const adm of admissions) {
        const patId = String(adm.patient_id);
        let patient: any = null;
        try {
          const allPatients = await patientService.getAllPatients();
          patient = allPatients?.find((p: any) => String(p.id) === patId);
        } catch {}

        let dvtAssessment: DVTRiskAssessment | undefined;
        let capriniScore = 0;
        let riskLevel = 'Not Assessed';
        let interpretation = 'No DVT risk assessment performed for this patient.';

        try {
          const assessments = await riskAssessmentService.getLatestRiskAssessments(patId);
          if (assessments.dvt) {
            dvtAssessment = assessments.dvt;
            const result = await riskAssessmentService.calculateDVTRisk(dvtAssessment);
            capriniScore = result.score;
            riskLevel = result.riskLevel;
            interpretation = result.interpretation;
          }
        } catch {}

        const daysAdmitted = daysBetween(adm.admission_date, new Date());

        data.push({
          patient: patient || { full_name: adm.patient_name, hospital_number: adm.hospital_number },
          admission: adm,
          dvtAssessment,
          capriniScore,
          riskLevel,
          interpretation,
          daysAdmitted,
        });
      }

      // Sort: highest risk first
      data.sort((a, b) => b.capriniScore - a.capriniScore);
      setVteData(data);
    } catch (err) {
      console.error('Error fetching VTE data:', err);
      setErrorMsg('Failed to fetch admission data.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchVTEData();
  }, []);

  // ─── Generate Slides ───────────────────────────────
  const generateSlides = async () => {
    if (vteData.length === 0) return;
    setLoading(true);

    try {
      const generatedSlides: SlideData[] = [];

      // ── 1. Title Slide ──
      generatedSlides.push({
        id: 'title',
        title: 'VTE PROPHYLAXIS AUDIT',
        subtitle: 'Venous Thromboembolism Risk Assessment & Compliance',
        type: 'title',
        content: (
          <div className="text-gray-500 space-y-1" style={{ fontSize: '16px' }}>
            <p>Burns, Plastic & Reconstructive Surgery UNIT</p>
            <p>Department of Surgery</p>
            <p>University of Nigeria Teaching Hospital, Enugu</p>
            <p className="mt-2 text-blue-600 font-semibold">{presentationDate}</p>
          </div>
        ),
      });

      // ── 2. Summary Slide ──
      const assessed = vteData.filter((d) => d.dvtAssessment);
      const notAssessed = vteData.filter((d) => !d.dvtAssessment);
      const highRisk = vteData.filter((d) => d.riskLevel.toLowerCase().includes('high'));
      const moderateRisk = vteData.filter((d) => d.riskLevel.toLowerCase().includes('moderate'));
      const lowRisk = vteData.filter(
        (d) => d.riskLevel.toLowerCase().includes('low') && !d.riskLevel.toLowerCase().includes('very')
      );
      const veryLowRisk = vteData.filter((d) => d.riskLevel.toLowerCase().includes('very'));

      generatedSlides.push({
        id: 'summary',
        title: 'Audit Summary',
        type: 'content',
        content: (
          <div className="space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-blue-600 font-bold" style={{ fontSize: '32px' }}>
                  {vteData.length}
                </p>
                <p className="text-blue-700 text-sm font-medium">Total Admitted</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-green-600 font-bold" style={{ fontSize: '32px' }}>
                  {assessed.length}
                </p>
                <p className="text-green-700 text-sm font-medium">Assessed</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-600 font-bold" style={{ fontSize: '32px' }}>
                  {notAssessed.length}
                </p>
                <p className="text-red-700 text-sm font-medium">Not Assessed</p>
              </div>
              <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-center">
                <p className="text-red-700 font-bold" style={{ fontSize: '24px' }}>
                  {highRisk.length}
                </p>
                <p className="text-red-600 text-sm">High Risk</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-orange-700 font-bold" style={{ fontSize: '24px' }}>
                  {moderateRisk.length}
                </p>
                <p className="text-orange-600 text-sm">Moderate Risk</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-green-700 font-bold" style={{ fontSize: '24px' }}>
                  {lowRisk.length + veryLowRisk.length}
                </p>
                <p className="text-green-600 text-sm">Low / Very Low</p>
              </div>
            </div>

            {/* Compliance rate */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700" style={{ fontSize: '20px' }}>
                  Assessment Compliance Rate
                </span>
                <span
                  className={`font-bold ${
                    (assessed.length / Math.max(vteData.length, 1)) * 100 >= 80
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                  style={{ fontSize: '28px' }}
                >
                  {Math.round((assessed.length / Math.max(vteData.length, 1)) * 100)}%
                </span>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    (assessed.length / Math.max(vteData.length, 1)) * 100 >= 80
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((assessed.length / Math.max(vteData.length, 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ),
      });

      // ── 3. Patient Summary Table ──
      // Show all patients in a table (split into pages of 6)
      const patientsPerTableSlide = 6;
      for (let i = 0; i < vteData.length; i += patientsPerTableSlide) {
        const chunk = vteData.slice(i, i + patientsPerTableSlide);
        const pageNum = Math.floor(i / patientsPerTableSlide) + 1;
        const totalPages = Math.ceil(vteData.length / patientsPerTableSlide);

        generatedSlides.push({
          id: `table-${pageNum}`,
          title: `All Patients${totalPages > 1 ? ` (Page ${pageNum}/${totalPages})` : ''}`,
          type: 'content',
          content: (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: '15px' }}>
                <thead>
                  <tr className="bg-green-50 border-b border-green-200">
                    <th className="px-2 py-2 font-bold text-green-800">Patient</th>
                    <th className="px-2 py-2 font-bold text-green-800">Hosp. No</th>
                    <th className="px-2 py-2 font-bold text-green-800">Ward</th>
                    <th className="px-2 py-2 font-bold text-green-800 text-center">Days</th>
                    <th className="px-2 py-2 font-bold text-green-800 text-center">Caprini</th>
                    <th className="px-2 py-2 font-bold text-green-800">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((d, idx) => {
                    const rc = riskColor(d.riskLevel);
                    return (
                      <tr
                        key={idx}
                        className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-2 py-2 font-medium">
                          {d.patient?.full_name || d.patient?.name || d.admission.patient_name}
                        </td>
                        <td className="px-2 py-2 text-gray-600">
                          {d.patient?.hospital_number || d.admission.hospital_number}
                        </td>
                        <td className="px-2 py-2 text-gray-600">
                          {d.admission.ward_location || 'N/A'}
                        </td>
                        <td className="px-2 py-2 text-center font-medium">{d.daysAdmitted}</td>
                        <td className="px-2 py-2 text-center font-bold">{d.capriniScore}</td>
                        <td className="px-2 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${rc.bg} ${rc.text}`}
                          >
                            {d.riskLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ),
        });
      }

      // ── 4. Per-Patient Slides ──
      vteData.forEach((d, idx) => {
        const rc = riskColor(d.riskLevel);
        const preventionMeasures = d.dvtAssessment?.prevention_measures;
        const implementedMeasures: string[] = [];
        if (preventionMeasures) {
          if (preventionMeasures.mechanical_prophylaxis) implementedMeasures.push('Mechanical Prophylaxis');
          if (preventionMeasures.pharmacological_prophylaxis) implementedMeasures.push('Pharmacological Prophylaxis');
          if (preventionMeasures.early_mobilization) implementedMeasures.push('Early Mobilization');
          if (preventionMeasures.hydration) implementedMeasures.push('Adequate Hydration');
          if (preventionMeasures.compression_stockings) implementedMeasures.push('Compression Stockings (TED)');
          if (preventionMeasures.sequential_compression_device) implementedMeasures.push('Sequential Compression Device (SCD)');
        }

        // Identified risk factors
        const identifiedRiskFactors: string[] = [];
        if (d.dvtAssessment?.risk_factors) {
          const rf = d.dvtAssessment.risk_factors;
          if (rf.age_41_60) identifiedRiskFactors.push('Age 41-60');
          if (rf.age_61_74) identifiedRiskFactors.push('Age 61-74');
          if (rf.age_over_75) identifiedRiskFactors.push('Age >75');
          if (rf.bmi_over_25) identifiedRiskFactors.push('BMI >25');
          if (rf.malignancy) identifiedRiskFactors.push('Malignancy');
          if (rf.major_surgery_45min) identifiedRiskFactors.push('Major Surgery >45min');
          if (rf.patient_confined_bed) identifiedRiskFactors.push('Confined to Bed');
          if (rf.immobilizing_cast) identifiedRiskFactors.push('Immobilizing Cast');
          if (rf.central_venous_access) identifiedRiskFactors.push('Central Venous Access');
          if (rf.personal_history_vte) identifiedRiskFactors.push('Personal History VTE');
          if (rf.family_history_vte) identifiedRiskFactors.push('Family History VTE');
          if (rf.sepsis_1month) identifiedRiskFactors.push('Sepsis <1 month');
          if (rf.chf_1month) identifiedRiskFactors.push('CHF <1 month');
          if (rf.varicose_veins) identifiedRiskFactors.push('Varicose Veins');
          if (rf.swollen_legs) identifiedRiskFactors.push('Swollen Legs');
          if (rf.stroke_1month) identifiedRiskFactors.push('Stroke <1 month');
          if (rf.hip_pelvis_fracture) identifiedRiskFactors.push('Hip/Pelvis Fracture');
          if (rf.acute_spinal_injury) identifiedRiskFactors.push('Acute Spinal Cord Injury');
          if (rf.elective_arthroplasty) identifiedRiskFactors.push('Elective Arthroplasty');
          if (rf.pregnancy_postpartum) identifiedRiskFactors.push('Pregnancy/Postpartum');
          if (rf.oral_contraceptives) identifiedRiskFactors.push('OCP/HRT');
          if (rf.inflammatory_bowel) identifiedRiskFactors.push('IBD');
          if (rf.laparoscopic_45min) identifiedRiskFactors.push('Laparoscopic >45min');
          if (rf.minor_surgery) identifiedRiskFactors.push('Minor Surgery');
          if (rf.medical_patient_bedrest) identifiedRiskFactors.push('Medical Patient on Bed Rest');
        }

        // Clinical signs
        const clinicalSigns: string[] = [];
        if (d.dvtAssessment?.clinical_signs) {
          const cs = d.dvtAssessment.clinical_signs;
          if (cs.localized_tenderness) clinicalSigns.push('Localized Tenderness');
          if (cs.swelling) clinicalSigns.push('Swelling');
          if (cs.calf_difference) clinicalSigns.push('Calf Size Difference');
          if (cs.pitting_edema) clinicalSigns.push('Pitting Edema');
          if (cs.collateral_veins) clinicalSigns.push('Collateral Superficial Veins');
          if (cs.warmth) clinicalSigns.push('Warmth');
          if (cs.erythema) clinicalSigns.push('Erythema');
        }

        generatedSlides.push({
          id: `patient-${idx}`,
          title: `${d.patient?.full_name || d.patient?.name || d.admission.patient_name}`,
          subtitle: `${d.patient?.hospital_number || d.admission.hospital_number} • ${d.admission.ward_location || 'Ward N/A'} • Day ${d.daysAdmitted}`,
          type: 'content',
          content: (
            <div className="space-y-4">
              {/* Caprini Score Badge */}
              <div className={`flex items-center justify-between ${rc.bg} border ${rc.border} rounded-lg p-4`}>
                <div>
                  <p className={`font-bold ${rc.text}`} style={{ fontSize: '22px' }}>
                    Caprini Score: {d.capriniScore}
                  </p>
                  <p className={`${rc.text} mt-1`} style={{ fontSize: '16px' }}>
                    {d.riskLevel} Risk
                  </p>
                </div>
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center font-bold ${rc.text} border-2 ${rc.border}`}
                  style={{ fontSize: '28px' }}
                >
                  {d.capriniScore}
                </div>
              </div>

              {/* Admission details */}
              <div className="grid grid-cols-2 gap-2" style={{ fontSize: '16px' }}>
                <p>
                  <strong>Admitted:</strong> {formatDate(d.admission.admission_date)}
                </p>
                <p>
                  <strong>Days:</strong> {d.daysAdmitted}
                </p>
                <p>
                  <strong>Diagnosis:</strong>{' '}
                  {d.admission.provisional_diagnosis || 'N/A'}
                </p>
                <p>
                  <strong>Route:</strong>{' '}
                  {d.admission.route_of_admission || 'N/A'}
                </p>
              </div>

              {/* Recommendation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-bold text-blue-800 mb-1" style={{ fontSize: '16px' }}>
                  Recommendation
                </p>
                <p className="text-blue-700" style={{ fontSize: '15px' }}>
                  {d.interpretation}
                </p>
              </div>

              {/* Risk factors */}
              {identifiedRiskFactors.length > 0 && (
                <div>
                  <p className="font-bold text-gray-700 mb-1" style={{ fontSize: '16px' }}>
                    Identified Risk Factors
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {identifiedRiskFactors.map((rf, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded-full text-yellow-800 text-xs"
                      >
                        {rf}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinical signs */}
              {clinicalSigns.length > 0 && (
                <div>
                  <p className="font-bold text-gray-700 mb-1" style={{ fontSize: '16px' }}>
                    Clinical Signs
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {clinicalSigns.map((cs, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-red-50 border border-red-200 rounded-full text-red-700 text-xs"
                      >
                        {cs}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Implemented prophylaxis */}
              <div>
                <p className="font-bold text-gray-700 mb-1" style={{ fontSize: '16px' }}>
                  DVT Prophylaxis Implemented
                </p>
                {implementedMeasures.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {implementedMeasures.map((m, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-red-500 italic" style={{ fontSize: '14px' }}>
                    {d.dvtAssessment
                      ? 'No prophylaxis measures documented'
                      : 'Assessment not performed'}
                  </p>
                )}
              </div>
            </div>
          ),
        });
      });

      // ── 5. Recommendations Slide ──
      generatedSlides.push({
        id: 'recommendations',
        title: 'Audit Recommendations',
        type: 'summary',
        content: (
          <div className="space-y-4">
            {[
              'All admitted surgical patients must have Caprini VTE risk assessment within 24 hours of admission',
              'Pharmacological prophylaxis (LMWH) should be initiated for Caprini score ≥ 3 unless contraindicated',
              'Mechanical prophylaxis (TED stockings / SCD) for all patients with moderate to high risk',
              'Early mobilization should be encouraged for all post-operative patients',
              'Daily reassessment of VTE risk upon change in clinical status or following surgery',
              'Documentation of VTE prophylaxis decisions and contraindications in patient records',
              'Multi-disciplinary audit compliance review at monthly departmental meetings',
            ].map((point, i) => (
              <div
                key={i}
                className="flex gap-4 items-start bg-blue-50 border-l-4 border-blue-600 p-3 rounded-r-lg"
              >
                <span
                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0"
                  style={{ fontSize: '14px' }}
                >
                  {i + 1}
                </span>
                <span className="text-gray-800" style={{ fontSize: '18px' }}>
                  {point}
                </span>
              </div>
            ))}
          </div>
        ),
      });

      // ── 6. Thank You ──
      generatedSlides.push({
        id: 'thankyou',
        title: 'Thank You',
        subtitle: 'Questions & Discussion',
        type: 'divider',
        content: <></>,
      });

      // Apply clinical images
      const finalSlides = generatedSlides.map((s) => ({
        ...s,
        image: clinicalImages[s.id] || s.image,
      }));

      setSlides(finalSlides);
      setShowPresentation(true);
    } catch (error) {
      console.error('Error generating VTE audit slides:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-7 h-7" />
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
            VTE Prophylaxis Audit
          </h2>
        </div>
        <p className="text-blue-100 text-sm">
          Audit Caprini VTE risk assessments for all currently admitted patients.
          Generate a professional presentation with per-patient risk analysis and prophylaxis compliance.
        </p>
      </div>

      {/* Status */}
      {fetching && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
          <p className="text-blue-700 font-medium">Fetching admission and VTE data...</p>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Live Preview */}
      {vteData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Current Admissions ({vteData.length} patients)
            </h3>
            <button
              onClick={fetchVTEData}
              disabled={fetching}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition"
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-2 font-semibold text-gray-600">Patient</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Ward</th>
                  <th className="px-4 py-2 font-semibold text-gray-600 text-center">Days</th>
                  <th className="px-4 py-2 font-semibold text-gray-600 text-center">Caprini</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Risk Level</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Prophylaxis</th>
                </tr>
              </thead>
              <tbody>
                {vteData.map((d, i) => {
                  const rc = riskColor(d.riskLevel);
                  const pm = d.dvtAssessment?.prevention_measures;
                  const hasProphylaxis = pm && (
                    pm.mechanical_prophylaxis ||
                    pm.pharmacological_prophylaxis ||
                    pm.compression_stockings ||
                    pm.sequential_compression_device
                  );
                  return (
                    <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-gray-800">
                          {d.patient?.full_name || d.patient?.name || d.admission.patient_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {d.patient?.hospital_number || d.admission.hospital_number}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {d.admission.ward_location || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-center font-medium">{d.daysAdmitted}</td>
                      <td className="px-4 py-2 text-center font-bold text-lg">
                        {d.dvtAssessment ? d.capriniScore : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${rc.bg} ${rc.text}`}
                        >
                          {d.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {d.dvtAssessment ? (
                          hasProphylaxis ? (
                            <span className="text-green-600 flex items-center gap-1 text-xs">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs">None documented</span>
                          )
                        ) : (
                          <span className="text-gray-400 italic text-xs">Not assessed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateSlides}
        disabled={vteData.length === 0 || loading}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Generating VTE Audit...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            Generate VTE Audit Presentation ({vteData.length} patients)
          </>
        )}
      </button>
    </div>
  );
}
