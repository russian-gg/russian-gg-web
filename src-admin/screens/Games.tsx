import { useState } from 'react'
import { adminFetch, useAdminQuery } from '../lib/api'
import type { AdminGame } from '../lib/types'
import { Badge, Button, Card, EmptyNote, ErrorNote, Loading, PageHeader } from '../components/ui'

/**
 * The switchboard.
 *
 * Every game is off until somebody here turns it on, and a game that is not built cannot be
 * turned on at all — the row says so instead of failing when the switch is pressed. What each
 * game is lives in the app's code; this screen owns one decision per game and nothing else.
 */
export function Games() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminGame[]>('/api/admin-portal/games')
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState('')

  async function setEnabled(game: AdminGame, enabled: boolean) {
    setBusy(game.slug)
    setFailure('')

    try {
      await adminFetch(`/api/admin-portal/games/${game.slug}/enabled?enabled=${enabled}`, {
        method: 'POST',
      })
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.")
    } finally {
      setBusy(null)
    }
  }

  const open = data?.filter((game) => game.isEnabled).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="O'yinlar"
        subtitle="Qaysi o'yin foydalanuvchilarga ochiq — hammasi standart holatda yopiq"
      />

      {error && <ErrorNote>{error}</ErrorNote>}
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {!data && isLoading && <Loading />}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={open > 0 ? 'signal' : 'neutral'}>{open} ta ochiq</Badge>
            <Badge tone="neutral">{data.length} ta jami</Badge>
          </div>

          {/*
            Nothing open is a state worth naming. The learner's menu disappears entirely in
            that case, and somebody looking at this screen should know that is what they did.
          */}
          {open === 0 && (
            <EmptyNote>
              Hozir hech biri ochiq emas — foydalanuvchilarda “O'yinlar” bo'limi umuman
              ko'rinmaydi.
            </EmptyNote>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((game) => (
              <Card key={game.slug} as="div" className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-extrabold text-ink">{game.titleUz}</h2>
                    {game.isEnabled && <Badge tone="milestone">Ochiq</Badge>}
                    {!game.isBuilt && <Badge tone="neutral">Yozilmagan</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{game.bodyUz}</p>
                  <p className="mt-1 font-mono text-xs text-ink-faint">{game.slug}</p>
                </div>

                <Button
                  variant={game.isEnabled ? 'danger' : 'primary'}
                  size="sm"
                  disabled={!game.isBuilt || busy === game.slug}
                  onClick={() => void setEnabled(game, !game.isEnabled)}
                  // The reason a switch cannot be flipped, where the finger already is.
                  title={game.isBuilt ? undefined : "Bu o'yin hali yozilmagan"}
                >
                  {game.isEnabled ? 'Yopish' : 'Ochish'}
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
