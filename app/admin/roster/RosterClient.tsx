'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function RosterClient({ initialData }: { initialData: any[] }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ usn: '', name: '', email: '', batch: '' })

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<any>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/roster?search=${encodeURIComponent(search)}`)
      const result = await res.json()
      if (res.ok) setData(result.roster || [])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow)
      })
      if (res.ok) {
        setShowAdd(false)
        setNewRow({ usn: '', name: '', email: '', batch: '' })
        router.refresh()
        handleSearch(e) // reload
      } else {
        const err = await res.json()
        toast.error(err.error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/roster/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRow)
      })
      if (res.ok) {
        setEditId(null)
        setEditRow(null)
        router.refresh()
        const updated = await res.json()
        setData(data.map(d => d.id === editId ? updated.data : d))
      } else {
        const err = await res.json()
        toast.error(err.error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this student?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/roster/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setData(data.map(d => d.id === id ? { ...d, is_active: false } : d))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/api/admin/roster/upload', {
          method: 'POST',
          body: formData
        })
        const result = await res.json()
        if (res.ok) {
          toast.success(`Successfully uploaded ${result.count} records.`)
          router.refresh()
          window.location.reload()
        } else {
          toast.error(`Upload failed: ${result.error}`)
        }
      } finally {
        setLoading(false)
      }
    }
    input.click()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search USN, Name, Email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-800 text-slate-200 text-sm font-medium rounded-md hover:bg-slate-700">
            Search
          </button>
        </form>

        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-500">
            Add Single
          </button>
          <button onClick={handleUploadClick} disabled={loading} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium rounded-md hover:bg-slate-700">
            Upload CSV
          </button>
          <a href="/api/admin/roster/template" className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium rounded-md hover:bg-slate-700 flex items-center">
            Template
          </a>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">USN</label>
            <input required type="text" value={newRow.usn} onChange={e => setNewRow({ ...newRow, usn: e.target.value.toUpperCase() })} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
            <input required type="text" value={newRow.name} onChange={e => setNewRow({ ...newRow, name: e.target.value })} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <input required type="email" value={newRow.email} onChange={e => setNewRow({ ...newRow, email: e.target.value })} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Batch</label>
            <input type="text" value={newRow.batch} onChange={e => setNewRow({ ...newRow, batch: e.target.value })} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-sm text-white" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-500">Save</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-1.5 bg-slate-800 text-slate-300 text-sm font-medium rounded-md hover:bg-slate-700">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">USN</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/30">
                  {editId === row.id ? (
                    <td colSpan={6} className="px-4 py-3">
                      <form onSubmit={handleUpdate} className="flex flex-wrap gap-4 items-end w-full">
                        <div>
                          <input required type="text" value={editRow.usn} onChange={e => setEditRow({ ...editRow, usn: e.target.value.toUpperCase() })} className="w-32 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-white" />
                        </div>
                        <div>
                          <input required type="text" value={editRow.name} onChange={e => setEditRow({ ...editRow, name: e.target.value })} className="w-40 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-white" />
                        </div>
                        <div>
                          <input required type="email" value={editRow.email} onChange={e => setEditRow({ ...editRow, email: e.target.value })} className="w-48 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-white" />
                        </div>
                        <div>
                          <input type="text" value={editRow.batch} onChange={e => setEditRow({ ...editRow, batch: e.target.value })} className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400">Active</label>
                          <input type="checkbox" checked={editRow.is_active} onChange={e => setEditRow({ ...editRow, is_active: e.target.checked })} />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500">Save</button>
                          <button type="button" onClick={() => setEditId(null)} className="px-3 py-1 bg-slate-700 text-slate-200 text-xs rounded hover:bg-slate-600">Cancel</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono font-medium text-white">{row.usn}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.email}</td>
                      <td className="px-4 py-3">{row.batch || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => { setEditId(row.id); setEditRow({ ...row }) }} className="text-blue-400 hover:underline text-xs">Edit</button>
                        {row.is_active && <button onClick={() => handleDelete(row.id)} className="text-red-400 hover:underline text-xs">Deactivate</button>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
