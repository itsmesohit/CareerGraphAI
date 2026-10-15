import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphVisualData } from '../types';
import { Network, Sparkles, Filter, X, ShieldCheck } from 'lucide-react';

interface CareerGraphExplorerProps {
  graphData: GraphVisualData;
  falkorMode?: string;
  selectedJobId?: string;
}

const LABEL_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Candidate: { bg: 'bg-sky-950/80', border: 'border-sky-400', text: 'text-sky-300', glow: 'rgba(56, 189, 248, 0.4)' },
  Experience: { bg: 'bg-purple-950/80', border: 'border-purple-400', text: 'text-purple-300', glow: 'rgba(192, 132, 252, 0.4)' },
  Project: { bg: 'bg-cyan-950/80', border: 'border-cyan-400', text: 'text-cyan-300', glow: 'rgba(34, 211, 238, 0.4)' },
  Skill: { bg: 'bg-emerald-950/80', border: 'border-emerald-400', text: 'text-emerald-300', glow: 'rgba(52, 211, 153, 0.4)' },
  Evidence: { bg: 'bg-violet-950/80', border: 'border-violet-400', text: 'text-violet-300', glow: 'rgba(167, 139, 250, 0.4)' },
  Job: { bg: 'bg-amber-950/80', border: 'border-amber-400', text: 'text-amber-300', glow: 'rgba(251, 191, 36, 0.4)' },
  Requirement: { bg: 'bg-rose-950/80', border: 'border-rose-400', text: 'text-rose-300', glow: 'rgba(251, 113, 133, 0.4)' },
  Memory: { bg: 'bg-indigo-950/80', border: 'border-indigo-400', text: 'text-indigo-300', glow: 'rgba(129, 140, 248, 0.4)' },
  Answer: { bg: 'bg-teal-950/80', border: 'border-teal-400', text: 'text-teal-300', glow: 'rgba(45, 212, 191, 0.4)' },
};

export const CareerGraphExplorer: React.FC<CareerGraphExplorerProps> = ({ graphData, falkorMode }) => {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Compute Layout Positions for React Flow
  const { initialNodes, initialEdges } = useMemo(() => {
    const rawNodes = graphData.nodes || [];
    const rawEdges = graphData.edges || [];

    // Filter by label if selected
    const filteredNodes = activeFilter === 'ALL'
      ? rawNodes
      : rawNodes.filter(n => n.label === activeFilter || n.label === 'Candidate');

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = rawEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    // Arrange nodes in hierarchical lanes
    const laneX: Record<string, number> = {
      Candidate: 80,
      Experience: 320,
      Project: 560,
      Evidence: 800,
      Skill: 1040,
      Requirement: 1280,
      Job: 1520,
      Memory: 320,
      Answer: 560,
    };

    const counts: Record<string, number> = {};

    const rfNodes: Node[] = filteredNodes.map(n => {
      const label = n.label || 'Node';
      counts[label] = (counts[label] || 0) + 1;
      const x = laneX[label] || 400;
      const y = (counts[label] - 1) * 110 + 60;

      const colors = LABEL_COLORS[label] || {
        bg: 'bg-slate-900',
        border: 'border-slate-500',
        text: 'text-slate-300',
        glow: 'rgba(255,255,255,0.2)',
      };

      const title = n.properties.title || n.properties.name || n.properties.text?.substring(0, 28) || n.id;

      return {
        id: n.id,
        position: { x, y },
        data: {
          label: (
            <div className={`p-2.5 rounded-lg border shadow-lg ${colors.bg} ${colors.border} transition-all hover:scale-105 cursor-pointer`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40 ${colors.text}`}>
                  {label}
                </span>
                {n.properties.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-semibold text-white max-w-[170px] truncate">
                {title}
              </div>
            </div>
          ),
          raw: n,
        },
      };
    });

    const rfEdges: Edge[] = filteredEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.type,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
      labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
    }));

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [graphData, activeFilter]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl glass-panel overflow-hidden border border-slate-800">
      {/* Top Overlay Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-xl">
          <Network className="w-5 h-5 text-brand-400 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              FalkorDB Context & Reasoning Graph
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {falkorMode || 'LIVE'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive multi-hop paths: Job → Requirement → Skill → Project → Experience → Candidate
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-xl">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          {['ALL', 'Skill', 'Project', 'Requirement', 'Job', 'Memory'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeFilter === f
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={(_, node) => setSelectedNode(node.data.raw)}
        fitView
        className="bg-slate-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
        <Controls className="!bg-slate-900 !border-slate-800 !text-white rounded-lg overflow-hidden" />
        <MiniMap
          nodeColor={n => {
            const rawLabel = (n.data?.raw as any)?.label;
            return LABEL_COLORS[rawLabel]?.border.replace('border-', '') || '#64748b';
          }}
          className="!bg-slate-900 !border-slate-800 rounded-xl"
        />
      </ReactFlow>

      {/* Node Details Inspection Drawer */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bottom-4 w-96 z-20 glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700/80 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/40">
                  {selectedNode.label}
                </span>
                <h4 className="text-base font-bold text-white mt-1.5">
                  {selectedNode.properties.title || selectedNode.properties.name || selectedNode.id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Properties List */}
            <div className="mt-4 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Graph Node Properties
              </div>
              {Object.entries(selectedNode.properties).map(([key, val]) => {
                if (key === 'title' || key === 'name') return null;
                return (
                  <div key={key} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[11px] font-mono text-brand-400 block mb-0.5">{key}</span>
                    <span className="text-xs text-slate-200 break-words font-sans">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>Verified Agent Context Entity in FalkorDB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
