'use client'

import { useState } from 'react'

export default function ApplyPage() {
  const [step, setStep] = useState(1)
  const [usn, setUsn] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Submit Projects State
  const [urls, setUrls] = useState(['', '', ''])
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/apply/lookup-usn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setName(data.name)
      
      // Auto trigger send OTP
      const resOtp = await fetch('/api/apply/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn }),
      })
      const otpData = await resOtp.json()
      if (!resOtp.ok) throw new Error(otpData.error)
      
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/apply/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setApplicationId(data.application_id)
      setStep(3)
    } catch (err: any) {
      setError(err.message || 'Error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitProjects = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const validUrls = urls.filter(u => u.trim() !== '')
    try {
      const res = await fetch('/api/apply/submit-projects', {
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
      setSubmitSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 w-full px-4">
      <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
        
        {step === 1 && (
          <form onSubmit={handleLookup} className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Apply for Coding Club</h1>
              <p className="mt-2 text-sm text-slate-500">Enter your USN to begin the application process.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">University Seat Number</label>
              <input
                type="text"
                required
                value={usn}
                onChange={e => setUsn(e.target.value.toUpperCase())}
                placeholder="e.g. 1RV21CS001"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-slate-900"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verify Identity</h1>
              <p className="mt-2 text-sm text-slate-500">Welcome, {name}. We have sent a 6-digit OTP to your registered email.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enter OTP</label>
              <input
                type="text"
                required
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-slate-900"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Problem Statement & Submission</h1>
              <p className="mt-2 text-sm text-slate-500">Review the problem and submit your GitHub repositories.</p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-sm">
              <h2 className="font-semibold text-slate-900 mb-2">Instructions</h2>
              <p className="text-slate-700">Please read the problem statement here:</p>
              <a href={process.env.NEXT_PUBLIC_PROBLEM_STATEMENT || '#'} target="_blank" className="text-blue-600 underline">
                View Problem Statement
              </a>
            </div>

            {submitSuccess ? (
              <div className="bg-green-50 text-green-800 p-4 rounded-md border border-green-200">
                <h3 className="font-bold mb-1">Application Submitted Successfully!</h3>
                <p className="text-sm">We have emailed you your login credentials. You can use them to sign in to the portal to track your status or edit your projects before the deadline.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitProjects} className="space-y-4">
                <h3 className="font-medium text-slate-900">Submit GitHub Projects (2-3)</h3>
                {[0, 1, 2].map(index => (
                  <div key={index}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Project {index + 1} URL {index === 2 && '(Optional)'}</label>
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900"
                    />
                  </div>
                ))}
                
                {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 mt-4"
                >
                  {loading ? 'Submitting...' : 'Submit Projects'}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
