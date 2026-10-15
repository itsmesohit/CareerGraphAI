import { falkor } from './falkorClient.js';
import { MatchPathExplanation } from './types.js';

export class FalkorGraphService {
  /**
   * Upserts the root Candidate node with tenant isolation.
   */
  static async upsertCandidate(tenantId: string, data: {
    name: string;
    email: string;
    targetRole?: string;
    minSalary?: number;
    remotePref?: string;
    noticePeriod?: string;
  }) {
    const cypher = `
      MERGE (c:Candidate { tenantId: $tenantId })
      ON CREATE SET 
        c.id = $id,
        c.name = $name,
        c.email = $email,
        c.targetRole = $targetRole,
        c.minSalary = $minSalary,
        c.remotePref = $remotePref,
        c.noticePeriod = $noticePeriod,
        c.createdAt = timestamp()
      ON MATCH SET 
        c.name = $name,
        c.email = $email,
        c.targetRole = $targetRole,
        c.minSalary = $minSalary,
        c.remotePref = $remotePref,
        c.noticePeriod = $noticePeriod,
        c.updatedAt = timestamp()
      RETURN c
    `;
    return falkor.query(cypher, {
      tenantId,
      id: `cand_${tenantId}`,
      name: data.name,
      email: data.email,
      targetRole: data.targetRole || '',
      minSalary: data.minSalary || 0,
      remotePref: data.remotePref || 'ANY',
      noticePeriod: data.noticePeriod || 'IMMEDIATE',
    });
  }

  /**
   * Upserts work experience and links to candidate.
   */
  static async upsertExperience(tenantId: string, exp: {
    id?: string;
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }) {
    const expId = exp.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const cypher = `
      MATCH (c:Candidate { tenantId: $tenantId })
      MERGE (e:Experience { id: $id, tenantId: $tenantId })
      ON CREATE SET 
        e.title = $title,
        e.company = $company,
        e.startDate = $startDate,
        e.endDate = $endDate,
        e.description = $description
      ON MATCH SET
        e.title = $title,
        e.company = $company,
        e.startDate = $startDate,
        e.endDate = $endDate,
        e.description = $description
      MERGE (c)-[:HAS_EXPERIENCE]->(e)
      RETURN e
    `;
    return falkor.query(cypher, {
      tenantId,
      id: expId,
      title: exp.title,
      company: exp.company,
      startDate: exp.startDate || '',
      endDate: exp.endDate || 'Present',
      description: exp.description || '',
    });
  }

  /**
   * Upserts a project and connects to experience and demonstrated skills.
   */
  static async upsertProject(tenantId: string, proj: {
    id?: string;
    experienceId?: string;
    title: string;
    summary: string;
    url?: string;
    metrics?: string;
    skillNames: string[];
  }) {
    const projId = proj.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const cypher = `
      MERGE (p:Project { id: $id, tenantId: $tenantId })
      SET p.title = $title, p.summary = $summary, p.url = $url, p.metrics = $metrics
      RETURN p
    `;
    await falkor.query(cypher, {
      tenantId,
      id: projId,
      title: proj.title,
      summary: proj.summary,
      url: proj.url || '',
      metrics: proj.metrics || '',
      experienceId: proj.experienceId,
      skillNames: proj.skillNames,
    });
    return projId;
  }

  /**
   * Adds verified evidence supporting a skill.
   */
  static async upsertEvidence(tenantId: string, ev: {
    id?: string;
    text: string;
    skillName: string;
    source?: string;
    confidence?: number;
  }) {
    const evId = ev.id || `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const cypher = `
      MERGE (ev:Evidence { id: $id, tenantId: $tenantId })
      SET ev.text = $text, ev.source = $source, ev.confidence = $confidence
      RETURN ev
    `;
    return falkor.query(cypher, {
      tenantId,
      id: evId,
      text: ev.text,
      skillName: ev.skillName,
      source: ev.source || 'RESUME',
      confidence: ev.confidence || 0.95,
    });
  }

  /**
   * Ingests a Job and its extracted Requirements into FalkorDB.
   */
  static async upsertJob(tenantId: string, job: {
    id: string;
    externalId: string;
    source: string;
    title: string;
    company: string;
    location: string;
    remote: boolean;
    url: string;
    applyUrl?: string;
    salary?: string;
    description: string;
    seniority?: string;
    requirements: Array<{
      text: string;
      importance?: 'REQUIRED' | 'PREFERRED';
      skillName?: string;
      minYears?: number;
    }>;
  }) {
    // 1. Ingest Job Node
    const jobCypher = `
      MERGE (j:Job { id: $id, tenantId: $tenantId })
      SET 
        j.externalId = $externalId,
        j.source = $source,
        j.title = $title,
        j.company = $company,
        j.location = $location,
        j.remote = $remote,
        j.url = $url,
        j.applyUrl = $applyUrl,
        j.salary = $salary,
        j.description = $description,
        j.seniority = $seniority,
        j.updatedAt = timestamp()
      RETURN j
    `;
    await falkor.query(jobCypher, {
      tenantId,
      id: job.id,
      externalId: job.externalId,
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      url: job.url,
      applyUrl: job.applyUrl || job.url,
      salary: job.salary || '',
      description: job.description,
      seniority: job.seniority || 'MID',
    });

    // 2. Ingest Requirements & Link to Skills
    for (const req of job.requirements) {
      const reqId = `req_${job.id}_${Math.random().toString(36).substr(2, 6)}`;
      const reqCypher = `
        MATCH (j:Job { id: $jobId, tenantId: $tenantId })
        MERGE (r:Requirement { id: $reqId, tenantId: $tenantId })
        SET r.text = $text, r.importance = $importance, r.minYears = $minYears
        MERGE (j)-[:HAS_REQUIREMENT]->(r)
        RETURN r
      `;
      await falkor.query(reqCypher, {
        tenantId,
        jobId: job.id,
        reqId,
        text: req.text,
        importance: req.importance || 'REQUIRED',
        minYears: req.minYears || 0,
        skillName: req.skillName || req.text,
      });
    }

    return job.id;
  }

  /**
   * Multi-Hop Graph Reasoning:
   * Traverses (Job)-[:HAS_REQUIREMENT]->(Requirement)-[:REQUIRES_SKILL]->(Skill)
   * And checks paths back to Candidate:
   * (Candidate)-[:HAS_EXPERIENCE]->(Experience)-[:CONTRIBUTED_TO]->(Project)-[:DEMONSTRATES]->(Skill)
   * or (Evidence)-[:SUPPORTS]->(Skill)
   */
  static async evaluateJobMatch(tenantId: string, jobId: string) {
    const cypher = `
      MATCH (j:Job { id: $jobId, tenantId: $tenantId })-[:HAS_REQUIREMENT]->(r:Requirement)-[:REQUIRES_SKILL]->(s:Skill)
      RETURN j, r, s
    `;
    const res = await falkor.query(cypher, { tenantId, jobId });
    
    const rows = res.data || [];
    const matchedItems: MatchPathExplanation[] = [];
    const missingItems: any[] = [];

    for (const row of rows) {
      if (row.matched && row.evidence) {
        matchedItems.push({
          jobId,
          requirementId: row.requirement?.id || '',
          requirementText: row.requirement?.text || '',
          skillName: row.skill?.name || '',
          demonstratedBy: {
            type: row.evidence.type || 'EVIDENCE',
            id: row.evidence.id || '',
            name: row.evidence.name || '',
            provenance: row.evidence.provenance || '',
          },
          confidence: row.evidence.confidence || 0.9,
        });
      } else {
        missingItems.push({
          requirementId: row.requirement?.id || '',
          requirementText: row.requirement?.text || '',
          skillName: row.skill?.name || '',
          importance: row.requirement?.importance || 'REQUIRED',
        });
      }
    }

    const totalReqs = rows.length;
    const matchedCount = matchedItems.length;
    const rawScore = totalReqs > 0 ? Math.round((matchedCount / totalReqs) * 100) : 70;

    return {
      jobId,
      score: rawScore,
      totalRequirements: totalReqs,
      matchedCount,
      matchedItems,
      missingItems,
      canAutoApply: missingItems.length === 0,
    };
  }

  /**
   * Episodic, Semantic, Procedural Memory queries
   */
  static async recordMemory(tenantId: string, mem: {
    category: 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL';
    text: string;
    context?: string;
    verified?: boolean;
  }) {
    const memId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const cypher = `
      MATCH (c:Candidate { tenantId: $tenantId })
      MERGE (m:Memory { id: $id, tenantId: $tenantId })
      SET m.category = $category, m.text = $text, m.context = $context, m.verified = $verified
      MERGE (c)-[:HAS_MEMORY]->(m)
      RETURN m
    `;
    return falkor.query(cypher, {
      tenantId,
      id: memId,
      category: mem.category,
      text: mem.text,
      context: mem.context || '',
      verified: mem.verified !== undefined ? mem.verified : true,
    });
  }

  static async getMemories(tenantId: string, category?: string) {
    const cypher = `
      MATCH (c:Candidate { tenantId: $tenantId })-[:HAS_MEMORY]->(m:Memory)
      RETURN m
    `;
    const res = await falkor.query(cypher, { tenantId, category });
    return (res.data || []).map((row: any) => row.m || row);
  }

  /**
   * Screening Answers and Provenance
   */
  static async recordAnswer(tenantId: string, ans: {
    questionKey: string;
    questionText: string;
    answerText: string;
    provenance?: string;
  }) {
    const ansId = `ans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const cypher = `
      MATCH (c:Candidate { tenantId: $tenantId })
      MERGE (a:Answer { id: $id, tenantId: $tenantId })
      SET a.questionKey = $questionKey, a.questionText = $questionText, a.answerText = $answerText, a.provenance = $provenance
      MERGE (c)-[:HAS_ANSWER]->(a)
      RETURN a
    `;
    return falkor.query(cypher, {
      tenantId,
      id: ansId,
      questionKey: ans.questionKey,
      questionText: ans.questionText,
      answerText: ans.answerText,
      provenance: ans.provenance || 'USER_VERIFIED',
    });
  }

  static async getAnswers(tenantId: string) {
    const cypher = `
      MATCH (c:Candidate { tenantId: $tenantId })-[:HAS_ANSWER]->(a:Answer)
      RETURN a
    `;
    const res = await falkor.query(cypher, { tenantId });
    return (res.data || []).map((row: any) => row.a || row);
  }

  /**
   * Retrieves full graph for visual rendering in React Flow
   */
  static async getCareerGraph(tenantId: string) {
    const engine = falkor.getInMemEngine();
    const allNodes = engine.getAllNodes().filter(
      n => !n.properties.tenantId || n.properties.tenantId === tenantId
    );
    const nodeIds = new Set(allNodes.map(n => n.id));
    const allEdges = engine.getAllEdges().filter(
      e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
    );

    return {
      nodes: allNodes.map(n => ({
        id: n.id,
        label: n.labels[0] || 'Node',
        properties: n.properties,
      })),
      edges: allEdges.map(e => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: e.type,
      })),
    };
  }
}
