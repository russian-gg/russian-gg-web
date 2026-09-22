import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './AdminApp'
import { MotionProvider } from '../src/components/motion'
import '../src/styles.css'

/*
  The panel gets the learner product's motion system, not one of its own.

  It is the same conscious call as `components/ui.tsx` here borrowing the learner app's
  tokens: one vocabulary, so a row arriving in a table and a card arriving on the home screen
  are the same gesture. `MotionProvider` also carries the `reducedMotion` setting, which is
  correctness rather than polish — without it the panel would ignore an operator's own
  operating-system preference all day, on a screen they keep open all day.

  The provider lazily loads Motion's feature bundle as its own chunk, so the cost to the
  admin entry chunk is the `m` components alone.
*/
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <AdminApp />
    </MotionProvider>
  </StrictMode>,
)
