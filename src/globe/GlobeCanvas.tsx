import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { DEFAULT_AMBIENT } from './ambient'
import { DPR_FOR_TIER, lowerStoredTier, lowerTier, tierForRenderer, type GraphicsTier } from './performanceTier'
import { Canvas, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { BASE_CAMERA_FOV, cameraFovForAspect } from './navigation/geo'
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
import type { CelestialSpec } from './ambient/planets'
import './globe.css'

/** Keeps the camera FOV matched to the canvas aspect (wider only on portrait phones). */
function ResponsiveFov() {
  const get = useThree((s) => s.get)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  useEffect(() => {
    const camera = get().camera as PerspectiveCamera
    const fov = cameraFovForAspect(width / Math.max(1, height))
    if (Math.abs(camera.fov - fov) < 0.01) return
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [get, width, height])
  return null
}

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
  onPlanetSelect?: (spec: CelestialSpec) => void
}

export const GlobeCanvas = forwardRef<GlobeNavigationApi | null, GlobeCanvasProps>(
  function GlobeCanvas(
    { pickingEnabled = false, onGlobePick, dprCap = 2, rotateSpeed = 0.55, ambient, marker, paused = false, labels, layers, onSatelliteSelect, onPlanetSelect },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const apiRef = useRef<GlobeNavigationApi | null>(null)
    const labelCanvasRef = useRef<HTMLCanvasElement>(null)
    // Adaptive resolution: drop pixel ratio on slow devices, restore when frames recover.
    const [dprScale, setDprScale] = useState(1)
    // Graphics tier ceiling learned at runtime (real GPU name, sustained slow frames,
    // lost context). The scene renders at the lower of this and the requested quality.
    const [gpuCap, setGpuCap] = useState<GraphicsTier>('high')
    const requested: GraphicsTier = ambient?.quality ?? DEFAULT_AMBIENT.quality
    const tier = lowerTier(requested, gpuCap)
    const tierRef = useRef(tier)
    useEffect(() => {
      tierRef.current = tier
    }, [tier])
    const sceneAmbient = useMemo<AmbientProfile>(
      () => ({ ...(ambient ?? DEFAULT_AMBIENT), quality: tier }),
      [ambient, tier],
    )
    /** One step lighter for the rest of this session and the next few loads. */
    const sceneStart = useRef(0)
    useEffect(() => {
      sceneStart.current = performance.now()
    }, [])
    const stepDown = (reason: string, fromFrameRate = false) => {
      if (tierRef.current === 'low') return
      // Loading/texture uploads stutter on every machine; judge frame rate only once the
      // scene has settled and the tab is actually on screen.
      if (fromFrameRate && (performance.now() - sceneStart.current < 8000 || document.hidden)) return
      const next = lowerStoredTier(tierRef.current)
      console.info(`[GLOBEHUNT] Graphics → ${next} (${reason})`)
      setGpuCap((cap) => lowerTier(cap, next))
      setDprScale(1)
    }
    // Antialiasing is fixed at context creation; skip it where the GPU is weakest.
    const [antialias] = useState(() => requested !== 'low')
    // GPU context recovery. Browsers can drop the WebGL context (GPU reset, memory
    // pressure on reload); unhandled, the canvas stays blank/white for good. Bumping the
    // key rebuilds the renderer and scene — baked textures included — on a fresh context.
    const [contextKey, setContextKey] = useState(0)
    const recoverTimer = useRef<number | null>(null)
    const restoreView = useRef<ReturnType<GlobeNavigationApi['getView']> | null>(null)

    // Only the current canvas counts: tearing down the old renderer force-loses its
    // context too, which must not trigger another rebuild.
    const liveCanvas = useRef<HTMLCanvasElement | null>(null)

    const rebuildScene = () => {
      if (recoverTimer.current) window.clearTimeout(recoverTimer.current)
      recoverTimer.current = null
      liveCanvas.current = null
      sceneStart.current = performance.now()
      setContextKey((k) => k + 1)
    }

    const watchContext = (canvas: HTMLCanvasElement) => {
      liveCanvas.current = canvas
      canvas.addEventListener('webglcontextrestored', () => {
        if (liveCanvas.current === canvas) rebuildScene()
      })
      canvas.addEventListener('webglcontextlost', (e) => {
        if (liveCanvas.current !== canvas) return
        // preventDefault asks the browser to restore the context instead of giving up.
        e.preventDefault()
        console.warn('[GLOBEHUNT] WebGL context lost — rebuilding the globe')
        // Usually GPU memory pressure: come back lighter so it doesn't happen again.
        stepDown('GPU context lost')
        restoreView.current = apiRef.current?.getView() ?? null
        // If the browser never restores it, start over on a brand-new context anyway.
        recoverTimer.current = window.setTimeout(rebuildScene, 2500)
      })
    }

    // After a rebuild, put the camera back where it was once the new scene is live.
    useEffect(() => {
      const view = restoreView.current
      if (!contextKey || !view) return
      let tries = 0
      const id = window.setInterval(() => {
        tries++
        if (apiRef.current) {
          apiRef.current.setView(view)
          restoreView.current = null
        }
        if (!restoreView.current || tries > 60) window.clearInterval(id)
      }, 80)
      return () => window.clearInterval(id)
    }, [contextKey])

    useEffect(() => () => {
      if (recoverTimer.current) window.clearTimeout(recoverTimer.current)
    }, [])

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
        <GlobeErrorBoundary key={contextKey}>
          <Canvas
            dpr={[1, Math.max(1, Math.min(dprCap, DPR_FOR_TIER[tier]) * dprScale)]}
            frameloop={paused ? 'never' : 'always'}
            gl={{
              antialias,
              alpha: false,
              powerPreference: 'high-performance',
            }}
            camera={{ position: [0, 0.7, 2.6], fov: BASE_CAMERA_FOV, near: 0.1, far: 420 }}
            onCreated={({ gl }) => {
              gl.setClearColor('#030712')
              gl.domElement.style.touchAction = 'none'
              watchContext(gl.domElement)
              // Refine the device guess from the actual GPU (software / integrated / mobile).
              const ctx = gl.getContext()
              const info = ctx.getExtension('WEBGL_debug_renderer_info')
              const name = String(ctx.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : ctx.RENDERER) ?? '')
              const gpuTier = tierForRenderer(name, ctx.getParameter(ctx.MAX_TEXTURE_SIZE) as number)
              setGpuCap((cap) => lowerTier(cap, gpuTier))
            }}
          >
            <ResponsiveFov />
            <PerformanceMonitor
              onDecline={() => {
                // Resolution first; once it's at the floor, shed scene detail instead.
                if (dprScale <= 0.5) stepDown('low frame rate', true)
                else setDprScale((v) => Math.max(0.5, v - 0.25))
              }}
              onIncline={() => setDprScale((v) => Math.min(1, v + 0.25))}
              flipflops={3}
              onFallback={() => stepDown('unstable frame rate', true)}
            />
            <Suspense fallback={<GlobeFallback />}>
              <GlobeScene
                apiRef={apiRef}
                pickingEnabled={pickingEnabled}
                onGlobePick={onGlobePick}
                rotateSpeed={rotateSpeed}
                ambient={sceneAmbient}
                marker={marker}
                labels={labels}
                labelCanvasRef={labelCanvasRef}
                layers={layers}
                onSatelliteSelect={onSatelliteSelect}
                onPlanetSelect={onPlanetSelect}
              />
            </Suspense>
          </Canvas>
        </GlobeErrorBoundary>
        <canvas ref={labelCanvasRef} className="globe-labels" aria-hidden />
      </div>
    )
  },
)
