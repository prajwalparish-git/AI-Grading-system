'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials.')
        setLoading(false)
        return
      }

      if (data.role !== 'admin') {
        setError('Unauthorized: Admin access required.')
        setLoading(false)
        return
      }

      router.push('/admin')
    } catch {
      setError('An error occurred during sign in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 rounded-xl shadow-2xl border border-slate-800 p-8 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-blue-500" />
        
        <div className="flex items-center space-x-2 mb-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold text-white font-mono">Admin Portal</h1>
        </div>
        
        <p className="text-sm text-slate-400 font-mono mb-8">
          Restricted Area. Authenticate to access evaluation telemetry.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-400 font-mono mb-1">
              Admin Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-colors"
              placeholder="admin@antigravity.dev"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-400 font-mono mb-1">
              Passphrase
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-xs font-mono text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-bold font-mono hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? 'Authenticating...' : 'Authorize'}
          </button>
        </form>
      </div>
    </div>
  )
}
