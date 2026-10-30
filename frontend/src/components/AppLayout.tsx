import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, navItems } from './Sidebar';
import { Header } from './Header';
import { fetchHealth, fetchAgentStatus } from '../api/client';
import { ApiConnectionStatus, HealthResponse, AgentStatusResponse } from '../types';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>('connecting');
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const location = useLocation();

  const checkConnection = useCallback(async () => {
    setIsRetrying(true);
    setApiStatus('connecting');
    try {
      const healthData = await fetchHealth();
      setApiHealth(healthData);
      setApiStatus('connected');

      try {
        const agentData = await fetchAgentStatus();
        setAgentStatus(agentData);
      } catch {
        // Agent capability degraded but API is healthy
      }
    } catch {
      setApiHealth(null);
      setAgentStatus(null);
      setApiStatus('unavailable');
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Determine current page title based on route
  const currentNavItem = navItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  );
  const pageTitle = currentNavItem ? currentNavItem.name : 'NetExplain Platform';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          apiStatus={apiStatus}
          apiHealth={apiHealth}
          agentStatus={agentStatus}
          onRetryConnection={checkConnection}
          isRetrying={isRetrying}
          pageTitle={pageTitle}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
