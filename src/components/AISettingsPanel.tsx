import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, RefreshCw, Activity, CheckCircle, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface AIStatus {
  enabled: boolean;
  hasOpenAI: boolean;
  governanceAllows: boolean;
  model?: string;
  message?: string;
}

/**
 * AI status for administrators.
 *
 * The OpenAI key is configured on the server (OPENAI_API_KEY in Vercel) and is
 * never shown to, entered in, or stored by the browser. This panel used to save
 * the key in localStorage, where any script on the page could read it. Whether
 * clinical text may be sent to OpenAI at all is decision D5 on the Clinical
 * Governance page.
 */
export function AISettingsPanel() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try { localStorage.removeItem('openai_api_key'); } catch { /* storage unavailable */ }
    try {
      setStatus(await apiClient.get('/ai/settings', { freshRead: true }) as AIStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r: any = await apiClient.post('/ai/chat', {
        purpose: 'connection_test', model: 'gpt-4o-mini', max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      });
      setTestResult({ ok: true, message: `Connected (${r?.model || 'model'}): "${String(r?.response || '').trim()}"` });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message || 'AI test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Server className="h-5 w-5 text-primary-600" /> AI configuration
        </h3>
        <button onClick={load} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Checking…</p>
      ) : !status ? (
        <p className="text-sm text-red-600 flex items-center gap-1"><XCircle className="h-4 w-4" /> Could not reach the server.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <Row ok={status.hasOpenAI} label="Server key (OPENAI_API_KEY)" okText="Configured" badText="Not set — add it in Vercel project settings" />
          <Row ok={status.governanceAllows} label="Unit decision D5 (external AI)" okText="Allowed, identifiers removed" badText="Switched off" />
          <div className={`flex items-start gap-2 p-3 rounded-lg ${status.enabled ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
            {status.enabled ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertTriangle className="h-4 w-4 mt-0.5" />}
            <span>{status.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={test}
          disabled={testing || !status?.enabled}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Activity className="h-4 w-4" /> {testing ? 'Testing…' : 'Test connection'}
        </button>
        <Link to="/clinical-governance" className="text-sm text-primary-700 hover:underline flex items-center gap-1">
          <ShieldCheck className="h-4 w-4" /> Clinical Governance (D1–D7)
        </Link>
      </div>
      {testResult && (
        <p className={`text-sm ${testResult.ok ? 'text-green-700' : 'text-red-600'}`}>{testResult.message}</p>
      )}
      <p className="text-xs text-gray-500">
        Patient names, hospital numbers, phone numbers and emails are removed on the server before any text is sent to
        OpenAI, and every AI request is recorded in the clinical audit log (model and purpose, not content).
      </p>
    </div>
  );
}

function Row({ ok, label, okText, badText }: { ok: boolean; label: string; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
      <span className="text-gray-600">{label}</span>
      <span className={`flex items-center gap-1 font-medium ${ok ? 'text-green-700' : 'text-red-600'}`}>
        {ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {ok ? okText : badText}
      </span>
    </div>
  );
}

export default AISettingsPanel;
