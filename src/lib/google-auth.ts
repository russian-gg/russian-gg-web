let scriptLoad: Promise<void> | null = null
const GOOGLE_BUTTON_LOCALE = 'uz'

export interface GoogleCredentialResponse {
  credential: string
  select_by?: string
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
          }): void
          renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
          disableAutoSelect(): void
        }
      }
    }
  }
}

export async function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') return
  if (window.google?.accounts?.id) return

  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="https://accounts.google.com/gsi/client?hl=${GOOGLE_BUTTON_LOCALE}"]`,
    )

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google script failed to load.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = `https://accounts.google.com/gsi/client?hl=${GOOGLE_BUTTON_LOCALE}`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google script failed to load.'))
    document.head.appendChild(script)
  })

  await scriptLoad
}

export function renderGoogleButton(
  element: HTMLElement,
  clientId: string,
  callback: (response: GoogleCredentialResponse) => void,
  text: GoogleButtonOptions['text'],
) {
  const google = window.google?.accounts?.id
  if (!google) {
    throw new Error('Google Identity Services is unavailable.')
  }

  google.initialize({
    client_id: clientId,
    callback,
  })

  element.innerHTML = ''
  google.renderButton(element, {
    theme: 'outline',
    size: 'large',
    text,
    shape: 'pill',
    width: 360,
  })
}

export function disableGoogleAutoSelect() {
  window.google?.accounts?.id.disableAutoSelect()
}
