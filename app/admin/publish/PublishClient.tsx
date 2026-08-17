'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, Plus, Trash } from 'lucide-react'

export default function PublishClient({ initialData }: { initialData: any[] }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  // Derive initial global state from the first app (if any) since they're globally applied usually
  const sampleApp = data.find(d => d.published_questions !== null)
  const initialQuestions = sampleApp?.published_questions || []
  const initialScoresPublished = sampleApp?.scores_published || false

  const [questions, setQuestions] = useState<string[]>(initialQuestions)
  const [publishScores, setPublishScores] = useState<boolean>(initialScoresPublished)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(
    data.filter(d => d.selection_status === 'selected').map(d => d.id)
  ))

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleAddQuestion = () => {
    if (questions.length < 5) setQuestions([...questions, ''])
  }

  const handleQuestionChange = (index: number, val: string) => {
    const newQ = [...questions]
    newQ[index] = val
    setQuestions(newQ)
  }

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handlePublish = async () => {
    if (!confirm('Are you sure you want to publish these results? This will immediately affect what students see on their portal.')) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedApplicationIds: Array.from(selectedIds),
          questions: questions.filter(q => q.trim().length > 0),
          publishScores
        })
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('Results published successfully!')
        router.refresh()
      } else {
        toast.error(`Failed to publish: ${result.error}`)
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Left Column: Config */}
      <div className="space-y-6">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white mb-4">Result Configuration</h2>
          
          <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
            <input 
              type="checkbox" 
              checked={publishScores}
              onChange={e => setPublishScores(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
            />
            <div>
              <p className="text-sm font-medium text-white">Publish Scores</p>
              <p className="text-xs text-slate-400">Allow students to see their actual AI evaluation scores</p>
            </div>
          </label>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Follow-up Questions</h2>
              <p className="text-xs text-slate-400">Ask selected students for more details (max 5)</p>
            </div>
            {questions.length < 5 && (
              <button onClick={handleAddQuestion} className="p-1.5 bg-blue-600/10 text-blue-400 rounded hover:bg-blue-600/20">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={q}
                  onChange={e => handleQuestionChange(i, e.target.value)}
                  placeholder={`Question ${i + 1}`}
                  className="flex-1 min-h-[60px] p-2 bg-slate-950 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
                <button onClick={() => handleRemoveQuestion(i)} className="p-2 h-fit text-slate-500 hover:text-red-400">
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            ))}
            {questions.length === 0 && (
              <div className="p-4 text-center border border-dashed border-slate-700 rounded-lg text-sm text-slate-500">
                No questions added.
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handlePublish}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Publishing...' : 'Publish Results Live'}
        </button>

      </div>

      {/* Right Column: Applicants list */}
      <div className="xl:col-span-2">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full max-h-[800px]">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <h2 className="text-sm font-bold text-white">Select Candidates</h2>
            <span className="text-xs font-mono text-slate-400">{selectedIds.size} Selected</span>
          </div>
          
          <div className="overflow-y-auto p-2">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2 w-10">Sel</th>
                  <th className="px-4 py-2">Candidate</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.map(app => (
                  <tr 
                    key={app.id} 
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${selectedIds.has(app.id) ? 'bg-blue-500/5' : ''}`}
                    onClick={() => handleToggleSelect(app.id)}
                  >
                    <td className="px-4 py-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center
                        ${selectedIds.has(app.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-950'}
                      `}>
                        {selectedIds.has(app.id) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-white">{app.roster?.usn}</div>
                      <div className="text-xs text-slate-400">{app.roster?.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono bg-slate-800 text-slate-400">
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No active applications available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  )
}
