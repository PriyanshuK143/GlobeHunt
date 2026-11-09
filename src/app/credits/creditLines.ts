/**
 * Skywriting credits — edit this list to add or change credits.
 *
 * Each block is written by the aircraft as one "page" in the sky; its lines are
 * written top to bottom. `wide` blocks take a full row in the final sky overview,
 * other blocks pair up side by side. `size` scales letter height (1 = standard).
 */
export interface CreditLine {
  text: string
  size?: number
}

export interface CreditBlock {
  id: string
  lines: CreditLine[]
  wide?: boolean
}

export const CREDIT_BLOCKS: CreditBlock[] = [
  { id: 'opening', wide: true, lines: [{ text: 'GLOBEHUNT', size: 1.9 }] },
  {
    id: 'idea',
    lines: [{ text: 'GAME IDEA & DESIGN BY', size: 0.8 }, { text: 'ESCAPE MATRIX STUDIOS', size: 1.1 }],
  },
  {
    id: 'dev',
    lines: [{ text: 'DEVELOPED BY', size: 0.8 }, { text: 'PRIYANSHU KAMBLE', size: 1.1 }],
  },
  {
    id: 'thanks',
    lines: [{ text: 'SPECIAL THANKS TO', size: 0.8 }, { text: 'OUR FRIENDS & PLAYERS', size: 1.0 }],
  },
  {
    id: 'thank-you',
    lines: [{ text: 'THANK YOU FOR', size: 0.95 }, { text: 'EXPLORING WITH US', size: 0.95 }],
  },
]

/** Required data / imagery attribution, shown small under the credits. */
export const CREDIT_ATTRIBUTION = 'Imagery: NASA · Map data: Natural Earth, GeoNames (CC BY 4.0)'

/** Plain-text version of every credit line (for screen readers). */
export const CREDIT_TEXT: string[] = CREDIT_BLOCKS.flatMap((b) => b.lines.map((l) => l.text))
