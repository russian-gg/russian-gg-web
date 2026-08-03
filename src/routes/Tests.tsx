import { Badge, EmptyState } from '../components/ui'

/**
 * Announced before it exists, on purpose: the nav entry carries a "New" chip, so landing on
 * an unexplained blank screen would read as a bug. The page says plainly that the content is
 * coming and promises nothing about when.
 */
export function Tests() {
  return (
    <div className="space-y-7">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="signal">New</Badge>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Testlar</h1>
      </header>

      <EmptyState
        title="Tayyorlanmoqda"
        body="Tez orada sizga bir dunyo testlar ko'rinadi."
      />
    </div>
  )
}
