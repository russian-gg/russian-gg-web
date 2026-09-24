import { useLocation } from 'react-router-dom'
import { Reveal, Sequence } from '../components/motion'
import { stagger } from '../lib/motion'
import { useAuth } from '../lib/auth-context'
import { useT } from '../lib/i18n'
import { TabLinks } from '../components/ui'
import { ProfileSettings } from './settings/ProfileSettings'
import { GeneralSettings } from './settings/GeneralSettings'
import { SubscriptionSettings } from './settings/SubscriptionSettings'

/**
 * Everything about the account, in one place, behind three tabs.
 *
 * Profile, billing and settings used to be three destinations in the account menu covering
 * one subject, so "where do I change my plan?" had three plausible answers and two wrong
 * ones. Each tab keeps its own URL — a tab that cannot be reloaded, linked or reached with
 * the back button is a tab in name only.
 *
 * This file is the shell and nothing else: the title, the tabs, and which panel is up. The
 * three panels live beside it in `settings/`, because each one is a screen's worth of work
 * and they share no state — only the URL that chooses between them.
 */
const TAB_PROFILE = '/settings'
const TAB_GENERAL = '/settings/general'
const TAB_BILLING = '/settings/billing'

export function Settings() {
  const t = useT()
  const { pathname } = useLocation()

  const tabs = [
    { to: TAB_PROFILE, label: t.settings.tabProfile },
    { to: TAB_GENERAL, label: t.settings.tabGeneral },
    { to: TAB_BILLING, label: t.settings.tabBilling },
  ]

  const active = tabs.some((tab) => tab.to === pathname) ? pathname : TAB_PROFILE

  return (
    <Sequence gap={stagger.tight} className="space-y-6">
      <Reveal as="section">
        <SettingsHeader />
      </Reveal>

      <Reveal>
        <TabLinks tabs={tabs} active={active} />
      </Reveal>

      {/*
        Keyed on the active tab so switching re-runs the entrance. Without the key React sees
        one element whose props changed and swaps the contents in place, which reads as the
        panel being overwritten rather than as a different panel arriving.

        `drive` is not optional here, and it is the one place on this screen that needs it.
        A `Reveal` inside a `Sequence` carries no `initial`/`animate` of its own — it is moved
        by the variants the `Sequence` propagates, and a `Sequence` propagates them once, when
        it mounts. This child outlives that moment: changing the key remounts it under a
        parent whose `animate` has not changed since it finished, so nothing tells the new
        panel to move. It mounted at `fadeUp`'s hidden state — `opacity: 0` — and stayed
        there, present in the DOM and focusable but invisible, until a reload remounted the
        whole tree. Owning its own entrance means it animates on every mount, which is what
        "re-runs the entrance" was supposed to mean.

        The delay is the two beats the header and the tabs take, so the staircase on first
        paint survives the panel stepping out of the `Sequence`'s stagger.
      */}
      <Reveal key={active} drive delay={stagger.tight * 2}>
        {active === TAB_PROFILE && <ProfileSettings />}
        {active === TAB_GENERAL && <GeneralSettings />}
        {active === TAB_BILLING && <SubscriptionSettings />}
      </Reveal>
    </Sequence>
  )
}

/**
 * The page's own title, and who is signed in.
 *
 * No banner and no artwork. Every other screen in the product opens on the thing it is for —
 * Home on the lesson, the path on the days — and a settings screen is for a list of controls.
 * A picture above them would only be something to scroll past on the way to a toggle.
 */
function SettingsHeader() {
  const t = useT()
  const { user } = useAuth()

  return (
    <header>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.settings.title}</h1>
      <p className="text-support mt-1 truncate">{user?.email ?? user?.phoneNumber}</p>
    </header>
  )
}
