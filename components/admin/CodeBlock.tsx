'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface TokenSpan {
  text: string
  color: string
}

// Lightweight regex-based tokenizer — no external deps
function tokenizeRust(code: string): TokenSpan[] {
  const tokens: TokenSpan[] = []
  const lines = code.split('\n')

  const RUST_KEYWORDS = /\b(use|pub|struct|impl|fn|let|mut|async|await|for|in|loop|if|else|match|return|Ok|Err|Some|None|Arc|Box|Vec|HashMap|self|Self|where|type|trait|enum|const|static|mod|crate|super|true|false|move|ref|dyn|unsafe|extern|break|continue)\b/g
  const TS_KEYWORDS   = /\b(import|export|interface|class|type|const|let|var|function|async|await|return|new|this|extends|implements|from|of|in|for|if|else|true|false|null|undefined|readonly|abstract|private|public|protected|static|typeof|keyof|never|void|any|unknown|string|number|boolean)\b/g
  const COMMENT_LINE  = /^(\s*\/\/.*)$/gm
  const STRING_LIT    = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g
  const NUMBER_LIT    = /\b(\d+(?:\.\d+)?)\b/g
  const TYPE_IDENT    = /\b([A-Z][A-Za-z0-9_]*)\b/g
  const PUNCT         = /(->|=>|::|[{}()\[\]<>,;:.])/g

  const raw = code

  // We'll do a character-level walk with regex match positions
  type Match = { start: number; end: number; color: string; text: string }
  const matches: Match[] = []

  const addMatches = (re: RegExp, color: string) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, color, text: m[0] })
    }
  }

  // Order matters: earlier pushes have lower priority → later ones override if overlapping
  addMatches(TYPE_IDENT,   '#c3a6ff')   // purple — types/structs
  addMatches(NUMBER_LIT,   '#f78c6c')   // orange — numbers
  addMatches(PUNCT,        '#89ddff')   // cyan — punctuation/operators
  addMatches(RUST_KEYWORDS, '#ff7edb')  // pink — keywords
  addMatches(TS_KEYWORDS,   '#ff7edb')  // pink — keywords
  addMatches(STRING_LIT,   '#c3e88d')   // green — strings
  addMatches(COMMENT_LINE, '#546e7a')   // grey — comments

  // Sort by start position, prefer longer matches on ties
  matches.sort((a, b) => a.start - b.start || b.end - a.end)

  // Merge: walk through, pick non-overlapping matches
  const selected: Match[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start < cursor) continue
    selected.push(m)
    cursor = m.end
  }

  // Fill gaps with plain text
  cursor = 0
  for (const m of selected) {
    if (m.start > cursor) {
      tokens.push({ text: raw.slice(cursor, m.start), color: '#cdd3de' })
    }
    tokens.push({ text: m.text, color: m.color })
    cursor = m.end
  }
  if (cursor < raw.length) {
    tokens.push({ text: raw.slice(cursor), color: '#cdd3de' })
  }

  return tokens
}

interface CodeBlockProps {
  code: string
  language: string
  className?: string
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const lines = code.split('\n')
  const tokens = tokenizeRust(code)

  // Re-split tokens into per-line buckets
  let flatText = ''
  const tokenList = tokens.map(t => { const s = flatText.length; flatText += t.text; return { ...t, start: s } })

  return (
    <div className={cn('relative h-full flex flex-col font-mono text-xs bg-[#0d1117] rounded-lg overflow-hidden border border-slate-800/80', className)}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-[#161b22]">
        <div className="flex items-center space-x-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/80" />
          <span className="h-3 w-3 rounded-full bg-amber-500/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-400 font-mono">{language.toLowerCase()}</span>
          <span className="text-[10px] text-slate-500 font-mono">{lines.length} lines</span>
        </div>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="flex-1 overflow-auto p-0">
        <table className="w-full border-collapse text-[11px] leading-5">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/[0.03] group">
                <td className="select-none text-right pr-4 pl-4 py-0 text-slate-600 w-10 shrink-0 border-r border-slate-800/60 group-hover:text-slate-500">
                  {idx + 1}
                </td>
                <td className="pl-4 pr-6 py-0 whitespace-pre-wrap break-all">
                  <CodeLine line={line} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Per-line inline tokenizer (simple, fast)
function CodeLine({ line }: { line: string }) {
  if (!line.trim()) return <span>&nbsp;</span>

  // Comment line
  if (/^\s*(\/\/)/.test(line)) {
    return <span style={{ color: '#546e7a' }}>{line}</span>
  }

  const parts: React.ReactNode[] = []
  const PATTERNS: [RegExp, string][] = [
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '#c3e88d'],
    [/\b(use|pub|struct|impl|fn|let|mut|async|await|for|in|loop|if|else|match|return|Ok|Err|Some|None|Arc|Box|Vec|HashMap|self|Self|where|type|trait|enum|const|static|mod|import|export|interface|class|from|of|readonly|abstract|private|public|protected|static|typeof|keyof|never|void|any|unknown|new|this|extends|implements|true|false|null|undefined)\b/g, '#ff7edb'],
    [/\b([A-Z][A-Za-z0-9_<>]*)\b/g, '#c3a6ff'],
    [/\b(\d+(?:\.\d+)?)\b/g, '#f78c6c'],
    [/(->|=>|::|[{}()\[\]<>])/g, '#89ddff'],
  ]

  type Seg = { start: number; end: number; color: string }
  const segs: Seg[] = []

  for (const [re, color] of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      segs.push({ start: m.index, end: m.index + m[0].length, color })
    }
  }

  segs.sort((a, b) => a.start - b.start || b.end - a.end)
  const used: Seg[] = []
  let cur = 0
  for (const seg of segs) {
    if (seg.start < cur) continue
    used.push(seg)
    cur = seg.end
  }

  cur = 0
  for (let i = 0; i < used.length; i++) {
    const seg = used[i]
    if (seg.start > cur) parts.push(<span key={`plain-${i}`} style={{ color: '#cdd3de' }}>{line.slice(cur, seg.start)}</span>)
    parts.push(<span key={`tok-${i}`} style={{ color: seg.color }}>{line.slice(seg.start, seg.end)}</span>)
    cur = seg.end
  }
  if (cur < line.length) parts.push(<span key="tail" style={{ color: '#cdd3de' }}>{line.slice(cur)}</span>)

  return <>{parts}</>
}
