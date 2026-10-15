import { falkor } from './falkorClient.js';
import { GraphNode, GraphEdge, MemoryType, MatchEvidencePath, GraphStats } from './types.js';

export const graphOps = {
  /**
   * Project or update a Candidate root node in the graph
   */
  async projectCandidate(data: {
    id: string;
    name: string;
    email: string;
    headline?: string | null;
    completenessScore?: number;
    tenantId?: string;
  }) {
    const cypher = `
      MERGE (c:Candidate { id: $id })
      ON CREATE SET
        c.name = $name,
        c.email = $email,
        c.headline = $headline,
        c.completenessScore = $completenessScore,
        c.tenantId = $tenantId,
        c.updatedAt = datetime()
      ON MATCH SET
        c.name = $name,
        c.email = $email,
        c.headline = $headline,
        c.completenessScore = $completenessScore,
        c.updatedAt = datetime()
      RETURN c
    `;

    return falkor.query(cypher, {
      id: data.id,
      name: data.name,
      email: data.email,
      headline: data.headline || '',
      completenessScore: data.completenessScore || 0,
      tenantId: data.tenantId || data.id,
    });
  },

  /**
   * Project an Experience node and link to Candidate and Demonstrated Skills
   */
  async projectExperience(data: {
    id: string;
    candidateId: string;
    company: string;
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string | null;
    metrics?: string[];
    technologies?: string[];
    verificationStatus?: string;
    tenantId?: string;
  }) {
    const cypher = `
      MERGE (e:Experience { id: $id })
      ON CREATE SET
        e.company = $company,
        e.title = $title,
        e.startDate = $startDate,
        e.endDate = $endDate,
        e.isCurrent = $isCurrent,
        e.description = $description,
        e.metrics = $metrics,
        e.technologies = $technologies,
        e.verificationStatus = $verificationStatus,
        e.candidateId = $candidateId,
        e.tenantId = $tenantId
      ON MATCH SET
        e.company = $company,
        e.title = $title,
        e.startDate = $startDate,
        e.endDate = $endDate,
        e.isCurrent = $isCurrent,
        e.description = $description,
        e.metrics = $metrics,
        e.technologies = $technologies,
        e.verificationStatus = $verificationStatus
      RETURN e
    `;

    return falkor.query(cypher, {
      ...data,
      metrics: data.metrics || [],
      technologies: data.technologies || [],
      tenantId: data.tenantId || data.candidateId,
    });
  },

  /**
   * Project a Skill node and connect to Candidate with proficiency
   */
  async projectSkill(data: {
    id?: string;
    candidateId?: string;
    name: string;
    category?: string | null;
    proficiency?: string | null;
    yearsExperience?: number | null;
    verificationStatus?: string;
    tenantId?: string;
  }) {
    const skillId =
      data.id || `skill_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const cypher = `
      MERGE (s:Skill { id: $id })
      ON CREATE SET
        s.name = $name,
        s.category = $category
      RETURN s
    `;

    return falkor.query(cypher, {
      id: skillId,
      name: data.name,
      category: data.category || 'General',
      candidateId: data.candidateId,
      proficiency: data.proficiency || 'Proficient',
      yearsExperience: data.yearsExperience || 1,
      verificationStatus: data.verificationStatus || 'UNVERIFIED',
      tenantId: data.tenantId || data.candidateId || 'GLOBAL',
    });
  },

  /**
   * Project a Project node and connect to Candidate and Skills
   */
  async projectProject(data: {
    id: string;
    candidateId: string;
    name: string;
    role?: string | null;
    description?: string | null;
    techStack?: string[];
    url?: string | null;
    verificationStatus?: string;
    tenantId?: string;
  }) {
    const cypher = `
      MERGE (p:Project { id: $id })
      ON CREATE SET
        p.name = $name,
        p.role = $role,
        p.description = $description,
        p.techStack = $techStack,
        p.url = $url,
        p.verificationStatus = $verificationStatus,
        p.candidateId = $candidateId,
        p.tenantId = $tenantId
      RETURN p
    `;

    return falkor.query(cypher, {
      ...data,
      techStack: data.techStack || [],
      tenantId: data.tenantId || data.candidateId,
    });
  },

  /**
   * Project an Education node and connect to Candidate
   */
  async projectEducation(data: {
    id: string;
    candidateId: string;
    institution: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    verificationStatus?: string;
    tenantId?: string;
  }) {
    const cypher = `
      MERGE (ed:Education { id: $id })
      ON CREATE SET
        ed.institution = $institution,
        ed.degree = $degree,
        ed.fieldOfStudy = $fieldOfStudy,
        ed.startDate = $startDate,
        ed.endDate = $endDate,
        ed.verificationStatus = $verificationStatus,
        ed.candidateId = $candidateId,
        ed.tenantId = $tenantId
      ON MATCH SET
        ed.institution = $institution,
        ed.degree = $degree,
        ed.fieldOfStudy = $fieldOfStudy,
        ed.startDate = $startDate,
        ed.endDate = $endDate,
        ed.verificationStatus = $verificationStatus
      RETURN ed
    `;

    return falkor.query(cypher, {
      ...data,
      degree: data.degree || '',
      fieldOfStudy: data.fieldOfStudy || '',
      verificationStatus: data.verificationStatus || 'UNVERIFIED',
      tenantId: data.tenantId || data.candidateId,
    });
  },

  /**
   * Project a Certification node and connect to Candidate
   */
  async projectCertification(data: {
    id: string;
    candidateId: string;
    name: string;
    issuer?: string | null;
    issueDate?: string | null;
    verificationStatus?: string;
    tenantId?: string;
  }) {
    const cypher = `
      MERGE (cert:Certification { id: $id })
      ON CREATE SET
        cert.name = $name,
        cert.issuer = $issuer,
        cert.issueDate = $issueDate,
        cert.verificationStatus = $verificationStatus,
        cert.candidateId = $candidateId,
        cert.tenantId = $tenantId
      ON MATCH SET
        cert.name = $name,
        cert.issuer = $issuer,
        cert.issueDate = $issueDate,
        cert.verificationStatus = $verificationStatus
      RETURN cert
    `;

    return falkor.query(cypher, {
      ...data,
      issuer: data.issuer || '',
      verificationStatus: data.verificationStatus || 'UNVERIFIED',
      tenantId: data.tenantId || data.candidateId,
    });
  },

  /**
   * Project a Job node with requirements and skills
   */
  async projectJob(data: {
    id: string;
    company: string;
    title: string;
    location?: string;
    url?: string;
    salary?: string;
    requirements?: Array<{ description: string; skill?: string; isHardConstraint?: boolean; weight?: number }>;
  }) {
    const cypher = `
      MERGE (j:Job { id: $id })
      ON CREATE SET
        j.company = $company,
        j.title = $title,
        j.location = $location,
        j.url = $url,
        j.salary = $salary
      RETURN j
    `;

    return falkor.query(cypher, data);
  },

  /**
   * Delete a node and its relationships
   */
  async deleteNode(id: string) {
    const cypher = `
      MATCH (n { id: $id })
      DETACH DELETE n
    `;
    return falkor.query(cypher, { id });
  },

  /**
   * Update verification status of a node
   */
  async updateNodeVerification(id: string, verificationStatus: string) {
    const cypher = `
      MATCH (n { id: $id })
      SET n.verificationStatus = $verificationStatus
      RETURN n
    `;
    return falkor.query(cypher, { id, verificationStatus });
  },

  /**
   * Record a Triple-Tier Memory node (Episodic, Semantic, Procedural)
   */
  async recordMemory(data: {
    id?: string;
    candidateId: string;
    memoryType: MemoryType;
    title: string;
    content: string;
    source?: string;
    verificationStatus?: string;
    expiresAt?: string | null;
    tenantId?: string;
  }) {
    const memoryId =
      data.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const cypher = `
      MERGE (m:Memory { id: $id })
      ON CREATE SET
        m.candidateId = $candidateId,
        m.memoryType = $memoryType,
        m.title = $title,
        m.content = $content,
        m.source = $source,
        m.verificationStatus = $verificationStatus,
        m.tenantId = $tenantId,
        m.createdAt = datetime()
      RETURN m
    `;

    return falkor.query(cypher, {
      id: memoryId,
      candidateId: data.candidateId,
      memoryType: data.memoryType,
      title: data.title,
      content: data.content,
      source: data.source || 'AGENT',
      verificationStatus: data.verificationStatus || 'USER_VERIFIED',
      expiresAt: data.expiresAt || null,
      tenantId: data.tenantId || data.candidateId,
    });
  },

  /**
   * Helper to record an Episodic memory event
   */
  async recordEpisodicMemory(
    candidateId: string,
    data: { text: string; context?: string; category?: string; verified?: boolean }
  ) {
    return this.recordMemory({
      candidateId,
      memoryType: 'EPISODIC',
      title: data.context || 'Episodic Event',
      content: data.text,
      verificationStatus: data.verified ? 'USER_VERIFIED' : 'UNVERIFIED',
    });
  },

  /**
   * Helper to record a Semantic memory fact
   */
  async recordSemanticMemory(
    candidateId: string,
    data: { text: string; context?: string; category?: string; verified?: boolean }
  ) {
    return this.recordMemory({
      candidateId,
      memoryType: 'SEMANTIC',
      title: data.context || 'Semantic Fact',
      content: data.text,
      verificationStatus: data.verified ? 'USER_VERIFIED' : 'UNVERIFIED',
    });
  },

  /**
   * Helper to record a Procedural memory guideline
   */
  async recordProceduralMemory(
    candidateId: string,
    data: { text: string; context?: string; category?: string; verified?: boolean }
  ) {
    return this.recordMemory({
      candidateId,
      memoryType: 'PROCEDURAL',
      title: data.context || 'Procedural Guideline',
      content: data.text,
      verificationStatus: data.verified ? 'USER_VERIFIED' : 'UNVERIFIED',
    });
  },

  /**
   * Retrieve all Graph Nodes & Edges belonging to a Candidate's career workspace
   */
  async getCandidateGraph(candidateId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const cypher = `
      MATCH (c:Candidate { id: $candidateId })
      RETURN c
    `;
    const res = await falkor.query(cypher, { candidateId });
    if (res.data.length > 0 && res.data[0].nodes) {
      return res.data[0] as { nodes: GraphNode[]; edges: GraphEdge[] };
    }
    return { nodes: [], edges: [] };
  },

  /**
   * Retrieve Triple-Tier Memories for a Candidate (optionally filtered by memoryType)
   */
  async getCandidateMemories(
    candidateId: string,
    memoryType?: MemoryType
  ): Promise<GraphNode[]> {
    const cypher = `
      MATCH (c:Candidate { id: $candidateId })-[:HAS_MEMORY]->(m:Memory)
      RETURN m
    `;
    const res = await falkor.query(cypher, { candidateId, memoryType });
    return (res.data || []).map((row: any) => row.m || row) as GraphNode[];
  },

  /**
   * Multi-hop query: match evidence path traversal
   */
  async getMatchEvidencePaths(candidateId: string, jobId: string): Promise<MatchEvidencePath[]> {
    const cypher = `
      MATCH (c:Candidate { id: $candidateId })-[*]->(p)-[:DEMONSTRATES]->(s:Skill)<-[:REQUIRES_SKILL]-(r:Requirement)<-[:REQUIRES]-(j:Job { id: $jobId })
      RETURN c, p, s, r, j
    `;
    const res = await falkor.query(cypher, { candidateId, jobId });
    return res.data as MatchEvidencePath[];
  },

  /**
   * Clear all graph data for a candidate (used for complete rebuilds)
   */
  async clearCandidateSubgraph(candidateId: string) {
    const cypher = `
      MATCH (n { tenantId: $tenantId })
      DETACH DELETE n
    `;
    return falkor.query(cypher, { tenantId: candidateId });
  },

  /**
   * Rebuild the entire graph for a candidate from their PostgreSQL entities
   */
  async rebuildCandidateGraph(candidateId: string, prisma: any) {
    // 1. Clear existing subgraph
    await this.clearCandidateSubgraph(candidateId);

    // 2. Fetch full candidate profile from PostgreSQL
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: candidateId },
      include: {
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        certifications: true,
        preferences: true,
      },
    });

    if (!profile) return { nodesProjected: 0 };

    const user = await prisma.user.findUnique({ where: { id: candidateId } });

    // 3. Project Candidate Node
    await this.projectCandidate({
      id: candidateId,
      name: profile.fullName || user?.name || 'Candidate',
      email: user?.email || '',
      headline: profile.headline,
      completenessScore: profile.completenessScore,
      tenantId: candidateId,
    });

    let count = 1;

    // 4. Project Experiences
    for (const exp of profile.experiences) {
      await this.projectExperience({
        id: exp.id,
        candidateId,
        company: exp.company,
        title: exp.title,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrent: exp.isCurrent,
        description: exp.description,
        metrics: exp.metrics,
        technologies: exp.technologies,
        verificationStatus: exp.verificationStatus,
        tenantId: candidateId,
      });
      count++;
    }

    // 5. Project Skills
    for (const skill of profile.skills) {
      await this.projectSkill({
        id: skill.id,
        candidateId,
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency,
        yearsExperience: skill.yearsExperience,
        verificationStatus: skill.verificationStatus,
        tenantId: candidateId,
      });
      count++;
    }

    // 6. Project Projects
    for (const proj of profile.projects) {
      await this.projectProject({
        id: proj.id,
        candidateId,
        name: proj.name,
        role: proj.role,
        description: proj.description,
        techStack: proj.techStack,
        url: proj.url,
        verificationStatus: proj.verificationStatus,
        tenantId: candidateId,
      });
      count++;
    }

    // 6b. Project Educations
    for (const edu of profile.educations) {
      await this.projectEducation({
        id: edu.id,
        candidateId,
        institution: edu.institution,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: edu.startDate,
        endDate: edu.endDate,
        verificationStatus: edu.verificationStatus,
        tenantId: candidateId,
      });
      count++;
    }

    // 6c. Project Certifications
    for (const cert of profile.certifications) {
      await this.projectCertification({
        id: cert.id,
        candidateId,
        name: cert.name,
        issuer: cert.issuer,
        issueDate: cert.issueDate,
        verificationStatus: cert.verificationStatus,
        tenantId: candidateId,
      });
      count++;
    }

    // 7. Seed baseline Semantic & Procedural memories
    if (profile.preferences) {
      await this.recordMemory({
        candidateId,
        memoryType: 'PROCEDURAL',
        title: 'Automation Preference Rules',
        content: `Mode: ${profile.preferences.automationMode}, Remote: ${profile.preferences.remotePreference}, Target Titles: ${profile.preferences.targetTitles.join(', ')}`,
        source: 'USER_VERIFIED',
        tenantId: candidateId,
      });
      count++;
    }

    return { nodesProjected: count };
  },

  /**
   * Return overall graph statistics
   */
  async getStats(): Promise<GraphStats> {
    return falkor.getStats();
  },
};
