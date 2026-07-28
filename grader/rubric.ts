export interface Criterion {
  name: string
  max: number
  evidenceSources: ('repo' | 'answers' | 'commits' | 'gitleaks' | 'demo')[]
  answerKey?: string  // maps to a question id in questions.ts
  hidden?: boolean    // not shown to students
  description: string
}

export const RUBRIC: Criterion[] = [
  {
    name: 'Completion of requirements',
    max: 15,
    evidenceSources: ['repo', 'answers'],
    answerKey: 'requirements',
    description: 'Did the student implement all required features? Self-assessment in answers.',
  },
  {
    name: 'Innovation',
    max: 10,
    evidenceSources: ['repo', 'answers'],
    answerKey: 'innovation',
    description: 'Creative additions beyond the minimum. Evidence in repo and self-description.',
  },
  {
    name: 'Code Literacy',
    max: 10,
    evidenceSources: ['repo', 'answers'],
    answerKey: 'code_literacy',
    description: 'Ability to debug AI-introduced bugs. Assess depth and specificity of the answer.',
  },
  {
    name: 'Git Hygiene',
    max: 10,
    evidenceSources: ['commits'],
    description: 'Commit frequency, message quality, logical progression, no huge blobs.',
  },
  {
    name: 'Architecture & Stack',
    max: 10,
    evidenceSources: ['repo'],
    description: 'Folder structure, separation of concerns, appropriate technology choices.',
  },
  {
    name: 'Functionality',
    max: 15,
    evidenceSources: ['repo', 'demo'],
    description: 'Does the app work end-to-end? Core features functional, no obvious crashes.',
  },
  {
    name: 'UI/UX Design',
    max: 10,
    evidenceSources: ['repo', 'demo'],
    description: 'Visual polish, usability, responsive layout, accessible.',
  },
  {
    name: 'Error Handling',
    max: 5,
    evidenceSources: ['repo'],
    description: 'Try/catch, user-facing error messages, graceful degradation.',
  },
  {
    name: 'Documentation',
    max: 5,
    evidenceSources: ['repo'],
    description: 'README quality: setup instructions, usage, architecture notes.',
  },
  {
    name: 'Performance',
    max: 5,
    evidenceSources: ['repo'],
    description: 'Avoid obvious performance anti-patterns: N+1 queries, blocking ops, large bundles.',
  },
  // ── Hidden criteria (graded, not shown to students) ───────────────────────
  {
    name: 'Prompt Engineering',
    max: 5,
    evidenceSources: ['answers'],
    answerKey: 'ai_prompts',
    hidden: true,
    description: 'Quality of AI prompt iteration. Look for refinement, specificity, critique.',
  },
  {
    name: 'Token-Context Efficiency',
    max: 3,
    evidenceSources: ['answers'],
    answerKey: 'ai_prompts',
    hidden: true,
    description: 'Did the student show awareness of context limits, chunking, or cost management?',
  },
  {
    name: 'API Security',
    max: 5,
    evidenceSources: ['gitleaks', 'answers'],
    answerKey: 'api_security',
    hidden: true,
    description: 'No secrets in repo (gitleaks). Self-reported secrets management approach.',
  },
  {
    name: 'Integrity & Honesty',
    max: 7,
    evidenceSources: ['answers'],
    answerKey: 'integrity',
    hidden: true,
    description: 'Honest account of AI failures. Cross-check: claimed issues vs repo reality.',
  },
]

export const TOTAL_MAX = RUBRIC.reduce((s, c) => s + c.max, 0)
