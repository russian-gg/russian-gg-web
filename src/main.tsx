import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './lib/auth'
import { LocaleProvider } from './lib/locale-provider'
import { RequestError } from './lib/api'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Short and honest: course state changes as the learner works, and a paywall must
      // never be shown from stale data (PRD §11).
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Auth and entitlement failures are answers, not transient faults.
        if (error instanceof RequestError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </LocaleProvider>
    </QueryClientProvider>
  </StrictMode>,
)
