'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApplicationsClient({ initialData }: { initialData: any[] }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [loadingAppId, setLoadingAppId] = useState<string | null>(null)

  const handleGrade = async (appId: string) => {
    setLoadingAppId(appId)
    try {
      const res = await fetch('/api/admin/grade-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId })
      })
      const result = await res.json()
      if (res.ok) {
        alert('Grading completed successfully!')
        router.refresh()
        // Optimistically update status
        setData(data.map(d => d.id === appId ? { ...d, status: 'graded' } : d))
      } else {
        alert(`Grading failed: ${result.error}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoadingAppId(null)
    }
  }

  const filteredData = data.filter(row => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      row.roster?.usn?.toLowerCase().includes(term) ||
      row.roster?.name?.toLowerCase().includes(term) ||
      row.roster?.email?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="Search USN, Name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="text-sm text-slate-400">
          Total: {filteredData.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">USN & Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Selection</th>
                <th className="px-4 py-3">Projects</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredData.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="font-mono text-white font-medium">{row.roster?.usn}</div>
                    <div className="text-xs text-slate-400">{row.roster?.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                      ${row.status === 'verified' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
                      ${row.status === 'submitted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
                      ${row.status === 'withdrawn' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
                      ${row.status === 'graded' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : ''}
                      ${row.status === 'pending_otp' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : ''}
                    `}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.selection_status ? (
                      <span className={`capitalize ${row.selection_status === 'selected' ? 'text-green-400' : 'text-red-400'}`}>
                        {row.selection_status}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.projects && row.projects.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {row.projects.map((p: any) => (
                          <a key={p.id} href={p.repo_url} target="_blank" title={p.repo_url} className={`w-2 h-2 rounded-full ${p.fetch_status === 'ok' ? 'bg-green-500' : p.fetch_status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'submitted' && (
                      <button
                        onClick={() => handleGrade(row.id)}
                        disabled={loadingAppId === row.id}
                        className="px-3 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-medium rounded transition-colors disabled:opacity-50"
                      >
                        {loadingAppId === row.id ? 'Grading...' : 'Verify & Grade'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
