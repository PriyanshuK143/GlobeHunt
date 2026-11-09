import { memo } from 'react'
import { INK } from './Kid'
import { BRAZIL_PATH, LAND_PATH } from './atlasSketch'

/** Where the world map sits on the open atlas (map units 360×180 → stage px). */
export const MAP = { cx: 800, cy: 642, sx: 1.0, sy: 0.74 }
export const mapToStage = (lng: number, lat: number) => ({
  x: MAP.cx + (lng + 180 - 180) * MAP.sx,
  y: MAP.cy + (90 - lat - 90) * MAP.sy,
})

const PAPER = '#efdcb4'
const WALL = '#e6cf9f'

/* ───────── Outside the window: a tree with two sparrows ───────── */

/** A small sparrow, facing right, sitting at (0, 0) on its feet. */
function Sparrow({ hop, bob, flick, turn }: { hop: string; bob: string; flick: string; turn?: string }) {
  return (
    <g>
      {turn ? <animateTransform attributeName="transform" type="scale" values="1 1;1 1;-1 1;-1 1;1 1" keyTimes="0;0.45;0.46;0.9;0.91" dur={turn} repeatCount="indefinite" calcMode="discrete" additive="sum" /> : null}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -9;0 0;0 0" keyTimes="0;0.6;0.66;0.72;1" dur={hop} repeatCount="indefinite" />
        {/* tail */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0 -12 -10;-14 -12 -10;0 -12 -10;0 -12 -10" keyTimes="0;0.08;0.16;1" dur={flick} repeatCount="indefinite" />
          <path d="M-12 -12 L-28 -18 L-27 -10 Z" fill="#6b4524" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        </g>
        {/* legs */}
        <path d="M-2 -4 L-3 0 M3 -4 L4 0" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        {/* body: brown back, pale belly */}
        <ellipse cx={0} cy={-11} rx={13} ry={8.5} fill="#e9d5ab" stroke={INK} strokeWidth={1.6} />
        <path d="M-12 -12 Q-4 -22 9 -16 Q4 -11 -6 -9 Z" fill="#8a5a32" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M-5 -15 L1 -13 M-8 -13 L-2 -11" stroke="#4e3218" strokeWidth={1.1} strokeLinecap="round" />
        {/* head */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0 10 -18;0 10 -18;14 10 -18;14 10 -18;-6 10 -18;0 10 -18" keyTimes="0;0.3;0.36;0.5;0.56;1" dur={bob} repeatCount="indefinite" />
          <circle cx={11} cy={-20} r={6.5} fill="#e9d5ab" stroke={INK} strokeWidth={1.5} />
          <path d="M6 -24 Q11 -28 16 -23 Q12 -22 7 -21 Z" fill="#7a4a26" />
          <circle cx={13} cy={-21} r={1.3} fill={INK} />
          <path d="M17 -21 L22 -19.5 L17 -18 Z" fill="#c98b3a" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
        </g>
      </g>
    </g>
  )
}

/** Tree seen through the window (clipped to the panes so it reads as outside). */
function WindowTree() {
  return (
    <g>
      <clipPath id="window-panes">
        <rect x={1097} y={77} width={306} height={286} />
      </clipPath>
      <g clipPath="url(#window-panes)">
        {/* distant hedge */}
        <path d="M1090 330 Q1150 300 1210 322 T1330 318 T1420 326 L1420 370 L1090 370 Z" fill="#b9a865" opacity={0.7} />
        {/* trunk and branches */}
        <path d="M1352 372 C1348 320 1340 270 1326 230 C1318 205 1300 186 1286 170 M1336 262 C1300 262 1240 280 1110 290" stroke="#6e4a2a" strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d="M1352 372 C1348 320 1340 270 1326 230 C1318 205 1300 186 1286 170 M1336 262 C1300 262 1240 280 1110 290" stroke={INK} strokeWidth={1.6} fill="none" opacity={0.5} />
        <path d="M1326 232 C1350 200 1372 186 1400 178" stroke="#6e4a2a" strokeWidth={8} fill="none" strokeLinecap="round" />
        {/* foliage, swaying gently in the breeze */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0 1340 360;1.6 1340 360;-0.8 1340 360;0 1340 360" dur="6.5s" repeatCount="indefinite" />
          {[
            [1290, 150, 48], [1350, 128, 52], [1232, 176, 40], [1385, 190, 44], [1300, 208, 38], [1180, 236, 30], [1395, 112, 36],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? '#8d955a' : '#7c8a4c'} stroke={INK} strokeWidth={1.6} opacity={0.95} />
          ))}
          {[[1270, 140], [1340, 120], [1220, 170], [1372, 176], [1310, 200]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} q6 -6 12 0`} stroke="#5f6a36" strokeWidth={2} fill="none" />
          ))}
        </g>
        {/* the two sparrows on the low branch */}
        <g transform="translate(1172 286) scale(1.3)">
          <Sparrow hop="3.4s" bob="2.6s" flick="1.9s" />
        </g>
        <g transform="translate(1240 279) scale(1.22)">
          <Sparrow hop="4.6s" bob="3.3s" flick="2.4s" turn="7.8s" />
        </g>
      </g>
    </g>
  )
}

/* ───────── Corner cupboard full of childhood games ───────── */

function Cupboard() {
  const wood = '#9a6b3c'
  const dark = '#7a4f28'
  return (
    <g stroke={INK} strokeWidth={3} strokeLinejoin="round">
      {/* body */}
      <rect x={1440} y={196} width={150} height={290} rx={4} fill={wood} />
      <rect x={1452} y={208} width={126} height={266} fill="#6a4322" />
      <rect x={1432} y={188} width={166} height={14} rx={3} fill={dark} />
      {/* shelves */}
      <rect x={1452} y={290} width={126} height={8} fill={dark} />
      <rect x={1452} y={380} width={126} height={8} fill={dark} />
      {/* top shelf: football + spinning top (lattu) */}
      <circle cx={1484} cy={268} r={20} fill="#f1e3c4" />
      <path d="M1484 258 L1493 264 L1490 275 L1478 275 L1475 264 Z" fill={INK} strokeWidth={1} />
      <path d="M1484 248 L1484 258 M1503 262 L1493 264 M1498 285 L1490 275 M1470 285 L1478 275 M1465 262 L1475 264" strokeWidth={1.5} />
      <path d="M1530 256 Q1550 252 1556 262 Q1552 276 1543 288 Q1534 276 1530 262 Z" fill="#c0632e" />
      <path d="M1533 262 Q1543 266 1554 262" fill="none" strokeWidth={1.5} stroke="#f1e3c4" />
      <path d="M1543 288 L1543 292" strokeWidth={2} />
      {/* middle shelf: carrom board leaning + marble jar */}
      <g transform="rotate(-8 1498 336)">
        <rect x={1466} y={302} width={64} height={64} rx={3} fill="#d9b77a" />
        <rect x={1474} y={310} width={48} height={48} fill="none" strokeWidth={1.5} />
        {[[1470, 306], [1526, 306], [1470, 362], [1526, 362]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill={INK} strokeWidth={0} />
        ))}
        <circle cx={1498} cy={334} r={6} fill="none" strokeWidth={1.5} />
      </g>
      <rect x={1540} y={334} width={30} height={42} rx={6} fill="rgba(230, 240, 235, 0.55)" />
      {[[1548, 366, '#3f7fb5'], [1560, 368, '#c0632e'], [1553, 356, '#5d9a52'], [1562, 354, '#e2b13c'], [1547, 348, '#b04a7a']].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={4} fill={c as string} strokeWidth={1} />
      ))}
      <rect x={1538} y={328} width={34} height={7} rx={2} fill={dark} />
      {/* bottom shelf: cricket bat + ball, skipping rope */}
      <g transform="rotate(-14 1488 430)">
        <rect x={1481} y={392} width={16} height={60} rx={4} fill="#e2c48e" />
        <rect x={1485} y={452} width={8} height={18} rx={2} fill="#7a4f28" />
      </g>
      <circle cx={1520} cy={462} r={8} fill="#b8432a" />
      <path d="M1514 458 Q1520 462 1526 458" fill="none" strokeWidth={1.2} stroke="#f1e3c4" />
      <path d="M1540 470 C1530 440 1575 432 1568 456 C1562 474 1544 466 1552 450 C1558 440 1572 446 1572 470" fill="none" strokeWidth={2.5} stroke="#c0632e" />
      <rect x={1544} y={466} width={6} height={10} rx={2} fill="#7a4f28" strokeWidth={1.5} />
      <rect x={1566} y={466} width={6} height={10} rx={2} fill="#7a4f28" strokeWidth={1.5} />
      {/* feet */}
      <rect x={1444} y={484} width={14} height={8} fill={dark} strokeWidth={2} />
      <rect x={1572} y={484} width={14} height={8} fill={dark} strokeWidth={2} />
    </g>
  )
}

/* ───────── Ceiling fan, turning slowly ───────── */

function CeilingFan() {
  return (
    <g stroke={INK} strokeWidth={3} strokeLinejoin="round">
      <rect x={926} y={-60} width={8} height={142} fill="#7a5430" />
      <ellipse cx={930} cy={84} rx={26} ry={11} fill="#8f6538" />
      {/* blades in perspective: rotate inside a vertically squashed group */}
      <g transform="translate(930 88) scale(1 0.26)">
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.6s" repeatCount="indefinite" />
          {[0, 120, 240].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M14 -10 L150 -26 Q162 0 150 26 L14 10 Z" fill="#c9a36a" strokeWidth={6} />
          ))}
          <circle r={22} fill="#7a5430" strokeWidth={6} />
        </g>
      </g>
      <ellipse cx={930} cy={96} rx={12} ry={6} fill="#6a4322" />
    </g>
  )
}

/** Classroom corner: wall, chalkboard, window light, wooden floor and a striped durrie. */
export const Room = memo(function Room() {
  return (
    <g>
      <rect x={-400} y={-1200} width={2400} height={1760} fill={WALL} />
      <rect x={-400} y={480} width={2400} height={1500} fill="#b98a55" />
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M${-200 + i * 150},480 L${-420 + i * 190},1200`} stroke="rgba(60,30,10,0.18)" strokeWidth={3} />
      ))}
      <rect x={-200} y={470} width={2000} height={18} fill="#8f6538" stroke={INK} strokeWidth={2} />
      {/* chalkboard */}
      <g>
        <rect x={140} y={90} width={430} height={240} rx={6} fill="#4a3a28" stroke="#6e4a26" strokeWidth={14} />
        <text x={180} y={150} fontFamily="'Patrick Hand', cursive" fontSize={34} fill="#e9dcc0" opacity={0.8}>
          Geography
        </text>
        <text x={190} y={196} fontFamily="'Patrick Hand', cursive" fontSize={22} fill="#e9dcc0" opacity={0.55}>
          Continents · Oceans · Rivers
        </text>
        <path d="M200,240 q40,-30 80,0 t80,0 t80,0" stroke="#e9dcc0" strokeWidth={3} fill="none" opacity={0.45} />
        <ellipse cx={470} cy={270} rx={34} ry={20} fill="none" stroke="#e9dcc0" strokeWidth={3} opacity={0.4} />
      </g>
      {/* window with warm light, the tree and sparrows outside, frame on top */}
      <g>
        <rect x={1090} y={70} width={320} height={300} fill="#f7e2a6" />
        <circle cx={1180} cy={150} r={40} fill="#fff1c4" opacity={0.9} />
        <WindowTree />
        <rect x={1090} y={70} width={320} height={300} fill="none" stroke="#7a5430" strokeWidth={14} />
        <path d="M1250,70 L1250,370 M1090,220 L1410,220" stroke="#7a5430" strokeWidth={10} />
      </g>
      <path d="M1100,370 L640,900 L1200,900 L1410,370 Z" fill="#fff2c8" opacity={0.16} />
      <path d="M1250,370 L900,900 L1100,900 L1330,370 Z" fill="#fff2c8" opacity={0.12} />
      {/* globe on a shelf */}
      <g>
        <rect x={700} y={250} width={190} height={14} fill="#7a5430" stroke={INK} strokeWidth={2} />
        <circle cx={795} cy={200} r={42} fill="#c9a36a" stroke={INK} strokeWidth={3} />
        <path d="M770,180 q20,-12 30,6 q14,10 -6,22 q-18,6 -24,-8 Z M808,214 q10,-4 14,6 q-4,10 -12,4 Z" fill="#8e6a3a" />
        <path d="M795,158 L795,248 M772,250 L818,250" stroke={INK} strokeWidth={3} />
      </g>
      {/* striped durrie under the circle */}
      <g>
        <ellipse cx={800} cy={700} rx={560} ry={200} fill="#c9773f" stroke={INK} strokeWidth={3} />
        <ellipse cx={800} cy={700} rx={500} ry={172} fill="none" stroke="#e8c58a" strokeWidth={16} />
        <ellipse cx={800} cy={700} rx={420} ry={140} fill="none" stroke="#9c4f27" strokeWidth={10} />
      </g>
      <g transform="translate(-528 0)">
        <Cupboard />
      </g>
      <CeilingFan />
      {/* school bags */}
      <g stroke={INK} strokeWidth={3}>
        <rect x={250} y={560} width={86} height={96} rx={14} fill="#7c5a36" />
        <rect x={264} y={580} width={58} height={30} rx={6} fill="#9a7348" />
        <rect x={1290} y={575} width={80} height={90} rx={14} fill="#86603a" />
      </g>
    </g>
  )
})

interface AtlasProps {
  /** 0 = closed, 1 = fully open. */
  open: number
  /** 0..1 glow on Brazil. */
  brazilGlow: number
  /** Little pencil mark where a wrong guess was (0..1 visibility). */
  wrongMark: number
}

/** The school atlas lying on the durrie, with a hand-inked world map. */
export const Atlas = memo(function Atlas({ open, brazilGlow, wrongMark }: AtlasProps) {
  const w = 200
  const top = 560
  const bottom = 732
  const spine = 800
  const mapOpacity = Math.max(0, Math.min(1, (open - 0.55) / 0.35))
  // Cover sweeps from the right page over to the left as the book opens.
  const coverX = spine + (w + 10) * (1 - 2 * open)
  const inside = open > 0.5
  const wrong = mapToStage(-102, 23)
  return (
    <g>
      <ellipse cx={spine} cy={bottom + 10} rx={240} ry={22} fill="rgba(40,20,5,0.3)" />
      {/* pages */}
      <path d={`M${spine},${top + 6} L${spine - w},${top} L${spine - w - 12},${bottom} L${spine},${bottom - 4} Z`} fill={PAPER} stroke={INK} strokeWidth={3} />
      <path d={`M${spine},${top + 6} L${spine + w},${top} L${spine + w + 12},${bottom} L${spine},${bottom - 4} Z`} fill={PAPER} stroke={INK} strokeWidth={3} />
      <g opacity={mapOpacity}>
        <clipPath id="atlas-pages">
          <path d={`M${spine - w - 12},${top} L${spine + w + 12},${top} L${spine + w + 12},${bottom} L${spine - w - 12},${bottom} Z`} />
        </clipPath>
        <g clipPath="url(#atlas-pages)">
          <g transform={`translate(${MAP.cx - 180 * MAP.sx} ${MAP.cy - 90 * MAP.sy}) scale(${MAP.sx} ${MAP.sy})`}>
            {[30, 60, 90, 120, 150].map((y) => (
              <path key={y} d={`M0,${y} L360,${y}`} stroke="#b89a68" strokeWidth={y === 90 ? 0.9 : 0.5} strokeDasharray={y === 90 ? '3 2' : undefined} vectorEffect="non-scaling-stroke" />
            ))}
            {[60, 120, 180, 240, 300].map((x) => (
              <path key={x} d={`M${x},0 L${x},180`} stroke="#b89a68" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={LAND_PATH} fill="#c49a5e" stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path
              d={BRAZIL_PATH}
              fill={`rgba(214, 110, 40, ${0.15 + brazilGlow * 0.7})`}
              stroke={brazilGlow > 0.05 ? '#8a3a12' : INK}
              strokeWidth={brazilGlow > 0.05 ? 2.4 : 0.8}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        {wrongMark > 0 ? (
          <g opacity={wrongMark} stroke="#7a2e10" strokeWidth={3} strokeLinecap="round">
            <path d={`M${wrong.x - 8},${wrong.y - 6} L${wrong.x + 8},${wrong.y + 6} M${wrong.x + 8},${wrong.y - 6} L${wrong.x - 8},${wrong.y + 6}`} />
          </g>
        ) : null}
        <path d={`M${spine},${top + 6} L${spine},${bottom - 4}`} stroke="rgba(60,30,10,0.45)" strokeWidth={6} />
      </g>
      {/* cover (front while closing, inside board once flipped) */}
      {open < 0.999 ? (
        <g>
          <path
            d={`M${spine},${top + 4} L${coverX},${top - 2 - Math.abs(1 - 2 * open) * 4} L${coverX + (inside ? -12 : 12) * Math.abs(1 - 2 * open)},${bottom + 2} L${spine},${bottom - 2} Z`}
            fill={inside ? '#d8bf8c' : '#7b3f1c'}
            stroke={INK}
            strokeWidth={3}
          />
          {!inside && open < 0.35 ? (
            <text x={spine + (coverX - spine) / 2} y={(top + bottom) / 2 + 10} textAnchor="middle" fontFamily="'Patrick Hand', cursive" fontSize={34 * (1 - 2 * open)} fill="#e8c58a">
              ATLAS
            </text>
          ) : null}
        </g>
      ) : (
        <path d={`M${spine},${top + 4} L${spine - w - 6},${top - 6} L${spine - w - 18},${bottom + 4} L${spine},${bottom - 2}`} fill="none" stroke="#7b3f1c" strokeWidth={6} opacity={0.9} />
      )}
    </g>
  )
})
