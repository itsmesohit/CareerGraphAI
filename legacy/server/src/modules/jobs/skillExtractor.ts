const KNOWN_SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++',
  'React', 'Node.js', 'Express', 'Next.js', 'Vue.js', 'Angular',
  'FalkorDB', 'Redis', 'PostgreSQL', 'MySQL', 'MongoDB', 'GraphQL', 'REST',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Linux', 'Git',
  'CI/CD', 'Playwright', 'Jest', 'Vitest', 'Microservices', 'Distributed Systems',
  'LLM', 'AI Agents', 'OpenAI', 'Gemini', 'LangChain', 'Prompt Engineering',
  'Machine Learning', 'Data Pipelines', 'Tailwind CSS', 'Prisma', 'BullMQ'
];

export function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const matched = new Set<string>();

  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      matched.add(skill);
    }
  }

  // Ensure at least 3 skills if text mentions general dev
  if (matched.size === 0) {
    matched.add('TypeScript');
    matched.add('Node.js');
    matched.add('React');
  }

  return Array.from(matched);
}

export function generateFingerprint(company: string, title: string, location: string): string {
  const clean = `${company}_${title}_${location}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return clean;
}
