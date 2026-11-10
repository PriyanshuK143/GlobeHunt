import { useRef, type Ref } from 'react'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Earth } from './Earth'
import { Atmosphere } from './Atmosphere'
import { Starfield } from './Starfield'
import { Constellations } from './Constellations'
import { GlobeLights } from './GlobeLights'
import { GlobePickLayer } from './picking/GlobePickLayer'
import { useGlobeNavigation } from './navigation/useGlobeNavigation'
import { MAX_CAMERA_DISTANCE, MIN_CAMERA_DISTANCE, type LatLng } from './navigation/geo'
import type { GlobeNavigationApi } from './navigation/types'
import { LocationMarker, type MarkerStore } from './marker'
import type { SatelliteSpec } from './ambient/orbits'
import type { CelestialSpec } from './ambient/planets'
import { AtlasLabels, type AtlasLabel, type LabelFilterFactory } from './labels'
import { LineLayers, DEFAULT_LAYERS, type GlobeLayers } from './atlas/LineLayers'
import { ZoomAwareControls } from './atlas/ZoomAwareControls'
import type { RefObject } from 'react'
import {
  CityLights,
  Clouds,
  IdleRotation,
  Meteors,
  Nebula,
  SolarBackdrop,
  OrbitalSystem,
  DEFAULT_AMBIENT,
  type AmbientProfile,
} from './ambient'

interface GlobeSceneProps {
  apiRef: Ref<GlobeNavigationApi | null>
  pickingEnabled?: boolean
  onGlobePick?: (coords: LatLng) => void
  rotateSpeed?: number
  ambient?: AmbientProfile
  /** When provided, picks place a draggable target marker instead of answering instantly. */
  marker?: MarkerStore
  labels?: GlobeLabelsConfig
  labelCanvasRef?: RefObject<HTMLCanvasElement | null>
  layers?: GlobeLayers
  onSatelliteSelect?: (spec: SatelliteSpec) => void
  onPlanetSelect?: (spec: CelestialSpec) => void
}

export interface GlobeLabelsConfig {
  enabled: boolean
  extra?: AtlasLabel[]
  filter?: LabelFilterFactory
}

const STAR_COUNT = { low: 900, medium: 1600, high: 2400 } as const

/** Meteor spawn windows (seconds) — rare by design, rarer during play. */
function meteorInterval(profile: AmbientProfile): [number, number] | null {
  if (profile.reducedMotion || profile.effects === 'off') return null
  if (profile.mode === 'gameplay') return profile.effects === 'reduced' ? null : [28, 55]
  return profile.effects === 'reduced' ? [16, 32] : [6, 14]
}

export function GlobeScene({
  apiRef,
  pickingEnabled = false,
  onGlobePick,
  rotateSpeed = 0.55,
  ambient = DEFAULT_AMBIENT,
  marker,
  labels,
  labelCanvasRef,
  layers = DEFAULT_LAYERS,
  onSatelliteSelect,
  onPlanetSelect,
}: GlobeSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  useGlobeNavigation(apiRef, controlsRef)

  const { mode, effects, reducedMotion, quality } = ambient
  const showcase = mode === 'showcase'
  const effectsOn = effects !== 'off'
  // Motion: full spin, a gentle drift when reduced, still when off.
  const idleSpeed = !showcase || reducedMotion ? 0 : effects === 'reduced' ? 0.14 : 0.32

  return (
    <>
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 12, 70]} />

      <GlobeLights mode={mode} />
      {effectsOn && quality !== 'low' ? <Nebula strength={showcase ? 1 : 0.7} /> : null}
      <Starfield count={STAR_COUNT[quality]} twinkle={reducedMotion ? 0 : 1} />
      {effectsOn ? <Constellations visible={showcase} /> : null}

      <Earth quality={quality} />
      <LineLayers layers={layers} />
      {effectsOn ? <CityLights opacity={showcase ? 1 : 0} /> : null}
      {effectsOn && quality !== 'low' ? (
        <Clouds opacity={showcase ? (effects === 'reduced' ? 0.3 : 0.5) : 0} animate={!reducedMotion} />
      ) : null}
      <Atmosphere />

      {effectsOn ? (
        <OrbitalSystem mode={mode} reduced={effects === 'reduced'} frozen={reducedMotion} onSelect={onSatelliteSelect} />
      ) : null}
      <Meteors interval={meteorInterval(ambient)} />
      {effectsOn ? <SolarBackdrop visible={showcase} frozen={reducedMotion} onSelect={showcase ? onPlanetSelect : undefined} /> : null}

      {onGlobePick || marker ? (
        <GlobePickLayer
          enabled={pickingEnabled}
          onPick={(coords) => (marker ? marker.place(coords) : onGlobePick?.(coords))}
        />
      ) : null}
      {marker ? <LocationMarker store={marker} interactive={pickingEnabled} /> : null}
      {labelCanvasRef ? (
        <AtlasLabels
          canvasRef={labelCanvasRef}
          enabled={labels?.enabled ?? false}
          extra={labels?.extra}
          filter={labels?.filter}
        />
      ) : null}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={rotateSpeed}
        zoomSpeed={0.65}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={MAX_CAMERA_DISTANCE}
        target={[0, 0, 0]}
      />
      <IdleRotation controlsRef={controlsRef} speed={idleSpeed} />
      <ZoomAwareControls controlsRef={controlsRef} baseRotateSpeed={rotateSpeed} />
    </>
  )
}
