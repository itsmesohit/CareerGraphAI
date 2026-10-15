import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import {
  Shield,
  Laptop,
  Smartphone,
  LogOut,
  CheckCircle,
  Clock,
  Sparkles,
  Trash2,
  FileText,
  RefreshCw,
  Compass,
  ArrowRight,
  Network,
  Zap,
  TrendingUp,
  Target,
  Briefcase,
} from 'lucide-react';
import { ProfileManager } from '../components/ProfileManager.js';
import { OnboardingWizard } from '../components/OnboardingWizard.js';
import { AIWorkflowVisualizer } from '../components/AIWorkflowVisualizer.js';

export const DashboardPage: React.FC = () => {
  const { user, accessToken, logout } = useAuth();
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<'profile' | 'onboarding' | 'security'>('profile');

  // Check onboarding state
  const { data: onboardingData } = useQuery({
    queryKey: ['onboarding-state', accessToken],
    queryFn: () => api.getOnboardingState(accessToken!),
    enabled: !!accessToken,
  });

  const { data: completenessData } = useQuery({
    queryKey: ['profile-completeness', accessToken],
    queryFn: () => api.getCompleteness(accessToken!),
    enabled: !!accessToken,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', accessToken],
    queryFn: () => api.getSessions(accessToken!),
    enabled: !!accessToken,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(sessionId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => api.revokeOtherSessions(accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  if (!user) return null;

  const isOnboardingCompleted = onboardingData?.state?.isCompleted ?? false;
  const currentStep = onboardingData?.state?.currentStep ?? 1;
  const completenessScore = completenessData?.completeness?.score ?? 0;

  // Mock AI workflow stages (in production, this would come from real agent activity data)
  const aiWorkflowStages: Array<{
    id: string;
    label: string;
    status: 'completed' | 'running' | 'pending' | 'failed';
    description?: string;
  }> = [
    { id: '1', label: 'Profile Analysis', status: completenessScore >= 80 ? 'completed' : 'pending', description: `${completenessScore}% complete` },
    { id: '2', label: 'Job Matching', status: completenessScore >= 80 ? 'running' : 'pending', description: 'AI scanning' },
    { id: '3', label: 'Resume Tailoring', status: 'pending', description: 'Awaiting match' },
    { id: '4', label: 'Review & Approve', status: 'pending', description: 'Your approval' },
  ];

  return (
    <div className="min-h-screen bg-dark-primary py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header with Dark Immersive AI Branding */}
        <div className="relative overflow-hidden rounded-2xl dark-panel p-8 md:p-12">
          {/* Animated background gradient and grid */}
          <div className="absolute inset-0 bg-grid-dark opacity-40" />
          <div className="absolute top-0 right-0 w-96 h-96 glow-mesh-dark blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-accent-cyan to-accent-violet opacity-20 blur-lg animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-violet flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-accent-cyan/30">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-extrabold text-white">{user.name}</h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1 font-mono">{user.email}</p>
              </div>
            </div>

            {/* Profile Completeness Gauge */}
            <div className="flex flex-col items-end">
              <div className="text-right mb-2">
                <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">Profile Strength</div>
                <div className="text-3xl font-bold text-white">{completenessScore}%</div>
              </div>
              <div className="w-48 h-2.5 bg-dark-elevated rounded-full overflow-hidden border border-dark-border">
                <div
                  className="h-full bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-violet transition-all duration-500"
                  style={{ width: `${completenessScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI Workflow Pipeline */}
        <AIWorkflowVisualizer stages={aiWorkflowStages} title="Career Automation Pipeline" />

        {/* Career Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="dark-panel-elevated p-6 rounded-xl border border-dark-border border-l-4 border-l-accent-cyan hover:border-accent-cyan/40 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-accent-cyan/10">
                <Target className="w-5 h-5 text-accent-cyan" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-slate-300">Job Matches Found</div>
            <div className="mt-3 text-xs text-slate-500">
              Complete your profile to unlock AI matching
            </div>
          </div>

          <div className="dark-panel-elevated p-6 rounded-xl border border-dark-border border-l-4 border-l-accent-violet hover:border-accent-violet/40 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-accent-violet/10">
                <Briefcase className="w-5 h-5 text-accent-violet" />
              </div>
              <Zap className="w-5 h-5 text-accent-cyan" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-slate-300">Active Applications</div>
            <div className="mt-3 text-xs text-slate-500">
              Start applying to track your pipeline
            </div>
          </div>

          <div className="dark-panel-elevated p-6 rounded-xl border border-dark-border border-l-4 border-l-accent-blue hover:border-accent-blue/40 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-accent-blue/10">
                <Network className="w-5 h-5 text-accent-blue" />
              </div>
              <Sparkles className="w-5 h-5 text-accent-violet" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{completenessScore}%</div>
            <div className="text-sm text-slate-300">Profile Completeness</div>
            <div className="mt-3 text-xs text-slate-500">
              {completenessScore >= 80 ? 'Ready for AI matching!' : 'Add more details to improve'}
            </div>
          </div>
        </div>

        {/* Onboarding Callout Banner if not complete */}
        {!isOnboardingCompleted && (
          <div className="relative overflow-hidden p-6 rounded-2xl dark-panel border border-accent-cyan/30">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan/10 via-accent-violet/10 to-transparent" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-violet flex items-center justify-center text-white flex-shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Complete Your Career Profile (Step {currentStep} of 5)
                  </h3>
                  <p className="text-sm text-slate-400">
                    Upload your resume and configure your autonomous application strategy
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveView('onboarding')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue hover:from-accent-cyan/90 hover:to-accent-blue/90 text-white text-sm font-bold shadow-lg shadow-accent-cyan/20 transition-all hover:scale-105 flex items-center gap-2 whitespace-nowrap"
              >
                <span>{activeView === 'onboarding' ? 'Viewing Wizard' : 'Resume Onboarding'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveView('profile')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              activeView === 'profile'
                ? 'bg-gradient-to-r from-accent-cyan to-accent-blue text-white shadow-lg shadow-accent-cyan/20'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-accent-cyan/30'
            }`}
          >
            <FileText className="w-4 h-4" />
            Career Profile
          </button>

          <button
            onClick={() => setActiveView('onboarding')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              activeView === 'onboarding'
                ? 'bg-gradient-to-r from-accent-cyan to-accent-blue text-white shadow-lg shadow-accent-cyan/20'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-accent-cyan/30'
            }`}
          >
            <Compass className="w-4 h-4" />
            Onboarding Wizard
          </button>

          <button
            onClick={() => setActiveView('security')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              activeView === 'security'
                ? 'bg-gradient-to-r from-accent-cyan to-accent-blue text-white shadow-lg shadow-accent-cyan/20'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-accent-cyan/30'
            }`}
          >
            <Shield className="w-4 h-4" />
            Security & Sessions
          </button>
        </div>

        {/* Main Content Area */}
        {activeView === 'profile' && <ProfileManager />}

        {activeView === 'onboarding' && (
          <OnboardingWizard
            onComplete={() => {
              setActiveView('profile');
              queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
              queryClient.invalidateQueries({ queryKey: ['profile-completeness'] });
            }}
          />
        )}

        {activeView === 'security' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-sky-600" />
                  Active Sessions & Connected Devices
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Rotating refresh tokens with automatic token-family theft detection. Manage your authorized login sessions.
                </p>
              </div>

              <button
                onClick={() => revokeOthersMutation.mutate()}
                disabled={revokeOthersMutation.isPending || !sessions || sessions.length <= 1}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-700 disabled:opacity-40 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all self-start sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                Log Out Other Devices
              </button>
            </div>

            {sessionsLoading ? (
              <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                Loading active sessions...
              </div>
            ) : (
              <div className="space-y-3">
                {sessions?.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      session.isCurrent
                        ? 'bg-sky-500/5 border-sky-500/30'
                        : 'bg-slate-100 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                        {session.userAgent?.toLowerCase().includes('mobile') ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Laptop className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {session.userAgent || 'Unknown Browser / Device'}
                          </span>
                          {session.isCurrent && (
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-600 text-[10px] font-bold">
                              Current Device
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                          <span>IP: {session.ipAddress || '127.0.0.1'}</span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Last active: {new Date(session.lastUsedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeMutation.mutate(session.id)}
                        disabled={revokeMutation.isPending}
                        className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-all self-end sm:self-auto flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
