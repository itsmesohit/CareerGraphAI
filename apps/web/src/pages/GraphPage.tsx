import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Network,
  Cpu,
  Brain,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Clock,
  FileText,
  Briefcase,
  Code,
  GraduationCap,
  Award,
  ChevronRight,
  Plus,
  Zap,
} from 'lucide-react';
import { CareerGraphExplorer } from '../components/CareerGraphExplorer.js';

interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface GraphEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
}

interface GraphStats {
  mode: 'LIVE' | 'IN_MEMORY';
  totalNodes: number;
  totalEdges: number;
  nodeCountsByLabel: Record<string, number>;
  edgeCountsByType: Record<string, number>;
}

interface MatchEvidencePath {
  jobId: string;
  requirementId: string;
  requirementText: string;
  skillName: string;
  demonstratedBy: {
    type: 'PROJECT' | 'EXPERIENCE' | 'EDUCATION' | 'ANSWER';
    id: string;
    title: string;
    metrics?: string[];
  };
  confidence: number;
}

export const GraphPage: React.FC = () => {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [memories, setMemories] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterLabel, setFilterLabel] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'GRAPH' | 'MEMORIES' | 'EVIDENCE'>('GRAPH');
  const [memoryFilter, setMemoryFilter] = useState<'ALL' | 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL'>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Evidence query state
  const [sampleJobId, setSampleJobId] = useState<string>('sample_job_senior_fullstack');
  const [evidencePaths, setEvidencePaths] = useState<MatchEvidencePath[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // New memory modal / input
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemType, setNewMemType] = useState<'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL'>('SEMANTIC');
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemContent, setNewMemContent] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [nodesRes, statsRes, memsRes] = await Promise.all([
        fetch('/api/v1/graph/nodes', { credentials: 'include' }),
        fetch('/api/v1/graph/stats', { credentials: 'include' }),
        fetch('/api/v1/graph/memories', { credentials: 'include' }),
      ]);

      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
      if (memsRes.ok) {
        const data = await memsRes.json();
        setMemories(data.memories || []);
      }
    } catch (err: any) {
      console.error('Failed to load graph data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setStatusMessage('Rebuilding graph from PostgreSQL...');
    try {
      const res = await fetch('/api/v1/graph/rebuild', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(`Rebuilt successfully: ${data.nodesProjected || 0} nodes projected.`);
        await fetchData();
      } else {
        setStatusMessage('Rebuild failed.');
      }
    } catch {
      setStatusMessage('Error rebuilding graph.');
    } finally {
      setIsRebuilding(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setStatusMessage('Sweeping outbox queue...');
    try {
      const res = await fetch('/api/v1/graph/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(`Outbox swept: ${data.swept} event(s) projected.`);
        await fetchData();
      }
    } catch {
      setStatusMessage('Sync failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle.trim() || !newMemContent.trim()) return;

    try {
      const res = await fetch('/api/v1/graph/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newMemTitle,
          content: newMemContent,
          memoryType: newMemType,
        }),
      });

      if (res.ok) {
        setShowAddMemory(false);
        setNewMemTitle('');
        setNewMemContent('');
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to add memory', err);
    }
  };

  const handleQueryEvidence = async () => {
    setLoadingEvidence(true);
    try {
      const res = await fetch(`/api/v1/graph/evidence-paths?jobId=${encodeURIComponent(sampleJobId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setEvidencePaths(data.paths || []);
      }
    } catch (err) {
      console.error('Error fetching evidence paths', err);
    } finally {
      setLoadingEvidence(false);
    }
  };

  const filteredNodes = useMemo(() => {
    if (filterLabel === 'ALL') return nodes;
    return nodes.filter((n) => n.labels.includes(filterLabel));
  }, [nodes, filterLabel]);

  const filteredMemories = useMemo(() => {
    if (memoryFilter === 'ALL') return memories;
    return memories.filter((m) => m.properties.memoryType === memoryFilter);
  }, [memories, memoryFilter]);

  const getNodeColor = (label?: string) => {
    switch (label) {
      case 'Candidate':
        return 'from-sky-500 to-blue-600 border-sky-400 text-sky-200';
      case 'Experience':
        return 'from-emerald-500 to-teal-600 border-emerald-400 text-emerald-200';
      case 'Skill':
        return 'from-violet-500 to-purple-600 border-violet-400 text-violet-200';
      case 'Project':
        return 'from-amber-500 to-orange-600 border-amber-400 text-amber-200';
      case 'Education':
        return 'from-pink-500 to-rose-600 border-pink-400 text-pink-200';
      case 'Memory':
        return 'from-cyan-500 to-blue-600 border-cyan-400 text-cyan-200';
      default:
        return 'from-slate-600 to-slate-700 border-slate-500 text-white';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header & Telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Career Knowledge Graph
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">
                  Cypher Engine
                </span>
              </h1>
              <p className="text-sm text-slate-500">
                FalkorDB graph projection & triple-tier memory model (Episodic, Semantic, Procedural)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Engine status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-500">Mode:</span>
            <span className="font-semibold text-slate-900">
              {stats?.mode === 'LIVE' ? 'LIVE FalkorDB' : 'In-Memory Engine'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-700 text-slate-800 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-amber-600' : 'text-slate-500'}`} />
            Sync Outbox
          </button>

          <button
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebuilding ? 'animate-spin' : ''}`} />
            Rebuild Graph
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="mt-4 px-4 py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 text-xs font-medium flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4" />
          {statusMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('GRAPH')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'GRAPH'
              ? 'bg-sky-500/15 text-sky-600 border border-sky-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Network className="w-4 h-4" />
          Graph Canvas ({nodes.length} nodes)
        </button>
        <button
          onClick={() => setActiveTab('MEMORIES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'MEMORIES'
              ? 'bg-sky-500/15 text-sky-600 border border-sky-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Brain className="w-4 h-4" />
          Triple-Tier Memory ({memories.length})
        </button>
        <button
          onClick={() => setActiveTab('EVIDENCE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'EVIDENCE'
              ? 'bg-sky-500/15 text-sky-600 border border-sky-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Match Evidence Paths
        </button>
      </div>

      {/* Content Panels */}
      {activeTab === 'GRAPH' && (
        <div className="mt-6">
          <CareerGraphExplorer
            nodes={nodes}
            edges={edges}
            falkorMode={stats?.mode || 'LIVE'}
          />
        </div>
      )}

      {/* Triple-Tier Memory Inspector */}
      {activeTab === 'MEMORIES' && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {(['ALL', 'EPISODIC', 'SEMANTIC', 'PROCEDURAL'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMemoryFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    memoryFilter === type
                      ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                      : 'bg-slate-100 text-slate-500 border-slate-100 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddMemory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Memory
            </button>
          </div>

          {/* Memory Modal */}
          {showAddMemory && (
            <div className="p-5 bg-slate-100 border border-sky-500/30 rounded-2xl animate-fadeIn space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-sky-600" />
                Record New Memory Node
              </h3>
              <form onSubmit={handleAddMemory} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Memory Tier</label>
                    <select
                      value={newMemType}
                      onChange={(e) => setNewMemType(e.target.value as any)}
                      className="mt-1 w-full bg-slate-900 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="EPISODIC">EPISODIC (Event / Timeline)</option>
                      <option value="SEMANTIC">SEMANTIC (Fact / Skill / Concept)</option>
                      <option value="PROCEDURAL">PROCEDURAL (Rule / Preference)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500 font-medium">Title</label>
                    <input
                      type="text"
                      value={newMemTitle}
                      onChange={(e) => setNewMemTitle(e.target.value)}
                      placeholder="e.g. Compensation Floor or Interview Takeaway"
                      className="mt-1 w-full bg-slate-900 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Content / Observation</label>
                  <textarea
                    value={newMemContent}
                    onChange={(e) => setNewMemContent(e.target.value)}
                    rows={3}
                    placeholder="Describe facts, candidate preferences, or rule execution details..."
                    className="mt-1 w-full bg-slate-900 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-600"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMemory(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold"
                  >
                    Save Memory
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMemories.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500">
                <Brain className="w-10 h-10 mx-auto mb-2 opacity-30 text-sky-600" />
                <p className="text-xs">No memories found under selected tier.</p>
              </div>
            ) : (
              filteredMemories.map((mem) => {
                const type = mem.properties.memoryType || 'SEMANTIC';
                const badgeColor =
                  type === 'EPISODIC'
                    ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                    : type === 'PROCEDURAL'
                    ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-sky-600 bg-sky-500/10 border-sky-500/20';

                return (
                  <div
                    key={mem.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}
                        >
                          {type}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {mem.properties.createdAt
                            ? new Date(mem.properties.createdAt).toLocaleDateString()
                            : 'Active'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                        {mem.properties.title || 'Untitled Memory'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {mem.properties.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Source: {mem.properties.source || 'USER_VERIFIED'}</span>
                      <span className="font-mono text-emerald-600 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Match Evidence Paths */}
      {activeTab === 'EVIDENCE' && (
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                Multi-Hop Graph Match Evidence Explainer
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates: <code>Candidate &rarr; Proof (Project / Exp) &rarr; Skill &larr; Requirement &larr; Job</code>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sampleJobId}
                onChange={(e) => setSampleJobId(e.target.value)}
                placeholder="Job ID"
                className="bg-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono w-56"
              />
              <button
                onClick={handleQueryEvidence}
                disabled={loadingEvidence}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                Traverse
              </button>
            </div>
          </div>

          {loadingEvidence ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Traversing Cypher multi-hop evidence paths...
            </div>
          ) : evidencePaths.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-100 border border-dashed border-slate-200 text-center text-slate-500 text-xs">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-600" />
              <p className="font-medium text-slate-700">No match evidence paths discovered for this job ID yet.</p>
              <p className="text-slate-500 mt-1">
                When jobs are ingested in Phase 4 & 5, evidence chains verify candidate experience directly against employer requirements.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {evidencePaths.map((path, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900">{path.skillName}</span>
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-500">{path.requirementText}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="text-sky-600 font-medium">Demonstrated By:</span>
                      <span className="text-slate-800">
                        {path.demonstratedBy.type}: {path.demonstratedBy.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-mono">Confidence</div>
                      <div className="text-xs font-bold text-emerald-600 font-mono">
                        {(path.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
