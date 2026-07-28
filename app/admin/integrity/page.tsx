import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function IntegrityPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Count events per user, ordered by most suspicious
  const { data: events } = await supabase
    .from('integrity_events')
    .select('user_id, type, at, payload')
    .order('at', { ascending: false })

  // Aggregate per user
  const byUser = new Map<string, { types: Record<string, number>; lastAt: string }>()
  for (const e of events ?? []) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, { types: {}, lastAt: e.at })
    const agg = byUser.get(e.user_id)!
    agg.types[e.type] = (agg.types[e.type] ?? 0) + 1
    if (e.at > agg.lastAt) agg.lastAt = e.at
  }

  // Fetch user profiles for flagged user_ids
  const userIds = [...byUser.keys()]
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('users').select('id, name, email').in('id', userIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const rows = [...byUser.entries()]
    .map(([uid, agg]) => ({
      uid,
      profile: profileMap.get(uid),
      total: Object.values(agg.types).reduce((a, b) => a + b, 0),
      types: agg.types,
      lastAt: agg.lastAt,
    }))
    .sort((a, b) => b.total - a.total)

  const severityColor = (total: number) => {
    if (total >= 10) return 'text-red-600 bg-red-50'
    if (total >= 3) return 'text-yellow-700 bg-yellow-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrity Flags</h1>
            <p className="text-sm text-gray-500 mt-1">Paste, copy, cut, blur, and fast-type events per applicant</p>
          </div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          Events are a signal, not a verdict. High counts may indicate paste attempts. The AI grader cross-checks claimed process vs the actual repo.
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total events</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Breakdown</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.uid} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{row.profile?.name ?? row.uid.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{row.profile?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${severityColor(row.total)}`}>
                      {row.total}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {Object.entries(row.types).map(([t, n]) => `${t}×${n}`).join(' · ')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(row.lastAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No integrity events recorded.</div>
          )}
        </div>
      </div>
    </main>
  )
}
