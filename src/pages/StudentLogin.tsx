import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/students/login', { email, password });
      // Store token and user in auth store
      const store = useAuthStore.getState();
      // Sync the token into apiClient so subsequent authenticated requests
      // (dashboard, patients, clerkings, plans) include the Authorization header.
      apiClient.setToken(response.token);
      useAuthStore.setState({
        user: {
          id: String(response.user.id),
          name: response.user.fullName,
          email: response.user.email,
          role: 'student' as any,
          privileges: [],
          mustChangePassword: false,
        },
        token: response.token,
        loading: false,
      });
      localStorage.setItem('psa-token', response.token);
      localStorage.setItem('userId', String(response.user.id));
      localStorage.setItem('studentPostingEnd', response.user.postingEnd);
      navigate('/student-dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Student Login</h1>
          <p className="text-gray-500 text-sm mt-1">Plastic Surgery Clinical Posting</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="student@university.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10"
                placeholder="Enter password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-gray-400" aria-label="Toggle password visibility">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap className="w-5 h-5" />}
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <button onClick={() => navigate('/student-register')} className="text-green-600 font-medium hover:underline">
              Register here
            </button>
          </p>
          <p className="text-sm text-gray-500">
            <button onClick={() => navigate('/login')} className="text-gray-600 hover:underline">
              Staff Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
