import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginPage } from './components/Auth/LoginPage';
import { PWAPrompt, OfflineIndicator } from './components/PWAPrompt';
import MainApp from '../App';
import { Loader2 } from 'lucide-react';

// Loading screen component
const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
      <p className="text-slate-400 text-sm font-medium">{message}</p>
    </div>
  </div>
);

// Data-aware app wrapper
const DataAwareApp: React.FC = () => {
  const { loading, error } = useData();

  if (loading) {
    return <LoadingScreen message="Loading your data..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load data: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <MainApp />;
};

// Protected app wrapper
const ProtectedApp: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DataProvider>
      <DataAwareApp />
    </DataProvider>
  );
};

// Main App with providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <OfflineIndicator />
      <ProtectedApp />
      <PWAPrompt />
    </AuthProvider>
  );
};

export default App;
