import { useState } from 'react';
import {
  BookOpen, CheckCircle2, ClipboardCheck, Users, Activity,
  FileText, FlaskConical, Pill, HeartPulse, Calendar,
  ShoppingCart, Stethoscope, Brain, X, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── HO Responsibilities & App Usage Guide Content ───
const RESPONSIBILITIES_SECTIONS = [
  {
    title: '1. Patient Documentation & Clerking',
    icon: FileText,
    color: 'text-blue-600 bg-blue-50',
    responsibilities: [
      'Clerk all new admissions thoroughly — history, examination, and assessment.',
      'Update patient records daily during ward rounds.',
      'Document all procedures, investigations ordered, and results received.',
      'Ensure all entries are dated, timed, and signed (digitally via the app).',
    ],
    appUsage: [
      'Go to **Patients → Add Patient** to register new admissions.',
      'Use the **Patient Profile → Encounters** tab to document daily reviews.',
      'Use **Vital Signs** tab to record or scan (OCR) vital sign charts.',
      'Upload clinical photos in the **Photos** tab for wound/progress tracking.',
    ],
  },
  {
    title: '2. Ward Rounds Preparation & Follow-Up',
    icon: Activity,
    color: 'text-green-600 bg-green-50',
    responsibilities: [
      'Prepare patient summaries before consultant ward rounds.',
      'Present patients concisely — problems, progress, plan.',
      'Execute ward round decisions promptly (orders, referrals, investigations).',
      'Update treatment plans based on consultant directives.',
    ],
    appUsage: [
      'Use **Ward Rounds** page to document round findings in real-time.',
      'Review **Treatment Plans** for each patient before rounds.',
      'Use the **AI Medical Scribe** for voice-to-text round documentation.',
      'Mark completed orders and pending tasks in patient encounters.',
    ],
  },
  {
    title: '3. Investigation & Lab Orders',
    icon: FlaskConical,
    color: 'text-purple-600 bg-purple-50',
    responsibilities: [
      'Order all required investigations as directed by senior colleagues.',
      'Track and follow up on pending lab results.',
      'Communicate critical results to the team immediately.',
      'Ensure pre-operative workups are complete before surgery.',
    ],
    appUsage: [
      'Use **Labs** page to place lab orders and view results.',
      'Check the **Investigations** tab on each patient profile.',
      'Pre-operative checklists are available under **Pre-Surgical Conference**.',
      'Use **Notifications** to receive alerts on critical results.',
    ],
  },
  {
    title: '4. Prescriptions & Medication Management',
    icon: Pill,
    color: 'text-orange-600 bg-orange-50',
    responsibilities: [
      'Write prescriptions as directed by the team (under supervision).',
      'Ensure drug charts are up-to-date and allergies are documented.',
      'Monitor patients for adverse drug reactions.',
      'Coordinate with pharmacy for medication availability.',
    ],
    appUsage: [
      'Use **Prescriptions** page to create and manage prescriptions.',
      'Patient allergies are visible on the **Patient Profile** header.',
      'Drug database with dosing is built into the prescription module.',
      'Use the **Shopping List** to flag unavailable consumables/medications.',
    ],
  },
  {
    title: '5. Wound Care & Dressings',
    icon: HeartPulse,
    color: 'text-red-600 bg-red-50',
    responsibilities: [
      'Perform daily wound assessments and dressing changes.',
      'Document wound dimensions, type, and healing phase.',
      'Follow wound care protocols specific to wound type (burns, keloid, pressure sores, etc.).',
      'Report any wound deterioration to the senior registrar.',
    ],
    appUsage: [
      'Document wounds in **Patient Profile → Wounds** tab.',
      'Use **Wound Care**, **Burn Care**, **Keloid Care**, or **Pressure Sore** specialized pages.',
      'Capture wound photos for progress comparison over time.',
      'Record dressing materials used for consumables tracking.',
    ],
  },
  {
    title: '6. Theatre & Surgical Duties',
    icon: Calendar,
    color: 'text-indigo-600 bg-indigo-50',
    responsibilities: [
      'Prepare patients for surgery (consent, pre-op checklist, blood grouping).',
      'Assist in theatre as directed by the operating surgeon.',
      'Write operative notes immediately after procedures.',
      'Manage post-operative orders and monitoring.',
    ],
    appUsage: [
      'Check **Booking Register** for upcoming surgeries.',
      'Complete **Pre-Surgical Conference** checklist before theatre.',
      'Book emergency cases via **Dashboard → Emergency Surgery** button.',
      'Document operative findings in the patient encounter notes.',
    ],
  },
  {
    title: '7. Admissions & Discharges',
    icon: Users,
    color: 'text-teal-600 bg-teal-50',
    responsibilities: [
      'Process all new admissions and ensure bed allocation.',
      'Prepare discharge summaries for patients being sent home.',
      'Ensure discharge medications and follow-up appointments are arranged.',
      'Hand over unstable patients clearly to the on-call team.',
    ],
    appUsage: [
      'Use **Admission & Discharge** page for managing bed status.',
      'Dashboard shows all admitted patients and their assignments.',
      'Use **Patient Summaries** to generate discharge documents.',
      'Record follow-up clinic dates in **Clinic Appointments**.',
    ],
  },
  {
    title: '8. On-Call & Emergency Duties',
    icon: Stethoscope,
    color: 'text-amber-600 bg-amber-50',
    responsibilities: [
      'Respond to all calls promptly — attend emergencies without delay.',
      'Triage and stabilize emergency patients before escalating.',
      'Document all after-hours activities in the patient record.',
      'Hand over all overnight events to the morning team.',
    ],
    appUsage: [
      'Check **Call Duty Roster** for your on-call schedule.',
      'Use the **Chat** feature to communicate with seniors in real-time.',
      'Document emergency encounters immediately in the patient profile.',
      'Use **Notifications** and **Notice Board** for team communication.',
    ],
  },
  {
    title: '9. Continuous Medical Education (CME)',
    icon: Brain,
    color: 'text-pink-600 bg-pink-50',
    responsibilities: [
      'Attend all departmental meetings, seminars, and case presentations.',
      'Prepare and present topics as assigned.',
      'Complete CBT assessments and MCQ modules.',
      'Maintain your training logbook and track procedures performed.',
    ],
    appUsage: [
      'Access **Medical Training** page for educational modules and MCQs.',
      'Track your progress on the **HO Tracking** page.',
      'View **Departmental Meetings** schedule and agendas.',
      'Your CBT scores and training completion are tracked automatically.',
    ],
  },
  {
    title: '10. Consumables & Inventory',
    icon: ShoppingCart,
    color: 'text-cyan-600 bg-cyan-50',
    responsibilities: [
      'Ensure adequate supplies for dressings, medications, and procedures.',
      'Report shortages to the appropriate channels.',
      'Use consumables judiciously and avoid wastage.',
      'Document all items used per patient for auditing.',
    ],
    appUsage: [
      'Use **Shopping List** to request and track consumables.',
      'Record materials used during wound dressings in patient notes.',
      'View consumable usage reports in the admin panel.',
    ],
  },
];

const SIGNOUT_CRITERIA = [
  'All assigned patients must be documented daily with updated encounter notes.',
  'Vital signs must be recorded at least twice daily for admitted patients.',
  'All investigation results must be reviewed and documented.',
  'Wound assessments must be completed and photographed for active wound patients.',
  'Treatment plans must be current and reflect latest consultant directives.',
  'Discharge summaries must be completed before patient discharge.',
  'Pre-operative checklists must be completed for all surgical patients.',
  'All prescribed medications must be charted in the prescriptions module.',
  'On-call handover notes must be documented at shift end.',
  'CBT assessments and training modules must be attempted as scheduled.',
  'Ward round notes must be entered by end of ward round session.',
  'All emergency consultations must be documented within 1 hour of assessment.',
];

interface HOResponsibilitiesGuideProps {
  mode: 'acknowledgment' | 'reference';
  onAcknowledge?: () => void;
  onClose?: () => void;
}

export default function HOResponsibilitiesGuide({ mode, onAcknowledge, onClose }: HOResponsibilitiesGuideProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    if (expandedSections.size === RESPONSIBILITIES_SECTIONS.length) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(RESPONSIBILITIES_SECTIONS.map((_, i) => i)));
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setHasScrolledToEnd(true);
    }
  };

  const handleAcknowledge = async () => {
    if (!acknowledged) return;
    setConfirming(true);
    try {
      onAcknowledge?.();
    } finally {
      setConfirming(false);
    }
  };

  const isAcknowledgmentMode = mode === 'acknowledgment';
  const allExpanded = expandedSections.size === RESPONSIBILITIES_SECTIONS.length;

  return (
    <div className={isAcknowledgmentMode
      ? 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-0 sm:p-4'
      : ''
    }>
      <div className={isAcknowledgmentMode
        ? 'bg-white rounded-none sm:rounded-xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col'
        : 'bg-white rounded-xl border border-gray-200 shadow-sm w-full flex flex-col max-h-[80vh]'
      }>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100 sm:rounded-t-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {isAcknowledgmentMode ? 'House Officer Orientation' : 'HO Responsibilities & App Guide'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                {isAcknowledgmentMode
                  ? 'Please read carefully and acknowledge before proceeding'
                  : 'Reference guide for clinical workflows and app usage'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-2 py-1 rounded bg-green-200 text-green-800 hover:bg-green-300"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
            {!isAcknowledgmentMode && onClose && (
              <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3"
          onScroll={isAcknowledgmentMode ? handleScroll : undefined}
        >
          {/* Introduction */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Welcome to the Plastic Surgery Unit
            </h3>
            <p className="text-sm text-blue-800">
              As a House Officer in the Plastic Surgery Department, you play a vital role in patient care.
              This guide outlines your responsibilities and shows you how to use this application to
              fulfil your duties efficiently, meet sign-out criteria, and ensure comprehensive patient documentation.
            </p>
          </div>

          {/* Responsibilities Sections */}
          {RESPONSIBILITIES_SECTIONS.map((section, idx) => {
            const isExpanded = expandedSections.has(idx);
            const Icon = section.icon;
            return (
              <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${section.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm sm:text-base text-gray-900">{section.title}</span>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                </button>

                {isExpanded && (
                  <div className="px-4 py-3 space-y-3">
                    {/* Responsibilities */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Your Responsibilities</h4>
                      <ul className="space-y-1.5">
                        {section.responsibilities.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* App Usage */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-green-700 mb-2">How to Use the App</h4>
                      <ul className="space-y-1.5">
                        {section.appUsage.map((u, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                            <span className="text-green-600 font-bold mt-0.5 shrink-0">→</span>
                            <span dangerouslySetInnerHTML={{ __html: u.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sign-Out Criteria */}
          <div className="border-2 border-red-200 rounded-lg overflow-hidden">
            <div className="bg-red-50 px-4 py-3">
              <h3 className="font-bold text-red-900 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-red-600" />
                Sign-Out Criteria Checklist
              </h3>
              <p className="text-xs text-red-700 mt-1">
                You must consistently meet the following criteria throughout your posting for a successful sign-out.
              </p>
            </div>
            <div className="px-4 py-3">
              <ol className="space-y-2">
                {SIGNOUT_CRITERIA.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="bg-red-100 text-red-700 font-bold text-xs rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Your performance on these criteria is tracked via the{' '}
              <strong>HO Tracking</strong> page, which your consultants and senior registrars can review
              at any time. Consistent use of this application for documentation ensures your efforts
              are visible and your patients receive the best care.
            </p>
          </div>
        </div>

        {/* Footer — Acknowledgment or Close */}
        <div className="border-t border-gray-200 px-4 sm:px-6 py-4 bg-gray-50 sm:rounded-b-xl shrink-0">
          {isAcknowledgmentMode ? (
            <div className="space-y-3">
              {!hasScrolledToEnd && (
                <p className="text-xs text-amber-600 text-center">
                  ↓ Please scroll through the entire document to enable acknowledgment
                </p>
              )}
              <label className={`flex items-start gap-3 cursor-pointer ${!hasScrolledToEnd ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  disabled={!hasScrolledToEnd}
                  className="mt-0.5 h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  I have read and understood my responsibilities as a House Officer in the Plastic Surgery Department.
                  I understand how to use this application to meet the sign-out criteria and will use it diligently
                  throughout my posting.
                </span>
              </label>
              <button
                onClick={handleAcknowledge}
                disabled={!acknowledged || confirming}
                className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg
                  hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2 transition-colors"
              >
                {confirming ? (
                  <>Processing...</>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    I Acknowledge — Proceed to Dashboard
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compact card for Dashboard reference ───
export function HOResponsibilitiesCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="card p-4 sm:p-5 border-l-4 border-green-500">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-green-100 rounded-lg shrink-0">
            <BookOpen className="h-5 w-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">HO Responsibilities & App Guide</h3>
            <p className="text-xs text-gray-500 truncate">Sign-out criteria, duties & how to use this app</p>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          View Guide
        </button>
      </div>
    </div>
  );
}
