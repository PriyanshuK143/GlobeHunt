import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { mulberry32 } from '../../globe/ambient/motion'

/**
 * Deep-space backdrop for the credits: drifting nebulae, a Milky Way band, a distant
 * galaxy, twinkling stars, an aurora over Earth's limb, a one-off stellar collision
 * (two stars spiral in, flash, shockwave, sparks, glowing remnant) and shooting stars
 * that are different every time — random position, angle, length, speed and timing.
 */

interface Meteor {
  id: number
  x: number
  y: number
  angle: number
  length: number
  duration: number
  travel: number
  bright: boolean
}

const SPARKS = 28

interface Drifter {
  id: number
  kind: 'comet' | 'satellite'
  y: number
  fromLeft: boolean
  duration: number
  tilt: number
}

/**
 * `calm` turns true once the flypast smoke has fully cleared: only then do the sky's
 * events begin (so nothing competes with the jets and the credits reveal).
 */
export const CreditsSky = memo(function CreditsSky({ reducedMotion, calm }: { reducedMotion: boolean; calm: boolean }) {
  const stars = useMemo(() => {
    const r = mulberry32(11)
    return Array.from({ length: 170 }, () => ({
      x: r() * 100,
      y: r() * 82,
      s: r() < 0.12 ? 2 : r() < 0.5 ? 1.4 : 1,
      o: 0.3 + r() * 0.6,
      tw: r() < 0.3 ? 2.5 + r() * 4 : 0,
      d: r() * 5,
      warm: r() < 0.12,
    }))
  }, [])

  const sparks = useMemo(() => {
    const r = mulberry32(42)
    return Array.from({ length: SPARKS }, (_, i) => ({
      angle: (i / SPARKS) * 360 + (r() - 0.5) * 14,
      dist: 70 + r() * 120,
      size: 1.5 + r() * 2.5,
      dur: 1.6 + r() * 1.4,
      hue: r() < 0.5 ? '#ffe9c4' : r() < 0.8 ? '#bfe3ff' : '#ffb3d9',
    }))
  }, [])

  // Shooting stars: spawned at random intervals with random paths.
  const [meteors, setMeteors] = useState<Meteor[]>([])
  const nextId = useRef(0)
  useEffect(() => {
    if (reducedMotion || !calm) return
    let timer = 0
    const spawn = () => {
      const fromLeft = Math.random() < 0.5
      const m: Meteor = {
        id: nextId.current++,
        x: 8 + Math.random() * 84,
        y: 4 + Math.random() * 48,
        angle: (fromLeft ? 1 : -1) * (14 + Math.random() * 30) + (fromLeft ? 0 : 180),
        length: 70 + Math.random() * 170,
        duration: 0.55 + Math.random() * 0.9,
        travel: 160 + Math.random() * 280,
        bright: Math.random() < 0.25,
      }
      setMeteors((list) => [...list.slice(-4), m])
      window.setTimeout(() => setMeteors((list) => list.filter((x) => x.id !== m.id)), (m.duration + 0.3) * 1000)
      // Irregular gaps; now and then a quick pair.
      timer = window.setTimeout(spawn, Math.random() < 0.18 ? 250 + Math.random() * 500 : 2200 + Math.random() * 5200)
    }
    timer = window.setTimeout(spawn, 2500 + Math.random() * 2500)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, calm])

  // Slow drifters: a comet with a glowing tail, or a satellite passing over, blinking.
  const [drifters, setDrifters] = useState<Drifter[]>([])
  useEffect(() => {
    if (reducedMotion || !calm) return
    let timer = 0
    let comet = Math.random() < 0.5
    const spawn = () => {
      const d: Drifter = {
        id: nextId.current++,
        kind: comet ? 'comet' : 'satellite',
        y: comet ? 6 + Math.random() * 22 : 8 + Math.random() * 40,
        fromLeft: Math.random() < 0.5,
        duration: comet ? 16 + Math.random() * 8 : 20 + Math.random() * 10,
        tilt: (Math.random() - 0.5) * (comet ? 16 : 10),
      }
      comet = !comet
      setDrifters((list) => [...list.slice(-2), d])
      window.setTimeout(() => setDrifters((list) => list.filter((x) => x.id !== d.id)), (d.duration + 0.5) * 1000)
      timer = window.setTimeout(spawn, 9000 + Math.random() * 9000)
    }
    timer = window.setTimeout(spawn, 7000 + Math.random() * 3000)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, calm])

  return (
    <div className="flypast-sky" aria-hidden>
      <div className="flypast-nebula flypast-nebula--a" />
      <div className="flypast-nebula flypast-nebula--b" />
      <div className="flypast-nebula flypast-nebula--c" />
      <div className="flypast-milkyway" />
      <div className="flypast-galaxy" />
      <div className="flypast-stars">
        {stars.map((s, i) => (
          <span
            key={i}
            className={`${s.tw ? 'is-twinkle' : ''} ${s.warm ? 'is-warm' : ''}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              opacity: s.o,
              animationDuration: s.tw ? `${s.tw}s` : undefined,
              animationDelay: s.tw ? `${s.d}s` : undefined,
            }}
          />
        ))}
      </div>

      {/* Stellar collision (after the smoke clears): two stars circle, spiral in, flash,
          shockwave + sparks, then a lingering remnant. */}
      {calm ? (
      <div className={`collision ${reducedMotion ? 'is-static' : ''}`}>
        <div className="collision__remnant" />
        <div className="collision__pair">
          <span className="collision__star collision__star--a" />
          <span className="collision__star collision__star--b" />
        </div>
        <span className="collision__flash" />
        <span className="collision__ring" />
        <span className="collision__ring collision__ring--late" />
        {sparks.map((p, i) => (
          <span
            key={i}
            className="collision__spark"
            style={{
              width: p.size,
              height: p.size,
              background: p.hue,
              animationDuration: `${p.dur}s`,
              ['--a' as string]: `${p.angle}deg`,
              ['--d' as string]: `${p.dist}px`,
            }}
          />
        ))}
      </div>
      ) : null}

      {drifters.map((d) => (
        <span
          key={d.id}
          className={`drifter drifter--${d.kind} ${d.fromLeft ? 'is-ltr' : 'is-rtl'}`}
          style={{ top: `${d.y}%`, animationDuration: `${d.duration}s`, ['--tilt' as string]: `${d.tilt}deg` }}
        />
      ))}

      {meteors.map((m) => (
        <span
          key={m.id}
          className={`flypast-meteor ${m.bright ? 'is-bright' : ''}`}
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.length,
            animationDuration: `${m.duration}s`,
            ['--angle' as string]: `${m.angle}deg`,
            ['--travel' as string]: `${m.travel}px`,
          }}
        />
      ))}

      {/* A small, slowly turning Earth rising from the bottom (NASA Blue Marble, public domain). */}
      <div className="credits-earth">
        <div className="credits-earth__globe">
          <div className="credits-earth__map" />
          <div className="credits-earth__shade" />
        </div>
      </div>
      <div className="flypast-aurora" />
    </div>
  )
})
