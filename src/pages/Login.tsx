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
      await userManagementService.submitRegistrationRequest({
        name: regData.name,
        email: regData.email,
        password: regData.password,
        role: regData.role,
        phone: regData.phone,
        department: regData.department,
        registration_number: regData.registration_number
      });

      alert('Registration request submitted successfully! Your account will be activated once approved by the administrator.');
      
      // Reset form and close modal
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
      setShowRegistration(false);
    } catch (error: any) {
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinical-light">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <img 
            src="/logo.png" 
            alt="Plastic Surgery Logo" 
            className="mx-auto h-20 w-20 object-contain"
          />
          <h2 className="mt-6 text-3xl font-bold text-clinical-dark">
            Plastic Surgeon Assistant
          </h2>
          <p className="mt-2 text-sm text-clinical">
            Sign in to access clinical workflows
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-clinical-dark">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-clinical-dark">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
            className="w-full border-2 border-primary-500 text-primary-500 hover:bg-primary-50 py-3 rounded-md font-medium transition flex items-center justify-center gap-2"
          >
            <UserPlus className="h-5 w-5" />
            Create New Profile
          </button>
        </form>
      </div>

      {/* Registration Modal */}
      {showRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-clinical-dark">Create New Profile</h3>
              <button
                onClick={() => setShowRegistration(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close registration form"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleRegistration} className="p-6 space-y-4">
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