import { MemoryAgent } from './memoryAgent.js';
import { MatchingAgent } from './matchingAgent.js';
import { ApplicationAgent } from './applicationAgent.js';
import { OutreachAgent } from './outreachAgent.js';
import { JobDiscoveryEngine } from '../modules/jobs/jobService.js';
import { FalkorGraphService } from '../db/falkor/queries.js';

export interface AgentActivityEvent {
  id: string;
  agent: 'ORCHESTRATOR' | 'MEMORY' | 'MATCHING' | 'APPLICATION' | 'OUTREACH';
  action: string;
  details: string;
  cypherQuery?: string;
  timestamp: string;
}

export class OrchestratorAgent {
  private static activityTimeline: AgentActivityEvent[] = [];

  static logActivity(event: Omit<AgentActivityEvent, 'id' | 'timestamp'>) {
    const entry: AgentActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.activityTimeline.unshift(entry);
    if (this.activityTimeline.length > 100) {
      this.activityTimeline.pop();
    }
  }

  static getActivityTimeline(): AgentActivityEvent[] {
    return this.activityTimeline;
  }

  /**
   * Dispatches discovery and evaluates match rankings.
   */
  static async runDiscoveryWorkflow(tenantId: string, keywords?: string) {
    this.logActivity({
      agent: 'ORCHESTRATOR',
      action: 'WORKFLOW_DISPATCH',
      details: `Dispatched Job Discovery workflow for tenant ${tenantId} (keywords: ${keywords || 'software engineering'})`,
    });

    const engine = new JobDiscoveryEngine();
    const jobs = await engine.discoverJobs(tenantId, { keywords });

    this.logActivity({
      agent: 'MATCHING',
      action: 'EVALUATE_GRAPH_MATCH',
      details: `Traversing FalkorDB multi-hop relationships for ${jobs.length} discovered jobs`,
      cypherQuery: 'MATCH (j:Job)-[:HAS_REQUIREMENT]->(r)-[:REQUIRES_SKILL]->(s:Skill)<-[:DEMONSTRATES]-(p:Project) RETURN j, r, s',
    });

    const enriched = await Promise.all(jobs.map(async j => {
      const match = await MatchingAgent.evaluateMatch(tenantId, j.id);
      return {
        ...j,
        matchScore: match.score,
        matchedSkills: match.matchedItems.map(m => m.skillName),
        missingRequirements: match.missingItems.map(m => m.skillName),
        explanation: match.explanation,
      };
    }));

    enriched.sort((a, b) => b.matchScore - a.matchScore);
    return enriched;
  }
}
