/**
 * One patient's pre-surgical brief, as a deck.
 *
 * Written for the conference stage: when a presenter puts a case up, every
 * participant's own app renders this from the patient's id. Nobody is looking
 * at a compressed video of somebody else's screen, so the photographs stay
 * sharp, the numbers stay readable on a phone, and it costs a few kilobytes
 * rather than a continuous video stream.
 *
 * `slide` is controlled from outside so the presenter's page turns can be
 * mirrored to the room; left uncontrolled, it simply behaves as its own deck.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertTriangle, FileQuestion } from 'lucide-react';
import {
  preSurgicalConferenceService,
  type ConferenceData,
} from '../../services/preSurgicalConferenceService';

import ClinicalSummarySlide from './ClinicalSummarySlide';
import ComorbiditiesSlide from './ComorbiditiesSlide';
import VitalSignsSlide from './VitalSignsSlide';
import ClinicalPhotographsSlide from './ClinicalPhotographsSlide';
import LabResultsSlide from './LabResultsSlide';
import MedicationsSlide from './MedicationsSlide';
import AnaesthetistCommentsSlide from './AnaesthetistCommentsSlide';
import PlannedProceduresSlide from './PlannedProceduresSlide';
import ShoppingListStatusSlide from './ShoppingListStatusSlide';
import PreparingTeamSlide from './PreparingTeamSlide';

export interface CasePresentationProps {
  patientId: string;
  /** Current slide, when the deck is driven from outside. */
  slide?: number;
  /** Told when the deck moves, so a presenter can mirror it to the room. */
  onSlideChange?: (index: number) => void;
  /** Hides the built-in pager, for a viewer following somebody else. */
  followerMode?: boolean;
  className?: string;
}

export function CasePresentation({
  patientId, slide, onSlideChange, followerMode = false, className = '',
}: CasePresentationProps) {
  const [data, setData] = useState<ConferenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownSlide, setOwnSlide] = useState(0);

  const current = slide ?? ownSlide;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    preSurgicalConferenceService.getConferenceData(patientId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this case.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  /**
   * The deck, built from what this patient actually has.
   *
   * A section with nothing in it is left out rather than shown empty: at eight
   * in the evening the room wants the case, not ten slides saying "none
   * recorded". Clinical summary is always present, so the deck is never blank.
   */
  const slides = useMemo(() => {
    if (!data) return [];
    const deck: Array<{ key: string; title: string; node: React.ReactNode }> = [
      { key: 'summary', title: 'Clinical Summary', node: <ClinicalSummarySlide patient={data.patient} /> },
    ];
    if (data.comorbidities.length) {
      deck.push({ key: 'comorbid', title: 'Comorbidities', node: <ComorbiditiesSlide comorbidities={data.comorbidities} /> });
    }
    if (data.vitalSigns) {
      deck.push({ key: 'vitals', title: 'Vital Signs', node: <VitalSignsSlide vitalSigns={data.vitalSigns} /> });
    }
    if (data.clinicalPhotographs.length) {
      deck.push({ key: 'photos', title: 'Clinical Photographs', node: <ClinicalPhotographsSlide photographs={data.clinicalPhotographs} /> });
    }
    if (data.labResults.length) {
      deck.push({
        key: 'labs', title: 'Laboratory Results',
        node: <LabResultsSlide labResults={data.labResults} categorizedResults={preSurgicalConferenceService.categorizeLabResults(data.labResults)} />,
      });
    }
    if (data.medications.length) {
      deck.push({
        key: 'meds', title: 'Medications',
        node: <MedicationsSlide medications={data.medications} categorizedMedications={preSurgicalConferenceService.categorizeMedications(data.medications)} />,
      });
    }
    if (data.anaesthetistComments.length) {
      deck.push({ key: 'anaes', title: 'Anaesthetic Review', node: <AnaesthetistCommentsSlide comments={data.anaesthetistComments} /> });
    }
    if (data.plannedProcedures.length) {
      deck.push({ key: 'procedures', title: 'Planned Procedures', node: <PlannedProceduresSlide procedures={data.plannedProcedures} /> });
    }
    deck.push({ key: 'shopping', title: 'Consumables', node: <ShoppingListStatusSlide shoppingList={data.shoppingListStatus} /> });
    if (data.preparingTeam.length) {
      deck.push({ key: 'team', title: 'Preparing Team', node: <PreparingTeamSlide team={data.preparingTeam} /> });
    }
    return deck;
  }, [data]);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, slides.length - 1));
    if (slide === undefined) setOwnSlide(clamped);
    onSlideChange?.(clamped);
  }, [slides.length, slide, onSlideChange]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-gray-500 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading the case…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
        <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data || !slides.length) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center text-gray-500 ${className}`}>
        <FileQuestion className="w-8 h-8 mb-3 text-gray-300" />
        <p className="text-sm">Nothing has been recorded for this patient yet.</p>
      </div>
    );
  }

  const active = slides[Math.min(current, slides.length - 1)];

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {/* Section tabs — a consultant can jump straight to the bloods. */}
      <div className="flex items-center gap-1 overflow-x-auto border-b bg-white/60 px-2 py-1.5 shrink-0">
        {slides.map((s, i) => (
          <button
            key={s.key}
            onClick={() => go(i)}
            disabled={followerMode}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              i === current
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent'
            } ${followerMode ? 'cursor-default' : ''}`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
        {active.node}
      </div>

      {!followerMode && slides.length > 1 && (
        <div className="flex items-center justify-between border-t bg-white/60 px-3 py-2 text-sm shrink-0">
          <button
            onClick={() => go(current - 1)} disabled={current === 0}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-40 hover:bg-gray-200"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 tabular-nums">
            {current + 1} of {slides.length}
          </span>
          <button
            onClick={() => go(current + 1)} disabled={current === slides.length - 1}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white disabled:opacity-40 hover:bg-green-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default CasePresentation;
