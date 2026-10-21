import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

interface SekkiInfo {
  number: number
  kanji: string
  romaji: string
  english: string
  startMonth: number
  startDay: number
}

export function SekkiWidget() {
  const [sekki, setSekki] = useState<SekkiInfo | null>(null)

  useEffect(() => {
    apiFetch<SekkiInfo>('/api/sekki/current')
      .then(setSekki)
      .catch(() => {})
  }, [])

  if (!sekki) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-950/80 border border-red-800/50 rounded-lg text-sm">
      <span className="text-2xl leading-none font-bold text-red-200">{sekki.kanji}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-red-100 font-semibold tracking-wide">
          {sekki.romaji} — {sekki.english}
        </span>
        <span className="text-red-300/80 text-xs">
          第{sekki.number}節気 · seasonal period
        </span>
      </div>
      <span className="ml-auto text-red-400 text-xs font-medium tracking-wider uppercase">旬</span>
    </div>
  )
}

/** Badge shown on in-season menu items */
export function ShunBadge() {
  return (
    <span
      title="In season (旬) — at peak freshness this sekki"
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-900 text-red-100
                 text-xs font-bold rounded tracking-wide"
    >
      旬
    </span>
  )
}
