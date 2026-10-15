import { falkor } from './falkorClient.js';

export async function initializeGraphSchema(): Promise<void> {
  console.log('[FalkorDB] Initializing graph schema & indices...');
  const indexStatements = [
    'CREATE INDEX FOR (c:Candidate) ON (c.tenantId)',
    'CREATE INDEX FOR (j:Job) ON (j.tenantId)',
    'CREATE INDEX FOR (s:Skill) ON (s.normalizedName)',
    'CREATE INDEX FOR (r:Requirement) ON (r.tenantId)',
    'CREATE INDEX FOR (e:Experience) ON (e.tenantId)',
    'CREATE INDEX FOR (p:Project) ON (p.tenantId)',
    'CREATE INDEX FOR (ev:Evidence) ON (ev.tenantId)',
    'CREATE INDEX FOR (m:Memory) ON (m.tenantId)',
    'CREATE INDEX FOR (a:Answer) ON (a.tenantId)',
  ];

  for (const stmt of indexStatements) {
    try {
      await falkor.query(stmt);
    } catch {
      // Index might already exist or handled by in-memory engine
    }
  }
  console.log('[FalkorDB] Schema initialization complete.');
}
