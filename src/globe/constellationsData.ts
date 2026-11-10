/**
 * Well-known constellations: their brightest stars (J2000 right ascension in hours,
 * declination in degrees, visual magnitude) and the usual stick-figure lines.
 */
export type Star = [ra: number, dec: number, mag: number]

export interface Constellation {
  name: string
  stars: Record<string, Star>
  lines: Array<[string, string]>
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Orion',
    stars: {
      betelgeuse: [5.919, 7.407, 0.5], rigel: [5.242, -8.202, 0.13], bellatrix: [5.418, 6.35, 1.64],
      saiph: [5.796, -9.67, 2.07], alnitak: [5.679, -1.943, 1.77], alnilam: [5.604, -1.202, 1.69],
      mintaka: [5.533, -0.299, 2.23], meissa: [5.585, 9.934, 3.39],
    },
    lines: [
      ['meissa', 'betelgeuse'], ['meissa', 'bellatrix'], ['betelgeuse', 'bellatrix'], ['betelgeuse', 'alnitak'],
      ['bellatrix', 'mintaka'], ['alnitak', 'alnilam'], ['alnilam', 'mintaka'], ['alnitak', 'saiph'],
      ['mintaka', 'rigel'], ['saiph', 'rigel'],
    ],
  },
  {
    name: 'Ursa Major',
    stars: {
      dubhe: [11.062, 61.751, 1.79], merak: [11.031, 56.382, 2.37], phecda: [11.897, 53.695, 2.44],
      megrez: [12.257, 57.033, 3.31], alioth: [12.9, 55.96, 1.77], mizar: [13.399, 54.925, 2.27], alkaid: [13.792, 49.313, 1.86],
    },
    lines: [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']],
  },
  {
    name: 'Cassiopeia',
    stars: { caph: [0.153, 59.15, 2.27], schedar: [0.675, 56.537, 2.24], navi: [0.945, 60.717, 2.15], ruchbah: [1.43, 60.235, 2.68], segin: [1.907, 63.67, 3.37] },
    lines: [['caph', 'schedar'], ['schedar', 'navi'], ['navi', 'ruchbah'], ['ruchbah', 'segin']],
  },
  {
    name: 'Cygnus',
    stars: { deneb: [20.69, 45.28, 1.25], sadr: [20.37, 40.257, 2.23], albireo: [19.512, 27.96, 3.05], gienah: [20.77, 33.97, 2.48], fawaris: [19.75, 45.131, 2.87] },
    lines: [['deneb', 'sadr'], ['sadr', 'albireo'], ['gienah', 'sadr'], ['sadr', 'fawaris']],
  },
  {
    name: 'Lyra',
    stars: { vega: [18.616, 38.784, 0.03], zeta: [18.746, 37.605, 4.3], sheliak: [18.835, 33.363, 3.45], sulafat: [18.982, 32.69, 3.24], delta: [18.908, 36.899, 4.3] },
    lines: [['vega', 'zeta'], ['zeta', 'sheliak'], ['sheliak', 'sulafat'], ['sulafat', 'delta'], ['delta', 'zeta']],
  },
  {
    name: 'Aquila',
    stars: { altair: [19.846, 8.868, 0.77], tarazed: [19.771, 10.613, 2.72], alshain: [19.922, 6.407, 3.71] },
    lines: [['tarazed', 'altair'], ['altair', 'alshain']],
  },
  {
    name: 'Scorpius',
    stars: {
      graffias: [16.091, -19.806, 2.62], dschubba: [16.006, -22.622, 2.29], pi: [15.981, -26.114, 2.89], sigma: [16.353, -25.593, 2.89],
      antares: [16.49, -26.432, 1.06], tau: [16.598, -28.216, 2.82], epsilon: [16.836, -34.293, 2.29], mu: [16.864, -38.047, 3.0],
      zeta: [16.91, -42.362, 3.6], eta: [17.203, -43.239, 3.3], sargas: [17.622, -42.998, 1.86], iota: [17.793, -40.127, 3.0],
      kappa: [17.708, -39.03, 2.39], shaula: [17.56, -37.104, 1.62],
    },
    lines: [
      ['graffias', 'dschubba'], ['dschubba', 'pi'], ['dschubba', 'sigma'], ['sigma', 'antares'], ['antares', 'tau'], ['tau', 'epsilon'],
      ['epsilon', 'mu'], ['mu', 'zeta'], ['zeta', 'eta'], ['eta', 'sargas'], ['sargas', 'iota'], ['iota', 'kappa'], ['kappa', 'shaula'],
    ],
  },
  {
    name: 'Crux',
    stars: { acrux: [12.443, -63.099, 0.77], mimosa: [12.795, -59.689, 1.25], gacrux: [12.519, -57.113, 1.63], delta: [12.252, -58.749, 2.79] },
    lines: [['acrux', 'gacrux'], ['mimosa', 'delta']],
  },
  {
    name: 'Leo',
    stars: {
      regulus: [10.14, 11.967, 1.35], eta: [10.122, 16.763, 3.5], algieba: [10.333, 19.842, 2.0], adhafera: [10.278, 23.417, 3.4],
      rasalas: [9.879, 26.007, 3.9], epsilon: [9.764, 23.774, 2.98], zosma: [11.235, 20.524, 2.56], chertan: [11.237, 15.43, 3.33],
      denebola: [11.818, 14.572, 2.14],
    },
    lines: [
      ['regulus', 'eta'], ['eta', 'algieba'], ['algieba', 'adhafera'], ['adhafera', 'rasalas'], ['rasalas', 'epsilon'],
      ['algieba', 'zosma'], ['zosma', 'denebola'], ['denebola', 'chertan'], ['chertan', 'regulus'],
    ],
  },
  {
    name: 'Taurus',
    stars: {
      aldebaran: [4.599, 16.509, 0.85], elnath: [5.438, 28.608, 1.65], zeta: [5.627, 21.143, 3.0], theta: [4.478, 15.871, 3.4],
      gamma: [4.33, 15.628, 3.65], delta: [4.382, 17.543, 3.76], epsilon: [4.477, 19.18, 3.53], pleiades: [3.791, 24.105, 2.87],
    },
    lines: [['elnath', 'epsilon'], ['epsilon', 'delta'], ['delta', 'gamma'], ['gamma', 'theta'], ['theta', 'aldebaran'], ['aldebaran', 'zeta']],
  },
  {
    name: 'Gemini',
    stars: { castor: [7.577, 31.888, 1.58], pollux: [7.755, 28.026, 1.14], alhena: [6.629, 16.399, 1.93], mebsuta: [6.732, 25.131, 3.06], tejat: [6.383, 22.514, 2.88], wasat: [7.335, 21.982, 3.53] },
    lines: [['castor', 'pollux'], ['castor', 'mebsuta'], ['mebsuta', 'tejat'], ['pollux', 'wasat'], ['wasat', 'alhena']],
  },
  {
    name: 'Canis Major',
    stars: { sirius: [6.752, -16.716, -1.46], mirzam: [6.378, -17.956, 1.98], wezen: [7.14, -26.393, 1.83], adhara: [6.977, -28.972, 1.5], aludra: [7.402, -29.303, 2.45] },
    lines: [['mirzam', 'sirius'], ['sirius', 'wezen'], ['wezen', 'adhara'], ['wezen', 'aludra']],
  },
  {
    name: 'Pegasus',
    stars: { markab: [23.079, 15.205, 2.49], scheat: [23.063, 28.083, 2.42], algenib: [0.22, 15.184, 2.83], alpheratz: [0.14, 29.091, 2.06], enif: [21.736, 9.875, 2.38] },
    lines: [['markab', 'scheat'], ['scheat', 'alpheratz'], ['alpheratz', 'algenib'], ['algenib', 'markab'], ['markab', 'enif']],
  },
]
