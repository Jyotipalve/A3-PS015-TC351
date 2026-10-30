import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center shadow-sm">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">NetExplain</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
          <span>Verifying authentication credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
