import { GraphNode, GraphEdge, QueryResult, FalkorGraphSession } from './types.js';

export class InMemFalkorGraphEngine implements FalkorGraphSession {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();

  constructor() {}

  public clear() {
    this.nodes.clear();
    this.edges.clear();
  }

  public addNode(node: GraphNode) {
    this.nodes.set(node.id, node);
  }

  public addEdge(edge: GraphEdge) {
    this.edges.set(edge.id, edge);
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

  /**
   * Evaluates Cypher queries against the in-memory graph.
   */
  async query<T = any>(cypher: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    const clean = cypher.trim();

    // 1. CREATE or MERGE Candidate
    if (clean.includes('MERGE (c:Candidate') || clean.includes('CREATE (c:Candidate')) {
      const candidateId = params.id || params.candidateId || `cand_${params.tenantId}`;
      const node: GraphNode = {
        id: candidateId,
        labels: ['Candidate'],
        properties: {
          id: candidateId,
          tenantId: params.tenantId,
          name: params.name || '',
          email: params.email || '',
          targetRole: params.targetRole || '',
          minSalary: params.minSalary || 0,
          remotePref: params.remotePref || 'ANY',
          noticePeriod: params.noticePeriod || 'IMMEDIATE',
          updatedAt: new Date().toISOString(),
        }
      };
      this.nodes.set(candidateId, node);
      return { data: [{ c: node } as unknown as T] };
    }

    // 2. MERGE Job & Requirements
    if (clean.includes('MERGE (j:Job') || clean.includes('CREATE (j:Job')) {
      const jobId = params.id || params.jobId;
      const jobNode: GraphNode = {
        id: jobId,
        labels: ['Job'],
        properties: {
          id: jobId,
          tenantId: params.tenantId,
          externalId: params.externalId || jobId,
          source: params.source || 'REMOTIVE',
          title: params.title || '',
          company: params.company || '',
          location: params.location || 'Remote',
          remote: params.remote !== undefined ? params.remote : true,
          url: params.url || '',
          applyUrl: params.applyUrl || params.url || '',
          salary: params.salary || '',
          description: params.description || '',
          seniority: params.seniority || 'MID',
          createdAt: params.createdAt || new Date().toISOString(),
        }
      };
      this.nodes.set(jobId, jobNode);
      return { data: [{ j: jobNode } as unknown as T] };
    }

    // 3. MERGE / CREATE Skill
    if (clean.includes('MERGE (s:Skill') || clean.includes('CREATE (s:Skill')) {
      const skillName = (params.name || '').toLowerCase().trim();
      const skillId = `skill_${skillName.replace(/[^a-z0-9]/g, '_')}`;
      let skillNode = this.nodes.get(skillId);
      if (!skillNode) {
        skillNode = {
          id: skillId,
          labels: ['Skill'],
          properties: {
            id: skillId,
            name: params.name,
            normalizedName: skillName,
            category: params.category || 'TECHNICAL',
          }
        };
        this.nodes.set(skillId, skillNode);
      }
      return { data: [{ s: skillNode } as unknown as T] };
    }

    // 4. Connect Requirement to Skill & Job
    if (clean.includes('MERGE (r:Requirement') || clean.includes('CREATE (r:Requirement')) {
      const reqId = params.requirementId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const reqNode: GraphNode = {
        id: reqId,
        labels: ['Requirement'],
        properties: {
          id: reqId,
          tenantId: params.tenantId,
          text: params.text || '',
          importance: params.importance || 'REQUIRED',
          minYears: params.minYears || 0,
        }
      };
      this.nodes.set(reqId, reqNode);

      if (params.jobId) {
        this.edges.set(`rel_${params.jobId}_req_${reqId}`, {
          id: `rel_${params.jobId}_req_${reqId}`,
          type: 'HAS_REQUIREMENT',
          sourceId: params.jobId,
          targetId: reqId,
          properties: {}
        });
      }

      if (params.skillName) {
        const norm = params.skillName.toLowerCase().trim();
        const skillId = `skill_${norm.replace(/[^a-z0-9]/g, '_')}`;
        let skillNode = this.nodes.get(skillId);
        if (!skillNode) {
          skillNode = {
            id: skillId,
            labels: ['Skill'],
            properties: { id: skillId, name: params.skillName, normalizedName: norm }
          };
          this.nodes.set(skillId, skillNode);
        }
        this.edges.set(`rel_req_${reqId}_skill_${skillId}`, {
          id: `rel_req_${reqId}_skill_${skillId}`,
          type: 'REQUIRES_SKILL',
          sourceId: reqId,
          targetId: skillId,
          properties: {}
        });
      }
      return { data: [{ r: reqNode } as unknown as T] };
    }

    // 5. Connect Candidate -> Experience -> Company -> Project -> Skill
    if (clean.includes('CREATE (e:Experience') || clean.includes('MERGE (e:Experience')) {
      const expId = params.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const expNode: GraphNode = {
        id: expId,
        labels: ['Experience'],
        properties: {
          id: expId,
          tenantId: params.tenantId,
          title: params.title || '',
          company: params.company || '',
          startDate: params.startDate || '',
          endDate: params.endDate || 'Present',
          description: params.description || '',
        }
      };
      this.nodes.set(expId, expNode);

      const candId = params.candidateId || `cand_${params.tenantId}`;
      this.edges.set(`rel_cand_${candId}_exp_${expId}`, {
        id: `rel_cand_${candId}_exp_${expId}`,
        type: 'HAS_EXPERIENCE',
        sourceId: candId,
        targetId: expId,
        properties: {}
      });

      return { data: [{ e: expNode } as unknown as T] };
    }

    // 6. Connect Project -> Demonstrates -> Skill
    if (clean.includes('CREATE (p:Project') || clean.includes('MERGE (p:Project')) {
      const projId = params.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const projNode: GraphNode = {
        id: projId,
        labels: ['Project'],
        properties: {
          id: projId,
          tenantId: params.tenantId,
          title: params.title || '',
          summary: params.summary || '',
          url: params.url || '',
          metrics: params.metrics || '',
        }
      };
      this.nodes.set(projId, projNode);

      if (params.experienceId) {
        this.edges.set(`rel_exp_${params.experienceId}_proj_${projId}`, {
          id: `rel_exp_${params.experienceId}_proj_${projId}`,
          type: 'CONTRIBUTED_TO',
          sourceId: params.experienceId,
          targetId: projId,
          properties: {}
        });
      }

      if (params.skillNames && Array.isArray(params.skillNames)) {
        for (const sName of params.skillNames) {
          const norm = sName.toLowerCase().trim();
          const sId = `skill_${norm.replace(/[^a-z0-9]/g, '_')}`;
          if (!this.nodes.has(sId)) {
            this.nodes.set(sId, {
              id: sId,
              labels: ['Skill'],
              properties: { id: sId, name: sName, normalizedName: norm }
            });
          }
          this.edges.set(`rel_proj_${projId}_skill_${sId}`, {
            id: `rel_proj_${projId}_skill_${sId}`,
            type: 'DEMONSTRATES',
            sourceId: projId,
            targetId: sId,
            properties: {}
          });
        }
      }
      return { data: [{ p: projNode } as unknown as T] };
    }

    // 7. Evidence -> SUPPORTS -> Skill
    if (clean.includes('CREATE (ev:Evidence') || clean.includes('MERGE (ev:Evidence')) {
      const evId = params.id || `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const evNode: GraphNode = {
        id: evId,
        labels: ['Evidence'],
        properties: {
          id: evId,
          tenantId: params.tenantId,
          text: params.text || '',
          source: params.source || 'RESUME',
          confidence: params.confidence || 0.9,
          verifiedAt: params.verifiedAt || new Date().toISOString(),
        }
      };
      this.nodes.set(evId, evNode);

      if (params.skillName) {
        const norm = params.skillName.toLowerCase().trim();
        const sId = `skill_${norm.replace(/[^a-z0-9]/g, '_')}`;
        if (!this.nodes.has(sId)) {
          this.nodes.set(sId, {
            id: sId,
            labels: ['Skill'],
            properties: { id: sId, name: params.skillName, normalizedName: norm }
          });
        }
        this.edges.set(`rel_ev_${evId}_skill_${sId}`, {
          id: `rel_ev_${evId}_skill_${sId}`,
          type: 'SUPPORTS',
          sourceId: evId,
          targetId: sId,
          properties: {}
        });
      }
      return { data: [{ ev: evNode } as unknown as T] };
    }

    // 8. Memory nodes (Episodic, Semantic, Procedural)
    if (clean.includes('CREATE (m:Memory') || clean.includes('MERGE (m:Memory')) {
      const memId = params.id || `mem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const memNode: GraphNode = {
        id: memId,
        labels: ['Memory'],
        properties: {
          id: memId,
          tenantId: params.tenantId,
          category: params.category || 'SEMANTIC', // EPISODIC, SEMANTIC, PROCEDURAL
          text: params.text || '',
          context: params.context || '',
          verified: params.verified !== undefined ? params.verified : true,
          createdAt: new Date().toISOString(),
        }
      };
      this.nodes.set(memId, memNode);

      const candId = `cand_${params.tenantId}`;
      this.edges.set(`rel_cand_${candId}_mem_${memId}`, {
        id: `rel_cand_${candId}_mem_${memId}`,
        type: 'HAS_MEMORY',
        sourceId: candId,
        targetId: memId,
        properties: {}
      });

      return { data: [{ m: memNode } as unknown as T] };
    }

    // 9. Answer nodes
    if (clean.includes('CREATE (a:Answer') || clean.includes('MERGE (a:Answer')) {
      const ansId = params.id || `ans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const ansNode: GraphNode = {
        id: ansId,
        labels: ['Answer'],
        properties: {
          id: ansId,
          tenantId: params.tenantId,
          questionKey: params.questionKey || '',
          questionText: params.questionText || '',
          answerText: params.answerText || '',
          provenance: params.provenance || 'USER_VERIFIED',
          verified: true,
          updatedAt: new Date().toISOString(),
        }
      };
      this.nodes.set(ansId, ansNode);

      const candId = `cand_${params.tenantId}`;
      this.edges.set(`rel_cand_${candId}_ans_${ansId}`, {
        id: `rel_cand_${candId}_ans_${ansId}`,
        type: 'HAS_ANSWER',
        sourceId: candId,
        targetId: ansId,
        properties: {}
      });

      return { data: [{ a: ansNode } as unknown as T] };
    }

    // 10. Multi-hop Reasoning Query: MATCH Job -> Requirement -> Skill <- Demonstrates / Supports
    if (clean.includes('[:HAS_REQUIREMENT]') && clean.includes('[:REQUIRES_SKILL]')) {
      const tenantId = params.tenantId;
      const jobId = params.jobId;

      // Find Job node
      const jobNode = this.nodes.get(jobId);
      if (!jobNode || (jobNode.properties.tenantId && jobNode.properties.tenantId !== tenantId)) {
        return { data: [] };
      }

      // Requirements for this Job
      const reqEdges = Array.from(this.edges.values()).filter(
        e => e.type === 'HAS_REQUIREMENT' && e.sourceId === jobId
      );

      const results: any[] = [];

      for (const reqEdge of reqEdges) {
        const reqNode = this.nodes.get(reqEdge.targetId);
        if (!reqNode) continue;

        // Skill for this Requirement
        const skillEdge = Array.from(this.edges.values()).find(
          e => e.type === 'REQUIRES_SKILL' && e.sourceId === reqNode.id
        );
        if (!skillEdge) continue;

        const skillNode = this.nodes.get(skillEdge.targetId);
        if (!skillNode) continue;

        // Check if candidate has evidence/project/answer for this skill with matching tenantId
        // 1) Project DEMONSTRATES Skill
        const projEdges = Array.from(this.edges.values()).filter(
          e => e.type === 'DEMONSTRATES' && e.targetId === skillNode.id
        );
        let evidenceFound: any = null;

        for (const pEdge of projEdges) {
          const proj = this.nodes.get(pEdge.sourceId);
          if (proj && proj.properties.tenantId === tenantId) {
            evidenceFound = {
              type: 'PROJECT',
              id: proj.id,
              name: proj.properties.title || 'Project',
              provenance: proj.properties.summary || 'Project Experience'
            };
            break;
          }
        }

        // 2) Evidence SUPPORTS Skill
        if (!evidenceFound) {
          const evEdges = Array.from(this.edges.values()).filter(
            e => e.type === 'SUPPORTS' && e.targetId === skillNode.id
          );
          for (const evEdge of evEdges) {
            const ev = this.nodes.get(evEdge.sourceId);
            if (ev && ev.properties.tenantId === tenantId) {
              evidenceFound = {
                type: 'EVIDENCE',
                id: ev.id,
                name: skillNode.properties.name,
                provenance: ev.properties.text || 'Verified Resume Fact'
              };
              break;
            }
          }
        }

        results.push({
          job: jobNode.properties,
          requirement: reqNode.properties,
          skill: skillNode.properties,
          evidence: evidenceFound,
          matched: !!evidenceFound
        });
      }

      return { data: results as unknown as T[] };
    }

    // 11. Generic Match for Candidate Memories
    if (clean.includes('[:HAS_MEMORY]') || clean.includes('(m:Memory)')) {
      const tenantId = params.tenantId;
      const category = params.category;
      const mems = Array.from(this.nodes.values()).filter(
        n => n.labels.includes('Memory') && n.properties.tenantId === tenantId && (!category || n.properties.category === category)
      );
      return { data: mems.map(m => ({ m: m.properties })) as unknown as T[] };
    }

    // 12. Generic Match for Candidate Answers
    if (clean.includes('[:HAS_ANSWER]') || clean.includes('(a:Answer)')) {
      const tenantId = params.tenantId;
      const answers = Array.from(this.nodes.values()).filter(
        n => n.labels.includes('Answer') && n.properties.tenantId === tenantId
      );
      return { data: answers.map(a => ({ a: a.properties })) as unknown as T[] };
    }

    // 13. Generic Match Candidate Profile
    if (clean.includes('(c:Candidate)')) {
      const tenantId = params.tenantId;
      const cand = Array.from(this.nodes.values()).find(
        n => n.labels.includes('Candidate') && n.properties.tenantId === tenantId
      );
      return { data: cand ? [{ c: cand.properties } as unknown as T] : [] };
    }

    // 14. Generic Match Jobs
    if (clean.includes('(j:Job)')) {
      const tenantId = params.tenantId;
      const jobs = Array.from(this.nodes.values()).filter(
        n => n.labels.includes('Job') && (!tenantId || n.properties.tenantId === tenantId)
      );
      return { data: jobs.map(j => ({ j: j.properties })) as unknown as T[] };
    }

    // Default return empty data
    return { data: [] };
  }
}
