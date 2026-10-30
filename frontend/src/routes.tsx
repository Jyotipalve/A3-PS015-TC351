import { RouteObject } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OverviewPage } from './pages/OverviewPage';
import { GuidedDiagnosisPage } from './pages/GuidedDiagnosisPage';
import { NetworkPathPage } from './pages/NetworkPathPage';
import { EvidencePage } from './pages/EvidencePage';
import { ResolutionPage } from './pages/ResolutionPage';
import { ReportsPage } from './pages/ReportsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { SimulationPage } from './pages/SimulationPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <OverviewPage />,
      },
      {
        path: 'diagnosis',
        element: <GuidedDiagnosisPage />,
      },
      {
        path: 'topology',
        element: <NetworkPathPage />,
      },
      {
        path: 'evidence',
        element: <EvidencePage />,
      },
      {
        path: 'resolve',
        element: <ResolutionPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'simulation',
        element: <SimulationPage />,
      },
      {
        path: '*',
        element: (
          <PlaceholderPage
            title="Route Not Found"
            phase="Navigation"
            description="The requested page does not match any recognized NetExplain diagnostic module."
            upcomingFeatures={[
              'Click Back to Overview to return to the dashboard',
              'Check that the route URL was typed correctly',
            ]}
          />
        ),
      },
    ],
  },
];
