import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  User,
  BookOpen,
  FileText,
} from 'lucide-react';
import PresentationSlide, { SlideData } from './PresentationSlide';
import { patientService } from '../../services/patientService';
import { labService } from '../../services/labService';
import { wardRoundsService } from '../../services/wardRoundsService';
import { getTopicContent, getAvailableTopics, ClinicalTopicContent } from '../../utils/medicalContentDB';

interface Presenter {
  name: string;
  section: string;
}

export default function ClinicalConference() {
  // ─── State ──────────────────────────────────────────
  const [topic, setTopic] = useState('');
  const [presenters, setPresenters] = useState<Presenter[]>([
    { name: '', section: 'Case Summary' },
    { name: '', section: 'Surgical Anatomy' },
    { name: '', section: 'Pathology' },
    { name: '', section: 'Clinical Evaluation' },
    { name: '', section: 'Treatment Principles' },
  ]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>(
    localStorage.getItem('meeting_logo') || ''
  );
  const [clinicalImages, setClinicalImages] = useState<{ [slideId: string]: string }>({});
  const [presentationDate, setPresentationDate] = useState(
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  );

  const availableTopics = getAvailableTopics();

  // ─── Fetch patients ─────────────────────────────────
  useEffect(() => {
    patientService.getAllPatients().then((p) => setPatients(p || [])).catch(() => {});
  }, []);

  const filteredPatients = patients.filter((p) => {
    const search = patientSearch.toLowerCase();
    return (
      (p.full_name || p.name || '').toLowerCase().includes(search) ||
      (p.hospital_number || '').toLowerCase().includes(search)
    );
  });

  // ─── Presenter helpers ──────────────────────────────
  const updatePresenter = (i: number, field: keyof Presenter, value: string) => {
    setPresenters((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  };
  const addPresenter = () =>
    setPresenters((prev) => [...prev, { name: '', section: '' }]);
  const removePresenter = (i: number) =>
    setPresenters((prev) => prev.filter((_, idx) => idx !== i));

  // ─── Logo handling ──────────────────────────────────
  const handleSetLogo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          setLogoUrl(url);
          localStorage.setItem('meeting_logo', url);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // ─── Image attachment per slide ─────────────────────
  const attachImage = (slideId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          setClinicalImages((prev) => ({ ...prev, [slideId]: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // ─── Generate slides ───────────────────────────────
  const generateSlides = async () => {
    if (!topic.trim()) return;
    setLoading(true);

    try {
      const content: ClinicalTopicContent = getTopicContent(topic);
      const selectedPatient = patients.find(
        (p) => String(p.id) === selectedPatientId
      );

      // Fetch patient data if selected
      let patientLabs: any[] = [];
      let patientRounds: any[] = [];
      if (selectedPatientId) {
        try {
          patientLabs = await labService.getLabInvestigations(selectedPatientId);
        } catch { patientLabs = []; }
        try {
          patientRounds = await wardRoundsService.getPatientWardRounds(selectedPatientId);
        } catch { patientRounds = []; }
      }

      const generatedSlides: SlideData[] = [];

      // 1. Title Slide
      generatedSlides.push({
        id: 'title',
        title: topic.toUpperCase(),
        subtitle: 'Clinical Conference Presentation',
        type: 'title',
        content: (
          <div className="text-gray-500 space-y-1" style={{ fontSize: '16px' }}>
            <p>Burns, Plastic & Reconstructive Surgery UNIT</p>
            <p>Department of Surgery</p>
            <p>University of Nigeria Teaching Hospital, Enugu</p>
          </div>
        ),
      });

      // 2. Outline Slide
      generatedSlides.push({
        id: 'outline',
        title: 'Presentation Outline',
        type: 'content',
        content: (
          <div className="space-y-3">
            {[
              'Case Summary',
              'Relevant Surgical Anatomy',
              'Pathology & Pathophysiology',
              'Clinical Evaluations',
              'Laboratory Evaluation',
              'Treatment Principles',
              'Take Home Points',
              'References',
            ].map((section, i) => {
              const presenter = presenters.find(
                (p) => p.section.toLowerCase() === section.toLowerCase()
              );
              return (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-100">
                  <span
                    className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold flex-shrink-0"
                    style={{ fontSize: '14px' }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium" style={{ fontSize: '22px' }}>
                    {section}
                  </span>
                  {presenter?.name && (
                    <span className="text-green-600 italic" style={{ fontSize: '16px' }}>
                      — {presenter.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ),
      });

      // 3. Case Summary (if patient selected)
      if (selectedPatient) {
        const age = selectedPatient.date_of_birth
          ? Math.floor(
              (Date.now() - new Date(selectedPatient.date_of_birth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : 'N/A';

        generatedSlides.push({
          id: 'case-summary',
          title: 'Case Summary',
          type: 'content',
          content: (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-green-800 mb-2" style={{ fontSize: '22px' }}>
                  Patient Demographics
                </h3>
                <div className="grid grid-cols-2 gap-2" style={{ fontSize: '18px' }}>
                  <p><strong>Name:</strong> {selectedPatient.full_name || selectedPatient.name}</p>
                  <p><strong>Hospital No:</strong> {selectedPatient.hospital_number || 'N/A'}</p>
                  <p><strong>Age:</strong> {age} years</p>
                  <p><strong>Gender:</strong> {selectedPatient.gender || 'N/A'}</p>
                </div>
              </div>
              {(selectedPatient.allergies?.length > 0 || selectedPatient.comorbidities?.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedPatient.allergies?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-red-700" style={{ fontSize: '18px' }}>Allergies</h4>
                      <ul className="list-disc list-inside text-red-600" style={{ fontSize: '16px' }}>
                        {selectedPatient.allergies.map((a: string, i: number) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedPatient.comorbidities?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-orange-700" style={{ fontSize: '18px' }}>Comorbidities</h4>
                      <ul className="list-disc list-inside text-orange-600" style={{ fontSize: '16px' }}>
                        {selectedPatient.comorbidities.map((c: string, i: number) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {patientRounds.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-700" style={{ fontSize: '18px' }}>
                    Presenting Complaint
                  </h4>
                  <p style={{ fontSize: '18px' }}>
                    {patientRounds[0]?.chief_complaint || 'See clinical notes'}
                  </p>
                </div>
              )}
            </div>
          ),
        });
      } else {
        // No patient selected — placeholder
        generatedSlides.push({
          id: 'case-summary',
          title: 'Case Summary',
          type: 'content',
          content: (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <User className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p style={{ fontSize: '20px' }}>No patient selected for case study</p>
                <p style={{ fontSize: '16px' }}>Select a patient to auto-populate clinical data</p>
              </div>
            </div>
          ),
        });
      }

      // 4. Relevant Surgical Anatomy
      generatedSlides.push({
        id: 'anatomy',
        title: 'Relevant Surgical Anatomy',
        type: 'content',
        content: (
          <ul className="space-y-3">
            {content.anatomy.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></span>
                <span style={{ fontSize: '20px' }}>{item}</span>
              </li>
            ))}
          </ul>
        ),
      });

      // 5. Pathology
      generatedSlides.push({
        id: 'pathology',
        title: 'Pathology',
        type: 'content',
        content: (
          <ul className="space-y-3">
            {content.pathology.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                <span style={{ fontSize: '20px' }}>{item}</span>
              </li>
            ))}
          </ul>
        ),
      });

      // 6. Pathophysiology
      generatedSlides.push({
        id: 'pathophysiology',
        title: 'Pathophysiology',
        type: 'content',
        content: (
          <ul className="space-y-3">
            {content.pathophysiology.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                <span style={{ fontSize: '20px' }}>{item}</span>
              </li>
            ))}
          </ul>
        ),
      });

      // 7. Clinical Evaluations
      generatedSlides.push({
        id: 'clinical-eval',
        title: 'Clinical Evaluations',
        type: 'content',
        content: (
          <div className="space-y-4">
            <ul className="space-y-3">
              {content.clinicalEvaluation.map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-teal-500 flex-shrink-0"></span>
                  <span style={{ fontSize: '20px' }}>{item}</span>
                </li>
              ))}
            </ul>
            {/* Patient-specific clinical findings */}
            {selectedPatient && patientRounds.length > 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold text-yellow-800 mb-2" style={{ fontSize: '18px' }}>
                  Patient-Specific Findings
                </h4>
                <p style={{ fontSize: '16px' }}>
                  <strong>Examination:</strong>{' '}
                  {patientRounds[0]?.examination_findings || 'No examination findings recorded'}
                </p>
                {patientRounds[0]?.clinical_notes && (
                  <p className="mt-2" style={{ fontSize: '16px' }}>
                    <strong>Clinical Notes:</strong> {patientRounds[0].clinical_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        ),
      });

      // 8. Laboratory Evaluation
      generatedSlides.push({
        id: 'lab-eval',
        title: 'Laboratory Evaluation',
        type: 'content',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700" style={{ fontSize: '22px' }}>
              Recommended Investigations
            </h3>
            <ul className="space-y-2">
              {content.labEvaluation.map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0"></span>
                  <span style={{ fontSize: '20px' }}>{item}</span>
                </li>
              ))}
            </ul>

            {/* Patient-specific labs */}
            {patientLabs.length > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-800 mb-2" style={{ fontSize: '18px' }}>
                  Patient Lab Results
                </h4>
                <div className="space-y-2">
                  {patientLabs.slice(0, 6).map((lab: any, i: number) => (
                    <div key={i} className="flex justify-between items-center border-b border-blue-100 pb-1" style={{ fontSize: '16px' }}>
                      <span>{lab.clinical_indication || lab.tests?.[0]?.test_name || 'Lab Order'}</span>
                      <span className={`font-medium ${lab.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {lab.status || 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ),
      });

      // 9. Treatment Principles
      generatedSlides.push({
        id: 'treatment',
        title: 'Treatment Principles',
        type: 'content',
        content: (
          <ol className="space-y-3">
            {content.treatmentPrinciples.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span
                  className="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0"
                  style={{ fontSize: '13px' }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: '20px' }}>{item}</span>
              </li>
            ))}
          </ol>
        ),
      });

      // 10. Take Home Points
      generatedSlides.push({
        id: 'takeaway',
        title: 'Take Home Points',
        type: 'summary',
        content: (
          <div className="space-y-4">
            {content.takeHomePoints.map((item, i) => (
              <div
                key={i}
                className="flex gap-4 items-start bg-green-50 border-l-4 border-green-600 p-3 rounded-r-lg"
              >
                <span
                  className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0"
                  style={{ fontSize: '14px' }}
                >
                  {i + 1}
                </span>
                <span className="text-green-900" style={{ fontSize: '20px' }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        ),
      });

      // 11. References
      generatedSlides.push({
        id: 'references',
        title: 'References',
        type: 'content',
        content: (
          <ol className="space-y-3">
            {content.references.map((ref, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-green-600 font-bold flex-shrink-0" style={{ fontSize: '16px' }}>
                  [{i + 1}]
                </span>
                <span className="text-gray-700 italic" style={{ fontSize: '16px' }}>
                  {ref}
                </span>
              </li>
            ))}
          </ol>
        ),
      });

      // 12. Thank You
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
      console.error('Error generating slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => String(p.id) === selectedPatientId);

  // ─── Presentation Mode ──────────────────────────────
  if (showPresentation && slides.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPresentation(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition text-sm font-medium"
          >
            ← Back to Editor
          </button>
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  attachImage(s.id);
                }}
                className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded text-blue-600 transition"
                title={`Attach image to: ${s.title}`}
              >
                📷 {s.title.slice(0, 15)}
              </button>
            ))}
          </div>
        </div>
        <PresentationSlide
          slides={slides.map((s) => ({
            ...s,
            image: clinicalImages[s.id] || s.image,
          }))}
          onSlidesChange={(updated) => setSlides(updated)}
          institutionName="Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery, UNTH"
          logoUrl={logoUrl}
          watermarkText="UNTH Plastic Surgery"
          presenterName={presenters.find((p) => p.section === 'Case Summary')?.name || ''}
          presentationDate={presentationDate}
          onSetLogo={handleSetLogo}
        />
      </div>
    );
  }

  // ─── Editor Mode ────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-7 h-7" />
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
            Clinical Conference
          </h2>
        </div>
        <p className="text-green-100 text-sm">
          Generate professional WHO-standard clinical presentation slides.
          Select a topic and optionally a patient for case-based learning.
        </p>
      </div>

      {/* Topic Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-600" />
          Presentation Topic
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter topic (e.g., Keloid Management, Burn Care, Cleft Lip...)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            style={{ fontFamily: 'Georgia, serif' }}
          />
          {/* Quick topic suggestions */}
          <div className="flex flex-wrap gap-2">
            {availableTopics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t.charAt(0).toUpperCase() + t.slice(1))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  topic.toLowerCase() === t
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Presentation date */}
          <div className="flex items-center gap-4 mt-2">
            <label className="text-sm font-medium text-gray-600">Date:</label>
            <input
              type="text"
              value={presentationDate}
              onChange={(e) => setPresentationDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Patient Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-green-600" />
          Patient for Case Study <span className="text-sm font-normal text-gray-400">(Optional)</span>
        </h3>

        {selectedPatient ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
            <div>
              <p className="font-medium text-green-800">
                {selectedPatient.full_name || selectedPatient.name}
              </p>
              <p className="text-sm text-green-600">
                {selectedPatient.hospital_number || 'No hospital number'} •{' '}
                {selectedPatient.gender || 'N/A'}
              </p>
            </div>
            <button
              onClick={() => setSelectedPatientId('')}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="w-4 h-4" />
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
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
                      onClick={() => {
                        setSelectedPatientId(String(p.id));
                        setPatientSearch('');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 transition text-sm"
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

      {/* Presenters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Presenters <span className="text-sm font-normal text-gray-400">(shown on Outline slide)</span>
        </h3>
        <div className="space-y-3">
          {presenters.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="text"
                value={p.section}
                onChange={(e) => updatePresenter(i, 'section', e.target.value)}
                placeholder="Section"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                value={p.name}
                onChange={(e) => updatePresenter(i, 'name', e.target.value)}
                placeholder="Presenter name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              />
              {presenters.length > 1 && (
                <button
                  onClick={() => removePresenter(i)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addPresenter}
            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 font-medium"
          >
            <Plus className="w-4 h-4" /> Add Presenter
          </button>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateSlides}
        disabled={!topic.trim() || loading}
        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Generating Slides...
          </>
        ) : (
          <>
            <BookOpen className="w-5 h-5" />
            Generate Presentation
          </>
        )}
      </button>
    </div>
  );
}
