import * as THREE from 'three'

/**
 * World-space Sun position from the solar backdrop + how visible it is (0..1).
 * GlobeLights reads this so the globe is lit from the side the Sun is actually on.
 */
export const solarSun = { position: new THREE.Vector3(), weight: 0 }
