import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Stethoscope, UserPlus, LogIn, X, Eye, EyeOff, Phone, Key } from 'lucide-react';
import { userManagementService } from '../services/userManagementService';
import { loginRateLimiter } from '../utils/rateLimiter';
import { validateEmail, validatePassword } from '../utils/validation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { login } = useAuthStore();

  // Forgot-password (self-service reset request) state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  const submitResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');
    try {
      const base = (import.meta as any).env?.VITE_API_BASE_URL
        || ((import.meta as any).env?.PROD ? '/api' : 'http://localhost:3005/api');
      const resp = await fetch(`${base}/users/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await resp.json().catch(() => ({}));
      setForgotMessage(data.message || 'If that account exists, a reset request has been sent to the administrators.');
    } catch {
      setForgotMessage('Request sent. If you remain locked out, contact your administrator.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Registration form state
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'house_officer' as 'senior_registrar' | 'junior_registrar' | 'medical_officer' | 'house_officer' | 'consultant',
    phone: '',
    department: '',
    registration_number: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Validate: require non-empty input (accept username or email)
    if (!email.trim()) {
      setError('Username or email is required');
      setLoading(false);
      return;
    }
    
    // Check rate limit before attempting login
    const rateLimitKey = email.toLowerCase();
    if (loginRateLimiter.isRateLimited(rateLimitKey)) {
      const resetTime = loginRateLimiter.getResetTimeFormatted(rateLimitKey);
      setError(`Too many login attempts. Please try again in ${resetTime}.`);
      setLoading(false);
      return;
    }
    
    try {
      // Record attempt
      loginRateLimiter.attempt(rateLimitKey);
      
      await login(email, password);
      
      // Clear rate limit on successful login
      loginRateLimiter.clear(rateLimitKey);
    } catch (error: any) {
      // Show remaining attempts
      const remaining = loginRateLimiter.getRemainingAttempts(rateLimitKey);
      const attemptText = remaining > 0 
        ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` 
        : '';
      setError((error.message || 'Login failed. Please check your credentials.') + attemptText);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validation
    const emailValidation = validateEmail(regData.email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Invalid email format');
      return;
    }

    if (regData.password !== regData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(regData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error || 'Password does not meet requirements');
      return;
    }

    setLoading(true);

    try {
      const service = userManagementService;
      await service.submitRegistrationRequest({
        name: regData.name,
        email: regData.email,
        password: regData.password,
        role: regData.role,
        phone: regData.phone,
        department: regData.department,
        registration_number: regData.registration_number
      });

      setSuccessMessage('Registration request submitted successfully! Your account will be activated once approved by the administrator.');
      
      // Reset form
      setRegData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'house_officer',
        phone: '',
        department: '',
        registration_number: ''
      });
      
      // Close modal after 2 seconds to show success message
      setTimeout(() => {
        setShowRegistration(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinical-light px-4 py-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <img 
            src="/logo.png" 
            alt="Plastic Surgery Logo" 
            className="mx-auto h-16 w-16 sm:h-20 sm:w-20 object-contain"
          />
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-clinical-dark">
            Plastic Surgeon Assistant
          </h2>
          <p className="mt-2 text-sm text-clinical">
            Sign in to access clinical workflows
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="form-label">
                Username or Email
              </label>
              <input
                id="email"
                name="email"
                type="text"
                required
                className="form-input"
                placeholder="admin or doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
          >
            <LogIn className="h-5 w-5" />
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          
          <button
            type="button"
            onClick={() => setShowRegistration(true)}
            className="w-full btn-secondary py-3 text-base flex items-center justify-center gap-2"
          >
            <UserPlus className="h-5 w-5" />
            Create New Profile
          </button>

          <button
            type="button"
            onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotMessage(''); }}
            className="w-full text-sm text-green-700 hover:underline pt-1"
          >
            Forgot password?
          </button>
        </form>
      </div>

      {/* Forgot-password modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2"><Key className="h-5 w-5 text-green-600" /> Reset password</h3>
              <button type="button" onClick={() => setShowForgot(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitResetRequest} className="p-5 space-y-3">
              <p className="text-sm text-gray-500">
                Enter your account email. An administrator will reset your password and give you a
                temporary one to sign in with (you'll set a new password on first login).
              </p>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
              />
              {forgotMessage && <p className="text-sm text-green-700 bg-green-50 rounded-md p-2">{forgotMessage}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForgot(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                <button type="submit" disabled={forgotLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {forgotLoading ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration Modal — styled to mirror admin's "Add New User" form */}
      {showRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md my-4 sm:my-8">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Profile</h3>
                <button
                  onClick={() => setShowRegistration(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close registration form"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <Key className="h-4 w-4 inline mr-1" />
                  Your registration request will be reviewed by the administrator. You will be notified once your account is approved.
                </p>
              </div>

              {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-800"><strong>Success!</strong> {successMessage}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleRegistration} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regData.name}
                    onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="user@hospital.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Username will be generated from email</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Min. 6 characters"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      tabIndex={-1}
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regData.confirmPassword}
                      onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Re-enter password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    id="role"
                    value={regData.role}
                    onChange={(e) => setRegData({ ...regData, role: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="house_officer">House Officer</option>
                    <option value="medical_officer">Medical Officer</option>
                    <option value="junior_registrar">Registrar</option>
                    <option value="senior_registrar">Senior Registrar</option>
                    <option value="consultant">Consultant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={regData.phone}
                      onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., +234 801 234 5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={regData.department}
                    onChange={(e) => setRegData({ ...regData, department: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Plastic Surgery"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={regData.registration_number}
                    onChange={(e) => setRegData({ ...regData, registration_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., MDCN/HO/12345"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? <span>Submitting...</span> : <span>Submit Registration</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegistration(false)}
                    disabled={loading}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}