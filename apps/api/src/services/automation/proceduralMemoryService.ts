import { graphOps } from '@careergraph/db';
import type { ProceduralMemoryDTO } from '@careergraph/shared';

// Baseline field selectors for major ATS providers
const ATS_DEFAULTS: Record<string, Record<string, string>> = {
  GREENHOUSE: {
    first_name: 'input#first_name, input[name="job_application[first_name]"]',
    last_name: 'input#last_name, input[name="job_application[last_name]"]',
    email: 'input#email, input[name="job_application[email]"]',
    phone: 'input#phone, input[name="job_application[phone]"]',
    resume_file: 'input#resume, input[type="file"][name*="resume"]',
    cover_letter: 'textarea#cover_letter_text, textarea[name*="cover_letter"]',
    linkedin: 'input[name*="linkedin"], input[name*="question"][autocomplete*="url"]',
    github: 'input[name*="github"]',
    portfolio: 'input[name*="website"], input[name*="portfolio"]',
    submit_button: 'button#submit_app, input[type="submit"]',
  },
  LEVER: {
    full_name: 'input[name="name"]',
    email: 'input[name="email"]',
    phone: 'input[name="phone"]',
    resume_file: 'input[type="file"][name="resume"]',
    org: 'input[name="org"]',
    linkedin: 'input[name="urls[LinkedIn]"]',
    github: 'input[name="urls[GitHub]"]',
    portfolio: 'input[name="urls[Portfolio]"], input[name="urls[Other]"]',
    comments: 'textarea[name="comments"]',
    submit_button: 'button[type="submit"].template-btn-submit',
  },
  ASHBY: {
    first_name: 'input[name="name_first"]',
    last_name: 'input[name="name_last"]',
    email: 'input[name="email"]',
    phone: 'input[name="phone"]',
    resume_file: 'input[type="file"][name*="resume"]',
    cover_letter: 'textarea[name*="coverLetter"]',
    linkedin: 'input[name*="linkedin"]',
    github: 'input[name*="github"]',
    submit_button: 'button[type="submit"]',
  },
  GENERIC: {
    first_name: 'input[name*="first_name" i], input[name*="firstname" i], input[id*="first_name" i]',
    last_name: 'input[name*="last_name" i], input[name*="lastname" i], input[id*="last_name" i]',
    full_name: 'input[name*="name" i], input[id*="name" i]',
    email: 'input[type="email" i], input[name*="email" i]',
    phone: 'input[type="tel" i], input[name*="phone" i]',
    resume_file: 'input[type="file" i]',
    cover_letter: 'textarea[name*="cover" i], textarea[id*="cover" i]',
    linkedin: 'input[name*="linkedin" i]',
    github: 'input[name*="github" i]',
    portfolio: 'input[name*="portfolio" i], input[name*="website" i]',
    submit_button: 'button[type="submit" i], input[type="submit" i]',
  },
};

export class ProceduralMemoryService {
  /**
   * Identifies ATS category from URL domain or page structure.
   */
  static detectAtsType(urlOrDomain: string): 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'GENERIC' {
    const lower = urlOrDomain.toLowerCase();
    if (lower.includes('greenhouse.io') || lower.includes('gh_jid')) return 'GREENHOUSE';
    if (lower.includes('lever.co')) return 'LEVER';
    if (lower.includes('ashbyhq.com')) return 'ASHBY';
    return 'GENERIC';
  }

  /**
   * Retrieves selectors for a domain, combining known ATS baselines with learned overrides.
   */
  static async getSelectorsForDomain(
    userId: string,
    domain: string
  ): Promise<Record<string, string>> {
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const atsType = this.detectAtsType(cleanDomain);
    const baseline = { ...ATS_DEFAULTS.GENERIC, ...ATS_DEFAULTS[atsType] };

    try {
      // Query procedural memory nodes for candidate
      const memories = await graphOps.getCandidateMemories(userId, 'PROCEDURAL');
      const domainMemory = memories.find((m: any) => {
        const title = m.properties?.title || m.title || '';
        return title.toLowerCase().includes(cleanDomain);
      });

      const content = domainMemory?.properties?.content || (domainMemory as any)?.content;
      if (content) {
        try {
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          return { ...baseline, ...parsed };
        } catch {}
      }
    } catch {
      // Return baseline if graph query unavailable
    }

    return baseline;
  }

  /**
   * Records newly learned or adjusted field selectors into FalkorDB procedural memory.
   */
  static async recordLearnedSelectors(
    userId: string,
    domain: string,
    selectors: Record<string, string>
  ): Promise<ProceduralMemoryDTO> {
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const atsType = this.detectAtsType(cleanDomain);

    await graphOps.recordProceduralMemory(userId, {
      category: 'PROCEDURAL',
      context: `Procedural_${cleanDomain}`,
      text: JSON.stringify(selectors),
      verified: true,
    });

    return {
      domain: cleanDomain,
      atsType,
      selectors,
      timesUsed: 1,
      lastVerifiedAt: new Date().toISOString(),
    };
  }
}
