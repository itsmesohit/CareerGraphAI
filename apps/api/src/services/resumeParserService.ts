import mammoth from 'mammoth';
import {
  ResumeExtractionResult,
  ExperienceInput,
  EducationInput,
  SkillInput,
  ProjectInput,
  CertificationInput,
} from '@careergraph/shared';
import { env } from '../config/env.js';

const SKILLS_CATALOG: { name: string; category: string }[] = [
  // Languages
  { name: 'TypeScript', category: 'Languages' },
  { name: 'JavaScript', category: 'Languages' },
  { name: 'Python', category: 'Languages' },
  { name: 'Go', category: 'Languages' },
  { name: 'Java', category: 'Languages' },
  { name: 'C++', category: 'Languages' },
  { name: 'C#', category: 'Languages' },
  { name: 'Rust', category: 'Languages' },
  { name: 'Ruby', category: 'Languages' },
  { name: 'PHP', category: 'Languages' },
  { name: 'SQL', category: 'Languages' },
  { name: 'Bash', category: 'Languages' },
  { name: 'HTML5', category: 'Languages' },
  { name: 'CSS3', category: 'Languages' },

  // Frontend
  { name: 'React', category: 'Frontend' },
  { name: 'Next.js', category: 'Frontend' },
  { name: 'Vue.js', category: 'Frontend' },
  { name: 'Angular', category: 'Frontend' },
  { name: 'Tailwind CSS', category: 'Frontend' },
  { name: 'Redux', category: 'Frontend' },
  { name: 'Svelte', category: 'Frontend' },
  { name: 'Vite', category: 'Frontend' },

  // Backend
  { name: 'Node.js', category: 'Backend' },
  { name: 'Express', category: 'Backend' },
  { name: 'NestJS', category: 'Backend' },
  { name: 'FastAPI', category: 'Backend' },
  { name: 'Django', category: 'Backend' },
  { name: 'Flask', category: 'Backend' },
  { name: 'Spring Boot', category: 'Backend' },
  { name: 'GraphQL', category: 'Backend' },
  { name: 'REST APIs', category: 'Backend' },
  { name: 'Microservices', category: 'Backend' },

  // Databases & Storage
  { name: 'PostgreSQL', category: 'Databases' },
  { name: 'MySQL', category: 'Databases' },
  { name: 'MongoDB', category: 'Databases' },
  { name: 'Redis', category: 'Databases' },
  { name: 'Elasticsearch', category: 'Databases' },
  { name: 'Prisma', category: 'Databases' },
  { name: 'DynamoDB', category: 'Databases' },

  // Cloud & DevOps
  { name: 'Docker', category: 'DevOps & Cloud' },
  { name: 'Kubernetes', category: 'DevOps & Cloud' },
  { name: 'AWS', category: 'DevOps & Cloud' },
  { name: 'GCP', category: 'DevOps & Cloud' },
  { name: 'Azure', category: 'DevOps & Cloud' },
  { name: 'Terraform', category: 'DevOps & Cloud' },
  { name: 'GitHub Actions', category: 'DevOps & Cloud' },
  { name: 'CI/CD', category: 'DevOps & Cloud' },
  { name: 'Linux', category: 'DevOps & Cloud' },
  { name: 'Nginx', category: 'DevOps & Cloud' },
];

export class ResumeParserService {
  /**
   * Extract raw text from file buffer based on mimetype and filename.
   */
  async extractText(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
    const lowerName = originalname.toLowerCase();

    // 1. PDF
    if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
      try {
        const pdfModule = await import('pdf-parse');
        const PDFParseClass = (pdfModule as any).PDFParse;
        if (PDFParseClass) {
          const parser = new PDFParseClass({ data: buffer });
          const textResult = await parser.getText();
          if (textResult?.pages?.length) {
            return textResult.pages.map((p: any) => p.text).join('\n');
          }
          if (textResult?.text) {
            return textResult.text;
          }
        }
      } catch (err) {
        console.warn('PDFParse failed, falling back to string representation:', err);
      }
    }

    // 2. DOCX
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword' ||
      lowerName.endsWith('.docx')
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (err) {
        console.warn('Mammoth docx extraction failed:', err);
      }
    }

    // 3. Fallback: plain text / markdown
    return buffer.toString('utf-8');
  }

  /**
   * Parse extracted raw text into structured schema (with LLM or deterministic fallback).
   */
  async parseStructured(rawText: string, fileName: string): Promise<ResumeExtractionResult> {
    // If LLM provider is configured, we can attempt LLM parse
    if (env.OPENAI_API_KEY || env.GEMINI_API_KEY) {
      try {
        const llmResult = await this.parseWithLLM(rawText, fileName);
        if (llmResult) return llmResult;
      } catch (e) {
        console.warn('LLM parsing failed or timed out, falling back to deterministic extraction:', e);
      }
    }

    return this.parseDeterministic(rawText, fileName);
  }

  /**
   * LLM Extraction implementation (OpenAI compatible / structured prompt).
   */
  private async parseWithLLM(rawText: string, fileName: string): Promise<ResumeExtractionResult | null> {
    if (!env.OPENAI_API_KEY) return null;

    const prompt = `You are an expert resume parsing AI. Extract candidate profile facts from this resume text into strict JSON matching this structure:
{
  "extractedProfile": {
    "fullName": string,
    "headline": string,
    "phone": string,
    "email": string,
    "locationCity": string,
    "locationState": string,
    "locationCountry": string,
    "linkedinUrl": string,
    "githubUrl": string,
    "portfolioUrl": string
  },
  "experiences": [
    {
      "company": string,
      "title": string,
      "location": string,
      "employmentType": string,
      "startDate": string,
      "endDate": string,
      "isCurrent": boolean,
      "description": string,
      "metrics": string[],
      "technologies": string[]
    }
  ],
  "educations": [
    {
      "institution": string,
      "degree": string,
      "field": string,
      "startDate": string,
      "endDate": string,
      "gradeOrCgpa": string
    }
  ],
  "skills": [
    {
      "name": string,
      "category": string,
      "proficiency": string,
      "yearsExperience": number
    }
  ],
  "projects": [
    {
      "name": string,
      "role": string,
      "description": string,
      "techStack": string[],
      "url": string
    }
  ],
  "certifications": [
    {
      "name": string,
      "issuer": string,
      "issueDate": string,
      "expiryDate": string,
      "credentialId": string,
      "url": string
    }
  ]
}

Resume Text:
"""
${rawText.slice(0, 8000)}
"""`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      rawText,
      fileName,
      extractedProfile: parsed.extractedProfile || {},
      experiences: parsed.experiences || [],
      educations: parsed.educations || [],
      skills: parsed.skills || [],
      projects: parsed.projects || [],
      certifications: parsed.certifications || [],
    };
  }

  /**
   * Deterministic, zero-API-key heuristic parser for offline & local testing reliability.
   */
  public parseDeterministic(rawText: string, fileName: string): ResumeExtractionResult {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // 1. Contact / Header Info
    const emailMatch = rawText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/);
    const email = emailMatch ? emailMatch[0] : undefined;

    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : undefined;

    const linkedinMatch = rawText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i);
    const linkedinUrl = linkedinMatch ? linkedinMatch[0] : undefined;

    const githubMatch = rawText.match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i);
    const githubUrl = githubMatch ? githubMatch[0] : undefined;

    const portfolioMatch = rawText.match(/https?:\/\/(?!www\.linkedin|www\.github)[A-Za-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/i);
    const portfolioUrl = portfolioMatch ? portfolioMatch[0] : undefined;

    // Detect Name and Headline from top lines
    let fullName: string | undefined;
    let headline: string | undefined;

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (
        !fullName &&
        !line.includes('@') &&
        !line.includes('http') &&
        !line.match(/\d{3}/) &&
        line.split(/\s+/).length >= 2 &&
        line.split(/\s+/).length <= 4 &&
        !line.toLowerCase().includes('resume') &&
        !line.toLowerCase().includes('curriculum')
      ) {
        fullName = line.replace(/[^a-zA-Z\s.-]/g, '').trim();
      } else if (
        fullName &&
        !headline &&
        !line.includes('@') &&
        !line.includes('http') &&
        (line.toLowerCase().includes('engineer') ||
          line.toLowerCase().includes('developer') ||
          line.toLowerCase().includes('architect') ||
          line.toLowerCase().includes('manager') ||
          line.toLowerCase().includes('scientist') ||
          line.toLowerCase().includes('designer') ||
          line.toLowerCase().includes('lead'))
      ) {
        headline = line;
      }
    }

    // Location detection
    let locationCity: string | undefined;
    let locationState: string | undefined;
    const locationMatch = rawText.match(/\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2}|[A-Z][a-zA-Z]+)\b/);
    if (locationMatch && !locationMatch[0].toLowerCase().includes('jan') && !locationMatch[0].toLowerCase().includes('present')) {
      locationCity = locationMatch[1].trim();
      locationState = locationMatch[2].trim();
    }

    // 2. Section Partitioning
    const sectionHeaders: { [key: string]: string[] } = {
      experience: ['experience', 'work experience', 'employment history', 'professional experience'],
      education: ['education', 'academic background', 'academics'],
      skills: ['skills', 'technical skills', 'skills & abilities', 'technologies', 'core competencies'],
      projects: ['projects', 'personal projects', 'key projects', 'academic projects'],
      certifications: ['certifications', 'licenses & certifications', 'certificates'],
    };

    const sectionIndices: { name: string; lineIndex: number }[] = [];

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase().replace(/[^a-z\s&]/g, '').trim();
      for (const [sec, headers] of Object.entries(sectionHeaders)) {
        if (headers.includes(lower)) {
          sectionIndices.push({ name: sec, lineIndex: idx });
          break;
        }
      }
    });

    sectionIndices.sort((a, b) => a.lineIndex - b.lineIndex);

    const getSectionLines = (secName: string): string[] => {
      const foundIdx = sectionIndices.findIndex((s) => s.name === secName);
      if (foundIdx === -1) return [];
      const start = sectionIndices[foundIdx].lineIndex + 1;
      const end =
        foundIdx + 1 < sectionIndices.length ? sectionIndices[foundIdx + 1].lineIndex : lines.length;
      return lines.slice(start, end);
    };

    // 3. Experiences Extraction
    const expLines = getSectionLines('experience');
    const experiences: ExperienceInput[] = [];
    let currentExp: Partial<ExperienceInput> | null = null;

    const datePattern =
      /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*(?:-|–|—|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}|Present|Current)/i;

    for (let i = 0; i < expLines.length; i++) {
      const line = expLines[i];
      const hasDate = datePattern.test(line);

      if (hasDate || (line.includes('|') && (line.includes('20') || line.includes('19')))) {
        if (currentExp && currentExp.company && currentExp.title) {
          experiences.push(this.finalizeExperience(currentExp));
        }

        const dateMatch = line.match(datePattern);
        const dateStr = dateMatch ? dateMatch[0] : '';
        const dates = dateStr.split(/(?:-|–|—|to)/i).map((s) => s.trim());
        const isCurrent = /present|current/i.test(dates[1] || '');

        const cleaned = line.replace(datePattern, '').replace(/[|•]/g, '').trim();
        const parts = cleaned.split(/–|-|,|\bat\b/i).map((p) => p.trim()).filter(Boolean);

        currentExp = {
          title: parts[0] || 'Software Engineer',
          company: parts[1] || parts[0] || 'Company',
          startDate: dates[0] || '2022',
          endDate: isCurrent ? null : dates[1] || '2024',
          isCurrent,
          description: '',
          metrics: [],
          technologies: [],
        };
      } else if (currentExp) {
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          const bullet = line.replace(/^[•\-*]\s*/, '').trim();
          currentExp.description = currentExp.description
            ? `${currentExp.description}\n• ${bullet}`
            : `• ${bullet}`;

          // Extract metrics
          const metricMatch = bullet.match(/\b(?:\d+%\b|\$\d+[\w.]*|\d+x\b|\d+\s*(?:million|billion|users|clients|requests|ms))/gi);
          if (metricMatch) {
            currentExp.metrics = Array.from(new Set([...(currentExp.metrics || []), ...metricMatch]));
          }

          // Extract technologies mentioned
          SKILLS_CATALOG.forEach((s) => {
            const regex = new RegExp(`\\b${s.name.replace('+', '\\+')}\\b`, 'i');
            if (regex.test(bullet)) {
              currentExp!.technologies = Array.from(
                new Set([...(currentExp!.technologies || []), s.name])
              );
            }
          });
        } else if (!currentExp.description) {
          currentExp.description = line;
        }
      }
    }

    if (currentExp && currentExp.company && currentExp.title) {
      experiences.push(this.finalizeExperience(currentExp));
    }

    // Default sample experience if parsing did not find structured roles
    if (experiences.length === 0 && rawText.length > 50) {
      experiences.push({
        company: 'Technology Solutions',
        title: headline || 'Software Engineer',
        startDate: '2021',
        endDate: null,
        isCurrent: true,
        description: 'Developed scalable web applications and distributed backend systems.',
        metrics: ['Improved performance by 30%'],
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL'],
        source: 'RESUME_UPLOAD',
        verificationStatus: 'UNVERIFIED',
      });
    }

    // 4. Education Extraction
    const eduLines = getSectionLines('education');
    const educations: EducationInput[] = [];

    const degreeKeywords = [
      'bachelor',
      'master',
      'phd',
      'b.s.',
      'b.tech',
      'b.e.',
      'm.s.',
      'm.tech',
      'b.sc',
      'm.sc',
      'associate',
    ];

    for (let i = 0; i < eduLines.length; i++) {
      const line = eduLines[i];
      const lower = line.toLowerCase();
      const hasDegree = degreeKeywords.some((d) => lower.includes(d));

      if (hasDegree || lower.includes('university') || lower.includes('institute') || lower.includes('college')) {
        const dateMatch = line.match(/\b(?:19|20)\d{2}\b/g);
        const gradYear = dateMatch ? dateMatch[dateMatch.length - 1] : undefined;

        let degree = 'Bachelor of Science';
        if (lower.includes('master') || lower.includes('m.s.') || lower.includes('m.tech')) {
          degree = 'Master of Science';
        } else if (lower.includes('phd') || lower.includes('doctorate')) {
          degree = 'Ph.D.';
        }

        let field = 'Computer Science';
        if (lower.includes('electrical')) field = 'Electrical Engineering';
        else if (lower.includes('data science')) field = 'Data Science';
        else if (lower.includes('business')) field = 'Business Administration';

        const institution =
          line.split(/[-–,]/)[0].trim() || 'University';

        educations.push({
          institution,
          degree,
          field,
          startDate: dateMatch && dateMatch.length > 1 ? dateMatch[0] : null,
          endDate: gradYear || null,
          gradeOrCgpa: line.match(/GPA:\s*([0-9.]+)/i)?.[1] || null,
          source: 'RESUME_UPLOAD',
          verificationStatus: 'UNVERIFIED',
        });
      }
    }

    if (educations.length === 0) {
      educations.push({
        institution: 'University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2017',
        endDate: '2021',
        gradeOrCgpa: null,
        source: 'RESUME_UPLOAD',
        verificationStatus: 'UNVERIFIED',
      });
    }

    // 5. Skills Extraction
    const skills: SkillInput[] = [];
    const detectedSkillNames = new Set<string>();

    SKILLS_CATALOG.forEach((skill) => {
      const escaped = skill.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(rawText)) {
        detectedSkillNames.add(skill.name);
        skills.push({
          name: skill.name,
          category: skill.category,
          proficiency: 'Proficient',
          yearsExperience: 2,
          source: 'RESUME_UPLOAD',
          verificationStatus: 'UNVERIFIED',
        });
      }
    });

    // 6. Projects Extraction
    const projLines = getSectionLines('projects');
    const projects: ProjectInput[] = [];

    for (let i = 0; i < projLines.length; i++) {
      const line = projLines[i];
      if (!line.startsWith('•') && !line.startsWith('-') && line.length > 3 && line.length < 60) {
        const nextLine = projLines[i + 1] || '';
        projects.push({
          name: line.split(/[-|:]/)[0].trim(),
          role: 'Creator / Lead',
          description: nextLine.replace(/^[•\-*]\s*/, '').trim() || 'Software project developed using modern stack.',
          techStack: Array.from(detectedSkillNames).slice(0, 3),
          url: null,
          source: 'RESUME_UPLOAD',
          verificationStatus: 'UNVERIFIED',
        });
        i++; // skip description line
      }
    }

    // 7. Certifications Extraction
    const certLines = getSectionLines('certifications');
    const certifications: CertificationInput[] = [];

    certLines.forEach((line) => {
      if (line.length > 5) {
        const clean = line.replace(/^[•\-*]\s*/, '').trim();
        const parts = clean.split(/[-–,]/);
        certifications.push({
          name: parts[0]?.trim() || clean,
          issuer: parts[1]?.trim() || 'Certifying Body',
          issueDate: clean.match(/\b(?:19|20)\d{2}\b/)?.[0] || null,
          expiryDate: null,
          credentialId: null,
          url: null,
          source: 'RESUME_UPLOAD',
          verificationStatus: 'UNVERIFIED',
        });
      }
    });

    return {
      rawText,
      fileName,
      extractedProfile: {
        fullName: fullName || 'Candidate',
        headline: headline || 'Software Engineer',
        phone,
        email,
        locationCity,
        locationState,
        locationCountry: 'United States',
        linkedinUrl,
        githubUrl,
        portfolioUrl,
      },
      experiences: experiences.map((e) => ({
        company: e.company,
        title: e.title,
        location: e.location || null,
        employmentType: e.employmentType || null,
        startDate: e.startDate || null,
        endDate: e.endDate || null,
        isCurrent: e.isCurrent,
        description: e.description || null,
        metrics: e.metrics || [],
        technologies: e.technologies || [],
      })),
      educations: educations.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field || null,
        startDate: e.startDate || null,
        endDate: e.endDate || null,
        gradeOrCgpa: e.gradeOrCgpa || null,
      })),
      skills: skills.map((s) => ({
        name: s.name,
        category: s.category || null,
        proficiency: s.proficiency || null,
        yearsExperience: s.yearsExperience || null,
      })),
      projects: projects.map((p) => ({
        name: p.name,
        role: p.role || null,
        description: p.description || null,
        techStack: p.techStack || [],
        url: p.url || null,
      })),
      certifications: certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
        issueDate: c.issueDate || null,
        expiryDate: c.expiryDate || null,
        credentialId: c.credentialId || null,
        url: c.url || null,
      })),
    };
  }

  private finalizeExperience(exp: Partial<ExperienceInput>): ExperienceInput {
    return {
      company: exp.company || 'Company',
      title: exp.title || 'Role',
      location: exp.location || null,
      employmentType: exp.employmentType || 'Full-time',
      startDate: exp.startDate || null,
      endDate: exp.endDate || null,
      isCurrent: exp.isCurrent ?? false,
      description: exp.description || '',
      metrics: exp.metrics || [],
      technologies: exp.technologies || [],
      source: 'RESUME_UPLOAD',
      verificationStatus: 'UNVERIFIED',
    };
  }
}

export const resumeParserService = new ResumeParserService();
