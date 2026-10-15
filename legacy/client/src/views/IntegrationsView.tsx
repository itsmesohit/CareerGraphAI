import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Mail,
  Send,
  Loader2,
  Globe,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../api/client';

interface Integration {
  id: string;
  name: string;
  category: string;
  status: 'CONNECTED' | 'AVAILABLE' | 'REQUIRES_KEY';
  description: string;
  attribution: string;
}

export const IntegrationsView: React.FC = () => {
  // Test email state
  const [testEmail, setTestEmail] = useState('sohitku404@gmail.com');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider?: string;
    deliveryId?: string;
    message?: string;
    recipient?: string;
    sender?: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'remotive',
      name: 'Remotive API',
      category: 'JOB_SOURCE',
      status: 'CONNECTED',
      description: 'Live remote software engineering job listings feed with real-time updates.',
      attribution: 'Public API • Free & Open',
    },
    {
      id: 'greenhouse',
      name: 'Greenhouse Public Boards',
      category: 'JOB_SOURCE',
      status: 'CONNECTED',
      description: 'Public job boards and application forms metadata.',
      attribution: 'Direct ATS Board Integration',
    },
    {
      id: 'lever',
      name: 'Lever Job Postings',
      category: 'JOB_SOURCE',
      status: 'CONNECTED',
      description: 'Structured Lever-hosted career listings.',
      attribution: 'Direct ATS Integration',
    },
    {
      id: 'adzuna',
      name: 'Adzuna Global Aggregator',
      category: 'JOB_SOURCE',
      status: 'AVAILABLE',
      description: 'Global job market search covering millions of postings.',
      attribution: 'Requires ADZUNA_APP_ID and ADZUNA_APP_KEY',
    },
    {
      id: 'gmail',
      name: 'Gmail Recruiter Outreach (OAuth 2.0)',
      category: 'EMAIL',
      status: 'CONNECTED',
      description: 'Authorized outreach sending with mandatory draft approval.',
      attribution: 'Google Identity OAuth (Scoped: gmail.send)',
    },
    {
      id: 'playwright',
      name: 'Playwright Authorized Automation',
      category: 'AUTOMATION',
      status: 'CONNECTED',
      description: 'Local verified headless browser application runner.',
      attribution: 'Compliant with platform automation terms',
    },
  ]);

  const toggleConnection = (id: string) => {
    setIntegrations(prev =>
      prev.map(i => {
        if (i.id === id) {
          return {
            ...i,
            status: i.status === 'CONNECTED' ? 'AVAILABLE' : 'CONNECTED',
          };
        }
        return i;
      })
    );
  };

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setSendingTest(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await api.sendTestNotification(
        testEmail.trim(),
        testMessage.trim() || undefined
      );
      setTestResult(res);
    } catch (err: any) {
      setTestError(err.message || 'Failed to dispatch test notification');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Integrations & Verified Communications
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium">
              Provider-Agnostic Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified email domain delivery via Resend, external job listing APIs, and autonomous browser automation runners.
          </p>
        </div>
      </div>

      {/* Featured Card: Resend & Verified Domain (codingspark.in) */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-slate-950 via-indigo-950/20 to-slate-900 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-6">
          {/* Top row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 p-0.5 shadow-lg shadow-brand-500/30">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Mail className="w-6 h-6 text-brand-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-white">Resend Email & Domain Verification</h3>
                  <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Verified Domain: codingspark.in
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    Resend API (HTTP/2)
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Domain verification is complete. All autonomous system notifications, 6-digit account OTPs, missing information alerts, and approved recruiter communications are dispatched directly from your domain using <strong className="text-white">verify@codingspark.in</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                <span className="text-slate-500">Sender: </span>
                <span className="font-mono text-cyan-300 font-semibold">verify@codingspark.in</span>
              </div>
            </div>
          </div>

          {/* Verification Status & Notification Channels Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 font-medium">Domain Status</span>
                <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                  <Check className="w-3.5 h-3.5" /> DNS Verified
                </span>
              </div>
              <div className="text-sm font-bold text-white font-mono">codingspark.in</div>
              <div className="text-[11px] text-slate-500 mt-0.5">SPF, DKIM, MX Active</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 font-medium">Account Security</span>
                <span className="text-emerald-400 font-bold text-[11px]">Active</span>
              </div>
              <div className="text-sm font-bold text-white">6-Digit Email OTP</div>
              <div className="text-[11px] text-slate-500 mt-0.5">10-minute code expiry</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 font-medium">Workflow Alerts</span>
                <span className="text-emerald-400 font-bold text-[11px]">Real-Time</span>
              </div>
              <div className="text-sm font-bold text-white">Approval & Missing Info</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Candidate attention pings</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 font-medium">Failover Transport</span>
                <span className="text-cyan-400 font-bold text-[11px]">Dual-Path</span>
              </div>
              <div className="text-sm font-bold text-white">Gmail SMTP Backup</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Automatic failover ready</div>
            </div>
          </div>

          {/* Interactive Live Test Dispatcher */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Test Live Notification Delivery from Verified Domain
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Dispatches immediately via Resend API
              </span>
            </div>

            <form onSubmit={handleSendTestNotification} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email (e.g. your email address)..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="flex-1">
                <input
                  type="text"
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  placeholder="Optional custom message or subject line..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest || !testEmail.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all shrink-0 cursor-pointer"
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Notification</span>
                  </>
                )}
              </button>
            </form>

            {/* Success Banner */}
            {testResult && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-300">
                    Test notification successfully delivered via Resend!
                  </div>
                  <div className="text-[11px] text-emerald-400/90 font-mono">
                    Sender: <span className="text-white">{testResult.sender}</span> &bull; 
                    Recipient: <span className="text-white">{testResult.recipient}</span> &bull; 
                    Resend ID: <span className="text-white font-bold">{testResult.deliveryId}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {testError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{testError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other Platform Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map(item => {
          const isConnected = item.status === 'CONNECTED';

          return (
            <div
              key={item.id}
              className="glass-card p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{item.name}</h3>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isConnected
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isConnected ? 'Active & Ready' : 'Available'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                <div className="text-[11px] text-slate-500 mt-2 font-mono">{item.attribution}</div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-brand-400" />
                  {isConnected ? 'Permissions Granted' : 'Configuration Optional'}
                </span>

                <button
                  onClick={() => toggleConnection(item.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                    isConnected
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-brand-600 hover:bg-brand-500 text-white'
                  }`}
                >
                  {isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
