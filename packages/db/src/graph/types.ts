export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
}

export interface QueryResult<T = any> {
  data: T[];
  metadata?: any[];
}

export interface FalkorGraphSession {
  query<T = any>(cypher: string, params?: Record<string, any>): Promise<QueryResult<T>>;
}

export type MemoryType = 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL';

export interface MemoryNode {
  id: string;
  tenantId: string;
  memoryType: MemoryType;
  title: string;
  content: string;
  source: string;
  verificationStatus: string;
  createdAt: string;
  expiresAt?: string | null;
  supersededBy?: string | null;
}

export interface MatchEvidencePath {
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

export interface GraphStats {
  mode: 'LIVE' | 'IN_MEMORY';
  totalNodes: number;
  totalEdges: number;
  nodeCountsByLabel: Record<string, number>;
  edgeCountsByType: Record<string, number>;
}
