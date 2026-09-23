import { useEffect, useRef, useState } from 'react'
import { Lock, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import type { SearchResultView } from '../../lib/types'

/** Matches the server's own floor, so the client never asks a question it knows returns nothing. */
const MIN_TERM_LENGTH = 2

/** Long enough that a normal typing rhythm produces one request per word, not one per key. */
const DEBOUNCE_MS = 250

/**
 * Type-ahead over the course.
 *
 * The results panel is deliberately a plain list rather than a combobox with roving focus: it
 * is eight items at most, every one of them a link, and a learner reaching for the mouse or
 * pressing Tab gets the behaviour they already know from the rest of the page.
 */
export function DashboardSearch() {
  const t = useT()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [term])

  // A click anywhere else is a dismissal. Listening on the document rather than on blur keeps
  // the panel open while the pointer travels from the field to a result.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const enabled = debounced.length >= MIN_TERM_LENGTH
  const { data, isFetching } = useQuery({
    queryKey: ['course-search', debounced],
    queryFn: () => api.get<SearchResultView[]>(`/course/search?q=${encodeURIComponent(debounced)}`),
    enabled,
    staleTime: 30_000,
  })

  const results = enabled ? (data ?? []) : []

  function go(result: SearchResultView) {
    setOpen(false)
    setTerm('')
    // A locked lesson still has somewhere to send the learner: the day it belongs to, on the
    // path, where the reason it is locked is visible.
    if (result.kind === 'Mission' && result.slug && !result.isLocked) {
      navigate(`/missions/${result.slug}`)
      return
    }
    navigate(result.courseDay ? `/path?day=${result.courseDay}` : '/path')
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block">
        <span className="sr-only">{t.home.search.label}</span>
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint">
          <SearchGlyph />
        </span>
        <input
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={t.home.search.placeholder}
          className="h-12 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised pr-4 pl-12 text-[15px] text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
        />
      </label>

      {open && enabled && (
        <div
          role="listbox"
          aria-label={t.home.search.label}
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised shadow-xl"
        >
          {results.length === 0 ? (
            <p className="text-support px-4 py-3.5 text-sm">
              {isFetching ? t.common.loading : t.home.search.noResults}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((result) => (
                <li key={`${result.kind}-${result.missionId ?? result.courseDay}`}>
                  <button
                    type="button"
                    onClick={() => go(result)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ground-sunken"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {result.titleUz}
                      </span>
                      {result.subtitleUz && (
                        <span className="text-support block truncate text-xs">
                          {result.subtitleUz}
                        </span>
                      )}
                    </span>
                    {result.courseDay != null && (
                      <span className="text-support shrink-0 text-xs font-semibold">
                        {t.home.search.day.replace('{day}', String(result.courseDay))}
                      </span>
                    )}
                    {result.isLocked && (
                      <span className="shrink-0 text-ink-faint" aria-label={t.path.locked}>
                        <LockGlyph />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SearchGlyph() {
  return (
    <Search aria-hidden="true" strokeWidth={2} className="size-5" />
  )
}

function LockGlyph() {
  return (
    <Lock aria-hidden="true" strokeWidth={2} className="size-4" />
  )
}
