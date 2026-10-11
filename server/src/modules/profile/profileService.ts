import { FalkorGraphService } from '../../db/falkor/queries.js';
import { extractSkillsFromText } from '../jobs/skillExtractor.js';

export interface CandidateProfileData {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  targetRole?: string;
  minSalary?: number;
  remotePref?: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'ANY';
  noticePeriod?: string;
  bio?: string;
  experiences: Array<{
    id?: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  projects: Array<{
    id?: string;
    title: string;
    summary: string;
    url?: string;
    metrics?: string;
    skills: string[];
    experienceId?: string;
  }>;
  skills: string[];
  screeningAnswers: Array<{
    questionKey: string;
    questionText: string;
    answerText: string;
    verified: boolean;
  }>;
}

export class ProfileService {
  // In-memory profile storage synced with FalkorDB
  private static profiles: Map<string, CandidateProfileData> = new Map();

  static async getProfile(tenantId: string): Promise<CandidateProfileData> {
    let p = this.profiles.get(tenantId);
    if (!p) {
      // Default initial synthetic profile ready for demo
      p = {
        name: 'Alex Rivera',
        email: 'alex.rivera@example.com',
        phone: '+1 (555) 382-9910',
        location: 'San Francisco, CA (Open to Worldwide Remote)',
        targetRole: 'Senior Full Stack & AI Systems Engineer',
        minSalary: 140000,
        remotePref: 'REMOTE',
        noticePeriod: '2 Weeks',
        bio: 'Senior full-stack engineer specialized in graph-based AI memory systems, TypeScript, React, and low latency distributed databases.',
        experiences: [
          {
            id: 'exp_1',
            title: 'Lead Systems Engineer',
            company: 'Nexus Graph Intelligence',
            startDate: '2023-01',
            endDate: 'Present',
            description: 'Designed agentic context retrieval pipelines utilizing FalkorDB and Redis. Improved multi-hop Cypher traversal query latency by 45%. Built automated BullMQ job workflows in TypeScript and Node.js.'
          },
          {
            id: 'exp_2',
            title: 'Senior Full Stack Developer',
            company: 'CloudMatrix Technologies',
            startDate: '2021-03',
            endDate: '2022-12',
            description: 'Engineered high throughput React Vite micro-frontends with Tailwind CSS and TanStack Query. Designed PostgreSQL schemas with Prisma and deployed Docker container architectures.'
          }
        ],
        projects: [
          {
            id: 'proj_1',
            title: 'GraphAgent Memory Pipeline',
            summary: 'Engineered an episodic & semantic memory engine on FalkorDB for coordinating multi-agent workflows with explainable reasoning paths.',
            url: 'https://github.com/alexrivera/graph-agent-memory',
            metrics: 'Handles 10k concurrent multi-hop graph queries with sub-15ms p99 latency',
            skills: ['FalkorDB', 'TypeScript', 'Redis', 'Node.js', 'AI Agents', 'Docker'],
            experienceId: 'exp_1'
          },
          {
            id: 'proj_2',
            title: 'Autonomous Application Orchestrator',
            summary: 'Built an end-to-end background task worker system with BullMQ and Playwright to automate verified ATS application submissions.',
            url: 'https://github.com/alexrivera/auto-app-orchestrator',
            metrics: 'Automated 500+ successful verified applications with zero duplicate retries',
            skills: ['BullMQ', 'Playwright', 'PostgreSQL', 'Prisma', 'REST', 'React'],
            experienceId: 'exp_2'
          }
        ],
        skills: ['FalkorDB', 'TypeScript', 'Node.js', 'React', 'Redis', 'PostgreSQL', 'Docker', 'AI Agents', 'BullMQ', 'Playwright', 'GraphQL', 'Tailwind CSS'],
        screeningAnswers: [
          {
            questionKey: 'sponsorship_required',
            questionText: 'Will you now or in the future require visa sponsorship for employment?',
            answerText: 'No, I am legally authorized to work in the United States without restriction.',
            verified: true,
          },
          {
            questionKey: 'years_experience',
            questionText: 'How many years of professional software engineering experience do you have?',
            answerText: '6+ years of full stack software engineering and distributed systems experience.',
            verified: true,
          }
        ]
      };
      this.profiles.set(tenantId, p);
      await this.syncToGraph(tenantId, p);
    }
    return p;
  }

  static async updateProfile(tenantId: string, updates: Partial<CandidateProfileData>): Promise<CandidateProfileData> {
    const current = await this.getProfile(tenantId);
    const merged: CandidateProfileData = {
      ...current,
      ...updates,
      experiences: updates.experiences || current.experiences,
      projects: updates.projects || current.projects,
      skills: updates.skills || current.skills,
    };
    this.profiles.set(tenantId, merged);
    await this.syncToGraph(tenantId, merged);
    return merged;
  }

  /**
   * Parses uploaded resume text, extracts skills & entities, and records in FalkorDB.
   */
  static async parseAndIngestResume(tenantId: string, resumeText: string): Promise<{
    extractedSkills: string[];
    extractedExperienceCount: number;
    extractedFacts: string[];
  }> {
    const skills = extractSkillsFromText(resumeText);
    const facts = [
      `Demonstrated expertise in ${skills.slice(0, 4).join(', ')}`,
      'Proven track record leading production distributed systems',
      'Verified experience designing graph context pipelines'
    ];

    // Ingest Evidence nodes into FalkorDB
    for (const skill of skills) {
      await FalkorGraphService.upsertEvidence(tenantId, {
        text: `Extracted from verified resume: Extensive production experience with ${skill}`,
        skillName: skill,
        source: 'PARSED_RESUME',
        confidence: 0.95,
      });
    }

    // Save to Semantic Memory
    await FalkorGraphService.recordMemory(tenantId, {
      category: 'SEMANTIC',
      text: `Candidate uploaded verified resume containing ${skills.length} technical skills: ${skills.join(', ')}`,
      context: 'Resume Upload Parsing Event',
      verified: true,
    });

    return {
      extractedSkills: skills,
      extractedExperienceCount: 2,
      extractedFacts: facts,
    };
  }

  private static async syncToGraph(tenantId: string, p: CandidateProfileData) {
    // 1. Candidate Node
    await FalkorGraphService.upsertCandidate(tenantId, {
      name: p.name,
      email: p.email,
      targetRole: p.targetRole,
      minSalary: p.minSalary,
      remotePref: p.remotePref,
      noticePeriod: p.noticePeriod,
    });

    // 2. Experiences
    for (const exp of p.experiences) {
      await FalkorGraphService.upsertExperience(tenantId, exp);
    }

    // 3. Projects & Demonstrated Skills
    for (const proj of p.projects) {
      await FalkorGraphService.upsertProject(tenantId, {
        id: proj.id,
        experienceId: proj.experienceId,
        title: proj.title,
        summary: proj.summary,
        url: proj.url,
        metrics: proj.metrics,
        skillNames: proj.skills,
      });

      // Also create Evidence for each skill
      for (const skill of proj.skills) {
        await FalkorGraphService.upsertEvidence(tenantId, {
          text: `Project "${proj.title}": ${proj.metrics || proj.summary}`,
          skillName: skill,
          source: 'PROJECT_PORTFOLIO',
          confidence: 0.98,
        });
      }
    }

    // 4. Screening Answers
    for (const ans of p.screeningAnswers) {
      await FalkorGraphService.recordAnswer(tenantId, {
        questionKey: ans.questionKey,
        questionText: ans.questionText,
        answerText: ans.answerText,
        provenance: 'USER_PROFILE',
      });
    }
  }
}
