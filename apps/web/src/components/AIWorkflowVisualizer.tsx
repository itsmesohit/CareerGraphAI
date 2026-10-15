import React from 'react';
import { Network, Zap, CheckCircle2, Clock, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

interface WorkflowStage {
  id: string;
  label: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  description?: string;
}

interface AIWorkflowVisualizerProps {
  stages: WorkflowStage[];
  title?: string;
}

export const AIWorkflowVisualizer: React.FC<AIWorkflowVisualizerProps> = ({ 
  stages, 
  title = "AI Agent Pipeline" 
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'running':
        return <Zap className="w-4 h-4 text-accent-cyan animate-pulse" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-emerald-400/30 bg-emerald-400/10';
      case 'running':
        return 'border-accent-cyan/50 bg-accent-cyan/10 shadow-glow-cyan';
      case 'failed':
        return 'border-rose-400/30 bg-rose-400/10';
      default:
        return 'border-dark-border bg-dark-elevated/50';
    }
  };

  return (
    <div className="dark-panel p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-6">
        <Network className="w-5 h-5 text-accent-cyan" />
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <Sparkles className="w-4 h-4 text-accent-violet ml-auto" />
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {stages.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            {/* Stage Node */}
            <div
              className={`relative flex flex-col items-center min-w-[140px] p-4 rounded-lg border transition-all ${getStatusColor(
                stage.status
              )}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(stage.status)}
                <span className="text-sm font-semibold text-slate-200">{stage.label}</span>
              </div>
              {stage.description && (
                <p className="text-xs text-slate-400 text-center">{stage.description}</p>
              )}
              {stage.status === 'running' && (
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-accent-cyan/20 to-accent-violet/20 blur-sm -z-10 animate-pulse" />
              )}
            </div>

            {/* Connection Arrow */}
            {idx < stages.length - 1 && (
              <ArrowRight
                className={`w-5 h-5 flex-shrink-0 ${
                  stages[idx].status === 'completed' ? 'text-accent-cyan' : 'text-slate-600'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};