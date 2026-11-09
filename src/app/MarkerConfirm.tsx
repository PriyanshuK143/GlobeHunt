import { useEffect } from 'react'
import { useMarkerState, type LatLng, type MarkerStore } from '../globe'

function formatLatLng({ lat, lng }: LatLng): string {
  const la = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
  return `${la} · ${lo}`
}

interface MarkerConfirmProps {
  store: MarkerStore
  enabled: boolean
  onConfirm: (coords: LatLng) => void
}

/**
 * Answer bar for the target marker: live coordinates + Confirm (or Enter).
 * Purely UI — it hands the marker's lat/lng to the existing answer handler.
 */
export function MarkerConfirm({ store, enabled, onConfirm }: MarkerConfirmProps) {
  const position = useMarkerState(store, (s) => s.position)
  const dragging = useMarkerState(store, (s) => s.dragging)

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return
      const current = store.get().position
      if (current) {
        e.preventDefault()
        onConfirm(current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onConfirm, store])

  if (!enabled) return null

  return (
    <div className={`marker-confirm ${position ? 'has-marker' : ''}`} role="group" aria-label="Your answer">
      {position ? (
        <>
          <span className="marker-confirm__reticle" aria-hidden />
          <span className="marker-confirm__coords" aria-live="off">
            {formatLatLng(position)}
          </span>
          <button
            type="button"
            className="gh-btn gh-btn--primary marker-confirm__btn"
            disabled={dragging}
            onClick={() => onConfirm(position)}
          >
            Confirm <kbd>⏎</kbd>
          </button>
        </>
      ) : (
        <span className="marker-confirm__hint">Tap the globe to drop your target</span>
      )}
    </div>
  )
}
