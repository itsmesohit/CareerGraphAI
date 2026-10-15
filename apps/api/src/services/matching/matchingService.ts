import { prisma, graphOps } from '@careergraph/db';
import {
  MatchScoreResult,
  MatchBreakdown,
  MatchedSkillEvidence,
  MissingRequirement,
  SupportingExperience,
  SupportingProject,
  MatchRecommendation,
  MatchScoringWeights,
  DEFAULT_MATCH_WEIGHTS,
} from '@careergraph/shared';

export class MatchingService {
  /**
   * Evaluates a candidate against a job posting deterministically.
   * Enforces hard constraints in code and queries multi-hop graph evidence paths.
   */
  async evaluateMatch(
    candidateId: string,
    jobId: string,
    customWeights?: Partial<MatchScoringWeights>
  ): Promise<MatchScoreResult> {
    const weights: MatchScoringWeights = {
      ...DEFAULT_MATCH_WEIGHTS,
      ...(customWeights || {}),
    };

    // 1. Fetch Candidate Profile with all evidence entities
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: candidateId },
      include: {
        skills: true,
        experiences: true,
        projects: true,
        educations: true,
        certifications: true,
        preferences: true,
      },
    });

    if (!profile) {
      throw new Error(`Candidate profile not found for user ${candidateId}`);
    }

    // 2. Fetch Job Posting with requirements
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        requirements: true,
      },
    });

    if (!job) {
      throw new Error(`Job posting not found for ID ${jobId}`);
    }

    // 3. Multi-hop Graph Evidence Traversal
    // Candidate -> Experience/Project -> DEMONSTRATES -> Skill <- REQUIRES_SKILL <- Requirement <- Job
    let graphEvidencePaths: any[] = [];
    try {
      graphEvidencePaths = await graphOps.getMatchEvidencePaths(candidateId, jobId);
    } catch {
      graphEvidencePaths = [];
    }

    // 4. Hard Constraints Evaluation (Immediate Disqualification)
    const disqualifiers: string[] = [];
    let isEliminated = false;

    // A. Blocked Company Check
    if (profile.preferences?.blockedCompanies && profile.preferences.blockedCompanies.length > 0) {
      const isBlocked = profile.preferences.blockedCompanies.some(
        (b) => b.trim().toLowerCase() === job.company.trim().toLowerCase()
      );
      if (isBlocked) {
        isEliminated = true;
        disqualifiers.push(`Company "${job.company}" is in your blocked companies exclusion list.`);
      }
    }

    // B. Minimum Compensation Check
    if (
      profile.preferences?.minSalary &&
      profile.preferences.minSalary > 0 &&
      job.maxSalary &&
      job.maxSalary > 0
    ) {
      if (job.maxSalary < profile.preferences.minSalary) {
        isEliminated = true;
        disqualifiers.push(
          `Offered salary ceiling ($${job.maxSalary.toLocaleString()}) is below your minimum preference requirement ($${profile.preferences.minSalary.toLocaleString()}).`
        );
      }
    }

    // C. Work Authorization Hard Constraints Check
    const workAuthReq = job.requirements.find(
      (r) =>
        r.isHardConstraint &&
        (r.category === 'WORK_AUTH' ||
          r.description.toLowerCase().includes('citizenship') ||
          r.description.toLowerCase().includes('security clearance') ||
          r.description.toLowerCase().includes('no sponsorship') ||
          r.description.toLowerCase().includes('authorized to work'))
    );

    if (workAuthReq) {
      const requiresSponsorship = profile.preferences?.requiresSponsorship || false;
      const reqText = workAuthReq.description.toLowerCase();

      // Check if job mandates citizenship/clearance or no sponsorship and candidate requires sponsorship
      if (
        (reqText.includes('citizen') || reqText.includes('clearance') || reqText.includes('no sponsorship')) &&
        requiresSponsorship
      ) {
        isEliminated = true;
        disqualifiers.push(
          `Mandatory legal constraint: "${workAuthReq.description}" conflicts with candidate work authorization status (requires visa sponsorship).`
        );
      }
    }

    // D. Mandatory Educational Degree Check
    const degreeReq = job.requirements.find(
      (r) =>
        r.isHardConstraint &&
        (r.category === 'DEGREE' ||
          r.description.toLowerCase().includes('bachelor') ||
          r.description.toLowerCase().includes('master') ||
          r.description.toLowerCase().includes('phd') ||
          r.description.toLowerCase().includes('degree required'))
    );

    if (degreeReq) {
      const candidateHasDegree = profile.educations.length > 0;
      if (!candidateHasDegree) {
        isEliminated = true;
        disqualifiers.push(
          `Mandatory educational requirement: "${degreeReq.description}" requires an academic degree not currently present in verified profile.`
        );
      }
    }

    // 5. Factor Computations
    const {
      requiredSkillsScore,
      preferredSkillsScore,
      matchedSkills,
      missingRequirements,
      supportingExperiences,
      supportingProjects,
    } = this.evaluateSkills(profile, job, graphEvidencePaths);

    const seniorityScore = this.evaluateSeniority(profile, job);
    const titleScore = this.evaluateTitleSimilarity(profile, job);
    const locationScore = this.evaluateLocationFit(profile, job);
    const compensationScore = this.evaluateCompensation(profile, job);

    const breakdown: MatchBreakdown = {
      requiredSkillsScore,
      preferredSkillsScore,
      seniorityScore,
      titleScore,
      locationScore,
      compensationScore,
    };

    // Calculate overall composite score
    let overallScore = 0;
    if (!isEliminated) {
      const rawScore =
        requiredSkillsScore * weights.requiredSkillsWeight +
        preferredSkillsScore * weights.preferredSkillsWeight +
        seniorityScore * weights.seniorityWeight +
        titleScore * weights.titleWeight +
        locationScore * weights.locationWeight +
        compensationScore * weights.compensationWeight;

      overallScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    }

    // Map recommendation status
    let recommendation: MatchRecommendation = 'LOW_FIT';
    if (isEliminated) {
      recommendation = 'DISQUALIFIED';
    } else if (overallScore >= 80) {
      recommendation = 'STRONG_MATCH';
    } else if (overallScore >= 65) {
      recommendation = 'GOOD_MATCH';
    } else if (overallScore >= 50) {
      recommendation = 'MODERATE_MATCH';
    }

    // Grounded concise explanation
    const conciseExplanation = this.generateExplanation(
      overallScore,
      isEliminated,
      disqualifiers,
      matchedSkills,
      missingRequirements,
      seniorityScore,
      locationScore
    );

    // Recommended next action
    let recommendedAction = 'Review job description details.';
    if (isEliminated) {
      recommendedAction = 'Disqualified due to mandatory constraint filters. Avoid applying or seek alternative openings.';
    } else if (overallScore >= 80) {
      recommendedAction = 'High affinity match. Ready for immediate application preparation with tailored resume.';
    } else if (overallScore >= 65) {
      recommendedAction = 'Competitive match. Ensure application materials emphasize experience in relevant core technologies.';
    } else if (overallScore >= 50) {
      recommendedAction = 'Moderate match. Address identified missing requirements or verify supporting skills before submitting.';
    } else {
      recommendedAction = 'Significant skill or seniority gaps detected. Prioritize higher-scoring matches in your feed.';
    }

    return {
      jobId,
      candidateId,
      overallScore,
      isEliminated,
      disqualifiers,
      recommendation,
      breakdown,
      matchedSkills,
      missingRequirements,
      supportingExperiences,
      supportingProjects,
      conciseExplanation,
      recommendedAction,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Compares candidate skills against job requirements and extracted skills.
   */
  private evaluateSkills(profile: any, job: any, graphEvidence: any[]) {
    const candidateSkillsMap = new Map<string, any>();
    profile.skills.forEach((s: any) => {
      candidateSkillsMap.set(s.name.toLowerCase().trim(), s);
    });

    const matchedSkills: MatchedSkillEvidence[] = [];
    const missingRequirements: MissingRequirement[] = [];

    // Separate job requirements into required skills vs optional
    const skillRequirements = job.requirements.filter(
      (r: any) => r.skill || (r.category === 'TECHNICAL_SKILL' && r.description)
    );

    // Combine explicit requirement skills and top-level job.skills
    const targetSkillSet = new Set<string>();
    job.skills.forEach((s: string) => targetSkillSet.add(s));
    skillRequirements.forEach((r: any) => {
      if (r.skill) targetSkillSet.add(r.skill);
    });

    let totalRequiredWeight = 0;
    let matchedRequiredWeight = 0;

    let totalPreferredCount = 0;
    let matchedPreferredCount = 0;

    // Build evidence lookup from graph traversal
    const evidenceBySkill = new Map<string, any[]>();
    graphEvidence.forEach((ev: any) => {
      const sk = (ev.skillName || '').toLowerCase().trim();
      if (!evidenceBySkill.has(sk)) evidenceBySkill.set(sk, []);
      if (ev.demonstratedBy) {
        evidenceBySkill.get(sk)!.push(ev.demonstratedBy);
      }
    });

    targetSkillSet.forEach((skillName) => {
      const normalizedSkill = skillName.toLowerCase().trim();
      const candidateSkill = this.findMatchingSkill(normalizedSkill, candidateSkillsMap);

      const matchingReq = job.requirements.find(
        (r: any) => (r.skill || '').toLowerCase() === normalizedSkill
      );

      const isRequired = matchingReq ? matchingReq.weight >= 1.0 : true;
      const weight = matchingReq?.weight || 1.0;

      if (candidateSkill) {
        // Candidate has this skill
        const isVerified = candidateSkill.verificationStatus === 'USER_VERIFIED';
        const proficiencyMultiplier =
          candidateSkill.proficiency === 'EXPERT'
            ? 1.0
            : candidateSkill.proficiency === 'ADVANCED'
            ? 0.95
            : candidateSkill.proficiency === 'INTERMEDIATE'
            ? 0.85
            : 0.7;

        const verificationMultiplier = isVerified ? 1.0 : 0.85;
        const skillScoreRatio = proficiencyMultiplier * verificationMultiplier;

        if (isRequired) {
          totalRequiredWeight += weight;
          matchedRequiredWeight += weight * skillScoreRatio;
        } else {
          totalPreferredCount++;
          matchedPreferredCount += skillScoreRatio;
        }

        // Collect demonstrations from graph evidence or profile experiences
        const demonstrations = evidenceBySkill.get(normalizedSkill) || [];

        // If no graph paths yet, check experiences and projects matching the skill directly
        if (demonstrations.length === 0) {
          profile.experiences.forEach((exp: any) => {
            if (
              exp.technologies?.some((t: string) => t.toLowerCase() === normalizedSkill) ||
              exp.description.toLowerCase().includes(normalizedSkill)
            ) {
              demonstrations.push({
                type: 'EXPERIENCE',
                id: exp.id,
                title: `${exp.title} at ${exp.company}`,
                metrics: exp.metrics || [],
              });
            }
          });

          profile.projects.forEach((proj: any) => {
            if (
              proj.techStack?.some((t: string) => t.toLowerCase() === normalizedSkill) ||
              proj.description?.toLowerCase().includes(normalizedSkill)
            ) {
              demonstrations.push({
                type: 'PROJECT',
                id: proj.id,
                title: proj.name,
              });
            }
          });
        }

        matchedSkills.push({
          skill: candidateSkill.name,
          isRequired,
          weight,
          candidateProficiency: candidateSkill.proficiency,
          yearsExperience: candidateSkill.yearsExperience,
          isVerified,
          demonstrations: demonstrations.slice(0, 3),
        });
      } else {
        // Missing skill
        if (isRequired) {
          totalRequiredWeight += weight;
        } else {
          totalPreferredCount++;
        }

        missingRequirements.push({
          description: matchingReq?.description || `Required proficiency in ${skillName}`,
          skill: skillName,
          isHardConstraint: matchingReq?.isHardConstraint || false,
          weight,
          category: matchingReq?.category || 'TECHNICAL_SKILL',
        });
      }
    });

    const requiredSkillsScore =
      totalRequiredWeight > 0
        ? Math.round((matchedRequiredWeight / totalRequiredWeight) * 100)
        : 100;

    const preferredSkillsScore =
      totalPreferredCount > 0
        ? Math.round((matchedPreferredCount / totalPreferredCount) * 100)
        : 100;

    // Identify Supporting Experiences and Projects
    const supportingExperiences: SupportingExperience[] = profile.experiences
      .map((exp: any) => {
        const skillsUsed = matchedSkills
          .filter((ms) =>
            exp.technologies?.some(
              (t: string) => t.toLowerCase() === ms.skill.toLowerCase()
            )
          )
          .map((ms) => ms.skill);

        return {
          id: exp.id,
          title: exp.title,
          company: exp.company,
          matchedSkills: skillsUsed,
        };
      })
      .filter((exp: SupportingExperience) => exp.matchedSkills.length > 0)
      .slice(0, 4);

    const supportingProjects: SupportingProject[] = profile.projects
      .map((proj: any) => {
        const skillsUsed = matchedSkills
          .filter((ms) =>
            proj.techStack?.some(
              (t: string) => t.toLowerCase() === ms.skill.toLowerCase()
            )
          )
          .map((ms) => ms.skill);

        return {
          id: proj.id,
          name: proj.name,
          matchedSkills: skillsUsed,
        };
      })
      .filter((proj: SupportingProject) => proj.matchedSkills.length > 0)
      .slice(0, 4);

    return {
      requiredSkillsScore,
      preferredSkillsScore,
      matchedSkills,
      missingRequirements,
      supportingExperiences,
      supportingProjects,
    };
  }

  /**
   * Evaluates seniority and total years of verified experience.
   */
  private evaluateSeniority(profile: any, job: any): number {
    // 1. Calculate candidate's total years of experience
    let totalMonths = 0;
    profile.experiences.forEach((exp: any) => {
      const start = new Date(exp.startDate).getTime();
      const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        totalMonths += (end - start) / (1000 * 60 * 60 * 24 * 30.4375);
      }
    });
    const candidateYears = totalMonths / 12;

    const seniorityTarget = (job.seniority || 'MID').toUpperCase();

    // Mapping of expected year ranges per seniority
    const seniorityMap: Record<string, { min: number; max: number; level: number }> = {
      ENTRY: { min: 0, max: 2, level: 1 },
      MID: { min: 2, max: 5, level: 2 },
      SENIOR: { min: 5, max: 8, level: 3 },
      LEAD: { min: 8, max: 20, level: 4 },
    };

    const targetConfig = seniorityMap[seniorityTarget] || seniorityMap.MID;

    if (candidateYears >= targetConfig.min && candidateYears <= targetConfig.max) {
      return 100;
    }

    if (candidateYears < targetConfig.min) {
      // Under-experienced penalty
      const gap = targetConfig.min - candidateYears;
      return Math.max(25, Math.round(100 - gap * 20));
    }

    // Over-experienced (mild penalty for being overqualified)
    return 85;
  }

  /**
   * Evaluates title similarity between candidate preferences / history and job title.
   */
  private evaluateTitleSimilarity(profile: any, job: any): number {
    const jobTitleTokens = this.tokenize(job.title);
    const candidateTitles: string[] = [];

    if (profile.preferences?.targetTitles) {
      candidateTitles.push(...profile.preferences.targetTitles);
    }
    profile.experiences.forEach((exp: any) => {
      if (exp.title) candidateTitles.push(exp.title);
    });

    if (candidateTitles.length === 0) {
      return 75; // Default neutral if no targets specified
    }

    let maxSimilarity = 0;

    candidateTitles.forEach((candidateTitle) => {
      const candidateTokens = this.tokenize(candidateTitle);
      const similarity = this.jaccardSimilarity(jobTitleTokens, candidateTokens);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    });

    return Math.round(maxSimilarity * 100);
  }

  /**
   * Evaluates workplace and remote eligibility.
   */
  private evaluateLocationFit(profile: any, job: any): number {
    const candidateRemotePref = profile.preferences?.remotePreference || 'REMOTE';
    const jobRemoteType = job.remoteType || 'REMOTE';

    if (jobRemoteType === 'REMOTE') {
      if (candidateRemotePref === 'REMOTE' || candidateRemotePref === 'HYBRID') return 100;
      return 85;
    }

    if (jobRemoteType === 'HYBRID') {
      if (candidateRemotePref === 'HYBRID') return 100;
      if (candidateRemotePref === 'REMOTE') return 45;
      return 90;
    }

    // ONSITE
    if (candidateRemotePref === 'ONSITE') return 100;
    if (candidateRemotePref === 'HYBRID') return 70;
    return 25; // Remote preference vs onsite job
  }

  /**
   * Evaluates compensation alignment.
   */
  private evaluateCompensation(profile: any, job: any): number {
    const targetMin = profile.preferences?.minSalary;
    const targetMax = profile.preferences?.expectedSalary;

    if (!job.minSalary && !job.maxSalary) {
      return 80; // Neutral baseline when salary is undisclosed
    }

    if (!targetMin && !targetMax) {
      return 90; // Candidate has no salary boundaries
    }

    const jobMin = job.minSalary || job.maxSalary || 0;
    const jobMax = job.maxSalary || job.minSalary || 0;

    if (targetMin && jobMax < targetMin) {
      return 20; // Below minimum requirement
    }

    if (targetMin && jobMin >= targetMin) {
      return 100; // Entire job band meets or exceeds target
    }

    return 85;
  }

  /**
   * Generates a grounded, transparent explanation string without LLM hallucination.
   */
  private generateExplanation(
    overallScore: number,
    isEliminated: boolean,
    disqualifiers: string[],
    matchedSkills: MatchedSkillEvidence[],
    missingRequirements: MissingRequirement[],
    seniorityScore: number,
    locationScore: number
  ): string {
    if (isEliminated) {
      return `Listing disqualified by mandatory constraints: ${disqualifiers.join(' ')}`;
    }

    const verifiedSkills = matchedSkills.filter((s) => s.isVerified).map((s) => s.skill);
    const keyMatched = matchedSkills.slice(0, 3).map((s) => s.skill).join(', ');
    const missingKeys = missingRequirements.slice(0, 2).map((m) => m.skill || m.description).join(', ');

    let summary = `Calculated ${overallScore}% fit. `;

    if (matchedSkills.length > 0) {
      summary += `Candidate matches ${matchedSkills.length} key required technologies (${keyMatched}). `;
    }

    if (verifiedSkills.length > 0) {
      summary += `${verifiedSkills.length} skills backed by verified profile facts and work history. `;
    }

    if (seniorityScore >= 90) {
      summary += `Seniority level aligns with required scope. `;
    } else if (seniorityScore < 60) {
      summary += `Seniority or experience gap detected. `;
    }

    if (locationScore >= 90) {
      summary += `Workplace setup matches preferences. `;
    }

    if (missingRequirements.length > 0) {
      summary += `Identified missing skills: ${missingKeys}.`;
    }

    return summary.trim();
  }

  /**
   * Ranks all open jobs for a candidate feed based on deterministic scores.
   */
  async getTopMatches(
    candidateId: string,
    options: {
      limit?: number;
      excludeEliminated?: boolean;
      minScore?: number;
    } = {}
  ): Promise<MatchScoreResult[]> {
    const limit = options.limit || 12;

    // Fetch open jobs
    const jobs = await prisma.jobPosting.findMany({
      where: { status: 'OPEN' },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const evaluations: MatchScoreResult[] = [];

    for (const job of jobs) {
      try {
        const evalResult = await this.evaluateMatch(candidateId, job.id);
        if (options.excludeEliminated && evalResult.isEliminated) {
          continue;
        }
        if (options.minScore && evalResult.overallScore < options.minScore) {
          continue;
        }
        evaluations.push(evalResult);
      } catch {
        // Skip job gracefully if eval fails
      }
    }

    // Sort descending by score
    evaluations.sort((a, b) => b.overallScore - a.overallScore);

    return evaluations.slice(0, limit);
  }

  // --- Helper Utilities ---

  private findMatchingSkill(targetSkill: string, candidateMap: Map<string, any>): any | null {
    if (candidateMap.has(targetSkill)) {
      return candidateMap.get(targetSkill);
    }

    // Skill aliases & normalizations
    const aliases: Record<string, string[]> = {
      typescript: ['ts'],
      javascript: ['js'],
      react: ['react.js', 'reactjs'],
      node: ['node.js', 'nodejs'],
      postgresql: ['postgres'],
      golang: ['go'],
      docker: ['containers'],
      kubernetes: ['k8s'],
    };

    for (const [canonical, altList] of Object.entries(aliases)) {
      if (targetSkill === canonical || altList.includes(targetSkill)) {
        if (candidateMap.has(canonical)) return candidateMap.get(canonical);
        for (const alt of altList) {
          if (candidateMap.has(alt)) return candidateMap.get(alt);
        }
      }
    }

    return null;
  }

  private tokenize(text: string): Set<string> {
    const tokens = (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
    return new Set(tokens);
  }

  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    setA.forEach((token) => {
      if (setB.has(token)) intersection++;
    });
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

export const matchingService = new MatchingService();
