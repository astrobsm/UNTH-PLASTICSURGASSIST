import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Users, 
  Calendar, 
  FlaskConical, 
  GraduationCap, 
  Settings as SettingsIcon,
  ClipboardList,
  ClipboardCheck,
  User,
  LogOut,
  Bell,
  BookOpen,
  Activity,
  FileText,
  FolderOpen,
  UserCog,
  BedDouble,
  Home,
  Droplet,
  BookOpenCheck,
  ShoppingCart,
  MessageSquare,
  Video,
  Footprints,
  Flame,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ArrowLeft,
  Syringe,
  Bug,
  Armchair,
  Presentation,
  Pill,
  Shield,
  PhoneCall,
  Megaphone,
  Brain,
  CalendarCheck,
  Stethoscope,
  Wine,
  Waves,
  Search
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import SyncStatusIndicator from './SyncStatusIndicator';
import { HeaderCheckForUpdates } from './SWUpdateBanner';
import { OfflineSearchModal } from './OfflineSearchModal';

interface LayoutProps {
  children: ReactNode;
}

// Global navigation items — always visible in the sidebar
const navigation = [
  { name: 'Dashboard', href: '/', icon: ClipboardList },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Dept. Meetings', href: '/departmental-meetings', icon: Presentation },
  { name: 'Medical Training', href: '/medical-training', icon: BookOpen },
  { name: 'Call Duty Roster', href: '/call-duty', icon: PhoneCall },
  { name: 'Clinic Duties', href: '/clinic-duties', icon: Shield },
  { name: 'Clinic Appointments', href: '/clinic-appointments', icon: CalendarCheck },
  { name: 'Consults', href: '/consults', icon: Stethoscope },
  { name: 'Notice Board', href: '/notice-board', icon: Megaphone },
  { name: 'Shopping List', href: '/shopping-list', icon: ShoppingCart },
  { name: 'Lymphedema', href: '/lymphedema', icon: Waves },
  { name: 'Substance Detox', href: '/substance-detox', icon: Wine },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Video Conference', href: '/conference', icon: Video },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
  { name: 'HO Tracking', href: '/ho-tracking', icon: ClipboardCheck },
  { name: 'Students', href: '/admin?tab=students', icon: GraduationCap },
  { name: 'Training Admin', href: '/admin-training', icon: GraduationCap },
  { name: 'Admin', href: '/admin', icon: SettingsIcon },
];

// Patient-specific actions — shown as dropdown when a patient is selected
export const patientActions = [
  { name: 'Admission & Discharge', href: '/admission-discharge', icon: BedDouble },
  { name: 'Treatment Planning', href: '/treatment-plan-manager', icon: Activity },
  { name: 'Patient Summaries', href: '/patient-summaries', icon: FileText },
  { name: 'Paperwork', href: '/paperwork', icon: FolderOpen },
  { name: 'MDT', href: '/mdt', icon: UserCog },
  { name: 'Booking Register', href: '/booking-register', icon: ClipboardCheck },
  { name: 'Pre-Surgical Conference', href: '/pre-surgical-conference', icon: Presentation },
  { name: 'Blood Transfusion', href: '/blood-transfusion', icon: Droplet },
  { name: 'Ward Rounds', href: '/ward-rounds', icon: Activity },
  { name: 'AI Medical Scribe', href: '/ai-scribe', icon: Brain },
  { name: 'Limb Salvage', href: '/limb-salvage', icon: Footprints },
  { name: 'Burn Care', href: '/burn-care', icon: Flame },
  { name: 'Wound Care', href: '/wound-care', icon: HeartPulse },
  { name: 'Keloid Care', href: '/keloid-care', icon: Syringe },
  { name: 'Soft Tissue Infection', href: '/soft-tissue-infection', icon: Bug },
  { name: 'Pressure Sore', href: '/pressure-sore', icon: Armchair },
  { name: 'Lymphedema', href: '/lymphedema', icon: Waves },
  { name: 'Substance Detox', href: '/substance-detox', icon: Wine },
  { name: 'Labs', href: '/labs', icon: FlaskConical },
  { name: 'Prescriptions', href: '/prescriptions', icon: Pill },
  { name: 'Patient Education', href: '/patient-education', icon: BookOpenCheck },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isHomePage = location.pathname === '/';
  
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Desktop sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Global offline search modal
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="min-h-screen bg-sky-100">
      {/* Top Navigation */}
      <header className="bg-navy-900 shadow-lg border-b border-navy-700 sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Left side - Logo and hamburger */}
            <div className="flex items-center">
              {/* Mobile hamburger menu */}
              <button
                onClick={toggleMobileMenu}
                className="lg:hidden p-2 -ml-2 mr-2 rounded-md text-sky-200 hover:text-white hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>

              {/* Back button — visible on all pages except Dashboard */}
              {!isHomePage && (
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 mr-1 sm:mr-2 rounded-md text-sky-200 hover:text-white hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors"
                  aria-label="Go back"
                  title="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              
              <div className="flex items-center space-x-2 sm:space-x-3">
                <img 
                  src="/logo.png" 
                  alt="Plastic Surgery Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
                <div className="text-left">
                  <h1 className="text-sm sm:text-xl font-semibold text-white leading-tight">
                    <span className="hidden sm:inline">Plastic Surgery Assistant</span>
                    <span className="sm:hidden">PS Assistant</span>
                  </h1>
                  <p className="text-xs text-sky-300 hidden sm:block">Clinical Management</p>
                </div>
              </div>
            </div>
            
            {/* Right side - User actions */}
            <div className="flex items-center space-x-1 sm:space-x-4">
              {/* Global Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-sky-300 hover:text-white rounded-full hover:bg-navy-700"
                title="Search (offline)"
              >
                <Search className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>

              {/* Check for Updates */}
              <HeaderCheckForUpdates />
              
              {/* Sync Status */}
              <div className="hidden sm:block">
                <SyncStatusIndicator />
              </div>
              
              {/* Notifications */}
              <button 
                className="relative p-2 text-sky-300 hover:text-white rounded-full hover:bg-navy-700"
                title="Notifications"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-danger-500 rounded-full"></span>
              </button>
              
              {/* User info */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="hidden md:flex items-center space-x-2">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-sky-300" />
                  <div className="text-sm">
                    <p className="font-medium text-white truncate max-w-[100px] lg:max-w-none">
                      {user?.name}
                    </p>
                    <p className="text-sky-400 capitalize text-xs">{user?.role?.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <button
                  onClick={logout}
                  className="p-2 text-sky-300 hover:text-white rounded-full hover:bg-navy-700"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile Navigation Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Navigation Drawer */}
        <nav 
          className={`
            fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-navy-900 shadow-2xl z-50 
            transform transition-transform duration-300 ease-in-out
            lg:hidden
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Mobile nav header */}
          <div className="flex items-center justify-between p-4 border-b border-navy-700">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-semibold text-white">Menu</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md text-sky-300 hover:text-white hover:bg-navy-700"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile user info */}
          <div className="p-4 border-b border-navy-700 bg-navy-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{user?.name}</p>
                <p className="text-sm text-sky-400 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Mobile navigation links */}
          <div className="overflow-y-auto h-[calc(100vh-140px)] py-2 overscroll-contain">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center px-4 py-3 text-sm font-medium transition-colors
                    active:bg-navy-600
                    ${isActive
                      ? 'bg-sky-600/20 text-sky-300 border-l-4 border-sky-400'
                      : 'text-gray-300 hover:bg-navy-700 hover:text-white border-l-4 border-transparent'
                    }
                  `}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Desktop Sidebar Navigation — Navy Blue */}
        <nav className={`hidden lg:block bg-navy-900 ${isCollapsed ? 'w-16' : 'w-64'} min-h-[calc(100vh-64px)] shadow-lg border-r border-navy-700 transition-all duration-300 relative flex-shrink-0`}>
          {/* Collapse Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-6 bg-navy-700 border border-navy-600 rounded-full p-1 shadow-md hover:bg-navy-600 transition-colors z-10"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-sky-300" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-sky-300" />
            )}
          </button>

          <div className={`${isCollapsed ? 'px-2' : 'px-3'} py-6 space-y-1 overflow-y-auto max-h-[calc(100vh-100px)]`}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-sky-600/20 text-sky-300 shadow-sm border border-sky-500/30'
                      : 'text-gray-400 hover:bg-navy-700 hover:text-white'
                    }
                  `}
                >
                  <item.icon className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0`} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content with watermark */}
        <main className="flex-1 min-w-0 overflow-x-hidden relative">
          {/* UNTH Logo Watermark */}
          <div 
            className="fixed pointer-events-none -z-10"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '50vw',
              height: '50vh',
              opacity: 0.06,
              backgroundImage: 'url(/unth-logo.png)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          />
          <div className="relative p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Global Offline Search Modal */}
      <OfflineSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}