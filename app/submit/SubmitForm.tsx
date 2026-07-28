'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VISIBLE_QUESTIONS, ALL_QUESTIONS } from '@/lib/questions'
import { attachIntegrityListeners } from '@/lib/integrity'

interface Props {
  userId: string
  draft: {
    id: string
    repo_url: string
    demo_url: string | null
    answers: Record<string, string>
  } | null
}

export default function SubmitForm({ userId, draft }: Props) {
  const router = useRouter()
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [repoUrl, setRepoUrl] = useState(draft?.repo_url ?? '')
  const [demoUrl, setDemoUrl] = useState(draft?.demo_url ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>(
    (draft?.answers as Record<string, string>) ?? {}
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Hidden question fields (same textareas, just not shown — grader sees them)
  const hiddenAnswers = useRef<Record<string, string>>({})

  useEffect(() => {
    // Attach integrity listeners to all answer textareas
    const cleanups: (() => void)[] = []
    ALL_QUESTIONS.forEach((q) => {
      const el = textareaRefs.current[q.id]
      if (el) {
        const cleanup = attachIntegrityListeners(el, q.id, userId)
        cleanups.push(cleanup)
      }
    })
    return () => cleanups.forEach((fn) => fn())
  }, [userId])

  const getPayload = () => ({
    repo_url: repoUrl.trim(),
    demo_url: demoUrl.trim() || null,
    answers: { ...answers, ...hiddenAnswers.current },
  })

  async function saveDraft() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...getPayload(), action: 'draft' }),
    })
    setSaving(false)
    if (!res.ok) setError((await res.json()).error ?? 'Save failed.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    // Validate required visible fields
    for (const q of VISIBLE_QUESTIONS) {
      const val = answers[q.id] ?? ''
      if (val.trim().length < q.minLength) {
        setError(`"${q.label.slice(0, 60)}…" needs at least ${q.minLength} characters.`)
        setSubmitting(false)
        return
      }
    }

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...getPayload(), action: 'submit' }),
    })

    if (res.ok) {
      router.refresh()
    } else {
      const body = await res.json()
      setError(body.error ?? 'Submission failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Repo & Demo URLs */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Project links</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GitHub repository URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/you/your-project"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Live demo URL <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://your-project.vercel.app"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Visible questions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
        <h2 className="font-semibold text-gray-800">Written answers</h2>
        <p className="text-xs text-gray-500 -mt-4">
          Type your own answers. Copy-paste is disabled and monitored.
        </p>

        {VISIBLE_QUESTIONS.map((q) => (
          <div key={q.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {q.label} <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={(el) => { textareaRefs.current[q.id] = el }}
              required
              minLength={q.minLength}
              rows={5}
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder={q.placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y select-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {answers[q.id]?.length ?? 0} / {q.minLength} min chars
            </p>
          </div>
        ))}

        {/* Hidden questions — rendered but visually hidden; still monitored */}
        {ALL_QUESTIONS.filter((q) => q.hidden).map((q) => (
          <div key={q.id} className="hidden" aria-hidden="true">
            <textarea
              ref={(el) => { textareaRefs.current[q.id] = el }}
              value={hiddenAnswers.current[q.id] ?? ''}
              onChange={(e) => { hiddenAnswers.current[q.id] = e.target.value }}
              tabIndex={-1}
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving || submitting}
          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="submit"
          disabled={submitting || saving}
          className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit for grading'}
        </button>
      </div>
      <p className="text-xs text-center text-gray-400">
        Once submitted you cannot edit your answers.
      </p>
    </form>
  )
}
