import { useSyncExternalStore } from 'react'
import type { LatLng } from '../navigation/geo'

export interface MarkerSnapshot {
  /** Geographic position of the target reticle, or null when not placed. */
  position: LatLng | null
  dragging: boolean
  /** Increments on every click-placement (drives the placement pulse). */
  placements: number
  /** True when the marker was locked onto a revealed / discovered answer. */
  revealed: boolean
}

export interface MarkerStore {
  get: () => MarkerSnapshot
  /** Place (or move) the marker by click — animates and pulses. */
  place: (position: LatLng) => void
  /** Continuous update while dragging. */
  drag: (position: LatLng) => void
  /** Lock the reticle onto an answer location (discovery / reveal). */
  reveal: (position: LatLng) => void
  setDragging: (dragging: boolean) => void
  clear: () => void
  subscribe: (listener: () => void) => () => void
}

/**
 * Tiny external store for the location marker. Keeps per-pointer-move updates out of
 * React's top-level tree: only components that select marker state re-render.
 */
export function createMarkerStore(): MarkerStore {
  let snapshot: MarkerSnapshot = { position: null, dragging: false, placements: 0, revealed: false }
  const listeners = new Set<() => void>()
  const emit = (next: MarkerSnapshot) => {
    snapshot = next
    listeners.forEach((l) => l())
  }
  return {
    get: () => snapshot,
    place: (position) => emit({ ...snapshot, position, placements: snapshot.placements + 1, revealed: false }),
    drag: (position) => emit({ ...snapshot, position, revealed: false }),
    reveal: (position) =>
      emit({ ...snapshot, position, dragging: false, placements: snapshot.placements + 1, revealed: true }),
    setDragging: (dragging) => {
      if (snapshot.dragging !== dragging) emit({ ...snapshot, dragging })
    },
    clear: () => {
      if (snapshot.position || snapshot.dragging) emit({ ...snapshot, position: null, dragging: false, revealed: false })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Subscribe to a slice of marker state. Return primitives or stable references. */
export function useMarkerState<T>(store: MarkerStore, selector: (s: MarkerSnapshot) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  )
}
