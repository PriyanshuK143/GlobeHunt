import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AmbientMode } from './ambient/types'
import { setDisplaySun } from './ambient/useSunDirection'
import { surfaceGrade } from './imagery/oceanSpecular'
import { approach } from './ambient/motion'
import { solarSun } from './ambient/solarSun'

const SUN_DISTANCE = 10

/**
 * Light levels per mode. Both modes light the face you are looking at (bright,
 * readable globe); showcase keeps more contrast and a soft terminator for drama.
 */
const LEVELS: Record<AmbientMode, { ambient: number; sun: number; hemi: number; rim: number; gain: number; sat: number; green: number }> = {
  showcase: { ambient: 0.62, sun: 2.1, hemi: 0.35, rim: 0.35, gain: 1.5, sat: 1.18, green: 1.04 },
  gameplay: { ambient: 1.0, sun: 1.25, hemi: 0.45, rim: 0.3, gain: 1.62, sat: 1.32, green: 1.1 },
}

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _toCam = new THREE.Vector3()
const _key = new THREE.Vector3()
const _sunDir = new THREE.Vector3()
/** In showcase the light follows the visible Sun, but never turns the facing side fully dark. */
const MIN_FACING = 0.62

/**
 * Camera-relative key light: the sun comes from the upper-left, slightly in front of the
 * globe, so whatever part of Earth you look at is lit. The same direction drives the
 * atmosphere, clouds and city lights (via setDisplaySun) so everything stays coherent.
 */
export function GlobeLights({ mode = 'showcase' }: { mode?: AmbientMode }) {
  const ambient = useRef<THREE.AmbientLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)

  useEffect(() => () => setDisplaySun(null), [])

  useFrame(({ camera }, delta) => {
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    _toCam.copy(camera.position).normalize()
    const front = mode === 'gameplay' ? 1.1 : 0.62
    _key.copy(_toCam).multiplyScalar(front).addScaledVector(_right, -0.62).addScaledVector(_up, 0.48).normalize()
    if (mode === 'showcase' && solarSun.weight > 0.01) {
      _sunDir.copy(solarSun.position).normalize()
      const facing = _sunDir.dot(_toCam)
      if (facing < MIN_FACING) _sunDir.addScaledVector(_toCam, MIN_FACING - facing).normalize()
      _key.lerp(_sunDir, solarSun.weight).normalize()
    }
    setDisplaySun(_key)
    const dir = _key
    const target = LEVELS[mode]
    const dt = Math.min(delta, 0.1)
    const k = 1 - Math.exp(-2.5 * dt)
    surfaceGrade.uGain.value += (target.gain - surfaceGrade.uGain.value) * k
    surfaceGrade.uSat.value += (target.sat - surfaceGrade.uSat.value) * k
    surfaceGrade.uGreen.value += (target.green - surfaceGrade.uGreen.value) * k
    if (sun.current) {
      sun.current.position.copy(dir).multiplyScalar(SUN_DISTANCE)
      sun.current.intensity = approach(sun.current.intensity, target.sun, 2.5, dt)
    }
    if (rim.current) {
      // Faint cool bounce from the far side keeps the night limb defined.
      rim.current.position.copy(dir).multiplyScalar(-SUN_DISTANCE)
      rim.current.intensity = approach(rim.current.intensity, target.rim, 2.5, dt)
    }
    if (ambient.current) {
      ambient.current.intensity = approach(ambient.current.intensity, target.ambient, 2.5, dt)
    }
    if (hemi.current) {
      hemi.current.intensity = approach(hemi.current.intensity, target.hemi, 2.5, dt)
    }
  })

  const initial = LEVELS[mode]
  return (
    <>
      <ambientLight ref={ambient} intensity={initial.ambient} color="#bcd4f2" />
      <directionalLight ref={sun} intensity={initial.sun} color="#fff4e2" castShadow={false} />
      <directionalLight ref={rim} intensity={initial.rim} color="#6f9be0" />
      <hemisphereLight ref={hemi} args={['#e2efff', '#1a2a3e', initial.hemi]} />
    </>
  )
}
