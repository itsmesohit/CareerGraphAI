import { FalkorGraphService } from '../db/falkor/queries.js';

export class MemoryAgent {
  /**
   * Retrieves relevant career context and memories from FalkorDB.
   */
  static async getContext(tenantId: string) {
    const memories = await FalkorGraphService.getMemories(tenantId);
    const answers = await FalkorGraphService.getAnswers(tenantId);
    return { memories, answers };
  }

  /**
   * Stores verified fact or user correction into Semantic & Episodic memory.
   */
  static async recordCorrection(tenantId: string, params: {
    questionKey: string;
    questionText: string;
    correctionText: string;
    context: string;
  }) {
    // 1. Update Answer node
    await FalkorGraphService.recordAnswer(tenantId, {
      questionKey: params.questionKey,
      questionText: params.questionText,
      answerText: params.correctionText,
      provenance: 'USER_CORRECTION',
    });

    // 2. Record in Episodic Memory
    await FalkorGraphService.recordMemory(tenantId, {
      category: 'EPISODIC',
      text: `User corrected answer for "${params.questionText}": "${params.correctionText}"`,
      context: params.context,
      verified: true,
    });

    // 3. Record in Procedural Memory for future applications
    await FalkorGraphService.recordMemory(tenantId, {
      category: 'PROCEDURAL',
      text: `Reusable rule: Always respond with "${params.correctionText}" for questions matching key "${params.questionKey}"`,
      context: 'Application Rule Formulation',
      verified: true,
    });
  }
}
