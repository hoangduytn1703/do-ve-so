import { useState } from 'react'

export default function CopyButton({
  text,
  label = 'Copy',
}: {
  text: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Trình duyệt cũ hoặc không cấp quyền clipboard
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button className="btn-copy" onClick={copy} title={`Copy: ${text}`}>
      {copied ? '✓ Đã copy' : `📋 ${label}`}
    </button>
  )
}
