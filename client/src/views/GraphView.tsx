import React from 'react';
import { GraphVisualData } from '../types';
import { CareerGraphExplorer } from '../components/CareerGraphExplorer';
import { Network, Database, Layers, Sparkles } from 'lucide-react';

interface GraphViewProps {
  graphData: GraphVisualData;
  falkorMode: string;
}

export const GraphView: React.FC<GraphViewProps> = ({ graphData, falkorMode }) => {
  const nodeCount = graphData.nodes?.length || 0;
  const edgeCount = graphData.edges?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Career Knowledge & Memory Graph
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium">
              FalkorDB Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time visualization of candidate experiences, verified projects, skills, job requirements, and agent episodic memories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-sm font-bold text-cyan-400">{nodeCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Graph Nodes</div>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-sm font-bold text-brand-400">{edgeCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Relationships</div>
          </div>
        </div>
      </div>

      {/* Explorer Component */}
      <CareerGraphExplorer graphData={graphData} falkorMode={falkorMode} />
    </div>
  );
};
