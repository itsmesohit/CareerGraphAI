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

export interface MatchPathExplanation {
  jobId: string;
  requirementId: string;
  requirementText: string;
  skillName: string;
  demonstratedBy: {
    type: 'PROJECT' | 'EXPERIENCE' | 'EVIDENCE' | 'ANSWER';
    id: string;
    name: string;
    provenance: string;
  };
  confidence: number;
}
