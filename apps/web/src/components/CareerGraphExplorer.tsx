import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Network, Sparkles, Filter, X, ShieldCheck, Compass } from 'lucide-react';

export interface GraphVisualNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphVisualEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties?: Record<string, any>;
}

interface CareerGraphExplorerProps {
  nodes: GraphVisualNode[];
  edges: GraphVisualEdge[];
  falkorMode?: string;
  highlightJobId?: string;
  onClose?: () => void;
}

const LABEL_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Candidate: { bg: 'bg-sky-950/90', border: 'border-sky-400', text: 'text-sky-500', glow: 'rgba(56, 189, 248, 0.4)' },
  Experience: { bg: 'bg-emerald-950/90', border: 'border-emerald-400', text: 'text-emerald-300', glow: 'rgba(52, 211, 153, 0.4)' },
  Project: { bg: 'bg-cyan-950/90', border: 'border-cyan-400', text: 'text-cyan-300', glow: 'rgba(34, 211, 238, 0.4)' },
  Skill: { bg: 'bg-violet-950/90', border: 'border-violet-400', text: 'text-violet-300', glow: 'rgba(167, 139, 250, 0.4)' },
  Job: { bg: 'bg-amber-950/90', border: 'border-amber-400', text: 'text-amber-500', glow: 'rgba(251, 191, 36, 0.4)' },
  Requirement: { bg: 'bg-rose-950/90', border: 'border-rose-400', text: 'text-rose-500', glow: 'rgba(251, 113, 133, 0.4)' },
  Education: { bg: 'bg-pink-950/90', border: 'border-pink-400', text: 'text-pink-300', glow: 'rgba(244, 114, 182, 0.4)' },
  Memory: { bg: 'bg-indigo-950/90', border: 'border-indigo-400', text: 'text-indigo-300', glow: 'rgba(129, 140, 248, 0.4)' },
};

export const CareerGraphExplorer: React.FC<CareerGraphExplorerProps> = ({
  nodes,
  edges,
  falkorMode = 'IN_MEMORY',
  highlightJobId,
  onClose,
}) => {
  const [selectedNode, setSelectedNode] = useState<GraphVisualNode | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Compute Layout Positions and Edge Styling for React Flow
  const { initialNodes, initialEdges } = useMemo(() => {
    // Filter by label if specified
    const filteredNodes =
      activeFilter === 'ALL'
        ? nodes
        : nodes.filter((n) => n.labels.includes(activeFilter) || n.labels.includes('Candidate'));

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

    // Hierarchical lane layout:
    // Candidate (80) -> Experience / Memory (320) -> Project / Education (560) -> Skill (800) -> Requirement (1040) -> Job (1280)
    const laneX: Record<string, number> = {
      Candidate: 60,
      Experience: 280,
      Memory: 280,
      Project: 520,
      Education: 520,
      Skill: 760,
      Requirement: 1000,
      Job: 1240,
    };

    const counts: Record<string, number> = {};

    const rfNodes: Node[] = filteredNodes.map((n) => {
      const primaryLabel = n.labels[0] || 'Node';
      counts[primaryLabel] = (counts[primaryLabel] || 0) + 1;
      const x = laneX[primaryLabel] || 400;
      const y = (counts[primaryLabel] - 1) * 100 + 70;

      const colors = LABEL_COLORS[primaryLabel] || {
        bg: 'bg-slate-100',
        border: 'border-slate-500',
        text: 'text-slate-700',
        glow: 'rgba(255,255,255,0.2)',
      };

      const title =
        n.properties.title ||
        n.properties.name ||
        n.properties.company ||
        n.properties.description?.substring(0, 28) ||
        n.id;

      const isHighlighted = highlightJobId && (n.id === highlightJobId || n.properties.jobId === highlightJobId);

      return {
        id: n.id,
        position: { x, y },
        data: {
          label: (
            <div
              className={`p-2.5 rounded-xl border shadow-lg ${colors.bg} ${colors.border} transition-all hover:scale-105 cursor-pointer ${
                isHighlighted ? 'ring-2 ring-amber-400 shadow-amber-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/50 ${colors.text}`}
                >
                  {primaryLabel}
                </span>
                {n.properties.verificationStatus === 'USER_VERIFIED' && (
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                )}
              </div>
              <div className="text-xs font-semibold text-slate-900 max-w-[160px] truncate">
                {title}
              </div>
            </div>
          ),
          raw: n,
        },
      };
    });

    const rfEdges: Edge[] = filteredEdges.map((e) => {
      const isProofEdge =
        highlightJobId &&
        (e.sourceId === highlightJobId || e.targetId === highlightJobId);

      return {
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.type,
        animated: true,
        style: {
          stroke: isProofEdge ? '#f59e0b' : '#38bdf8',
          strokeWidth: isProofEdge ? 2.5 : 1.5,
        },
        labelStyle: { fill: '#94a3b8', fontSize: 9, fontWeight: 600, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#0a0f1d', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      };
    });

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [nodes, edges, activeFilter, highlightJobId]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl bg-slate-50 overflow-hidden border border-slate-200 shadow-2xl">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-3 bg-slate-100/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 shadow-xl">
          <Network className="w-5 h-5 text-sky-600 animate-pulse shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Career Graph Reasoning Canvas</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-500 border border-sky-500/30">
                {falkorMode}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Interactive multi-hop proof: Candidate &rarr; Experience &rarr; Skill &larr; Requirement &larr; Job
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-xl">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
          {['ALL', 'Skill', 'Experience', 'Project', 'Requirement', 'Job'].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeFilter === f
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {f}
            </button>
          ))}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* React Flow Viewport Canvas */}
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={(_, node) => setSelectedNode((node.data as any).raw)}
        fitView
        className="bg-slate-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
        <Controls className="!bg-slate-100 !border-slate-300 !text-slate-900 rounded-xl overflow-hidden" />
        <MiniMap
          nodeColor={(n) => {
            const raw = (n.data as any)?.raw as GraphVisualNode;
            const primary = raw?.labels?.[0] || 'Node';
            return LABEL_COLORS[primary]?.border.replace('border-', '') || '#64748b';
          }}
          className="!bg-slate-900 !border-slate-200 rounded-xl"
        />
      </ReactFlow>

      {/* Node Details Inspection Drawer */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bottom-4 w-96 z-20 bg-slate-100/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-500 border border-sky-500/40">
                  {selectedNode.labels.join(', ')}
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-2">
                  {selectedNode.properties.title ||
                    selectedNode.properties.name ||
                    selectedNode.properties.company ||
                    selectedNode.id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Properties List */}
            <div className="mt-4 space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Graph Node Properties
              </div>
              {Object.entries(selectedNode.properties).map(([key, val]) => {
                if (key === 'title' || key === 'name') return null;
                return (
                  <div key={key} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-mono text-sky-600 block mb-0.5">{key}</span>
                    <span className="text-xs text-slate-800 break-words font-sans">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Verified Agent Context Entity in FalkorDB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
