import type { NormalizedJob, JobUrlImportInput } from '@careergraph/shared';
import { extractSkillsFromText, extractStructuredRequirements, generateJobFingerprint } from './skillExtractor.js';

const PROHIBITED_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'naukri.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com',
  'dice.com',
];

/**
 * Checks whether automated scraping of a domain is restricted.
 */
export function isProhibitedScrapingDomain(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return PROHIBITED_DOMAINS.some((domain) => parsed.hostname.toLowerCase().includes(domain));
  } catch {
    return false;
  }
}

/**
 * Parses JSON-LD Schema.org JobPosting object from HTML markup.
 */
function extractJsonLdJob(html: string): any | null {
  const scriptRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed['@type'] === 'JobPosting') return parsed;
      if (Array.isArray(parsed['@graph'])) {
        const found = parsed['@graph'].find((item: any) => item['@type'] === 'JobPosting');
        if (found) return found;
      }
    } catch {
      // Continue search
    }
  }
  return null;
}

/**
 * Scrapes or constructs a NormalizedJob from a candidate-provided URL.
 */
export async function scrapeOrConstructJob(input: JobUrlImportInput): Promise<NormalizedJob> {
  const url = input.url;
  const isRestricted = isProhibitedScrapingDomain(url);

  // If prohibited site and user didn't provide title & description:
  if (isRestricted && (!input.title || !input.description)) {
    throw new Error(
      `Automated scraping of this domain is restricted by its Terms of Service. Please paste the job title and description directly, or import via our browser extension.`
    );
  }

  // If user explicitly provided title and description, use them directly
  if (input.title && input.description) {
    const company = input.company || new URL(url).hostname.replace('www.', '').split('.')[0];
    const skills = extractSkillsFromText(`${input.title} ${input.description}`);
    const requirements = extractStructuredRequirements(input.title, input.description);

    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      provider: 'USER_PASTED',
      company: company.charAt(0).toUpperCase() + company.slice(1),
      title: input.title,
      description: input.description,
      jobUrl: url,
      applyUrl: url,
      location: input.location || 'Remote',
      remoteType: input.remoteType || 'REMOTE',
      employmentType: 'Full-time',
      seniority: input.title.toLowerCase().includes('senior') ? 'SENIOR' : 'MID',
      minSalary: input.minSalary,
      maxSalary: input.maxSalary,
      currency: 'USD',
      skills,
      qualifications: requirements.filter(r => r.category === 'EDUCATION' || r.category === 'WORK_AUTH').map(r => r.description),
      status: 'OPEN',
      postedAt: new Date().toISOString(),
      attribution: 'User Imported URL',
      fingerprint: generateJobFingerprint(company, input.title, input.location || 'remote'),
      requirements,
    };
  }

  // Permitted domain: Attempt live HTTP fetch
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch job page (HTTP ${res.status})`);
    }

    const html = await res.text();

    // Check JSON-LD
    const jsonLd = extractJsonLdJob(html);
    if (jsonLd) {
      const company = jsonLd.hiringOrganization?.name || input.company || new URL(url).hostname;
      const title = jsonLd.title || input.title || 'Engineering Role';
      const description = (jsonLd.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      const location = jsonLd.jobLocation?.address?.addressLocality || input.location || 'Remote';
      const skills = extractSkillsFromText(`${title} ${description}`);
      const requirements = extractStructuredRequirements(title, description);

      return {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        provider: 'USER_PASTED',
        company,
        title,
        description: description || `${title} at ${company}`,
        jobUrl: url,
        applyUrl: url,
        location,
        remoteType: input.remoteType || 'REMOTE',
        employmentType: jsonLd.employmentType || 'Full-time',
        seniority: title.toLowerCase().includes('senior') ? 'SENIOR' : 'MID',
        currency: 'USD',
        skills,
        qualifications: requirements.filter(r => r.category === 'EDUCATION' || r.category === 'WORK_AUTH').map(r => r.description),
        status: 'OPEN',
        postedAt: jsonLd.datePosted || new Date().toISOString(),
        attribution: 'Web URL Import (JSON-LD)',
        fingerprint: generateJobFingerprint(company, title, location),
        requirements,
      };
    }

    // Fallback: Parse meta tags & title
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
      html.match(/<title>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
      html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);

    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>?/gm, '').trim() : (input.title || 'Job Opportunity');
    const description = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : (input.description || `${title} from ${url}`);
    const company = input.company || new URL(url).hostname.replace('www.', '').split('.')[0];
    const skills = extractSkillsFromText(`${title} ${description}`);
    const requirements = extractStructuredRequirements(title, description);

    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      provider: 'USER_PASTED',
      company: company.charAt(0).toUpperCase() + company.slice(1),
      title,
      description,
      jobUrl: url,
      applyUrl: url,
      location: input.location || 'Remote',
      remoteType: input.remoteType || 'REMOTE',
      employmentType: 'Full-time',
      seniority: title.toLowerCase().includes('senior') ? 'SENIOR' : 'MID',
      currency: 'USD',
      skills,
      qualifications: requirements.filter(r => r.category === 'EDUCATION' || r.category === 'WORK_AUTH').map(r => r.description),
      status: 'OPEN',
      postedAt: new Date().toISOString(),
      attribution: 'Web URL Import',
      fingerprint: generateJobFingerprint(company, title, input.location || 'remote'),
      requirements,
    };
  } catch (err: any) {
    if (input.title && input.description) {
      // Use fallback input values
      const company = input.company || new URL(url).hostname;
      const skills = extractSkillsFromText(`${input.title} ${input.description}`);
      const requirements = extractStructuredRequirements(input.title, input.description);

      return {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        provider: 'USER_PASTED',
        company,
        title: input.title,
        description: input.description,
        jobUrl: url,
        applyUrl: url,
        location: input.location || 'Remote',
        remoteType: input.remoteType || 'REMOTE',
        employmentType: 'Full-time',
        seniority: 'MID',
        currency: 'USD',
        skills,
        qualifications: requirements.map(r => r.description),
        status: 'OPEN',
        postedAt: new Date().toISOString(),
        attribution: 'Manual URL Fallback',
        fingerprint: generateJobFingerprint(company, input.title, input.location || 'remote'),
        requirements,
      };
    }
    throw new Error(`Unable to fetch job content from URL (${err.message}). Please paste the job description manually.`);
  }
}
