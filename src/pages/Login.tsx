import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Stethoscope, UserPlus, LogIn, X } from 'lucide-react';
import { userManagementService } from '../services/userManagementService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { login } = useAuthStore();

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
    
    try {
      await login(email, password);
    } catch (error: any) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validation
    if (regData.password !== regData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (regData.password.length < 6) {
      setError('Password must be at least 6 characters');
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
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="form-input"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
        </form>
      </div>

      {/* Registration Modal */}
      {showRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-4 sm:my-8">
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-lg z-10">
              <h3 className="text-lg sm:text-xl font-bold text-clinical-dark">Create New Profile</h3>
              <button
                onClick={() => setShowRegistration(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                aria-label="Close registration form"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleRegistration} className="p-4 sm:p-6 space-y-4">
              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                  <strong>Success!</strong> {successMessage}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Dr. John Doe"
                    value={regData.name}
                    onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="john.doe@hospital.com"
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Min. 6 characters"
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Re-enter password"
                    value={regData.confirmPassword}
                    onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-clinical-dark mb-1">
                    Role *
                  </label>
                  <select
                    id="role"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={regData.role}
                    onChange={(e) => setRegData({ ...regData, role: e.target.value as any })}
                  >
                    <option value="house_officer">House Officer</option>
                    <option value="medical_officer">Medical Officer</option>
                    <option value="junior_registrar">Junior Registrar</option>
                    <option value="senior_registrar">Senior Registrar</option>
                    <option value="consultant">Consultant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="+234 800 000 0000"
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Surgery, Plastic Surgery"
                    value={regData.department}
                    onChange={(e) => setRegData({ ...regData, department: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-clinical-dark mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="MDCN/HO/12345"
                    value={regData.registration_number}
                    onChange={(e) => setRegData({ ...regData, registration_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <strong>Note:</strong> Your registration request will be reviewed by the administrator. 
                You will be notified once your account is approved.
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegistration(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary py-2"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}