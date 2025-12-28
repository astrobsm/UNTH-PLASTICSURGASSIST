import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  FlaskConical, 
  GraduationCap, 
  Settings,
  Stethoscope,
  ClipboardList,
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
  ChevronLeft,
  ChevronRight
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
  { name: 'Scheduling', href: '/scheduling', icon: Calendar },
  { name: 'Blood Transfusion', href: '/blood-transfusion', icon: Droplet },
  { name: 'Ward Rounds', href: '/ward-rounds', icon: Activity },
  { name: 'Limb Salvage', href: '/limb-salvage', icon: Footprints },
  { name: 'Burn Care', href: '/burn-care', icon: Flame },
  { name: 'Medical Training', href: '/medical-training', icon: BookOpen },
  { name: 'Labs', href: '/labs', icon: FlaskConical },
  { name: 'Patient Education', href: '/patient-education', icon: BookOpenCheck },
  { name: 'Shopping List', href: '/shopping-list', icon: ShoppingCart },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Video Conference', href: '/conference', icon: Video },
  { name: 'Education', href: '/education', icon: GraduationCap },
  { name: 'MCQ Assessment', href: '/mcq-education', icon: GraduationCap },
  { name: 'Topic Management', href: '/topic-management', icon: BookOpen },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Admin', href: '/admin', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen bg-clinical-light">
      {/* Top Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <img 
                  src="/logo.png" 
                  alt="Plastic Surgery Logo" 
                  className="w-10 h-10 object-contain"
                />
                <div className="text-left">
                  <h1 className="text-xl font-semibold text-clinical-dark">
                    Plastic Surgery Assistant
                  </h1>
                  <p className="text-xs text-clinical">Clinical Management System</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Sync Status Indicator */}
              <SyncStatusIndicator />
              
              <button 
                className="relative p-2 text-gray-400 hover:text-clinical-dark"
                title="Notifications"
              >
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-danger-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <User className="h-6 w-6 text-gray-400" />
                  <div className="text-sm">
                    <p className="font-medium text-clinical-dark">{user?.name}</p>
                    <p className="text-gray-500 capitalize">{user?.role.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-clinical-dark"
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
        {/* Sidebar Navigation */}
        <nav className={`bg-white ${isCollapsed ? 'w-16' : 'w-64'} min-h-screen shadow-sm border-r border-gray-200 transition-all duration-300 relative`}>
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

          <div className={`${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-1`}>
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
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}