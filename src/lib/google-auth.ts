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
  /*
    Google renders the button at exactly the width it is given and ignores CSS, so a hardcoded
    360 was wider than the column it sits in on a 360px phone (the page's own padding leaves
    ~320) and pushed the whole sign-in page into a horizontal scroll. Measured from the slot
    instead, clamped to the 200–400 range the widget accepts; the 360 only stands in for the
    frame where the element has not been laid out yet.
  */
  const slot = Math.round(element.getBoundingClientRect().width) || 360
  google.renderButton(element, {
    theme: 'outline',
    size: 'large',
    text,
    shape: 'pill',
    width: Math.min(400, Math.max(200, slot)),
  })
}

export function disableGoogleAutoSelect() {
  window.google?.accounts?.id.disableAutoSelect()
}
