import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export interface Vulnerability {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  analysis: string;
  suggested_fix: string;
}

export interface CriteriaScores {
  completion: number;
  innovation: number;
  code_literacy: number;
  git_hygiene: number;
  architecture_stack: number;
  functionality: number;
  ui_ux_design: number;
  error_handling: number;
  documentation: number;
  performance: number;
  prompt_engineering: number;
  api_security: number;
  integrity_honesty: number;
}

export interface EvaluationResult {
  overall_score: number;
  criteria_scores: CriteriaScores;
  summary: string;
  vulnerabilities: Vulnerability[];
}

const SYSTEM_PROMPT = `You are a Principal Code Auditor evaluating applicant submission code for a high-performance computer science club.
Analyze the provided source code thoroughly across 13 specific evaluation criteria on a scale of 0 to 10:

Criteria Keys (MUST use these exact keys):
1. completion: Extent to which the requirements were met.
2. innovation: Creativity and uniqueness of the solution.
3. code_literacy: Readability, naming conventions, and code cleanliness.
4. git_hygiene: Meaningful commit messages and repository structure.
5. architecture_stack: System design, separation of concerns, and technology choices.
6. functionality: Core logic correctness and bug-free execution.
7. ui_ux_design: User interface aesthetics and user experience (if applicable).
8. error_handling: Graceful handling of edge cases and unexpected inputs.
9. documentation: README quality, inline comments, and setup instructions.
10. performance: Algorithm efficiency and resource usage.
11. prompt_engineering: Effective use of AI constraints (if AI tools were allowed).
12. api_security: Resistance to vulnerabilities and safe data handling.
13. integrity_honesty: Absence of blatant plagiarism or unmodified boilerplate.

Output Requirements:
You MUST output ONLY a valid raw JSON object (no markdown formatting, no extra explanation) with the following shape:
{
  "overall_score": <number 0-10>,
  "criteria_scores": {
    "completion": <number 0-10>,
    "innovation": <number 0-10>,
    "code_literacy": <number 0-10>,
    "git_hygiene": <number 0-10>,
    "architecture_stack": <number 0-10>,
    "functionality": <number 0-10>,
    "ui_ux_design": <number 0-10>,
    "error_handling": <number 0-10>,
    "documentation": <number 0-10>,
    "performance": <number 0-10>,
    "prompt_engineering": <number 0-10>,
    "api_security": <number 0-10>,
    "integrity_honesty": <number 0-10>
  },
  "summary": "<3-5 sentence detailed summary of strengths and areas for improvement>",
  "vulnerabilities": [
    {
      "id": "vuln-1",
      "title": "<short title>",
      "severity": "<low|medium|high|critical>",
      "line": <line number or 0>,
      "analysis": "<detailed explanation of the vulnerability>",
      "suggested_fix": "<recommended remediation>"
    }
  ]
}`;

// Helper for backoff on rate limits
async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('rate limit');
      if (!isRateLimit || attempt === maxRetries) throw err;
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10000);
      console.log(`[Groq API Rate Limit] Retrying in ${(delay / 1000).toFixed(1)}s (Attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded for Groq API call.');
}

/**
 * Evaluates raw source code text against 13 criteria using Groq (Meta Llama 3).
 *
 * @param rawCodeText Flattened source code string
 * @param language Programming language of the submission
 * @returns EvaluationResult object with overall score, criteria breakdown, summary, and vulnerabilities
 */
export async function evaluateCodeWithGroq(
  rawCodeText: string,
  language: string
): Promise<EvaluationResult> {
  if (!rawCodeText || !rawCodeText.trim()) {
    return {
      overall_score: 0,
      criteria_scores: {
        completion: 0,
        innovation: 0,
        code_literacy: 0,
        git_hygiene: 0,
        architecture_stack: 0,
        functionality: 0,
        ui_ux_design: 0,
        error_handling: 0,
        documentation: 0,
        performance: 0,
        prompt_engineering: 0,
        api_security: 0,
        integrity_honesty: 0,
      },
      summary: 'No code submitted for evaluation.',
      vulnerabilities: [],
    };
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const userContent = `Language: ${language}\n\nSource Code to Audit:\n${rawCodeText.slice(0, 50000)}`;

  const response = await withBackoff(() =>
    groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4096,
    })
  );

  const rawText = response.choices[0]?.message?.content || '{}';

  // Markdown-stripping fallback parsing logic
  let parsed: any;
  try {
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('[Groq Response Parse Error] Failed to parse JSON response:', rawText.slice(0, 300));
    throw new Error('Groq API returned malformed or non-JSON output.');
  }

  // Ensure default fallback values for safety
  const defaultCriteria: CriteriaScores = {
    completion: 7,
    innovation: 7,
    code_literacy: 7,
    git_hygiene: 7,
    architecture_stack: 7,
    functionality: 7,
    ui_ux_design: 7,
    error_handling: 7,
    documentation: 7,
    performance: 7,
    prompt_engineering: 7,
    api_security: 7,
    integrity_honesty: 7,
  };

  const criteriaScores: CriteriaScores = {
    ...defaultCriteria,
    ...(parsed.criteria_scores || {}),
  };

  const calculatedAvg =
    Object.values(criteriaScores).reduce((a, b) => a + Number(b || 0), 0) /
    Object.keys(criteriaScores).length;

  const overallScore = typeof parsed.overall_score === 'number'
    ? parsed.overall_score
    : Math.round(calculatedAvg * 10) / 10;

  return {
    overall_score: Number(overallScore),
    criteria_scores: criteriaScores,
    summary: String(parsed.summary || 'Evaluation completed successfully.'),
    vulnerabilities: Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [],
  };
}

// Backward compatibility alias for legacy scripts
export const gradeSubmission = evaluateCodeWithGroq;
