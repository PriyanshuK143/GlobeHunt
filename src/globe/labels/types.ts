export type LabelKind =
  | 'country'
  | 'capital'
  | 'admincap'
  | 'city'
  | 'town'
  | 'village'
  | 'ocean'
  | 'sea'
  | 'bay'
  | 'river'
  | 'lake'
  | 'mountain'
  | 'range'
  | 'desert'
  | 'plateau'
  | 'region'
  | 'island'
  | 'admin1'
  | 'airport'
  | 'port'
  | 'landmark'

export interface AtlasLabel {
  id: string
  name: string
  kind: LabelKind
  lat: number
  lng: number
  /** Shown only when the camera is closer than this distance (Earth radius = 1). */
  maxDistance: number
  /** Higher wins when labels collide. */
  priority: number
  /** Country the place belongs to (for answer-hiding). */
  country?: string
  /** Scale for country/ocean labels (bigger regions → bigger text). */
  size?: number
  /** Display text when it differs from the name (e.g. "Mount Everest 8,849 m"). */
  text?: string
  /** Alternative names (local / ASCII spellings). */
  alt?: string[]
  /** Second point along a mountain range's main axis (rotated label). */
  axis?: { lat: number; lng: number }
  /** River geometry for line labels: flat [lng, lat, lng, lat, …]. */
  line?: number[]
  /** Tile tier the label came from ('core' | 't1' … | 'static'). */
  tier?: string
}

/** Decides which labels may be shown (false = hidden, e.g. it would reveal the answer). */
export type LabelFilter = (label: AtlasLabel) => boolean

/**
 * Builds a filter from every label currently loaded. `regionReady` is true once the
 * deterministic tiles around the target are loaded (see `prefetch`), so decoys can be
 * chosen identically on every client.
 */
export interface LabelFilterFactory {
  (all: readonly AtlasLabel[], regionReady: boolean): LabelFilter
  /** Area whose canonical tiles must be loaded before decoys are picked. */
  prefetch?: { lat: number; lng: number; km: number }
}
