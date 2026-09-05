/**
 * Profile creation from a shared link.
 *
 * One page for everyone joining the unit — students, house officers,
 * registrars, senior registrars and consultants — replacing the arrangement
 * where only students could enrol themselves and every doctor had to be keyed
 * in by an administrator.
 *
 * Everyone except a consultant is on a rotation, so the form asks when theirs
 * starts and how long it runs. A consultant supervises rather than rotates and
 * is not asked.
 *
 * The page also offers to install the app, because the people using this link
 * are usually on a phone and about to need it there.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Stethoscope, UserPlus, CalendarDays, Loader2, CheckCircle,
  AlertCircle, Eye, EyeOff, Smartphone, Download, ArrowRight,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { UNTHLogo } from '../components/UNTHBranding';

interface RoleOption {
  value: string;
  label: string;
  rotates: boolean;
  defaultDays: number | null;
}

/** Offered lengths, with the plain-English name people actually use. */
const DURATIONS = [
  { days: 28, label: '4 weeks' },
  { days: 56, label: '8 weeks' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

const ROLE_ICON: Record<string, typeof GraduationCap> = {
  student: GraduationCap,
  house_officer: Stethoscope,
  junior_registrar: Stethoscope,
  registrar: Stethoscope,
  senior_registrar: Stethoscope,
  consultant: UserPlus,
};

export default function JoinPage() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [role, setRole] = useState<string>('');
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirm: '', phone: '',
    university: '', matricNumber: '',
    rotationStart: new Date().toISOString().slice(0, 10),
    rotationDays: 90,
    customDays: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { message: string; rotation?: { expected_end_date: string } }>(null);

  // The install prompt the browser offers, held until the user asks for it.
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    apiClient.get('/auth/join')
      .then((d) => {
        setRoles(d.roles || []);
        if (d.roles?.length) setRole(d.roles[0].value);
      })
      .catch(() => setError('Could not load the joining options. Check your connection and reload.'));
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const selected = useMemo(() => roles.find((r) => r.value === role), [roles, role]);
  const rotates = selected?.rotates ?? false;

  // Follow the role's own default whenever the role changes, so a consultant
  // switching to registrar does not inherit a student's eight weeks.
  useEffect(() => {
    if (selected?.defaultDays) setForm((f) => ({ ...f, rotationDays: selected.defaultDays!, customDays: '' }));
  }, [selected]);

  const effectiveDays = form.customDays.trim()
    ? Math.round(Number(form.customDays))
    : form.rotationDays;

  const endDate = useMemo(() => {
    if (!rotates || !form.rotationStart || !effectiveDays) return null;
    const d = new Date(form.rotationStart);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() + effectiveDays * 86400000).toISOString().slice(0, 10);
  }, [rotates, form.rotationStart, effectiveDays]);

  const install = async () => {
    if (!installPrompt) return;
    // The saved event is the only way to open the browser's install dialog.
    await (installPrompt as unknown as { prompt: () => Promise<void> }).prompt();
    setInstallPrompt(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim()) return setError('Please give your full name.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    if (rotates && (!effectiveDays || effectiveDays < 7)) {
      return setError('Rotation length must be at least a week.');
    }

    setLoading(true);
    try {
      const r = await apiClient.post('/auth/join', {
        role,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        university: form.university.trim() || undefined,
        matricNumber: form.matricNumber.trim() || undefined,
        rotationStart: rotates ? form.rotationStart : undefined,
        rotationDays: rotates ? effectiveDays : undefined,
      });
      setDone({ message: r.message, rotation: r.rotation });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-navy-800 to-navy-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Profile created</h1>
          <p className="text-gray-600 text-sm mb-4">{done.message}</p>

          {done.rotation && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900 mb-4">
              Your rotation runs to <strong>{done.rotation.expected_end_date?.slice(0, 10)}</strong>.
              You will be signed out automatically at the end if you have met the requirements.
            </div>
          )}

          <InstallCard installPrompt={installPrompt} installed={installed} onInstall={install} />

          <Link to="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-navy-700 hover:text-navy-900">
            Go to sign in <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-800 to-navy-900 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><UNTHLogo /></div>
          <h1 className="text-2xl font-bold text-white">Join the unit</h1>
          <p className="text-sky-200 text-sm mt-1">
            Create your profile. An administrator approves it before you can sign in.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 space-y-5">
          {/* Role */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-700 mb-2">I am joining as</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {roles.map((r) => {
                const Icon = ROLE_ICON[r.value] || UserPlus;
                const active = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-colors ${
                      active
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium leading-tight">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Identity */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" required>
              <input
                type="text" required value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputClass} placeholder="Dr Chidi Okafor"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass} placeholder="you@unth.edu.ng"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Password" required hint="At least 8 characters">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`${inputClass} pr-10`} minLength={8}
                />
                <button
                  type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm password" required>
              <input
                type={showPw ? 'text' : 'password'} required value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Student-only */}
          {role === 'student' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="University">
                <input
                  type="text" value={form.university}
                  onChange={(e) => setForm({ ...form, university: e.target.value })}
                  className={inputClass} placeholder="University of Nigeria"
                />
              </Field>
              <Field label="Matriculation number">
                <input
                  type="text" value={form.matricNumber}
                  onChange={(e) => setForm({ ...form, matricNumber: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {role !== 'student' && (
            <Field label="Phone" hint="Optional — used for duty reminders">
              <input
                type="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass} placeholder="080..."
              />
            </Field>
          )}

          {/* Rotation — everyone but the consultant */}
          {rotates ? (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sky-900">
                <CalendarDays className="w-4 h-4" />
                <h2 className="text-sm font-semibold">Your rotation</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Starts on" required>
                  <input
                    type="date" required value={form.rotationStart}
                    onChange={(e) => setForm({ ...form, rotationStart: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Runs for" required>
                  <select
                    value={form.customDays ? 'custom' : String(form.rotationDays)}
                    onChange={(e) => {
                      if (e.target.value === 'custom') setForm({ ...form, customDays: String(form.rotationDays) });
                      else setForm({ ...form, rotationDays: Number(e.target.value), customDays: '' });
                    }}
                    className={inputClass}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.days} value={d.days}>{d.label}</option>
                    ))}
                    <option value="custom">Another length…</option>
                  </select>
                </Field>
              </div>

              {form.customDays !== '' && (
                <Field label="Length in days" required>
                  <input
                    type="number" min={7} max={1098} value={form.customDays}
                    onChange={(e) => setForm({ ...form, customDays: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              )}

              {endDate && (
                <p className="text-xs text-sky-800">
                  Ending <strong>{endDate}</strong>. You are signed out automatically on that date if
                  you have met the requirements; if not, an administrator can extend it or sign you
                  out with a reason.
                </p>
              )}
            </div>
          ) : (
            selected && (
              <p className="text-xs text-gray-500 bg-gray-50 border rounded-lg p-3">
                Consultants supervise rather than rotate, so there are no rotation dates to set.
              </p>
            )
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit" disabled={loading || !role}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            {loading ? 'Creating your profile…' : 'Create my profile'}
          </button>

          <p className="text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-navy-700 font-medium hover:underline">Sign in</Link>
          </p>
        </form>

        <div className="mt-4">
          <InstallCard installPrompt={installPrompt} installed={installed} onInstall={install} dark />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const inputClass =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent';

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

/**
 * Offers to install the app.
 *
 * `beforeinstallprompt` only fires on browsers that support installing and only
 * when the app is not installed already, so the button appears when it can
 * actually do something. iOS never fires it, hence the written instructions.
 */
function InstallCard({ installPrompt, installed, onInstall, dark }: {
  installPrompt: Event | null; installed: boolean; onInstall: () => void; dark?: boolean;
}) {
  const isIOS = typeof navigator !== 'undefined'
    && /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (installed) {
    return (
      <p className={`text-center text-sm ${dark ? 'text-sky-200' : 'text-green-700'}`}>
        The app is installed on this device.
      </p>
    );
  }

  if (installPrompt) {
    return (
      <div className={`rounded-xl p-4 flex items-center gap-3 ${dark ? 'bg-white/10 text-white' : 'bg-navy-50 border border-navy-200'}`}>
        <Smartphone className={`w-8 h-8 shrink-0 ${dark ? 'text-sky-300' : 'text-navy-600'}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install on this phone</p>
          <p className={`text-xs ${dark ? 'text-sky-200' : 'text-gray-500'}`}>
            Works offline on the ward, and opens like any other app.
          </p>
        </div>
        <button
          type="button" onClick={onInstall}
          className="shrink-0 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
        >
          <Download className="w-4 h-4" /> Install
        </button>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className={`rounded-xl p-4 text-sm ${dark ? 'bg-white/10 text-sky-100' : 'bg-navy-50 border border-navy-200 text-gray-600'}`}>
        <p className="font-semibold mb-1 flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> Install on iPhone
        </p>
        <p className="text-xs">
          Tap the Share button, then <strong>Add to Home Screen</strong>.
        </p>
      </div>
    );
  }

  return null;
}
