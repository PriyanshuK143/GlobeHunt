/**
 * Facts and photos for the bodies in the solar backdrop (shown when one is clicked).
 * Photos are public-domain NASA images via Wikimedia Commons, resized for the card.
 */
export interface CelestialSpec {
  id: string
  label: string
  /** e.g. "Planet · gas giant". */
  type: string
  facts: Array<[label: string, value: string]>
  fact: string
  photo: { src: string; credit: string }
}

const photo = (id: string, credit: string) => ({ src: `/images/planets/${id}.jpg`, credit: `Photo: ${credit} · public domain` })

export const CELESTIAL: Record<string, CelestialSpec> = {
  sun: {
    id: 'sun', label: 'The Sun', type: 'Star · yellow dwarf (G2V)',
    facts: [['Diameter', '1,392,700 km'], ['From Earth', '149.6 million km'], ['Surface', 'about 5,500 °C'], ['Age', '4.6 billion years']],
    fact: 'It holds 99.86% of the Solar System’s mass; its light takes about 8 minutes 20 seconds to reach Earth.',
    photo: photo('sun', 'NASA / SDO (AIA)'),
  },
  mercury: {
    id: 'mercury', label: 'Mercury', type: 'Planet · rocky',
    facts: [['Diameter', '4,879 km'], ['From Sun', '57.9 million km'], ['Year', '88 Earth days'], ['Moons', 'None']],
    fact: 'The smallest planet: daytime reaches about 430 °C, yet nights drop to −180 °C.',
    photo: photo('mercury', 'NASA / JHUAPL / Carnegie Institution (MESSENGER)'),
  },
  venus: {
    id: 'venus', label: 'Venus', type: 'Planet · rocky',
    facts: [['Diameter', '12,104 km'], ['From Sun', '108.2 million km'], ['Year', '225 Earth days'], ['Moons', 'None']],
    fact: 'The hottest planet (about 465 °C) — its thick carbon-dioxide atmosphere traps heat. It also spins backwards.',
    photo: photo('venus', 'NASA / JPL-Caltech (Mariner 10)'),
  },
  moon: {
    id: 'moon', label: 'The Moon', type: 'Earth’s natural satellite',
    facts: [['Diameter', '3,474 km'], ['From Earth', '384,400 km'], ['Orbit', '27.3 days'], ['Visited', '12 astronauts (1969–72)']],
    fact: 'It is tidally locked, so the same side always faces Earth.',
    photo: photo('moon', 'NASA / GSFC / Arizona State University (LRO)'),
  },
  mars: {
    id: 'mars', label: 'Mars', type: 'Planet · rocky',
    facts: [['Diameter', '6,779 km'], ['From Sun', '227.9 million km'], ['Day', '24 h 37 min'], ['Moons', '2 (Phobos, Deimos)']],
    fact: 'Home to Olympus Mons, the largest volcano in the Solar System, about 22 km high.',
    photo: photo('mars', 'NASA / USGS (Viking)'),
  },
  jupiter: {
    id: 'jupiter', label: 'Jupiter', type: 'Planet · gas giant',
    facts: [['Diameter', '139,820 km'], ['From Sun', '778.5 million km'], ['Day', '9 h 56 min'], ['Year', '11.9 Earth years']],
    fact: 'The Great Red Spot is a storm wider than Earth that has been raging for centuries.',
    photo: photo('jupiter', 'NASA / JPL / University of Arizona (Cassini)'),
  },
  saturn: {
    id: 'saturn', label: 'Saturn', type: 'Planet · gas giant',
    facts: [['Diameter', '116,460 km'], ['From Sun', '1.43 billion km'], ['Day', '10 h 34 min'], ['Year', '29.4 Earth years']],
    fact: 'Its rings are mostly ice and span about 280,000 km, yet are typically only tens of metres thick.',
    photo: photo('saturn', 'NASA / JPL / Space Science Institute (Cassini)'),
  },
  uranus: {
    id: 'uranus', label: 'Uranus', type: 'Planet · ice giant',
    facts: [['Diameter', '50,724 km'], ['From Sun', '2.87 billion km'], ['Day', '17 h 14 min'], ['Year', '84 Earth years']],
    fact: 'Tilted about 98°, it rolls around the Sun on its side.',
    photo: photo('uranus', 'NASA / JPL (Voyager 2)'),
  },
  neptune: {
    id: 'neptune', label: 'Neptune', type: 'Planet · ice giant',
    facts: [['Diameter', '49,244 km'], ['From Sun', '4.5 billion km'], ['Day', '16 h 6 min'], ['Year', '165 Earth years']],
    fact: 'It has the fastest winds measured in the Solar System — over 2,000 km/h.',
    photo: photo('neptune', 'NASA / JPL (Voyager 2), processed by Aster Cowart'),
  },
}
