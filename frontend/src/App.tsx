import React from 'react';
import { useRoutes } from 'react-router-dom';
import { routes } from './routes';
import { AuthProvider } from './context/AuthContext';

export const App: React.FC = () => {
  const element = useRoutes(routes);
  return <AuthProvider>{element}</AuthProvider>;
};

export default App;
