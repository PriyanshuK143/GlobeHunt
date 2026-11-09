/**
 * The dark launch veil lives in index.html so the very first paint is deep space, never
 * a white flash or a half-loaded globe. It fades away once the home camera is placed,
 * and fades back in on reload / tab close so leaving never cuts to white either.
 */
const veil = () => document.getElementById('launch-veil')

let revealed = false

export function revealApp(): void {
  if (revealed) return
  revealed = true
  const el = veil()
  if (!el) return
  el.classList.add('is-gone')
  el.setAttribute('aria-hidden', 'true')
}

if (typeof window !== 'undefined') {
  // Safety net: never leave the player behind the veil if the globe is slow to start.
  window.setTimeout(revealApp, 1500)
  window.addEventListener('beforeunload', () => {
    const el = veil()
    if (!el) return
    el.classList.add('is-leaving')
    el.classList.remove('is-gone')
  })
  // bfcache restore (back/forward): lift the veil again.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) veil()?.classList.replace('is-leaving', 'is-gone')
  })
}
