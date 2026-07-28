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
  code_correctness: number;
  time_complexity: number;
  space_efficiency: number;
  code_cleanliness: number;
  architecture: number;
  edge_cases: number;
  test_suite: number;
  security: number;
  documentation: number;
  ai_integrity: number;
}

export interface EvaluationResult {
  overall_score: number;
  criteria_scores: CriteriaScores;
  summary: string;
  vulnerabilities: Vulnerability[];
}

const SYSTEM_PROMPT = `You are a Principal Code Auditor evaluating applicant submission code for a high-performance computer science club.
Analyze the provided source code thoroughly across 10 specific evaluation criteria on a scale of 0 to 100:

Criteria Keys (MUST use these exact keys):
1. code_correctness: Logic accuracy, syntax correctness, functionality.
2. time_complexity: Algorithm efficiency, Big-O scaling, runtime performance.
3. space_efficiency: Memory usage, resource allocation, payload footprint.
4. code_cleanliness: Naming conventions, readability, modularity, DRY principles.
5. architecture: System design, separation of concerns, pattern usage.
6. edge_cases: Handling null/empty inputs, boundary conditions, error handling.
7. test_suite: Presence, quality, and coverage of unit/integration tests.
8. security: Resistance to vulnerabilities (e.g. injection, data leaks, hardcoded credentials).
9. documentation: Inline comments, README quality, clear specifications.
10. ai_integrity: Code authenticity, absence of boilerplate AI artifacts or unverified copy-pasting.

Output Requirements:
You MUST output ONLY a valid raw JSON object (no markdown formatting, no extra explanation) with the following shape:
{
  "overall_score": <number 0-100>,
  "criteria_scores": {
    "code_correctness": <number 0-100>,
    "time_complexity": <number 0-100>,
    "space_efficiency": <number 0-100>,
    "code_cleanliness": <number 0-100>,
    "architecture": <number 0-100>,
    "edge_cases": <number 0-100>,
    "test_suite": <number 0-100>,
    "security": <number 0-100>,
    "documentation": <number 0-100>,
    "ai_integrity": <number 0-100>
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
 * Evaluates raw source code text against 10 criteria using Groq (Meta Llama 3).
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
        code_correctness: 0,
        time_complexity: 0,
        space_efficiency: 0,
        code_cleanliness: 0,
        architecture: 0,
        edge_cases: 0,
        test_suite: 0,
        security: 0,
        documentation: 0,
        ai_integrity: 0,
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
    code_correctness: 70,
    time_complexity: 70,
    space_efficiency: 70,
    code_cleanliness: 70,
    architecture: 70,
    edge_cases: 70,
    test_suite: 70,
    security: 70,
    documentation: 70,
    ai_integrity: 70,
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
