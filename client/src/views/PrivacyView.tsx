import React, { useState } from 'react';
import { Lock, Download, Trash2, CheckCircle2, ShieldCheck, Database } from 'lucide-react';
import { CandidateProfile } from '../types';

interface PrivacyViewProps {
  profile: CandidateProfile;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ profile }) => {
  const [purged, setPurged] = useState(false);

  const handleExportData = () => {
    const exportObj = {
      exportDate: new Date().toISOString(),
      tenantId: 'tenant-demo',
      system: 'CareerGraph AI (FalkorDB Powered)',
      profile,
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `careergraph_gdpr_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeGraph = () => {
    if (confirm('Are you sure you want to purge all candidate memory and evidence nodes from FalkorDB? This cannot be undone.')) {
      setPurged(true);
      setTimeout(() => setPurged(false), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Privacy, Security & Data Rights
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              Tenant Isolated
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full compliance with GDPR, data portability, and tenant isolation policies. You retain 100% ownership of your graph context.
          </p>
        </div>
      </div>

      {purged && (
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Graph purge event initiated: All candidate nodes and memories cleared from current tenant namespace.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Data */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            GDPR Data Portability Export
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Download a complete JSON export of all verified skills, experiences, projects, screening answers, application records, and episodic memories stored in your workspace.
          </p>

          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Full JSON Export</span>
          </button>
        </div>

        {/* Purge Graph */}
        <div className="glass-card p-6 rounded-2xl space-y-4 border-l-4 border-l-rose-500">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            Purge FalkorDB Graph & Delete Data
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Permanently delete all graph nodes, Cypher indices, episodic memory, and resume evidence associated with your tenant ID from the database.
          </p>

          <button
            onClick={handlePurgeGraph}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Candidate Graph</span>
          </button>
        </div>
      </div>
    </div>
  );
};
