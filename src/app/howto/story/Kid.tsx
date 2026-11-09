import { memo } from 'react'
import { solveArm, type Pt } from './anim'

export const INK = '#3b2412'
const SKIN_SHADE = 'rgba(80, 40, 15, 0.18)'

export type HairStyle = 'sidepart' | 'braids' | 'curly' | 'crew' | 'longbraid'
export type Eyes = 'open' | 'wide' | 'happy' | 'closed'
export type Mouth = 'smile' | 'grin' | 'open' | 'laugh' | 'o' | 'flat'

export interface KidLook {
  id: string
  name: string
  gender: 'boy' | 'girl'
  view: 'front' | 'back'
  hair: HairStyle
  skin: string
  shirt: string
  bottom: string
  accent: string
  glasses?: boolean
  bindi?: boolean
  tie?: boolean
}

export interface KidPose {
  lean: number
  /** Lean toward the atlas (front view: down, back view: up), px. */
  forward: number
  bob: number
  headTilt: number
  headTurn: number
  eyes: Eyes
  mouth: Mouth
  brows: number
  /** Hand targets in the kid's local space (null = resting on the knees). */
  left: Pt | null
  right: Pt | null
  pointLeft?: boolean
  pointRight?: boolean
}

const L1 = 62
const L2 = 60
const SHOULDER_Y = -100
const REST_L: Pt = { x: -50, y: 6 }
const REST_R: Pt = { x: 50, y: 6 }

function rotate(p: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

function Arm({ side, target, sleeve, skin, point }: { side: -1 | 1; target: Pt; sleeve: string; skin: string; point: boolean }) {
  const s = { x: side * 40, y: SHOULDER_Y }
  const { elbow, hand } = solveArm(s, target, L1, L2, side === -1 ? 1 : -1)
  const line = `M${s.x},${s.y} L${elbow.x},${elbow.y} L${hand.x},${hand.y}`
  const sleeveEnd = { x: s.x + (elbow.x - s.x) * 0.42, y: s.y + (elbow.y - s.y) * 0.42 }
  const dir = Math.atan2(hand.y - elbow.y, hand.x - elbow.x)
  const tip = { x: hand.x + Math.cos(dir) * 15, y: hand.y + Math.sin(dir) * 15 }
  return (
    <g>
      <path d={line} stroke={INK} strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={line} stroke={skin} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M${s.x},${s.y} L${sleeveEnd.x},${sleeveEnd.y}`} stroke={INK} strokeWidth={24} strokeLinecap="round" />
      <path d={`M${s.x},${s.y} L${sleeveEnd.x},${sleeveEnd.y}`} stroke={sleeve} strokeWidth={18.5} strokeLinecap="round" />
      {point ? (
        <>
          <path d={`M${hand.x},${hand.y} L${tip.x},${tip.y}`} stroke={INK} strokeWidth={8.5} strokeLinecap="round" />
          <path d={`M${hand.x},${hand.y} L${tip.x},${tip.y}`} stroke={skin} strokeWidth={4.5} strokeLinecap="round" />
        </>
      ) : null}
      <circle cx={hand.x} cy={hand.y} r={10.5} fill={skin} stroke={INK} strokeWidth={3} />
    </g>
  )
}

function eyeShape(kind: Eyes, x: number, y: number) {
  switch (kind) {
    case 'happy':
      return <path d={`M${x - 6},${y + 2} Q${x},${y - 7} ${x + 6},${y + 2}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    case 'closed':
      return <path d={`M${x - 6},${y} Q${x},${y + 4} ${x + 6},${y}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    case 'wide':
      return (
        <g>
          <ellipse cx={x} cy={y} rx={5.6} ry={7.6} fill={INK} />
          <circle cx={x + 1.8} cy={y - 2.6} r={1.8} fill="#f6e9cf" />
        </g>
      )
    default:
      return (
        <g>
          <ellipse cx={x} cy={y} rx={4.4} ry={6} fill={INK} />
          <circle cx={x + 1.4} cy={y - 2} r={1.4} fill="#f6e9cf" />
        </g>
      )
  }
}

function mouthShape(kind: Mouth, x: number, y: number) {
  switch (kind) {
    case 'grin':
      return (
        <g>
          <path d={`M${x - 12},${y - 2} Q${x},${y + 14} ${x + 12},${y - 2} Z`} fill={INK} />
          <path d={`M${x - 10},${y - 1} L${x + 10},${y - 1} L${x + 8},${y + 3} L${x - 8},${y + 3} Z`} fill="#f6e9cf" />
        </g>
      )
    case 'laugh':
      return (
        <g>
          <path d={`M${x - 14},${y - 4} Q${x},${y + 20} ${x + 14},${y - 4} Z`} fill={INK} />
          <ellipse cx={x} cy={y + 7} rx={6} ry={3.5} fill="#b5562a" />
        </g>
      )
    case 'open':
      return <ellipse cx={x} cy={y + 2} rx={6} ry={8} fill={INK} />
    case 'o':
      return <circle cx={x} cy={y + 1} r={4.6} fill={INK} />
    case 'flat':
      return <path d={`M${x - 8},${y} L${x + 8},${y}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
    default:
      return <path d={`M${x - 10},${y - 1} Q${x},${y + 8} ${x + 10},${y - 1}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
  }
}

function braid(x0: number, y0: number, x1: number, y1: number, color: string, ribbon: string, links = 7) {
  const parts = []
  for (let i = 0; i < links; i++) {
    const k = i / (links - 1)
    parts.push(<ellipse key={i} cx={x0 + (x1 - x0) * k} cy={y0 + (y1 - y0) * k} rx={9} ry={8} fill={color} stroke={INK} strokeWidth={2.5} />)
  }
  return (
    <g>
      {parts}
      <path d={`M${x1},${y1 + 6} l-12,-8 l0,16 Z M${x1},${y1 + 6} l12,-8 l0,16 Z`} fill={ribbon} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={x1} cy={y1 + 6} r={4} fill={ribbon} stroke={INK} strokeWidth={2} />
    </g>
  )
}

const HAIR = '#2b1a0e'

function FrontHead({ look, pose }: { look: KidLook; pose: KidPose }) {
  const sx = pose.headTurn * 12
  const ex = 16
  const ey = -172
  return (
    <g>
      {look.hair === 'braids' ? (
        <>
          {braid(-40, -150, -50, -66, HAIR, look.accent)}
          {braid(40, -150, 50, -66, HAIR, look.accent)}
        </>
      ) : null}
      <circle cx={-42 + Math.max(0, pose.headTurn) * 4} cy={-168} r={9} fill={look.skin} stroke={INK} strokeWidth={3} />
      <circle cx={42 + Math.min(0, pose.headTurn) * 4} cy={-168} r={9} fill={look.skin} stroke={INK} strokeWidth={3} />
      <ellipse cx={0} cy={-170} rx={42} ry={45} fill={look.skin} stroke={INK} strokeWidth={3.2} />
      <ellipse cx={-24 + sx} cy={-154} rx={7} ry={4} fill="#c96f4c" opacity={0.35} />
      <ellipse cx={24 + sx} cy={-154} rx={7} ry={4} fill="#c96f4c" opacity={0.35} />
      {/* brows */}
      <path d={`M${-ex - 7 + sx},${-186 - pose.brows} Q${-ex + sx},${-190 - pose.brows} ${-ex + 7 + sx},${-186 - pose.brows}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={`M${ex - 7 + sx},${-186 - pose.brows} Q${ex + sx},${-190 - pose.brows} ${ex + 7 + sx},${-186 - pose.brows}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      {eyeShape(pose.eyes, -ex + sx, ey)}
      {eyeShape(pose.eyes, ex + sx, ey)}
      {look.glasses ? (
        <g fill="none" stroke={INK} strokeWidth={2.6}>
          <circle cx={-ex + sx} cy={ey} r={11} />
          <circle cx={ex + sx} cy={ey} r={11} />
          <path d={`M${-ex + 11 + sx},${ey - 1} L${ex - 11 + sx},${ey - 1}`} />
        </g>
      ) : null}
      <path d={`M${sx - 2},${-164} Q${sx + 3},${-158} ${sx - 3},${-156}`} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {mouthShape(pose.mouth, sx, -143)}
      {look.bindi ? <circle cx={sx} cy={-197} r={2.6} fill="#9c3d1c" /> : null}
      {/* hair */}
      {look.hair === 'sidepart' ? (
        <path
          d="M-45,-160 C-50,-224 48,-230 46,-162 C42,-180 34,-196 18,-202 C6,-196 -14,-200 -30,-192 C-38,-186 -42,-176 -45,-160 Z"
          fill={HAIR}
          stroke={INK}
          strokeWidth={3}
        />
      ) : null}
      {look.hair === 'braids' ? (
        <>
          <path d="M-46,-152 C-50,-226 50,-226 46,-152 C42,-186 24,-206 0,-207 C-24,-206 -42,-186 -46,-152 Z" fill={HAIR} stroke={INK} strokeWidth={3} />
          <path d="M0,-214 L0,-205" stroke="#6b4a2c" strokeWidth={2} />
        </>
      ) : null}
      {look.hair === 'curly' ? (
        <g fill={HAIR} stroke={INK} strokeWidth={2.6}>
          {[190, 214, 238, 262, 286, 310, 334, 358].map((a) => {
            const r = (a * Math.PI) / 180
            return <circle key={a} cx={Math.cos(r) * 38} cy={-178 + Math.sin(r) * 38} r={14} />
          })}
          <ellipse cx={0} cy={-200} rx={34} ry={18} stroke="none" />
        </g>
      ) : null}
    </g>
  )
}

function BackHead({ look, pose }: { look: KidLook; pose: KidPose }) {
  const shift = pose.headTurn * 10
  return (
    <g>
      <circle cx={-42 - shift * 0.3} cy={-166} r={9} fill={look.skin} stroke={INK} strokeWidth={3} />
      <circle cx={42 - shift * 0.3} cy={-166} r={9} fill={look.skin} stroke={INK} strokeWidth={3} />
      <ellipse cx={0} cy={-170} rx={42} ry={45} fill={look.skin} stroke={INK} strokeWidth={3.2} />
      {look.hair === 'crew' ? (
        <path d="M-43,-160 C-48,-226 48,-226 43,-160 C38,-140 -38,-140 -43,-160 Z" fill={HAIR} stroke={INK} strokeWidth={3} />
      ) : (
        <>
          <path d="M-44,-150 C-50,-228 50,-228 44,-150 C36,-128 -36,-128 -44,-150 Z" fill={HAIR} stroke={INK} strokeWidth={3} />
          <path d="M-40,-196 Q0,-226 40,-196" stroke={look.accent} strokeWidth={6} fill="none" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

function Clothes({ look, part }: { look: KidLook; part: 'legs' | 'upper' }) {
  const torso = 'M-36,0 C-40,-40 -46,-80 -42,-100 Q0,-116 42,-100 C46,-80 40,-40 36,0 Z'
  const lap = 'M-74,18 C-76,-8 -40,-16 0,-12 C40,-16 76,-8 74,18 C60,36 -60,36 -74,18 Z'
  const girl = look.gender === 'girl'
  if (part === 'legs') {
    return (
    <g>
      {/* crossed legs / skirt */}
      {girl ? (
        <path d="M-82,22 C-80,-6 -40,-18 0,-14 C40,-18 80,-6 82,22 C64,40 -64,40 -82,22 Z" fill={look.bottom} stroke={INK} strokeWidth={3} />
      ) : (
        <>
          <ellipse cx={-60} cy={12} rx={17} ry={14} fill={look.skin} stroke={INK} strokeWidth={3} />
          <ellipse cx={60} cy={12} rx={17} ry={14} fill={look.skin} stroke={INK} strokeWidth={3} />
          <path d={lap} fill={look.bottom} stroke={INK} strokeWidth={3} />
        </>
      )}
      {look.view === 'front' ? (
        <>
          <ellipse cx={-26} cy={26} rx={13} ry={7} fill={look.skin} stroke={INK} strokeWidth={2.6} />
          <ellipse cx={26} cy={26} rx={13} ry={7} fill={look.skin} stroke={INK} strokeWidth={2.6} />
        </>
      ) : null}
    </g>
    )
  }
  return (
    <g>
      <path d={torso} fill={look.shirt} stroke={INK} strokeWidth={3.2} />
      <path d="M-30,-20 Q0,-12 30,-20" stroke={SKIN_SHADE} strokeWidth={6} fill="none" />
      {look.view === 'front' ? (
        <>
          {girl ? (
            <>
              <path d="M-30,-62 Q0,-56 30,-62 L34,-4 Q0,4 -34,-4 Z" fill={look.bottom} stroke={INK} strokeWidth={2.8} />
              <path d="M-28,-62 L-24,-102 M28,-62 L24,-102" stroke={look.bottom} strokeWidth={9} />
              <path d="M-28,-62 L-24,-102 M28,-62 L24,-102" stroke={INK} strokeWidth={1.6} opacity={0.6} />
            </>
          ) : null}
          <path d="M-16,-108 L0,-92 L16,-108 L10,-114 L0,-104 L-10,-114 Z" fill={look.shirt} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
          {look.tie ? (
            <path d="M0,-96 L-7,-86 L-4,-48 L0,-42 L4,-48 L7,-86 Z" fill={look.accent} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          ) : null}
          {!girl && !look.tie ? <rect x={12} y={-84} width={16} height={14} rx={2} fill="none" stroke={INK} strokeWidth={2.2} /> : null}
        </>
      ) : girl ? (
        <path d="M-30,-102 L28,-20 M30,-102 L-28,-20" stroke={look.bottom} strokeWidth={10} strokeLinecap="round" />
      ) : (
        <path d="M0,-108 L0,-10" stroke={SKIN_SHADE} strokeWidth={3} />
      )}
      <rect x={-9} y={-124} width={18} height={24} fill={look.skin} stroke={INK} strokeWidth={3} />
    </g>
  )
}

/** A seated, cross-legged schoolchild. Origin = hips; local units ≈ px at scale 1. */
export const Kid = memo(function Kid({
  look,
  pose,
  layer = 'all',
}: {
  look: KidLook
  pose: KidPose
  /**
   * Split rendering so a child sits *behind* the atlas: legs and body go under the book,
   * then the arms are drawn again on top so hands can still reach across the pages.
   */
  layer?: 'all' | 'legs' | 'upper' | 'body' | 'arms'
}) {
  const back = look.view === 'back'
  const fy = back ? -pose.forward : pose.forward
  // Resting hands stay on the knees even when the upper body leans.
  const toUpper = (p: Pt | null, rest: Pt) => rotate({ x: (p ?? rest).x, y: (p ?? rest).y - fy }, -pose.lean)
  const left = toUpper(pose.left, REST_L)
  const right = toUpper(pose.right, REST_R)
  return (
    <g transform={`translate(0 ${pose.bob})`}>
      {layer === 'all' || layer === 'legs' || layer === 'body' ? <Clothes look={look} part="legs" /> : null}
      {layer === 'arms' ? (
        <g transform={`translate(0 ${fy}) rotate(${pose.lean})`}>
          <Arm side={-1} target={left} sleeve={look.shirt} skin={look.skin} point={!!pose.pointLeft} />
          <Arm side={1} target={right} sleeve={look.shirt} skin={look.skin} point={!!pose.pointRight} />
        </g>
      ) : layer === 'body' ? (
        <g transform={`translate(0 ${fy}) rotate(${pose.lean})`}>
          <Clothes look={look} part="upper" />
          <g transform={`rotate(${pose.headTilt} 0 -122)`}>
            {back ? <BackHead look={look} pose={pose} /> : <FrontHead look={look} pose={pose} />}
          </g>
        </g>
      ) : layer !== 'legs' ? (
      <g transform={`translate(0 ${fy}) rotate(${pose.lean})`}>
        <Clothes look={look} part="upper" />
        {back ? (
          <>
            <Arm side={-1} target={left} sleeve={look.shirt} skin={look.skin} point={!!pose.pointLeft} />
            <Arm side={1} target={right} sleeve={look.shirt} skin={look.skin} point={!!pose.pointRight} />
            {look.hair === 'longbraid' ? braid(0, -132, pose.headTurn * -6, -26, HAIR, look.accent, 8) : null}
            <g transform={`rotate(${pose.headTilt} 0 -122)`}>
              <BackHead look={look} pose={pose} />
            </g>
          </>
        ) : (
          <>
            <g transform={`rotate(${pose.headTilt} 0 -122)`}>
              <FrontHead look={look} pose={pose} />
            </g>
            <Arm side={-1} target={left} sleeve={look.shirt} skin={look.skin} point={!!pose.pointLeft} />
            <Arm side={1} target={right} sleeve={look.shirt} skin={look.skin} point={!!pose.pointRight} />
          </>
        )}
      </g>
      ) : null}
    </g>
  )
})
