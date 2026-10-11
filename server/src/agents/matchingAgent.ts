import { FalkorGraphService } from '../db/falkor/queries.js';

export class MatchingAgent {
  /**
   * Traverses FalkorDB multi-hop relationships to score and explain job suitability.
   */
  static async evaluateMatch(tenantId: string, jobId: string) {
    const evaluation = await FalkorGraphService.evaluateJobMatch(tenantId, jobId);

    const explanation = evaluation.matchedItems.length > 0
      ? `Matched ${evaluation.matchedCount} of ${evaluation.totalRequirements} requirements based on verified graph projects and skills (${evaluation.matchedItems.map(m => m.skillName).join(', ')}).`
      : 'Insufficient verified evidence found in candidate knowledge graph for job requirements.';

    return {
      ...evaluation,
      explanation,
    };
  }
}
