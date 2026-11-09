import { forwardRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Low-poly delta-wing fighter. Local frame: nose +Z, top +Y, exhaust nozzle at the
 * origin — so the smoke trail starts exactly at the tail.
 */
export const Fighter = forwardRef<THREE.Group, { scale?: number }>(function Fighter({ scale = 1 }, ref) {
  const kit = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: '#c3ceda', metalness: 0.55, roughness: 0.34 })
    const wing = new THREE.MeshStandardMaterial({ color: '#9fadbd', metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide })
    const glass = new THREE.MeshStandardMaterial({ color: '#13213a', metalness: 0.9, roughness: 0.12 })
    const flame = new THREE.MeshBasicMaterial({ color: '#ffd9a8', transparent: true, opacity: 0.9, toneMapped: false })

    const fuselage = new THREE.CylinderGeometry(0.034, 0.048, 0.44, 12)
    fuselage.rotateX(Math.PI / 2)
    const nose = new THREE.ConeGeometry(0.034, 0.17, 12)
    nose.rotateX(Math.PI / 2)
    const canopy = new THREE.SphereGeometry(0.03, 12, 8)
    canopy.scale(0.85, 0.75, 2.3)

    const wingShape = new THREE.Shape()
    wingShape.moveTo(-0.28, 0.04)
    wingShape.lineTo(-0.28, 0.085)
    wingShape.lineTo(0, 0.4)
    wingShape.lineTo(0.28, 0.085)
    wingShape.lineTo(0.28, 0.04)
    wingShape.lineTo(0, 0.07)
    wingShape.closePath()
    const wings = new THREE.ShapeGeometry(wingShape)
    wings.rotateX(Math.PI / 2)

    const stabShape = new THREE.Shape()
    stabShape.moveTo(-0.13, 0)
    stabShape.lineTo(0, 0.11)
    stabShape.lineTo(0.13, 0)
    stabShape.lineTo(0, 0.02)
    stabShape.closePath()
    const stab = new THREE.ShapeGeometry(stabShape)
    stab.rotateX(Math.PI / 2)

    const finShape = new THREE.Shape()
    finShape.moveTo(0.0, 0)
    finShape.lineTo(0.15, 0)
    finShape.lineTo(0.05, 0.13)
    finShape.lineTo(0.0, 0.13)
    finShape.closePath()
    const fin = new THREE.ShapeGeometry(finShape)
    fin.rotateY(-Math.PI / 2)

    const nozzle = new THREE.CircleGeometry(0.036, 12)
    nozzle.rotateY(Math.PI)

    return { body, wing, glass, flame, fuselage, nose, canopy, wings, stab, fin, nozzle }
  }, [])

  useEffect(
    () => () => {
      Object.values(kit).forEach((r) => (r as { dispose: () => void }).dispose())
    },
    [kit],
  )

  return (
    <group ref={ref}>
      <group scale={scale}>
        <mesh geometry={kit.fuselage} material={kit.body} position={[0, 0, 0.24]} />
        <mesh geometry={kit.nose} material={kit.body} position={[0, 0, 0.545]} />
        <mesh geometry={kit.canopy} material={kit.glass} position={[0, 0.032, 0.39]} />
        <mesh geometry={kit.wings} material={kit.wing} position={[0, -0.004, 0]} />
        <mesh geometry={kit.stab} material={kit.wing} position={[0, 0, 0.005]} />
        <mesh geometry={kit.fin} material={kit.wing} position={[0.03, 0.02, 0.02]} rotation={[0, 0, -0.22]} />
        <mesh geometry={kit.fin} material={kit.wing} position={[-0.03, 0.02, 0.02]} rotation={[0, 0, 0.22]} />
        <mesh geometry={kit.nozzle} material={kit.flame} position={[0, 0, 0.018]} />
      </group>
    </group>
  )
})
