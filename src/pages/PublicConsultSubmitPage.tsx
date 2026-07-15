/**
 * Public Consult Submission Page
 * Accessible without authentication via /submit-consult/:token
 *
 * Other clinical units use a shareable link (created by PSU staff) to send
 * an electronic consult to the plastic surgery unit. The submitting unit
 * MUST provide a phone number — this is how PSU sends back SMS feedback.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardCheck, AlertTriangle, CheckCircle2, Phone, Loader2 } from 'lucide-react';
import { publicVerifyLink, publicSubmitConsult, REFERRING_DEPARTMENTS, REFERRING_UNITS, type Urgency } from '../services/consultsModuleService';

interface FormState {
  patient_name: string;
  hospital_number: string;
  age: string;
  sex: string;
  ward: string;
  bed_number: string;
  // Referring unit / inviting team
  referring_hospital: string;
  referring_department: string;
  referring_unit: string;
  referring_consultant: string;
  referring_consultant_phone: string;
  referring_senior_registrar_name: string;
  referring_senior_registrar_phone: string;
  referring_registrar_name: string;
  referring_registrar_phone: string;
  referring_house_officer_name: string;
  referring_house_officer_phone: string;
  referring_medical_officer_name: string;
  referring_medical_officer_phone: string;
  referring_doctor_name: string;
  referring_doctor_role: string;
  referring_phone: string;
  referring_alt_phone: string;
  primary_diagnosis: string;
  presenting_complaint: string;
  history_summary: string;
  examination_summary: string;
  investigations_summary: string;
  indication: string;
  urgency: Urgency;
  requested_input: string;
}

const EMPTY: FormState = {
  patient_name: '', hospital_number: '', age: '', sex: '', ward: '', bed_number: '',
  referring_hospital: '', referring_department: '', referring_unit: '',
  referring_consultant: '', referring_consultant_phone: '',
  referring_senior_registrar_name: '', referring_senior_registrar_phone: '',
  referring_registrar_name: '', referring_registrar_phone: '',
  referring_house_officer_name: '', referring_house_officer_phone: '',
  referring_medical_officer_name: '', referring_medical_officer_phone: '',
  referring_doctor_name: '', referring_doctor_role: '',
  referring_phone: '', referring_alt_phone: '',
  primary_diagnosis: '', presenting_complaint: '', history_summary: '',
  examination_summary: '', investigations_summary: '',
  indication: '', urgency: 'routine', requested_input: '',
};

export default function PublicConsultSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [linkInfo, setLinkInfo] = useState<{ unit_label: string; description?: string | null } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLinkError('No link token provided'); setVerifying(false); return; }
    publicVerifyLink(token)
      .then((info) => setLinkInfo({ unit_label: info.unit_label, description: info.description }))
      .catch((e) => setLinkError(e.message || 'This link is no longer active.'))
      .finally(() => setVerifying(false));
  }, [token]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    // Client-side checks
    const missing: string[] = [];
    if (!form.patient_name.trim()) missing.push('Patient name');
    if (!form.referring_hospital.trim()) missing.push('Referring hospital');
    if (!form.referring_department.trim()) missing.push('Referring department');
    if (!form.referring_unit.trim()) missing.push('Referring unit');
    if (!form.referring_consultant.trim()) missing.push('Referring consultant');
    if (!form.ward.trim()) missing.push('Ward');
    if (!form.referring_doctor_name.trim()) missing.push('Your name');
    if (!form.referring_phone.trim()) missing.push('Your phone number');
    if (!form.indication.trim()) missing.push('Reason for referral');
    if (missing.length) { setError(`Please complete: ${missing.join(', ')}`); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age, 10) : undefined,
        referral_priority: form.urgency,
        reason_for_referral: form.indication,
        referral_datetime: new Date().toISOString(),
      };
      const r = await publicSubmitConsult(token, payload);
      setSubmitted({ ref: r.consult_ref, message: r.message });
      setForm(EMPTY);
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Verifying link…</div>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md bg-white border border-red-200 rounded-lg p-6 shadow-sm text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Link not available</h1>
          <p className="text-sm text-gray-600">{linkError}</p>
          <p className="text-xs text-gray-500 mt-3">Please contact the Plastic Surgery Unit for a new submission link.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md bg-white border border-green-200 rounded-lg p-6 shadow-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-1">Consult submitted</h1>
          <p className="text-sm text-gray-600 mb-3">{submitted.message}</p>
          <div className="bg-gray-50 rounded p-3 text-sm">
            <div className="text-gray-500">Reference number</div>
            <div className="font-mono font-semibold text-green-700 text-lg">{submitted.ref}</div>
          </div>
          <button
            onClick={() => setSubmitted(null)}
            className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >Submit another consult</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardCheck className="w-7 h-7 text-green-600" />
            <h1 className="text-xl font-bold text-gray-900">Plastic Surgery Consult Request</h1>
          </div>
          <p className="text-sm text-gray-600">
            Submit a consult to the <span className="font-medium text-gray-900">Plastic Surgery Unit</span>. Please complete every required field below — your unit and phone number are how we route the consult and send SMS feedback.
          </p>
          {linkInfo?.description && <p className="text-xs text-gray-500 mt-1">{linkInfo.description}</p>}
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
            <Phone className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>The phone number you enter will be used by the plastic surgery team to send you SMS feedback on this consult. Please double-check it.</span>
          </div>
        </header>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Patient">
            <Field label="Patient name *"      value={form.patient_name}     onChange={v => update('patient_name', v)} />
            <Field label="Hospital number"     value={form.hospital_number}  onChange={v => update('hospital_number', v)} />
            <Field label="Age"                 value={form.age}              onChange={v => update('age', v)} type="number" />
            <Select label="Sex"                value={form.sex}              onChange={v => update('sex', v)} options={['', 'Male', 'Female']} />
            <Field label="Ward"                value={form.ward}             onChange={v => update('ward', v)} />
            <Field label="Bed number"          value={form.bed_number}       onChange={v => update('bed_number', v)} />
          </Section>

          <Section title="Referring unit / inviting team">
            <Field label="Referring hospital *"    value={form.referring_hospital}     onChange={v => update('referring_hospital', v)} placeholder="e.g. UNTH, Ituku-Ozalla" />
            <Field label="Referring department *"  value={form.referring_department}   onChange={v => update('referring_department', v)} list="ref-departments" options={REFERRING_DEPARTMENTS} placeholder="e.g. General Surgery" />
            <Field label="Referring unit *"        value={form.referring_unit}         onChange={v => update('referring_unit', v)} list="ref-units" options={REFERRING_UNITS} placeholder="e.g. Trauma Unit" />
            <Select label="Referral priority *"
              value={form.urgency}
              onChange={v => update('urgency', v as Urgency)}
              options={['routine', 'urgent', 'emergency']}
              renderLabel={(o) => o.charAt(0).toUpperCase() + o.slice(1)}
            />
            <Field label="Referring consultant *"  value={form.referring_consultant}          onChange={v => update('referring_consultant', v)} />
            <Field label="Consultant phone"        value={form.referring_consultant_phone}    onChange={v => update('referring_consultant_phone', v)} type="tel" />
            <Field label="Senior registrar"        value={form.referring_senior_registrar_name}  onChange={v => update('referring_senior_registrar_name', v)} />
            <Field label="Senior registrar phone"  value={form.referring_senior_registrar_phone} onChange={v => update('referring_senior_registrar_phone', v)} type="tel" />
            <Field label="Registrar"               value={form.referring_registrar_name}      onChange={v => update('referring_registrar_name', v)} />
            <Field label="Registrar phone"         value={form.referring_registrar_phone}     onChange={v => update('referring_registrar_phone', v)} type="tel" />
            <Field label="House officer"           value={form.referring_house_officer_name}  onChange={v => update('referring_house_officer_name', v)} />
            <Field label="House officer phone"     value={form.referring_house_officer_phone} onChange={v => update('referring_house_officer_phone', v)} type="tel" />
            <Field label="Medical officer"         value={form.referring_medical_officer_name}  onChange={v => update('referring_medical_officer_name', v)} />
            <Field label="Medical officer phone"   value={form.referring_medical_officer_phone} onChange={v => update('referring_medical_officer_phone', v)} type="tel" />
          </Section>

          <Section title="Your contact (for SMS feedback)">
            <Field label="Your name *"             value={form.referring_doctor_name}  onChange={v => update('referring_doctor_name', v)} />
            <Field label="Your role"               value={form.referring_doctor_role}  onChange={v => update('referring_doctor_role', v)} placeholder="e.g. Senior Registrar" />
            <Field label="Phone number * (for SMS feedback)" value={form.referring_phone} onChange={v => update('referring_phone', v)} type="tel" placeholder="08012345678" />
            <Field label="Alternate phone"         value={form.referring_alt_phone}    onChange={v => update('referring_alt_phone', v)} type="tel" />
          </Section>

          <Section title="Clinical summary">
            <Textarea label="Primary diagnosis"            value={form.primary_diagnosis}      onChange={v => update('primary_diagnosis', v)} />
            <Textarea label="Presenting complaint"         value={form.presenting_complaint}   onChange={v => update('presenting_complaint', v)} />
            <Textarea label="Brief history"                value={form.history_summary}        onChange={v => update('history_summary', v)} />
            <Textarea label="Examination findings"         value={form.examination_summary}    onChange={v => update('examination_summary', v)} />
            <Textarea label="Relevant investigations"      value={form.investigations_summary} onChange={v => update('investigations_summary', v)} />
          </Section>

          <Section title="Reason for referral">
            <Textarea label="Reason for referral / indication for plastic surgery consult *" value={form.indication} onChange={v => update('indication', v)} required />
            <Textarea label="What input do you need?"                  value={form.requested_input} onChange={v => update('requested_input', v)} placeholder="e.g. opinion, take-over, theatre booking" />
          </Section>

          <div className="bg-white border border-gray-200 rounded-lg p-4 sticky bottom-4 shadow-md flex items-center justify-between">
            <p className="text-xs text-gray-500">By submitting you confirm the patient details above are accurate.</p>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit consult'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tiny presentational helpers ─────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-white border border-gray-200 rounded-lg p-4">
      <legend className="px-2 text-sm font-semibold text-gray-700">{title}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}
function Field({ label, value, onChange, type = 'text', placeholder, list, options }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; list?: string; options?: string[] }) {
  return (
    <label className="block sm:col-span-1">
      <span className="text-xs text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        list={list}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
      />
      {list && options && (
        <datalist id={list}>
          {options.map(o => <option key={o} value={o} />)}
        </datalist>
      )}
    </label>
  );
}
function Select({ label, value, onChange, options, renderLabel }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; renderLabel?: (o: string) => string;
}) {
  return (
    <label className="block sm:col-span-1">
      <span className="text-xs text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white"
      >
        {options.map(o => <option key={o} value={o}>{renderLabel ? renderLabel(o) : (o || '— Select —')}</option>)}
      </select>
    </label>
  );
}
function Textarea({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block sm:col-span-2">
      <span className="text-xs text-gray-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={3}
        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
      />
    </label>
  );
}
