'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminsClient({ initialAdmins }: { initialAdmins: any[] }) {
  const router = useRouter()
  const [admins, setAdmins] = useState(initialAdmins)
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/invite-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail })
      })
      const result = await res.json()
      if (res.ok) {
        alert('Admin invitation sent!')
        setInviteEmail('')
        router.refresh()
        // Wait for refresh to bring new data, or we can't easily add without ID
      } else {
        alert(`Invite failed: ${result.error}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this admin? They will lose all admin privileges.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/revoke-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id })
      })
      const result = await res.json()
      if (res.ok) {
        setAdmins(admins.filter(a => a.id !== id))
        router.refresh()
      } else {
        alert(`Revoke failed: ${result.error}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Admins List */}
      <div className="md:col-span-2 space-y-4">
        <h2 className="text-lg font-bold text-white">Current Administrators</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Last Sign In</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {admin.email}
                        {admin.is_current_user && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {admin.last_sign_in_at ? new Date(admin.last_sign_in_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!admin.is_current_user && (
                        <button
                          onClick={() => handleRevoke(admin.id)}
                          disabled={loading}
                          className="text-red-400 hover:underline text-xs disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No administrators found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invite Form */}
      <div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sticky top-6">
          <h3 className="text-sm font-bold text-white mb-4">Invite New Admin</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Inviting...' : 'Send Invitation'}
            </button>
          </form>
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <p className="text-xs text-blue-400">
              Invited users will receive an email with a secure link to set up their password and log in. They will have full access to this control center.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
