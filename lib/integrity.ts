'use client'

// Attach paste/copy/cut/blur monitoring to a textarea element.
// Events are fired to /api/integrity; the actual block is done via preventDefault.
export function attachIntegrityListeners(
  element: HTMLTextAreaElement,
  fieldName: string,
  userId: string
) {
  const send = (type: string, extra?: Record<string, unknown>) => {
    fetch('/api/integrity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, field: fieldName, userId, ...extra }),
      keepalive: true,
    }).catch(() => {})
  }

  const block = (e: Event, type: string) => {
    e.preventDefault()
    e.stopPropagation()
    send(type, { field: fieldName })
  }

  let lastLength = 0
  let lastTime = Date.now()

  const handleInput = () => {
    const now = Date.now()
    const delta = element.value.length - lastLength
    const elapsed = now - lastTime
    // Flag if >50 chars appear in under 200ms — likely paste via devtools
    if (delta > 50 && elapsed < 200) {
      send('fast_paste', { delta, elapsed_ms: elapsed })
    }
    lastLength = element.value.length
    lastTime = now
  }

  const handleBlur = () => send('blur')

  element.addEventListener('paste', (e) => block(e, 'paste'))
  element.addEventListener('copy', (e) => block(e, 'copy'))
  element.addEventListener('cut', (e) => block(e, 'cut'))
  element.addEventListener('contextmenu', (e) => e.preventDefault())
  element.addEventListener('input', handleInput)
  element.addEventListener('blur', handleBlur)

  // Block Ctrl/Cmd+V, C, X
  element.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      send(e.key.toLowerCase() === 'v' ? 'paste' : e.key.toLowerCase() === 'c' ? 'copy' : 'cut')
    }
  })

  return () => {
    element.removeEventListener('input', handleInput)
    element.removeEventListener('blur', handleBlur)
  }
}
