import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // readonly: the lists come from config/routeAccess and are never mutated.
  allowedRoles: readonly string[];
  fallback?: string;
}

export function ProtectedRoute({ children, allowedRoles, fallback = '/' }: ProtectedRouteProps) {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
