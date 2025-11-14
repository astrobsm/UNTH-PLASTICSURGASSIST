import React, { useState, useEffect } from 'react';
import {
  Server,
  Save,
  RefreshCw,
  Eye,
  Lock,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export function AISettingsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success' | 'error', message: string} | null>(null);
  const [aiStatus, setAiStatus] = useState<'configured' | 'not-configured' | 'loading'>('loading');

  useEffect(() => {
    loadAISettings();
  }, []);

  const loadAISettings = async () => {
    try {
      const response = await fetch('/api/ai/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const keySetting = data.settings?.find((s: any) => s.setting_key === 'openai_api_key');
        if (keySetting) {
          setApiKey(keySetting.setting_value);
          setAiStatus('configured');
        } else {
          setAiStatus('not-configured');
        }
      } else {
        setAiStatus('not-configured');
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
      setAiStatus('not-configured');
    }
  };

  const handleSaveSettings = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an OpenAI API key');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          setting_key: 'openai_api_key',
          setting_value: apiKey
        })
      });

      if (response.ok) {
        setAiStatus('configured');
        alert('AI settings saved successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to save settings: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving AI settings:', error);
      alert('Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful medical assistant.' },
            { role: 'user', content: 'Say "AI integration working!" in one sentence.' }
          ],
          model: 'gpt-4',
          max_tokens: 50
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          status: 'success',
          message: data.choices[0].message.content
        });
      } else {
        const error = await response.json();
        setTestResult({
          status: 'error',
          message: error.error || 'AI test failed'
        });
      }
    } catch (error) {
      setTestResult({
        status: 'error',
        message: 'Failed to test AI connection'
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <Server className="h-5 w-5 text-blue-600" />
            <span>AI Configuration</span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure OpenAI integration for patient summaries, CME generation, and clinical insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {aiStatus === 'configured' && (
            <span className="flex items-center space-x-1 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>Configured</span>
            </span>
          )}
          {aiStatus === 'not-configured' && (
            <span className="flex items-center space-x-1 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Not Configured</span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OpenAI API Key
          </label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKey ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a>
          </p>
        </div>

        {aiStatus === 'configured' && (
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleTestAI}
              disabled={isTestingAI}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isTestingAI ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Testing AI...</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  <span>Test AI Connection</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={`mt-4 p-4 rounded-lg ${testResult.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start space-x-2">
                  {testResult.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${testResult.status === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                      {testResult.status === 'success' ? 'AI Connection Successful' : 'AI Connection Failed'}
                    </p>
                    <p className={`text-sm mt-1 ${testResult.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">AI Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>AI-powered patient summaries (admission, progress, discharge)</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Weekly CME topic generation from clinical data</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Clinical decision support and recommendations</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Treatment progress analysis</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
