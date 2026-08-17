import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Audit Log - Admin',
}

export default async function AuditPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/login')
  }

  // Fetch recent audit logs joined with the user who performed them
  const { data: logs, error } = await supabase
    .from('audit_log')
    .select(`
      id,
      action,
      payload,
      created_at,
      actor_user_id
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  // Supabase auth.users cannot be joined directly in a standard select easily via public schema
  // so we will just display the actor_user_id if needed, but since it's just an audit trail, 
  // action and payload are most important. We can do a quick fetch of emails via admin api if needed,
  // but showing the raw data is sufficient for an audit log.

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Audit Log</h1>
        <p className="text-slate-400 text-sm mt-1">Read-only trail of administrative and significant system actions.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor ID</th>
                <th className="px-4 py-3">Details (Payload)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-[120px]">
                    {(log as any).actor_user_id || 'System'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 break-words max-w-md">
                    {JSON.stringify(log.payload)}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-sans">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
