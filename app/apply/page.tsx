'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApplyPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [usn, setUsn] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/student/verify-usn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
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
      const res = await fetch('/api/student/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, code: otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      // Clear any existing admin Supabase session
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.auth.signOut()

      // Redirect straight to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 w-full px-4">
      <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
        
        {step === 1 && (
          <form onSubmit={handleLookup} className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Portal Login / Apply</h1>
              <p className="mt-2 text-sm text-slate-500">Enter your USN below to apply or log in to your existing application.</p>
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
              {loading ? 'Processing...' : 'Verify USN'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verify Identity</h1>
              <p className="mt-2 text-sm text-slate-500">We have sent a 6-digit OTP to your registered email.</p>
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

      </div>
    </div>
  )
}
