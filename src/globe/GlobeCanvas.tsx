import { Suspense, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { GlobeScene } from './GlobeScene'
import { GlobeErrorBoundary } from './GlobeErrorBoundary'
import { usePreventCanvasScroll } from './hooks/usePreventCanvasScroll'
import type { LatLng } from './navigation/geo'
import type { GlobeNavigationApi } from './navigation/types'
import type { AmbientProfile } from './ambient/types'
import type { MarkerStore } from './marker'
import type { GlobeLabelsConfig } from './GlobeScene'
import type { GlobeLayers } from './atlas/LineLayers'
import type { SatelliteSpec } from './ambient/orbits'
import './globe.css'

function GlobeFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#0b1c33" wireframe />
    </mesh>
  )
}

export interface GlobeCanvasProps {
  pickingEnabled?: boolean
  onGlobePick?: (coords: LatLng) => void
  dprCap?: number
  rotateSpeed?: number
  /** Ambient scene profile (mode, effects level, motion, quality). */
  ambient?: AmbientProfile
  /** Enables the draggable target marker; picks then move the marker. */
  marker?: MarkerStore
  /** Stop rendering (e.g. while a full-screen scene such as the credits is shown). */
  paused?: boolean
  /** Atlas place-name labels (toggle, extra places, answer-hiding filter). */
  labels?: GlobeLabelsConfig
  /** Geographic overlay toggles (borders, admin lines, rivers, lakes…). */
  layers?: GlobeLayers
  onSatelliteSelect?: (spec: SatelliteSpec) => void
}

export const GlobeCanvas = forwardRef<GlobeNavigationApi | null, GlobeCanvasProps>(
  function GlobeCanvas(
    { pickingEnabled = false, onGlobePick, dprCap = 2, rotateSpeed = 0.55, ambient, marker, paused = false, labels, layers, onSatelliteSelect },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const apiRef = useRef<GlobeNavigationApi | null>(null)
    const labelCanvasRef = useRef<HTMLCanvasElement>(null)
    // Adaptive resolution: drop pixel ratio on slow devices, restore when frames recover.
    const [dprScale, setDprScale] = useState(1)

    usePreventCanvasScroll(containerRef)

    useImperativeHandle(ref, () => ({
      flyTo: (target, durationMs) => {
        if (!apiRef.current) return Promise.resolve()
        return apiRef.current.flyTo(target, durationMs)
      },
      setView: (target) => {
        apiRef.current?.setView(target)
      },
      getView: () =>
        apiRef.current?.getView() ?? { lat: 0, lng: 0, altitude: 2.6 },
      cancelFlight: () => {
        apiRef.current?.cancelFlight()
      },
    }))

    useEffect(() => {
      if (!import.meta.env.DEV) return

      const bridge = {
        flyTo: (lat: number, lng: number, altitude?: number, durationMs?: number) =>
          apiRef.current?.flyTo({ lat, lng, altitude }, durationMs),
        setView: (lat: number, lng: number, altitude?: number) =>
          apiRef.current?.setView({ lat, lng, altitude }),
        getView: () => apiRef.current?.getView(),
        cancelFlight: () => apiRef.current?.cancelFlight(),
      }

      ;(window as Window & { __GLOBEHUNT__?: typeof bridge }).__GLOBEHUNT__ = bridge
      console.info(
        '[GLOBEHUNT] Dev navigation ready. Try: __GLOBEHUNT__.flyTo(48.86, 2.35) // Paris',
      )

      return () => {
        delete (window as Window & { __GLOBEHUNT__?: typeof bridge }).__GLOBEHUNT__
      }
    }, [])

    return (
      <div ref={containerRef} className="globe-canvas-root" aria-label="Interactive Earth globe">
        <GlobeErrorBoundary>
          <Canvas
            dpr={[1, Math.max(1, dprCap * dprScale)]}
            frameloop={paused ? 'never' : 'always'}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
            }}
            camera={{ position: [0, 0.7, 2.6], fov: 42, near: 0.1, far: 420 }}
            onCreated={({ gl }) => {
              gl.setClearColor('#030712')
              gl.domElement.style.touchAction = 'none'
            }}
          >
            <PerformanceMonitor
              onDecline={() => setDprScale((v) => Math.max(0.5, v - 0.25))}
              onIncline={() => setDprScale((v) => Math.min(1, v + 0.25))}
              flipflops={3}
              onFallback={() => setDprScale(0.5)}
            />
            <Suspense fallback={<GlobeFallback />}>
              <GlobeScene
                apiRef={apiRef}
                pickingEnabled={pickingEnabled}
                onGlobePick={onGlobePick}
                rotateSpeed={rotateSpeed}
                ambient={ambient}
                marker={marker}
                labels={labels}
                labelCanvasRef={labelCanvasRef}
                layers={layers}
                onSatelliteSelect={onSatelliteSelect}
              />
            </Suspense>
          </Canvas>
        </GlobeErrorBoundary>
        <canvas ref={labelCanvasRef} className="globe-labels" aria-hidden />
      </div>
    )
  },
)
