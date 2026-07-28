import Groq from 'groq-sdk'
import { RUBRIC, type Criterion } from './rubric'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export interface GradeResult {
  criterion: string
  score: number
  max: number
  rationale: string
}

const SYSTEM_PROMPT = `You are an expert technical assessor grading student coding projects for a university coding club admissions process.
You will be given evidence (repo files, commit history, gitleaks output, written answers) and a rubric.
Return ONLY a valid JSON array with one object per criterion: [{criterion, score, max, rationale}].
- score must be a number between 0 and max (inclusive), can be a decimal.
- rationale must be 1-3 sentences, specific to the evidence provided.
- Be honest and calibrated — a mediocre project should score 40-60%, excellent work 80%+.
- Never fabricate evidence. If evidence is missing, score conservatively.`

// Exponential backoff for Groq rate limits
async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      const isRateLimit = e?.status === 429 || e?.message?.includes('rate limit')
      if (!isRateLimit || attempt === maxRetries) throw err
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 30_000)
      console.log(`  Rate limited — waiting ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1})`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function gradeSubmission(opts: {
  repoTree: string
  keyFiles: Record<string, string>
  commits: string
  gitleaksFindings: string
  answers: Record<string, string>
  demoUrl?: string | null
}): Promise<GradeResult[]> {
  const { repoTree, keyFiles, commits, gitleaksFindings, answers, demoUrl } = opts

  // Build file context
  const fileContext = Object.entries(keyFiles)
    .map(([p, c]) => `\n--- ${p} ---\n${c}`)
    .join('\n')

  // Build answers context
  const answersText = Object.entries(answers)
    .map(([k, v]) => `[${k}]: ${v}`)
    .join('\n\n')

  const leaks = JSON.parse(gitleaksFindings || '[]')
  const leakSummary = leaks.length === 0
    ? 'No secrets found by gitleaks.'
    : `gitleaks found ${leaks.length} potential secret(s): ${JSON.stringify(leaks.slice(0, 5))}`

  const userContent = `
## Repository file tree (up to 300 files)
${repoTree}

## Key file contents
${fileContext}

## Commit history (last 50 commits)
${commits}

## Secret scan
${leakSummary}

## Demo URL
${demoUrl ?? 'Not provided'}

## Student written answers
${answersText}

## Rubric (grade ALL of these criteria)
${RUBRIC.map((c) => `- ${c.name} (max ${c.max}): ${c.description}`).join('\n')}

Return a JSON array: [{criterion, score, max, rationale}, ...]
`.trim()

  const response = await withBackoff(() =>
    groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4096,
    })
  )

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Groq returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  // Accept either {grades:[...]} or [...] directly
  const arr: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>).grades ?? Object.values(parsed as Record<string, unknown>)[0]

  if (!Array.isArray(arr)) throw new Error('Unexpected Groq response shape')

  // Validate and coerce each item against the rubric
  const rubricMap = new Map(RUBRIC.map((c) => [c.name, c]))
  return (arr as Record<string, unknown>[]).map((item) => {
    const crit = rubricMap.get(item.criterion as string)
    const max = crit?.max ?? (item.max as number) ?? 10
    const score = Math.max(0, Math.min(max, Number(item.score) || 0))
    return {
      criterion: String(item.criterion),
      score,
      max,
      rationale: String(item.rationale ?? ''),
    }
  })
}
