import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { AuthModal } from './components/AuthModal.js';
import { LandingPage } from './pages/LandingPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { GraphPage } from './pages/GraphPage.js';
import { JobsPage } from './pages/JobsPage.js';
import { ApplicationsPage } from './pages/ApplicationsPage.js';
import { ApprovalsPage } from './pages/ApprovalsPage.js';
import { MissingInfoPage } from './pages/MissingInfoPage.js';
import { OutreachPage } from './pages/OutreachPage.js';
import { BillingPage } from './pages/BillingPage.js';
import { OrganizationPage } from './pages/OrganizationPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { CopilotWidget } from './components/CopilotWidget.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-cyan to-accent-violet opacity-20 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin" />
          </div>
          <span className="text-sm font-medium tracking-wide text-slate-400">
            Initializing CareerGraph AI...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-primary text-white flex flex-col font-sans">
      <Navbar onOpenAuth={handleOpenAuth} />

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage onOpenAuth={handleOpenAuth} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={user ? <DashboardPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/jobs"
            element={user ? <JobsPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/applications"
            element={user ? <ApplicationsPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/approvals"
            element={user ? <ApprovalsPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/missing-info"
            element={user ? <MissingInfoPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/outreach"
            element={user ? <OutreachPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/billing"
            element={user ? <BillingPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/organizations"
            element={user ? <OrganizationPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin"
            element={user ? <AdminPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/compliance"
            element={user ? <AdminPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/graph"
            element={user ? <GraphPage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />

      {user && <CopilotWidget />}
    </div>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
