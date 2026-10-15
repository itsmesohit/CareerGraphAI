import { GraphNode, GraphEdge, QueryResult, FalkorGraphSession, MatchEvidencePath } from './types.js';
import { Redis } from 'ioredis';

export class InMemFalkorGraphEngine implements FalkorGraphSession {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();

  // Secondary indexes for high-speed graph traversal
  private nodesByTenant: Map<string, Set<string>> = new Map();
  private edgesBySource: Map<string, Set<string>> = new Map();
  private edgesByTarget: Map<string, Set<string>> = new Map();

  // Cross-process synchronization backing store
  private redis: Redis | null = null;
  private redisPrefix = 'careergraph:inmem_graph';

  constructor() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 800,
        retryStrategy: () => null,
      });
      this.redis.on('error', () => {
        // silent fallback to pure in-memory without crashing
      });
    } catch {
      this.redis = null;
    }
  }

  private async syncFromRedis() {
    if (!this.redis) return;
    try {
      const [rawNodes, rawEdges] = await Promise.all([
        this.redis.hgetall(`${this.redisPrefix}:nodes`),
        this.redis.hgetall(`${this.redisPrefix}:edges`),
      ]);

      if (rawNodes && Object.keys(rawNodes).length > 0) {
        Object.values(rawNodes).forEach((str) => {
          try {
            const node = JSON.parse(str);
            this.addNodeLocal(node);
          } catch {}
        });
      }

      if (rawEdges && Object.keys(rawEdges).length > 0) {
        Object.values(rawEdges).forEach((str) => {
          try {
            const edge = JSON.parse(str);
            this.addEdgeLocal(edge);
          } catch {}
        });
      }
    } catch {}
  }

  public clear() {
    this.nodes.clear();
    this.edges.clear();
    this.nodesByTenant.clear();
    this.edgesBySource.clear();
    this.edgesByTarget.clear();

    if (this.redis) {
      this.redis.del(`${this.redisPrefix}:nodes`, `${this.redisPrefix}:edges`).catch(() => {});
    }
  }

  private addNodeLocal(node: GraphNode) {
    this.nodes.set(node.id, node);

    const tenantId = node.properties.tenantId || node.properties.candidateId || node.properties.userId;
    if (tenantId) {
      if (!this.nodesByTenant.has(tenantId)) {
        this.nodesByTenant.set(tenantId, new Set());
      }
      this.nodesByTenant.get(tenantId)!.add(node.id);
    }
  }

  public addNode(node: GraphNode) {
    this.addNodeLocal(node);
    if (this.redis) {
      this.redis.hset(`${this.redisPrefix}:nodes`, node.id, JSON.stringify(node)).catch(() => {});
    }
  }

  private removeNodeLocal(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;

    // Delete associated edges
    const relatedEdgeIds: string[] = [];
    this.edges.forEach((edge, edgeId) => {
      if (edge.sourceId === id || edge.targetId === id) {
        relatedEdgeIds.push(edgeId);
      }
    });

    relatedEdgeIds.forEach((edgeId) => this.removeEdge(edgeId));

    const tenantId = node.properties.tenantId || node.properties.candidateId || node.properties.userId;
    if (tenantId && this.nodesByTenant.has(tenantId)) {
      this.nodesByTenant.get(tenantId)!.delete(id);
    }

    this.nodes.delete(id);
  }

  public removeNode(id: string) {
    this.removeNodeLocal(id);
    if (this.redis) {
      this.redis.hdel(`${this.redisPrefix}:nodes`, id).catch(() => {});
    }
  }

  private addEdgeLocal(edge: GraphEdge) {
    this.edges.set(edge.id, edge);

    if (!this.edgesBySource.has(edge.sourceId)) {
      this.edgesBySource.set(edge.sourceId, new Set());
    }
    this.edgesBySource.get(edge.sourceId)!.add(edge.id);

    if (!this.edgesByTarget.has(edge.targetId)) {
      this.edgesByTarget.set(edge.targetId, new Set());
    }
    this.edgesByTarget.get(edge.targetId)!.add(edge.id);
  }

  public addEdge(edge: GraphEdge) {
    this.addEdgeLocal(edge);
    if (this.redis) {
      this.redis.hset(`${this.redisPrefix}:edges`, edge.id, JSON.stringify(edge)).catch(() => {});
    }
  }

  private removeEdgeLocal(id: string) {
    const edge = this.edges.get(id);
    if (!edge) return;

    if (this.edgesBySource.has(edge.sourceId)) {
      this.edgesBySource.get(edge.sourceId)!.delete(id);
    }
    if (this.edgesByTarget.has(edge.targetId)) {
      this.edgesByTarget.get(edge.targetId)!.delete(id);
    }

    this.edges.delete(id);
  }

  public removeEdge(id: string) {
    this.removeEdgeLocal(id);
    if (this.redis) {
      this.redis.hdel(`${this.redisPrefix}:edges`, id).catch(() => {});
    }
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  public getNodesByTenant(tenantId: string): GraphNode[] {
    const ids = this.nodesByTenant.get(tenantId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  public getEdgesForNodes(nodeIds: Set<string>): GraphEdge[] {
    return Array.from(this.edges.values()).filter(
      (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
    );
  }

  public ensureCandidateNode(candidateId: string): GraphNode {
    let node = this.nodes.get(candidateId);
    if (!node) {
      node = {
        id: candidateId,
        labels: ['Candidate'],
        properties: {
          id: candidateId,
          tenantId: candidateId,
          name: 'Candidate',
          updatedAt: new Date().toISOString(),
        },
      };
      this.addNode(node);
    }
    return node;
  }

  /**
   * Evaluates Cypher queries against the graph engine.
   */
  async query<T = any>(cypher: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    await this.syncFromRedis();
    const clean = cypher.trim();

    // 1. DELETE / DETACH DELETE by tenant or by node id
    if (clean.includes('DETACH DELETE')) {
      if (params.tenantId) {
        const tenantNodes = this.nodesByTenant.get(params.tenantId);
        if (tenantNodes) {
          const toDelete = Array.from(tenantNodes);
          toDelete.forEach((id) => this.removeNode(id));
        }
        return { data: [] };
      }
      if (params.id) {
        this.removeNode(params.id);
        return { data: [] };
      }
    }

    // 1b. SET n.verificationStatus
    if (clean.includes('SET n.verificationStatus = $verificationStatus')) {
      const node = this.nodes.get(params.id);
      if (node) {
        node.properties.verificationStatus = params.verificationStatus;
        this.addNode(node); // updates redis as well
      }
      return { data: [{ n: node } as unknown as T] };
    }

    // 2. MERGE / CREATE Candidate
    if (clean.includes('MERGE (c:Candidate') || clean.includes('CREATE (c:Candidate')) {
      const candidateId = params.id || params.candidateId;
      const node: GraphNode = {
        id: candidateId,
        labels: ['Candidate'],
        properties: {
          id: candidateId,
          tenantId: params.tenantId || candidateId,
          name: params.name || '',
          email: params.email || '',
          headline: params.headline || '',
          completenessScore: params.completenessScore || 0,
          updatedAt: new Date().toISOString(),
        },
      };
      this.addNode(node);
      return { data: [{ c: node } as unknown as T] };
    }

    // 3. MERGE / CREATE Experience
    if (clean.includes('MERGE (e:Experience') || clean.includes('CREATE (e:Experience')) {
      const expId = params.id || params.experienceId;
      const candidateId = params.candidateId || params.tenantId;
      if (candidateId) {
        this.ensureCandidateNode(candidateId);
      }

      const node: GraphNode = {
        id: expId,
        labels: ['Experience'],
        properties: {
          id: expId,
          tenantId: params.tenantId || candidateId,
          candidateId: candidateId,
          company: params.company,
          title: params.title,
          startDate: params.startDate,
          endDate: params.endDate,
          isCurrent: params.isCurrent ?? false,
          description: params.description || '',
          metrics: params.metrics || [],
          technologies: params.technologies || [],
          verificationStatus: params.verificationStatus || 'UNVERIFIED',
        },
      };
      this.addNode(node);

      // Link to candidate
      if (candidateId) {
        const edgeId = `edge_has_exp_${candidateId}_${expId}`;
        this.addEdge({
          id: edgeId,
          type: 'HAS_EXPERIENCE',
          sourceId: candidateId,
          targetId: expId,
          properties: { createdAt: new Date().toISOString() },
        });
      }

      // Link to skills demonstrated
      if (params.technologies && Array.isArray(params.technologies)) {
        params.technologies.forEach((tech: string) => {
          const skillId = `skill_${tech.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          this.ensureSkillNode(skillId, tech, params.tenantId || candidateId);

          const edgeId = `edge_exp_demo_${expId}_${skillId}`;
          this.addEdge({
            id: edgeId,
            type: 'DEMONSTRATES',
            sourceId: expId,
            targetId: skillId,
            properties: { context: params.company },
          });
        });
      }

      return { data: [{ e: node } as unknown as T] };
    }

    // 4. MERGE / CREATE Skill
    if (clean.includes('MERGE (s:Skill') || clean.includes('CREATE (s:Skill')) {
      const skillName = (params.name || '').trim();
      const skillId = params.id || `skill_${skillName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const candidateId = params.candidateId || params.tenantId;
      if (candidateId) {
        this.ensureCandidateNode(candidateId);
      }

      const skillNode = this.ensureSkillNode(skillId, skillName, params.tenantId || candidateId, params.category);

      // Link to candidate
      if (candidateId) {
        const edgeId = `edge_has_skill_${candidateId}_${skillId}`;
        this.addEdge({
          id: edgeId,
          type: 'HAS_SKILL',
          sourceId: candidateId,
          targetId: skillId,
          properties: {
            proficiency: params.proficiency || 'Proficient',
            yearsExperience: params.yearsExperience || 1,
            verificationStatus: params.verificationStatus || 'UNVERIFIED',
          },
        });
      }

      return { data: [{ s: skillNode } as unknown as T] };
    }

    // 5. MERGE / CREATE Project
    if (clean.includes('MERGE (p:Project') || clean.includes('CREATE (p:Project')) {
      const projId = params.id || params.projectId;
      const candidateId = params.candidateId || params.tenantId;
      if (candidateId) {
        this.ensureCandidateNode(candidateId);
      }

      const node: GraphNode = {
        id: projId,
        labels: ['Project'],
        properties: {
          id: projId,
          tenantId: params.tenantId || candidateId,
          candidateId: candidateId,
          name: params.name,
          role: params.role || '',
          description: params.description || '',
          techStack: params.techStack || [],
          url: params.url || '',
          verificationStatus: params.verificationStatus || 'UNVERIFIED',
        },
      };
      this.addNode(node);

      if (candidateId) {
        const edgeId = `edge_built_proj_${candidateId}_${projId}`;
        this.addEdge({
          id: edgeId,
          type: 'BUILT',
          sourceId: candidateId,
          targetId: projId,
          properties: { role: params.role || 'Creator' },
        });
      }

      if (params.techStack && Array.isArray(params.techStack)) {
        params.techStack.forEach((tech: string) => {
          const skillId = `skill_${tech.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          this.ensureSkillNode(skillId, tech, params.tenantId || candidateId);

          const edgeId = `edge_proj_demo_${projId}_${skillId}`;
          this.addEdge({
            id: edgeId,
            type: 'DEMONSTRATES',
            sourceId: projId,
            targetId: skillId,
            properties: { context: params.name },
          });
        });
      }

      return { data: [{ p: node } as unknown as T] };
    }

    // 5b. MERGE / CREATE Education
    if (clean.includes('MERGE (ed:Education') || clean.includes('CREATE (ed:Education')) {
      const edId = params.id || params.educationId;
      const candidateId = params.candidateId || params.tenantId;
      if (candidateId) {
        this.ensureCandidateNode(candidateId);
      }

      const node: GraphNode = {
        id: edId,
        labels: ['Education'],
        properties: {
          id: edId,
          tenantId: params.tenantId || candidateId,
          candidateId: candidateId,
          institution: params.institution,
          degree: params.degree || '',
          fieldOfStudy: params.fieldOfStudy || '',
          startDate: params.startDate || null,
          endDate: params.endDate || null,
          verificationStatus: params.verificationStatus || 'UNVERIFIED',
        },
      };
      this.addNode(node);

      if (candidateId) {
        const edgeId = `edge_studied_at_${candidateId}_${edId}`;
        this.addEdge({
          id: edgeId,
          type: 'STUDIED_AT',
          sourceId: candidateId,
          targetId: edId,
          properties: { institution: params.institution },
        });
      }

      return { data: [{ ed: node } as unknown as T] };
    }

    // 5c. MERGE / CREATE Certification
    if (clean.includes('MERGE (cert:Certification') || clean.includes('CREATE (cert:Certification')) {
      const certId = params.id || params.certificationId;
      const candidateId = params.candidateId || params.tenantId;
      if (candidateId) {
        this.ensureCandidateNode(candidateId);
      }

      const node: GraphNode = {
        id: certId,
        labels: ['Certification'],
        properties: {
          id: certId,
          tenantId: params.tenantId || candidateId,
          candidateId: candidateId,
          name: params.name,
          issuer: params.issuer || '',
          issueDate: params.issueDate || null,
          verificationStatus: params.verificationStatus || 'UNVERIFIED',
        },
      };
      this.addNode(node);

      if (candidateId) {
        const edgeId = `edge_holds_cert_${candidateId}_${certId}`;
        this.addEdge({
          id: edgeId,
          type: 'HOLDS_CERT',
          sourceId: candidateId,
          targetId: certId,
          properties: { issuer: params.issuer },
        });
      }

      return { data: [{ cert: node } as unknown as T] };
    }

    // 6. MERGE / CREATE Memory (Episodic / Semantic / Procedural)
    if (clean.includes('MERGE (m:Memory') || clean.includes('CREATE (m:Memory')) {
      const memoryId = params.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const candidateId = params.candidateId || params.tenantId;
      if (candidateId) {
        this.ensureCandidateNode(candidateId);
      }

      const node: GraphNode = {
        id: memoryId,
        labels: ['Memory'],
        properties: {
          id: memoryId,
          tenantId: params.tenantId || candidateId,
          candidateId: candidateId,
          memoryType: params.memoryType || 'SEMANTIC',
          title: params.title || '',
          content: params.content || '',
          source: params.source || 'USER_VERIFIED',
          verificationStatus: params.verificationStatus || 'USER_VERIFIED',
          createdAt: params.createdAt || new Date().toISOString(),
          expiresAt: params.expiresAt || null,
        },
      };
      this.addNode(node);

      if (candidateId) {
        const edgeId = `edge_has_mem_${candidateId}_${memoryId}`;
        this.addEdge({
          id: edgeId,
          type: 'HAS_MEMORY',
          sourceId: candidateId,
          targetId: memoryId,
          properties: { memoryType: params.memoryType || 'SEMANTIC' },
        });
      }

      return { data: [{ m: node } as unknown as T] };
    }

    // 7. MERGE / CREATE Job & Requirements
    if (clean.includes('MERGE (j:Job') || clean.includes('CREATE (j:Job')) {
      const jobId = params.id || params.jobId;
      const node: GraphNode = {
        id: jobId,
        labels: ['Job'],
        properties: {
          id: jobId,
          company: params.company,
          title: params.title,
          location: params.location,
          url: params.url,
          salary: params.salary,
          createdAt: new Date().toISOString(),
        },
      };
      this.addNode(node);

      if (params.requirements && Array.isArray(params.requirements)) {
        params.requirements.forEach((req: any, idx: number) => {
          const reqId = `req_${jobId}_${idx}`;
          const reqNode: GraphNode = {
            id: reqId,
            labels: ['Requirement'],
            properties: {
              id: reqId,
              jobId,
              description: req.description || req.text,
              isHardConstraint: req.isHardConstraint || false,
              weight: req.weight || 1.0,
            },
          };
          this.addNode(reqNode);

          this.addEdge({
            id: `edge_job_requires_${jobId}_${reqId}`,
            type: 'REQUIRES',
            sourceId: jobId,
            targetId: reqId,
            properties: {},
          });

          if (req.skill) {
            const skillId = `skill_${req.skill.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            this.ensureSkillNode(skillId, req.skill, params.tenantId);
            this.addEdge({
              id: `edge_req_needs_skill_${reqId}_${skillId}`,
              type: 'REQUIRES_SKILL',
              sourceId: reqId,
              targetId: skillId,
              properties: {},
            });
          }
        });
      }

      return { data: [{ j: node } as unknown as T] };
    }

    // 8. MULTI-HOP Traversal: Match Evidence Path
    // Path: Candidate -> [HAS_EXPERIENCE/BUILT] -> [Experience/Project] -> [DEMONSTRATES] -> [Skill] <- [REQUIRES_SKILL] <- [Requirement] <- [REQUIRES] <- [Job]
    if (clean.includes('DEMONSTRATES') && clean.includes('REQUIRES')) {
      const candidateId = params.candidateId;
      const targetJobId = params.jobId;

      const explanations: MatchEvidencePath[] = [];

      // Find requirements for Job
      const jobEdges = targetJobId ? this.edgesBySource.get(targetJobId) : undefined;
      if (jobEdges) {
        for (const jEdgeId of jobEdges) {
          const jEdge = this.edges.get(jEdgeId);
          if (jEdge && jEdge.type === 'REQUIRES') {
            const reqNode = this.nodes.get(jEdge.targetId);
            if (reqNode) {
              // Find required skill
              const reqEdges = this.edgesBySource.get(reqNode.id);
              if (reqEdges) {
                for (const rEdgeId of reqEdges) {
                  const rEdge = this.edges.get(rEdgeId);
                  if (rEdge && rEdge.type === 'REQUIRES_SKILL') {
                    const skillNode = this.nodes.get(rEdge.targetId);
                    if (skillNode) {
                      // Check if candidate demonstrated this skill via experience or project
                      const skillTargetEdges = this.edgesByTarget.get(skillNode.id);
                      if (skillTargetEdges) {
                        for (const sTargetEdgeId of skillTargetEdges) {
                          const sEdge = this.edges.get(sTargetEdgeId);
                          if (sEdge && sEdge.type === 'DEMONSTRATES') {
                            const proofNode = this.nodes.get(sEdge.sourceId);
                            if (proofNode) {
                              // Verify proof belongs to this candidate
                              if (proofNode.properties.candidateId === candidateId || proofNode.properties.tenantId === candidateId) {
                                const isExperience = proofNode.labels.includes('Experience');
                                const isProject = proofNode.labels.includes('Project');

                                explanations.push({
                                  jobId: targetJobId || reqNode.properties.jobId || 'job_unknown',
                                  requirementId: reqNode.id,
                                  requirementText: reqNode.properties.description || '',
                                  skillName: skillNode.properties.name || '',
                                  demonstratedBy: {
                                    type: isProject ? 'PROJECT' : 'EXPERIENCE',
                                    id: proofNode.id,
                                    title: proofNode.properties.title || proofNode.properties.name,
                                    metrics: proofNode.properties.metrics || [],
                                  },
                                  confidence: proofNode.properties.verificationStatus === 'USER_VERIFIED' ? 1.0 : 0.7,
                                });
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      return { data: explanations as unknown as T[] };
    }

    // 9. QUERY: Triple-Tier Memories
    if (clean.includes('-[:HAS_MEMORY]->(m:Memory)') || (clean.includes('Memory') && clean.includes('RETURN m'))) {
      const candidateId = params.candidateId;
      const memoryType = params.memoryType;

      const seenIds = new Set<string>();
      const memories: GraphNode[] = [];

      // 1. Traverse via edge
      const edgeIds = this.edgesBySource.get(candidateId);
      if (edgeIds) {
        edgeIds.forEach((eid) => {
          const edge = this.edges.get(eid);
          if (edge && edge.type === 'HAS_MEMORY') {
            const memNode = this.nodes.get(edge.targetId);
            if (memNode && memNode.labels.includes('Memory') && !seenIds.has(memNode.id)) {
              if (!memoryType || memNode.properties.memoryType === memoryType) {
                seenIds.add(memNode.id);
                memories.push(memNode);
              }
            }
          }
        });
      }

      // 2. Fallback via tenant index
      const tenantNodes = this.nodesByTenant.get(candidateId);
      if (tenantNodes) {
        tenantNodes.forEach((nid) => {
          const node = this.nodes.get(nid);
          if (node && node.labels.includes('Memory') && !seenIds.has(node.id)) {
            if (!memoryType || node.properties.memoryType === memoryType) {
              seenIds.add(node.id);
              memories.push(node);
            }
          }
        });
      }

      return { data: memories as unknown as T[] };
    }

    // 10. QUERY: Candidate Graph Nodes & Edges
    if (clean.includes('MATCH (c:Candidate') && (clean.endsWith('RETURN c') || clean.includes('RETURN c\n') || clean.includes('RETURN c '))) {
      const candidateId = params.candidateId;
      let candidateNode = this.nodes.get(candidateId);
      if (!candidateNode) {
        // Check if there are any nodes belonging to this candidate
        const tenantNodes = this.getNodesByTenant(candidateId);
        if (tenantNodes.length > 0) {
          candidateNode = this.ensureCandidateNode(candidateId);
        } else {
          return { data: [] };
        }
      }

      // Collect all directly and indirectly connected nodes for this candidate
      const candidateConnectedNodeIds = new Set<string>([candidateId]);

      this.edges.forEach((edge) => {
        if (edge.sourceId === candidateId) {
          candidateConnectedNodeIds.add(edge.targetId);
        }
      });

      // Also add skills connected from projects / experiences of this candidate
      this.edges.forEach((edge) => {
        if (candidateConnectedNodeIds.has(edge.sourceId)) {
          candidateConnectedNodeIds.add(edge.targetId);
        }
      });

      const matchedNodes = Array.from(candidateConnectedNodeIds)
        .map((id) => this.nodes.get(id))
        .filter((n): n is GraphNode => n !== undefined);

      const matchedEdges = this.getEdgesForNodes(candidateConnectedNodeIds);

      return {
        data: [{ nodes: matchedNodes, edges: matchedEdges } as unknown as T],
      };
    }

    // Default fallback
    return { data: [] };
  }

  private ensureSkillNode(
    id: string,
    name: string,
    tenantId?: string,
    category?: string
  ): GraphNode {
    let node = this.nodes.get(id);
    if (!node) {
      node = {
        id,
        labels: ['Skill'],
        properties: {
          id,
          name,
          category: category || 'General',
          tenantId: tenantId || 'GLOBAL',
        },
      };
      this.addNode(node);
    }
    return node;
  }
}
