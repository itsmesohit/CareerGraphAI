import React, { useState } from 'react';
import { JobPosting } from '../types';
import {
  Search,
  Sparkles,
  MapPin,
  DollarSign,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Send,
  Layers,
  Network,
  RefreshCw,
} from 'lucide-react';

interface JobsFeedViewProps {
  jobs: JobPosting[];
  loading: boolean;
  onRefreshDiscovery: (keywords?: string) => void;
  onPrepareApplication: (jobId: string) => void;
  onInspectMatch: (job: JobPosting) => void;
  onStartOutreach: (job: JobPosting) => void;
}

export const JobsFeedView: React.FC<JobsFeedViewProps> = ({
  jobs,
  loading,
  onRefreshDiscovery,
  onPrepareApplication,
  onInspectMatch,
  onStartOutreach,
}) => {
  const [keyword, setKeyword] = useState('');
  const [filterRemote, setFilterRemote] = useState(true);

  const filteredJobs = jobs.filter(j => {
    if (filterRemote && !j.remote) return false;
    if (keyword) {
      const q = keyword.toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.extractedSkills.some(s => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Discovered Opportunities
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-normal">
              {filteredJobs.length} Live Listings
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked deterministically through FalkorDB multi-hop candidate evidence paths.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Filter by title, skill, or company..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            onClick={() => onRefreshDiscovery(keyword)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium text-xs shadow-lg transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Discover Jobs</span>
          </button>
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="py-20 text-center glass-panel rounded-2xl">
          <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Traversing Graph & Ingesting Listings...</p>
          <p className="text-xs text-slate-400 mt-1">Calling Remotive, Greenhouse & Lever adapters</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-16 text-center glass-panel rounded-2xl">
          <p className="text-sm text-slate-300 font-semibold">No listings matched your criteria</p>
          <button
            onClick={() => { setKeyword(''); onRefreshDiscovery(); }}
            className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map(job => {
            const score = job.matchScore || 75;
            const scoreColor =
              score >= 80 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40' :
              score >= 60 ? 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40' :
              'text-amber-400 border-amber-500/40 bg-amber-950/40';

            return (
              <div
                key={job.id}
                className="glass-card p-5 rounded-2xl transition-all duration-200 border border-slate-800/80 hover:border-brand-500/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {job.provider}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{job.company}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {job.location}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white hover:text-brand-300 transition-colors">
                      {job.title}
                    </h3>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Extracted Skills and Requirements Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      {job.extractedSkills.map(skill => {
                        const isMatched = (job.matchedSkills || []).includes(skill);
                        return (
                          <span
                            key={skill}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                              isMatched
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {isMatched ? '✓ ' : ''}{skill}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Match Score & Actions */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                    <div className={`px-3 py-1.5 rounded-xl border text-center ${scoreColor}`}>
                      <div className="text-base font-black tracking-tight">{score}%</div>
                      <div className="text-[9px] uppercase tracking-wider font-bold">Graph Match</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onInspectMatch(job)}
                        title="Inspect multi-hop reasoning path in FalkorDB"
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                      >
                        <Network className="w-4 h-4 text-cyan-400" />
                      </button>

                      <button
                        onClick={() => onStartOutreach(job)}
                        title="Draft recruiter outreach email"
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                      >
                        <Send className="w-4 h-4 text-brand-400" />
                      </button>

                      <button
                        onClick={() => onPrepareApplication(job.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md transition-all hover:scale-105"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Prepare Application</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
