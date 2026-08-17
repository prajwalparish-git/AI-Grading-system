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
  
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  // Message dev state
  const [message, setMessage] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)

  const handleSignOut = async () => {
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
        if (data.failedRepos) {
          throw new Error(data.error + ' ' + data.failedRepos.join(', '))
        }
        throw new Error(data.error)
      }
      toast.success('Projects updated successfully.')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error occurred')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password changed successfully.')
      setNewPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Error occurred')
    } finally {
      setPasswordLoading(false)
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
        
        {/* Projects Form */}
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Submit Projects</h2>
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
                    disabled={isWithdrawn}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900"
                  />
                </div>
              )
            })}
            
            <button
              type="submit"
              disabled={submitLoading || isWithdrawn}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 mt-4"
            >
              {submitLoading ? 'Submitting...' : 'Save Projects'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {/* Change Password */}
          <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="bg-slate-900 text-white px-4 py-2 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 text-sm"
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
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
