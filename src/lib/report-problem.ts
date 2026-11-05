import { createContext, useContext, useEffect } from 'react'

/**
 * What a learner can report, as the stable keys the server stores. The labels are the
 * learner's language (`help.kinds`); the admin panel maps the same keys to its own.
 */
export const ISSUE_KINDS = ['bug', 'voice', 'payment', 'content', 'idea', 'other'] as const
export type IssueKind = (typeof ISSUE_KINDS)[number]

/** The form's attachment limit, and the server's (`RequestFormLimits` on the endpoint). */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

/**
 * Where the learner was when they pressed report, said the way they would say it
 * ("5-dars · AI savol 2/3"). `detail` is what went wrong when an error screen opens it, and
 * `kind` preselects the topic, so a learner looking at a microphone error is not asked
 * whether this is about the microphone.
 */
export interface ReportContext {
  label: string
  detail?: string
  kind?: IssueKind
}

export interface ReportProblemApi {
  /** Opens the report sheet over the current screen. Without a context it uses the screen's own. */
  open: (context?: ReportContext) => void
  /** True while the sheet is up, so a dialog under it can stand down its own focus trap and keys. */
  isOpen: boolean
  /** The screen's standing context, for reports opened from outside it (the Help menu). */
  setPageContext: (context: ReportContext | null) => void
}

/*
  Context and hook live apart from the provider component, the same split as `auth-context`:
  the screens that only open the sheet import this small module, not the dialog.
*/
export const ReportProblemContext = createContext<ReportProblemApi | null>(null)

export function useReportProblem(): ReportProblemApi {
  const value = useContext(ReportProblemContext)
  if (!value) throw new Error('useReportProblem must be used inside ReportProblemProvider')
  return value
}

/**
 * Declares where the learner is for as long as the calling screen is mounted. Keyed on the
 * label's text so a screen re-rendering with the same place does not churn the provider.
 */
export function useReportPageContext(label: string | null, kind?: IssueKind) {
  const { setPageContext } = useReportProblem()
  useEffect(() => {
    if (!label) return
    setPageContext({ label, kind })
    return () => setPageContext(null)
  }, [label, kind, setPageContext])
}
