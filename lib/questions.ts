export interface Question {
  id: string
  label: string
  placeholder: string
  minLength: number
  hidden?: boolean // hidden criteria — not shown to student
}

export const QUESTIONS: Question[] = [
  {
    id: 'requirements',
    label: 'Which project requirements did you complete? Which ones did you skip, and why?',
    placeholder: 'Be specific — list each requirement and whether it works.',
    minLength: 100,
  },
  {
    id: 'innovation',
    label: 'What did you build beyond the minimum requirements?',
    placeholder: 'Describe any extra features, improvements, or creative additions.',
    minLength: 50,
  },
  {
    id: 'code_literacy',
    label: 'Describe a bug that an AI tool introduced into your code. How did you find it and fix it?',
    placeholder: 'Walk us through the bug, how you spotted it, and what the fix was.',
    minLength: 100,
  },
  {
    id: 'ai_prompts',
    label: 'Paste or summarize your most important AI prompts and how you iterated on them.',
    placeholder: 'Show your prompt-engineering process — what worked, what failed, how you refined.',
    minLength: 100,
    hidden: true,
  },
  {
    id: 'api_security',
    label: 'How did you store your API keys? Did you ever accidentally expose one?',
    placeholder: 'Explain your approach to secrets management (env vars, .gitignore, etc.).',
    minLength: 50,
    hidden: true,
  },
  {
    id: 'integrity',
    label: 'List any AI hallucinations or failures you encountered and how you handled them.',
    placeholder: 'Be honest — what did the AI get wrong and how did you catch or correct it?',
    minLength: 50,
    hidden: true,
  },
]

// Visible questions shown to students on the form
export const VISIBLE_QUESTIONS = QUESTIONS.filter((q) => !q.hidden)

// All questions used by the grader (hidden ones included)
export const ALL_QUESTIONS = QUESTIONS
