import React, { useState } from 'react';
import { CandidateProfile } from '../types';
import {
  User,
  Briefcase,
  Code2,
  FolderGit2,
  ShieldCheck,
  Save,
  Plus,
  Trash2,
  DollarSign,
  MapPin,
  Clock,
} from 'lucide-react';

interface ProfileViewProps {
  profile: CandidateProfile;
  onSaveProfile: (updated: Partial<CandidateProfile>) => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onSaveProfile }) => {
  const [formData, setFormData] = useState<CandidateProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProfile(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Career Profile & Graph Context
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              Verified Facts
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Your single source of truth. Updates synchronize directly into FalkorDB property graph nodes.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Syncing to Graph...' : saveSuccess ? 'Saved to FalkorDB!' : 'Save & Sync to Graph'}</span>
        </button>
      </div>

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" />
            Candidate Essentials
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Target Designation</label>
              <input
                type="text"
                value={formData.targetRole || ''}
                onChange={e => setFormData({ ...formData, targetRole: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Location & Relocation Preference</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Compensation & Work Style
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Minimum Acceptable Salary (USD)</label>
              <input
                type="number"
                value={formData.minSalary || 0}
                onChange={e => setFormData({ ...formData, minSalary: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Remote Preference</label>
              <select
                value={formData.remotePref || 'REMOTE'}
                onChange={e => setFormData({ ...formData, remotePref: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="REMOTE">Worldwide / US Remote Only</option>
                <option value="HYBRID">Hybrid OK</option>
                <option value="ONSITE">Onsite OK</option>
                <option value="ANY">Flexible / Any</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Notice Period</label>
              <input
                type="text"
                value={formData.noticePeriod || ''}
                onChange={e => setFormData({ ...formData, noticePeriod: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Professional Bio</label>
              <textarea
                rows={2}
                value={formData.bio || ''}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-cyan-400" />
          Technical Projects & Demonstrations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formData.projects.map((proj, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-white">{proj.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{proj.summary}</p>
              {proj.metrics && (
                <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-1 rounded">
                  {proj.metrics}
                </div>
              )}
              <div className="flex flex-wrap gap-1 pt-1">
                {proj.skills.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
