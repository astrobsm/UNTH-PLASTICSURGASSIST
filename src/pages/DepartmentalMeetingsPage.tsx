import { useState } from 'react';
import {
  BookOpen,
  AlertTriangle,
  ShieldCheck,
  Presentation,
} from 'lucide-react';
import ClinicalConference from '../components/meetings/ClinicalConference';
import MortalityReview from '../components/meetings/MortalityReview';
import VTEAudit from '../components/meetings/VTEAudit';

type TabKey = 'conference' | 'mortality' | 'vte';

const tabs: { key: TabKey; label: string; icon: typeof BookOpen; description: string }[] = [
  {
    key: 'conference',
    label: 'Clinical Conference',
    icon: Presentation,
    description: 'WHO-standard clinical presentations with auto-generated slides',
  },
  {
    key: 'mortality',
    label: 'Mortality Review',
    icon: AlertTriangle,
    description: 'Day-by-day clinical timeline for mortality cases',
  },
  {
    key: 'vte',
    label: 'VTE Audit',
    icon: ShieldCheck,
    description: 'Caprini score audit for all admitted patients',
  },
];

export default function DepartmentalMeetingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('conference');

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-green-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8" />
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Departmental Clinical Meetings
          </h1>
        </div>
        <p className="text-green-100 text-sm md:text-base">
          Professional presentation slides for clinical conferences, mortality reviews, and VTE audits.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="text-left">
                <div className="font-semibold">{tab.label}</div>
                <div
                  className={`text-xs hidden md:block ${
                    isActive ? 'text-green-100' : 'text-gray-400'
                  }`}
                >
                  {tab.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'conference' && <ClinicalConference />}
        {activeTab === 'mortality' && <MortalityReview />}
        {activeTab === 'vte' && <VTEAudit />}
      </div>
    </div>
  );
}
