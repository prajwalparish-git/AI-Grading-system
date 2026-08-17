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
      setStep(3)
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
              <p className="mt-2 text-sm text-slate-500">Enter your USN to begin the verification process.</p>
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

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Identity Verified</h1>
              <p className="mt-2 text-sm text-slate-500">Your application record has been created.</p>
            </div>
            
            <div className="bg-green-50 text-green-800 p-6 rounded-md border border-green-200 text-center">
              <h3 className="font-bold mb-2">Check Your Email</h3>
              <p className="text-sm">We have emailed you your login credentials. Use them to log in and submit your GitHub repositories before the deadline.</p>
            </div>
            
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
