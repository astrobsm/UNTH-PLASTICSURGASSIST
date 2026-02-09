import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users, 
  Calendar, 
  FlaskConical, 
  GraduationCap, 
  Settings as SettingsIcon,
  Stethoscope,
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
  Syringe
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import SyncStatusIndicator from './SyncStatusIndicator';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: ClipboardList },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Admission & Discharge', href: '/admission-discharge', icon: BedDouble },
  { name: 'Treatment Planning', href: '/treatment-planning', icon: Activity },
  { name: 'Patient Summaries', href: '/patient-summaries', icon: FileText },
  { name: 'Paperwork', href: '/paperwork', icon: FolderOpen },
  { name: 'MDT', href: '/mdt', icon: UserCog },
  { name: 'Procedures', href: '/procedures', icon: Stethoscope },
  { name: 'Pre-op Planning', href: '/preoperative-planning', icon: ClipboardCheck },
  { name: 'Blood Transfusion', href: '/blood-transfusion', icon: Droplet },
  { name: 'Ward Rounds', href: '/ward-rounds', icon: Activity },
  { name: 'Limb Salvage', href: '/limb-salvage', icon: Footprints },
  { name: 'Burn Care', href: '/burn-care', icon: Flame },
  { name: 'Wound Care', href: '/wound-care', icon: HeartPulse },
  { name: 'Keloid Care', href: '/keloid-care', icon: Syringe },
  { name: 'Medical Training', href: '/medical-training', icon: BookOpen },
  { name: 'Labs', href: '/labs', icon: FlaskConical },
  { name: 'Patient Education', href: '/patient-education', icon: BookOpenCheck },
  { name: 'Shopping List', href: '/shopping-list', icon: ShoppingCart },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Video Conference', href: '/conference', icon: Video },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
  { name: 'Admin', href: '/admin', icon: SettingsIcon },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Desktop sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

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
    <div className="min-h-screen bg-clinical-light">
      {/* Top Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Left side - Logo and hamburger */}
            <div className="flex items-center">
              {/* Mobile hamburger menu */}
              <button
                onClick={toggleMobileMenu}
                className="lg:hidden p-2 -ml-2 mr-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <div className="flex items-center space-x-2 sm:space-x-3">
                <img 
                  src="/logo.png" 
                  alt="Plastic Surgery Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
                <div className="text-left">
                  <h1 className="text-sm sm:text-xl font-semibold text-clinical-dark leading-tight">
                    <span className="hidden sm:inline">Plastic Surgery Assistant</span>
                    <span className="sm:hidden">PS Assistant</span>
                  </h1>
                  <p className="text-xs text-clinical hidden sm:block">Clinical Management</p>
                </div>
              </div>
            </div>
            
            {/* Right side - User actions */}
            <div className="flex items-center space-x-1 sm:space-x-4">
              {/* Sync Status - Hidden on very small screens */}
              <div className="hidden sm:block">
                <SyncStatusIndicator />
              </div>
              
              {/* Notifications */}
              <button 
                className="relative p-2 text-gray-400 hover:text-clinical-dark rounded-full hover:bg-gray-100"
                title="Notifications"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-danger-500 rounded-full"></span>
              </button>
              
              {/* User info - Condensed on mobile */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="hidden md:flex items-center space-x-2">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                  <div className="text-sm">
                    <p className="font-medium text-clinical-dark truncate max-w-[100px] lg:max-w-none">
                      {user?.name}
                    </p>
                    <p className="text-gray-500 capitalize text-xs">{user?.role?.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-clinical-dark rounded-full hover:bg-gray-100"
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
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Navigation Drawer */}
        <nav 
          className={`
            fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl z-50 
            transform transition-transform duration-300 ease-in-out
            lg:hidden
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Mobile nav header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-semibold text-clinical-dark">Menu</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile user info */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-clinical-dark truncate">{user?.name}</p>
                <p className="text-sm text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
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
                    active:bg-gray-100
                    ${isActive
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-clinical-dark border-l-4 border-transparent'
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

        {/* Desktop Sidebar Navigation */}
        <nav className={`hidden lg:block bg-white ${isCollapsed ? 'w-16' : 'w-64'} min-h-[calc(100vh-64px)] shadow-sm border-r border-gray-200 transition-all duration-300 relative flex-shrink-0`}>
          {/* Collapse Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-6 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors z-10"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            )}
          </button>

          <div className={`${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-1 overflow-y-auto max-h-[calc(100vh-100px)]`}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-clinical-dark'
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

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}