/**
 * Room invite links for local-network play: http://<host-lan-ip>:2002/?join=1234
 * Opening one lands the guest on the Fly screen with the code ready to join.
 */
declare const __LAN_ADDRESS__: string | null

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const PARAM = 'join'

/** Base URL other devices can reach: the LAN address when the host is browsing via localhost. */
export function shareableOrigin(): string {
  const { protocol, hostname, port, origin } = window.location
  if (LOOPBACK.has(hostname) && __LAN_ADDRESS__) return `${protocol}//${__LAN_ADDRESS__}${port ? `:${port}` : ''}`
  return origin
}

export function inviteLink(code: string): string {
  return `${shareableOrigin()}/?${PARAM}=${encodeURIComponent(code)}`
}

/** Read (once) and strip ?join=1234 from the address bar. */
export function takeInviteCode(): string | null {
  const url = new URL(window.location.href)
  const raw = url.searchParams.get(PARAM)
  if (raw === null) return null
  url.searchParams.delete(PARAM)
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  return /^\d{4}$/.test(raw.trim()) ? raw.trim() : null
}

/**
 * Copy text. navigator.clipboard only exists on secure origins (https / localhost), so on
 * a plain-http LAN address fall back to a hidden textarea + execCommand.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}
