import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Rendered instead of the children once something below has thrown. */
  fallback: (retry: () => void) => ReactNode
}

type State = { failed: boolean }

/**
 * The last line before a white screen.
 *
 * Without one of these, a single `undefined.map` anywhere in the tree unmounts the whole
 * application and leaves an empty document — no message, no navigation, nothing to press but
 * reload. React has no built-in equivalent as a hook, so this is the one class component in
 * the codebase.
 *
 * It catches render faults only: an error thrown inside an event handler or a promise never
 * reaches here, which is why the data screens still carry their own `isError` branches. This
 * is for the fault nobody predicted.
 *
 * `retry` clears the flag and re-renders. That is genuinely worth offering — a good share of
 * these come from state that has since moved on, and the alternative costs the learner their
 * place in a lesson.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nothing is reported anywhere yet, so the console is the only record. Left deliberately:
    // a boundary that swallows the error silently is harder to debug than no boundary at all.
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback(() => this.setState({ failed: false }))
    }

    return this.props.children
  }
}
