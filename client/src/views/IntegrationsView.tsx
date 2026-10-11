import React, { useState } from 'react';
import { Sliders, CheckCircle2, AlertCircle, ExternalLink, Shield } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  category: string;
  status: 'CONNECTED' | 'AVAILABLE' | 'REQUIRES_KEY';
  description: string;
  attribution: string;
}

export const IntegrationsView: React.FC = () => {
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
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Integrations & Connected Providers
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium">
              Provider-Agnostic Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure external job data APIs, email OAuth interfaces, and verified automation execution runners.
          </p>
        </div>
      </div>

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

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}>
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
                  className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
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
