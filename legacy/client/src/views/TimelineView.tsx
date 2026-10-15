import React from 'react';
import { TimelineEvent } from '../types';
import { Activity, Terminal, Brain, Compass, Layers, Mail, Clock } from 'lucide-react';

interface TimelineViewProps {
  timeline: TimelineEvent[];
}

const AGENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ORCHESTRATOR: { label: 'Orchestrator Agent', color: 'text-brand-400 bg-brand-500/20 border-brand-500/30', icon: Brain },
  MEMORY: { label: 'Memory Agent', color: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30', icon: Terminal },
  MATCHING: { label: 'Matching Agent', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', icon: Compass },
  APPLICATION: { label: 'Application Agent', color: 'text-amber-400 bg-amber-500/20 border-amber-500/30', icon: Layers },
  OUTREACH: { label: 'Outreach Agent', color: 'text-violet-400 bg-violet-500/20 border-violet-500/30', icon: Mail },
};

export const TimelineView: React.FC<TimelineViewProps> = ({ timeline }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Agent Decision & Reasoning Timeline
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              Traceable State Machine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of inter-agent handoffs, Cypher queries executed against FalkorDB, and autonomous workflow actions.
          </p>
        </div>
      </div>

      {/* Events List */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {timeline.map((event, idx) => {
          const config = AGENT_CONFIG[event.agent] || {
            label: event.agent,
            color: 'text-slate-400 bg-slate-800',
            icon: Activity,
          };
          const Icon = config.icon;

          return (
            <div key={event.id || idx} className="relative group">
              {/* Dot Icon */}
              <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-brand-400 group-hover:scale-125 transition-transform" />
              </div>

              {/* Event Card */}
              <div className="glass-card p-5 rounded-2xl border border-slate-800/80 space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${config.color}`}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <span className="text-xs font-semibold text-white">{event.action}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {event.details}
                </p>

                {event.cypherQuery && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                      Cypher Query Executed on FalkorDB:
                    </span>
                    <code>{event.cypherQuery}</code>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
