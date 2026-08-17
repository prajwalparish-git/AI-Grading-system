'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { toast } from 'sonner'

export default function DashboardClient({ application, projects }: { application: any, projects: any[] }) {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Submitting projects state
  const [urls, setUrls] = useState(() => {
    const initUrls = ['', '', '']
    projects.forEach(p => {
      if (p.slot >= 1 && p.slot <= 3) {
        initUrls[p.slot - 1] = p.repo_url
      }
    })
    return initUrls
  })
  const [submitLoading, setSubmitLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  
  // Edit logic
  const isPastDeadline = application.edit_deadline ? new Date() > new Date(application.edit_deadline) : false
  const [isEditing, setIsEditing] = useState(application.status !== 'submitted')

  // Message dev state
  const [message, setMessage] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)

  // Problem statement & questions
  const problemStatementUrl = process.env.NEXT_PUBLIC_PROBLEM_STATEMENT
  const publishedQuestions = Array.isArray(application.published_questions) 
    ? application.published_questions.slice(0, 5) 
    : []

  const handleSignOut = async () => {
    await fetch('/api/student/signout', { method: 'POST' })
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSubmitProjects = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitLoading(true)

    const validUrls = urls.filter(u => u.trim() !== '')
    try {
      const res = await fetch('/api/student/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Your session has expired. Please log in again.')
        }
        if (data.failedRepos) {
          throw new Error(data.error + ' ' + data.failedRepos.join(', '))
        }
        throw new Error(data.error)
      }
      toast.success('Projects updated successfully.')
      setIsEditing(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error occurred')
    } finally {
      setSubmitLoading(false)
    }
  }



  const handleWithdraw = async () => {
    if (!confirm('Are you sure you want to withdraw your application? This action cannot be undone.')) return
    
    setWithdrawLoading(true)
    try {
      const res = await fetch('/api/student/withdraw', { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Application withdrawn successfully.')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error occurred')
      setWithdrawLoading(false)
    }
  }

  const handleMessageDev = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsgLoading(true)

    try {
      const res = await fetch('/api/student/message-developer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Message sent successfully. We will reply to your email.')
      setMessage('')
    } catch (err: any) {
      toast.error(err.message || 'Error occurred')
    } finally {
      setMsgLoading(false)
    }
  }

  const isWithdrawn = application.status === 'withdrawn'

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => router.push('/results')}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors"
        >
          View Results
        </button>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Problem Statement & Questions */}
        {(problemStatementUrl || publishedQuestions.length > 0) && (
          <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-indigo-900 mb-4">Problem Statement & Questions</h2>
            
            {problemStatementUrl && (
              <div className="mb-6">
                <p className="text-sm text-indigo-800 mb-3">
                  Please review the full problem statement and requirements before beginning your project.
                </p>
                <a 
                  href={problemStatementUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  View Problem Statement
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            )}

            {publishedQuestions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wider">Required Questions</h3>
                <ul className="space-y-3">
                  {publishedQuestions.map((q: string, idx: number) => (
                    <li key={idx} className="bg-white p-3 rounded-lg border border-indigo-100 text-sm text-indigo-900 flex gap-3 shadow-sm">
                      <span className="font-bold text-indigo-400 shrink-0">Q{idx + 1}.</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Projects Form */}
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Your Repositories</h2>
            {application.status === 'submitted' && !isEditing && !isWithdrawn && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={isPastDeadline}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {isPastDeadline ? 'Edit window closed' : 'Edit Links'}
              </button>
            )}
          </div>
          <form onSubmit={handleSubmitProjects} className="space-y-4">
            {[0, 1, 2].map(index => {
              const proj = projects.find(p => p.slot === index + 1)
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Project {index + 1} URL {index === 2 && '(Optional)'}</label>
                    {proj && (
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize 
                        ${proj.fetch_status === 'ok' ? 'bg-green-100 text-green-700' : ''}
                        ${proj.fetch_status === 'failed' ? 'bg-red-100 text-red-700' : ''}
                        ${proj.fetch_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                      `}>
                        {proj.fetch_status}
                      </span>
                    )}
                  </div>
                  <input
                    type="url"
                    required={index < 2}
                    value={urls[index]}
                    onChange={e => {
                      const newUrls = [...urls]
                      newUrls[index] = e.target.value
                      setUrls(newUrls)
                    }}
                    placeholder="https://github.com/owner/repo"
                    disabled={isWithdrawn || !isEditing}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              )
            })}
            
            {isEditing && (
              <button
                type="submit"
                disabled={submitLoading || isWithdrawn || isPastDeadline}
                className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 mt-4"
              >
                {submitLoading ? 'Submitting...' : 'Save Projects'}
              </button>
            )}

            {application.edit_deadline && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                Deadline: {new Date(application.edit_deadline).toLocaleString()}
              </p>
            )}
          </form>
        </div>

        <div className="space-y-6">
          {/* Security */}
          <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Security</h2>
            <p className="text-sm text-slate-600 mb-4">Keep your account secure by updating your password regularly.</p>
            <button
              onClick={() => router.push('/dashboard/change-password')}
              className="bg-slate-900 text-white px-4 py-2 rounded-md font-medium hover:bg-slate-800 text-sm"
            >
              Change Password
            </button>
          </div>

          {/* Message Developer */}
          <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Message Developer</h2>
            <form onSubmit={handleMessageDev} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Message</label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Need help with something?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={msgLoading}
                className="bg-slate-900 text-white px-4 py-2 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 text-sm"
              >
                {msgLoading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Withdraw Application */}
          <div className="bg-red-50 p-6 border border-red-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-red-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-700 mb-4">Withdrawing your application removes you from the current coding club admission cycle.</p>
            <button
              onClick={handleWithdraw}
              disabled={withdrawLoading || isWithdrawn}
              className="bg-red-600 text-white px-4 py-2 rounded-md font-medium hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              {isWithdrawn ? 'Application Withdrawn' : (withdrawLoading ? 'Processing...' : 'Withdraw Application')}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
