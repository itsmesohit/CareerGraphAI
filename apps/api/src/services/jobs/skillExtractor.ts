import crypto from 'node:crypto';
import type { ExtractedRequirement } from '@careergraph/shared';

// Comprehensive dictionary of canonical tech skills for deterministic recognition
const CANONICAL_SKILLS = [
  'TypeScript', 'JavaScript', 'Node.js', 'React', 'Next.js', 'Vue.js', 'Angular',
  'Python', 'Django', 'FastAPI', 'Flask', 'Go', 'Golang', 'Rust', 'Java', 'Spring Boot',
  'C++', 'C#', '.NET', 'PHP', 'Ruby', 'Ruby on Rails', 'Swift', 'Kotlin', 'Flutter',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB',
  'FalkorDB', 'Neo4j', 'GraphQL', 'REST', 'gRPC', 'Kafka', 'RabbitMQ', 'SQS',
  'AWS', 'Google Cloud', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'GitHub Actions', 'Linux', 'Git', 'Microservices', 'Distributed Systems', 'System Design',
  'Tailwind CSS', 'HTML5', 'CSS3', 'WebSockets', 'Prisma', 'TypeORM', 'SQL',
  'Machine Learning', 'PyTorch', 'TensorFlow', 'LLM', 'OpenAI', 'LangChain', 'LlamaIndex',
  'Cybersecurity', 'OAuth', 'JWT', 'Penetration Testing', 'Agile', 'Scrum'
];

/**
 * Extracts recognized canonical skills from any text snippet.
 */
export function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const normalizedText = ` ${text.replace(/[\n\r\t]/g, ' ')} `;
  const matched = new Set<string>();

  for (const skill of CANONICAL_SKILLS) {
    // Exact word boundary matching
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
    if (regex.test(normalizedText)) {
      matched.add(skill);
    }
  }

  return Array.from(matched);
}

/**
 * Generates an immutable SHA-256 fingerprint for deduplication.
 */
export function generateJobFingerprint(company: string, title: string, location: string = 'remote'): string {
  const normCompany = (company || '').toLowerCase().trim();
  const normTitle = (title || '').toLowerCase().trim();
  const normLocation = (location || 'remote').toLowerCase().trim();
  
  return crypto
    .createHash('sha256')
    .update(`${normCompany}:${normTitle}:${normLocation}`)
    .digest('hex');
}

/**
 * Extracts structured job requirements, identifying hard constraints,
 * experience thresholds, and skill links.
 */
export function extractStructuredRequirements(
  title: string,
  description: string
): ExtractedRequirement[] {
  const fullText = `${title}\n${description}`;
  const lines = fullText
    .split(/\n|\r|\. (?=[A-Z])/)
    .map((l) => l.trim())
    .filter((l) => l.length > 15 && l.length < 300);

  const requirements: ExtractedRequirement[] = [];
  const seenDescriptions = new Set<string>();

  // 1. Check for Work Authorization / Hard Constraints
  const workAuthRegex = /(must be authorized to work|us citizen|green card|sponsorship not available|no visa sponsorship|security clearance)/i;
  for (const line of lines) {
    if (workAuthRegex.test(line) && !seenDescriptions.has(line)) {
      seenDescriptions.add(line);
      requirements.push({
        description: line,
        isHardConstraint: true,
        weight: 2.5,
        category: 'WORK_AUTH',
      });
      break;
    }
  }

  // 2. Check for Degree / Education requirements
  const educationRegex = /(bachelor'?s? degree|master'?s? degree|degree in computer science|phd|equivalent experience)/i;
  for (const line of lines) {
    if (educationRegex.test(line) && !seenDescriptions.has(line)) {
      seenDescriptions.add(line);
      requirements.push({
        description: line,
        isHardConstraint: false,
        weight: 1.2,
        category: 'EDUCATION',
      });
      break;
    }
  }

  // 3. Extract Years of Experience
  const yoeRegex = /(\d+)\+?\s*years?(?:\s+of)?\s+(?:experience|hands-on|working)/i;
  let minYearsOverall = 2;
  for (const line of lines) {
    const match = line.match(yoeRegex);
    if (match) {
      minYearsOverall = parseInt(match[1], 10);
      if (!seenDescriptions.has(line)) {
        seenDescriptions.add(line);
        requirements.push({
          description: line,
          isHardConstraint: false,
          weight: 1.5,
          category: 'EXPERIENCE',
          minYears: minYearsOverall,
        });
      }
      break;
    }
  }

  // 4. Extract Skills-based Requirements
  const extractedSkills = extractSkillsFromText(fullText);
  extractedSkills.slice(0, 8).forEach((skill, idx) => {
    // Find a relevant line mentioning this skill, or construct a canonical requirement
    const matchingLine = lines.find((l) => l.toLowerCase().includes(skill.toLowerCase()));
    const desc = matchingLine || `Demonstrated proficiency building production applications with ${skill}`;

    if (!seenDescriptions.has(desc)) {
      seenDescriptions.add(desc);
      requirements.push({
        description: desc,
        skill,
        isHardConstraint: idx === 0, // Primary core skill
        weight: idx < 3 ? 1.5 : 1.0,
        category: 'TECHNICAL',
        minYears: minYearsOverall,
      });
    }
  });

  // Fallback: If no requirements extracted, ensure at least 2 default requirements exist
  if (requirements.length === 0) {
    requirements.push({
      description: `Solid software engineering experience in ${title}`,
      isHardConstraint: true,
      weight: 1.5,
      category: 'TECHNICAL',
    });
  }

  return requirements;
}
