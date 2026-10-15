import { SanitizePromptResultDto } from '@careergraph/shared';

const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: 'IGNORE_PREVIOUS_INSTRUCTIONS',
    regex: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directions|prompts|context)/i,
  },
  {
    name: 'SYSTEM_PROMPT_OVERRIDE',
    regex: /(system\s*prompt|system\s*instruction|system\s*message)\s*[:=]/i,
  },
  {
    name: 'JAILBREAK_ROLEPLAY',
    regex: /(you\s+are\s+now|act\s+as)\s+(DAN|unrestricted|jailbreak|developer\s+mode|root|god\s+mode)/i,
  },
  {
    name: 'FORGET_POLICIES',
    regex: /(forget|discard|disregard|bypass)\s+(all\s+)?(rules|policies|safety|guidelines|guardrails)/i,
  },
  {
    name: 'TOOL_HIJACKING_INSTRUCTION',
    regex: /(invoke|call|execute)\s+(tool|function|api|command)\s*[:=]\s*[a-zA-Z0-9_-]+/i,
  },
  {
    name: 'HIDDEN_HTML_INJECTION',
    regex: /<!--[\s\S]*?(system|instructions|ignore|prompt)[\s\S]*?-->/i,
  },
  {
    name: 'EXFILTRATE_SECRET_KEYS',
    regex: /(reveal|print|output|display)\s+(api[_-]?key|secret|password|bearer|auth[_-]?token)/i,
  },
];

export class PromptInjectionService {
  /**
   * Scans and sanitizes untrusted external text (job descriptions, email bodies, scraped ATS fields)
   * before passing it into LLM reasoning loops or tailoring prompts.
   */
  sanitizeExternalContent(content: string, origin: string = 'external_source'): SanitizePromptResultDto {
    if (!content) {
      return {
        sanitized: '',
        isFlagged: false,
        matchedPatterns: [],
      };
    }

    // 1. Strip evasive zero-width Unicode characters
    let cleaned = content.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ');

    // 2. Scan for adversarial prompt-injection patterns
    const matchedPatterns: string[] = [];
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.regex.test(cleaned)) {
        matchedPatterns.push(pattern.name);
      }
    }

    const isFlagged = matchedPatterns.length > 0;

    // 3. If flagged, neutralize direct command phrases
    if (isFlagged) {
      for (const pattern of INJECTION_PATTERNS) {
        cleaned = cleaned.replace(pattern.regex, '[REDACTED_ADVERSARIAL_INSTRUCTION]');
      }
    }

    // 4. Wrap securely in data boundary delimiters (Spec §22: external content wrapped as data)
    const sanitized = `<UNTRUSTED_EXTERNAL_DATA origin="${origin}" flagged="${isFlagged}">\n${cleaned.trim()}\n</UNTRUSTED_EXTERNAL_DATA>`;

    return {
      sanitized,
      isFlagged,
      matchedPatterns,
    };
  }
}

export const promptInjectionService = new PromptInjectionService();
