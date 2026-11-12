/**
 * Standalone critical-care review — a case not (yet) linked to a registered
 * patient (referral calls, consults). For a registered patient use the review
 * from the patient's Encounters, which prefills from and saves to the record.
 */
import { HeartPulse } from 'lucide-react';
import { CriticalCareReview } from '../components/critical/CriticalCareReview';

export default function CriticalCarePage() {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HeartPulse className="w-6 h-6 text-red-600" />
        <div>
          <h1 className="text-xl font-semibold">Critical care review</h1>
          <p className="text-sm text-gray-600">Consultant-level decision support: critical alerts, calculations, organ systems, medication review, differential and plan. For a registered patient, open it from the patient's Encounters to prefill and save.</p>
        </div>
      </div>
      <CriticalCareReview patientId={null} />
    </div>
  );
}
