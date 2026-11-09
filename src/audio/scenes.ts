import { bell, noise, pad, pluck, tone, type Out } from './synth'

/**
 * Generative, original music + ambience. Each scene schedules its own notes a little
 * ahead of the audio clock (lookahead scheduler), with randomised variation so the
 * loop never audibly repeats. Scenes fade through their own gain node, so crossfades
 * never overlap two copies of the same scene.
 */
export interface SceneContext {
  ctx: AudioContext
  music: Out
  ambient: Out
}

const LOOKAHEAD = 0.6
const TICK_MS = 150

abstract class Scheduled {
  protected next = 0
  private timer = 0
  protected readonly gain: GainNode
  protected readonly out: Out
  protected readonly sc: SceneContext

  constructor(sc: SceneContext, target: Out) {
    this.sc = sc
    this.gain = sc.ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(target.dry)
    this.out = { dry: this.gain, wet: target.wet, wetAmount: target.wetAmount }
  }

  start(fade = 2.5) {
    const now = this.sc.ctx.currentTime
    this.next = now + 0.1
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(1, now + fade)
    this.timer = window.setInterval(() => this.pump(), TICK_MS)
    this.pump()
  }

  /** Fade out, stop scheduling and release the graph. */
  stop(fade = 2.5) {
    window.clearInterval(this.timer)
    const now = this.sc.ctx.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(0, now + fade)
    window.setTimeout(() => this.gain.disconnect(), (fade + 6) * 1000)
  }

  private pump() {
    const horizon = this.sc.ctx.currentTime + LOOKAHEAD
    // Never try to catch up on a backlog (e.g. after the tab was suspended).
    if (this.next < this.sc.ctx.currentTime - 1) this.next = this.sc.ctx.currentTime + 0.05
    let guard = 0
    while (this.next < horizon && guard++ < 32) {
      this.next += this.step(this.next)
    }
  }

  /** Schedule events at time t; return seconds until the next step. */
  protected abstract step(t: number): number
}

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
const chance = (p: number) => Math.random() < p

/* ───────── Home: "Orbital Observatory" — D major, floating, nostalgic ───────── */

const HOME_CHORDS = [
  [50, 57, 64, 66, 69], // D add9
  [47, 54, 61, 62, 66], // Bm add9
  [43, 50, 57, 59, 66], // Gmaj7 add9
  [45, 52, 59, 61, 64], // A add9
]
const HOME_MELODY = [74, 76, 78, 81, 83, 86, 88, 90] // D major pentatonic, upper register

export class HomeMusic extends Scheduled {
  private chord = 0
  private beat = 0
  private lastNote = 0
  private readonly CHORD_BEATS = 6
  private readonly BEAT = 1.5

  protected step(t: number): number {
    if (this.beat % this.CHORD_BEATS === 0) {
      const notes = HOME_CHORDS[this.chord % HOME_CHORDS.length]
      pad(this.sc.ctx, { ...this.out, wetAmount: 0.45 }, notes, t, this.CHORD_BEATS * this.BEAT, { level: 0.055, cutoff: 1100 })
      this.chord++
    }
    // Sparse music-box chimes over the pads, never the same note twice in a row.
    if (this.beat % this.CHORD_BEATS !== 0 && chance(0.42)) {
      let n = pick(HOME_MELODY)
      if (n === this.lastNote) n = HOME_MELODY[(HOME_MELODY.indexOf(n) + 2) % HOME_MELODY.length]
      this.lastNote = n
      bell(this.sc.ctx, { ...this.out, wetAmount: 0.6 }, n, t + (chance(0.3) ? this.BEAT / 2 : 0), { level: 0.035, decay: 3.2, ratio: 3.5, brightness: 0.8 })
    }
    this.beat++
    return this.BEAT
  }
}

/* ───────── Gameplay: "Survey" — E minor, focused, gently pulsing ───────── */

const PLAY_CHORDS = [
  [40, 52, 59, 62, 66], // Em9
  [36, 48, 55, 59, 64], // Cmaj7
  [43, 50, 57, 59, 64], // G6/9
  [42, 50, 57, 62, 64], // D add9 / F#
]

export class GameplayMusic extends Scheduled {
  private chord = 0
  private eighth = 0
  private readonly EIGHTH = 60 / 92 / 2
  private readonly CHORD_EIGHTHS = 32
  private pattern = [0, 2, 3, 2, 4, 2, 3, 1]

  protected step(t: number): number {
    const chordNotes = PLAY_CHORDS[this.chord % PLAY_CHORDS.length]
    if (this.eighth % this.CHORD_EIGHTHS === 0) {
      pad(this.sc.ctx, { ...this.out, wetAmount: 0.35 }, chordNotes.slice(1), t, this.CHORD_EIGHTHS * this.EIGHTH, {
        level: 0.04,
        cutoff: 700,
        attack: 1.6,
      })
      if (chance(0.5)) this.pattern = [...this.pattern].sort(() => Math.random() - 0.5)
    }
    // Quiet arpeggio pulse — present but never demanding attention. Rests often.
    const idx = this.eighth % 8
    if (!(this.eighth % 16 >= 12 && chance(0.6))) {
      const note = chordNotes[1 + (this.pattern[idx] % 4)] + 12
      pluck(this.sc.ctx, { ...this.out, wetAmount: 0.25 }, note, t, { level: idx === 0 ? 0.03 : 0.02, decay: 0.45, cutoff: 1500 })
    }
    if (this.eighth % 64 === 40 && chance(0.6)) {
      bell(this.sc.ctx, { ...this.out, wetAmount: 0.6 }, chordNotes[4] + 12, t, { level: 0.022, decay: 3 })
    }
    this.eighth++
    if (this.eighth % this.CHORD_EIGHTHS === 0) this.chord++
    return this.EIGHTH
  }
}

/* ───────── Credits: "Homeward" — F major, uplifting, peaceful ending ───────── */

const CREDIT_CHORDS = [
  [41, 53, 57, 60, 67], // F add9
  [40, 52, 55, 60, 64], // C/E
  [38, 50, 57, 60, 65], // Dm7
  [34, 46, 53, 57, 62], // Bbmaj7
  [45, 53, 57, 60, 65], // F/A
  [43, 50, 55, 58, 65], // Gm7
  [34, 46, 53, 57, 62], // Bbmaj7
  [36, 48, 53, 55, 60], // Csus4
]
// Original motif (two phrases), played as long bell tones over the progression.
const CREDIT_MOTIF: Array<number | null> = [
  69, null, 72, 74, 77, null, 76, 74,
  72, null, null, 69, 67, null, 65, null,
  69, null, 72, 74, 77, null, 79, 81,
  79, null, 77, 76, 77, null, null, null,
]

export class CreditsMusic extends Scheduled {
  private beat = 0
  private readonly BEAT = 60 / 72
  private readonly CHORD_BEATS = 4

  protected step(t: number): number {
    const bar = Math.floor(this.beat / this.CHORD_BEATS)
    const chordNotes = CREDIT_CHORDS[bar % CREDIT_CHORDS.length]
    if (this.beat % this.CHORD_BEATS === 0) {
      pad(this.sc.ctx, { ...this.out, wetAmount: 0.5 }, chordNotes.slice(1), t, this.CHORD_BEATS * this.BEAT, {
        level: 0.05,
        cutoff: bar < 8 ? 800 : 1300,
        attack: 1.8,
      })
    }
    // Section 2+: the motif, very softly.
    if (bar >= 8) {
      const note = CREDIT_MOTIF[this.beat % CREDIT_MOTIF.length]
      // Chimes kept very soft and sparse (every other note), well behind the pads.
      if (note !== null && this.beat % 2 === 0) bell(this.sc.ctx, { ...this.out, wetAmount: 0.7 }, note, t, { level: 0.014, decay: 3.8, brightness: 0.6 })
    }
    // Underneath it all, a low drone so the credits feel like deep space too.
    if (this.beat % 16 === 0) {
      pad(this.sc.ctx, { ...this.out, wetAmount: 0.3 }, [29, 36], t, 16 * this.BEAT, { level: 0.04, cutoff: 170, attack: 4, release: 6 })
    }
    this.beat++
    return this.BEAT
  }
}

/* ───────── Ambience: rare comm chatter, telemetry, observatory air ───────── */

export class SpaceAmbience extends Scheduled {
  private nextRadio: number
  private nextTelemetry: number
  private nextAir = 0
  private readonly busy: boolean
  constructor(sc: SceneContext, target: Out, busy: boolean) {
    super(sc, target)
    this.busy = busy
    const now = sc.ctx.currentTime
    this.nextRadio = now + 18 + Math.random() * 20
    this.nextTelemetry = now + 6 + Math.random() * 10
  }

  protected step(t: number): number {
    const ctx = this.sc.ctx
    // A barely-audible low "room tone" of the observatory (not space noise).
    if (t >= this.nextAir) {
      noise(ctx, this.out, t, 12, { level: this.busy ? 0.004 : 0.007, type: 'lowpass', from: 260, q: 0.3, attack: 4 })
      this.nextAir = t + 10
    }
    if (!this.busy && t >= this.nextRadio) {
      // Distant radio: Quindar-style tone, a breath of static, closing tone.
      const pan = Math.random() * 1.2 - 0.6
      tone(ctx, this.out, 2525, t, 0.22, { level: 0.006, pan })
      noise(ctx, this.out, t + 0.3, 1.2 + Math.random() * 1.2, { level: 0.008, from: 1800, to: 1200, q: 2.5, tremolo: 9, pan })
      tone(ctx, this.out, 2475, t + 2.2, 0.22, { level: 0.005, pan })
      this.nextRadio = t + 35 + Math.random() * 40
    }
    if (t >= this.nextTelemetry) {
      const pips = 3 + Math.floor(Math.random() * 4)
      const base = 1800 + Math.random() * 1400
      const pan = Math.random() * 1.6 - 0.8
      for (let i = 0; i < pips; i++) {
        tone(ctx, this.out, base * (chance(0.3) ? 1.5 : 1), t + i * 0.09, 0.035, { level: this.busy ? 0.004 : 0.006, pan })
      }
      this.nextTelemetry = t + (this.busy ? 40 : 18) + Math.random() * 25
    }
    return 0.5
  }
}

/* ───────── Gameplay: "Mission Control" — drone, sonar, comms; tension at the end ───────── */

const MC_DRONES = [
  [28, 35, 40], // E1 B1 E2
  [28, 35, 43], // E1 B1 G2
  [26, 33, 40], // D1 A1 E2
  [28, 35, 38], // E1 B1 D2
]
const MC_OPEN = [52, 59, 64, 66, 71] // Em add9, high: the "drone opens up" on a result

export class MissionControlMusic extends Scheduled {
  private tension = 0
  private openUp = false
  private nextDrone = 0
  private nextPing = 0
  private nextComms = 0
  private nextStatic = 0
  private nextPulse = 0
  private drone = 0
  private pingPan = 0.35

  /** 0 = calm search, 1 = last seconds. Dropping back to 0 after tension opens the drone up. */
  setTension(v: number) {
    const next = Math.max(0, Math.min(1, v))
    if (this.tension > 0 && next === 0) this.openUp = true
    this.tension = next
  }

  start(fade = 2.5) {
    super.start(fade)
    const now = this.sc.ctx.currentTime
    this.nextDrone = now + 0.1
    this.nextPing = now + 2.5
    this.nextComms = now + 6 + Math.random() * 6
    this.nextStatic = now + 3
    this.nextPulse = now
  }

  protected step(t: number): number {
    const ctx = this.sc.ctx
    // Low drone: long overlapping layers so it never breathes in and out audibly.
    if (t >= this.nextDrone) {
      const notes = MC_DRONES[this.drone++ % MC_DRONES.length]
      pad(ctx, { ...this.out, wetAmount: 0.35 }, notes, t, 12, { level: 0.05, cutoff: 240 + this.tension * 160, attack: 4, release: 5 })
      this.nextDrone = t + 12
    }
    // Sonar ping with a softer echo, alternating sides. Faster as tension rises.
    if (t >= this.nextPing) {
      const pan = (this.pingPan = -this.pingPan)
      // Sonar on 1080 Hz (2.5 × 432), gliding gently down.
      tone(ctx, { ...this.out, wetAmount: 0.85 }, 1080, t, 0.16, { level: 0.02, pan, glideTo: 1026 })
      tone(ctx, { ...this.out, wetAmount: 0.95 }, 1080, t + 0.42, 0.14, { level: 0.007, pan: -pan, glideTo: 1026 })
      this.nextPing = t + (4.2 - this.tension * 2) + Math.random() * 0.6
    }
    // Distant comms: a quick two-tone beep pair, now and then.
    if (t >= this.nextComms) {
      const pan = Math.random() * 1.4 - 0.7
      const base = pick([1760, 1980, 2240])
      tone(ctx, this.out, base, t, 0.06, { level: 0.007, pan, type: 'square' })
      tone(ctx, this.out, base * (chance(0.5) ? 1.25 : 0.8), t + 0.1, 0.06, { level: 0.006, pan, type: 'square' })
      this.nextComms = t + 7 + Math.random() * 9
    }
    // Faint radio static breath.
    if (t >= this.nextStatic) {
      noise(ctx, this.out, t, 2 + Math.random() * 2, { level: 0.005, from: 2400, to: 1600, q: 1.8, tremolo: 6 + Math.random() * 6, pan: Math.random() * 1.2 - 0.6 })
      this.nextStatic = t + 9 + Math.random() * 10
    }
    // Last seconds: a soft heartbeat-like pulse that speeds up with tension.
    if (this.tension > 0 && t >= this.nextPulse) {
      tone(ctx, this.out, 92, t, 0.22, { level: 0.05 + this.tension * 0.03, glideTo: 46 })
      tone(ctx, this.out, 92, t + 0.18, 0.16, { level: 0.025, glideTo: 50 })
      this.nextPulse = t + (1.05 - this.tension * 0.55)
    } else if (this.tension === 0) {
      this.nextPulse = t
    }
    // Round over: the drone opens up into a brief, brighter chord.
    if (this.openUp) {
      this.openUp = false
      pad(ctx, { ...this.out, wetAmount: 0.55 }, MC_OPEN, t, 3, { level: 0.04, cutoff: 1500, attack: 0.6, release: 4 })
    }
    return 0.1
  }
}

/* ───────── How to Play: "Retro Space Class" — music box on a wobbly old tape ───────── */

// Original waltz in C major (3/4), one note per beat (null = rest).
const RSC_TUNE: Array<number | null> = [
  76, 79, 84, 83, 79, 76, 77, 81, 86, 84, null, null,
  79, 76, 72, 74, 77, 79, 76, 72, 74, 72, null, null,
  76, 79, 84, 86, 88, 86, 84, 83, 81, 79, null, 76,
  77, 76, 74, 72, 74, 76, 74, 71, 67, 72, null, null,
]
const RSC_BASS = [48, 53, 55, 48, 45, 53, 55, 48] // one per bar of three beats

export class RetroClassMusic extends Scheduled {
  private beat = 0
  private nextHiss = 0
  private readonly BEAT = 60 / 96
  private readonly tapeIn: GainNode
  private readonly tapeDelay: DelayNode
  private readonly lfos: OscillatorNode[] = []
  private readonly tapeOut: Out

  constructor(sc: SceneContext, target: Out) {
    super(sc, target)
    const ctx = sc.ctx
    // Tape chain: wow & flutter (modulated delay) → warm low-pass → scene gain.
    this.tapeIn = ctx.createGain()
    this.tapeDelay = ctx.createDelay(1.5)
    this.tapeDelay.delayTime.value = 0.03
    const warm = ctx.createBiquadFilter()
    warm.type = 'lowpass'
    warm.frequency.value = 3400
    warm.Q.value = 0.3
    this.tapeIn.connect(this.tapeDelay)
    this.tapeDelay.connect(warm)
    warm.connect(this.gain)
    for (const [hz, depth] of [
      [0.55, 0.0022], // wow
      [6.5, 0.00035], // flutter
    ] as const) {
      const lfo = ctx.createOscillator()
      const g = ctx.createGain()
      lfo.frequency.value = hz
      g.gain.value = depth
      lfo.connect(g)
      g.connect(this.tapeDelay.delayTime)
      lfo.start()
      this.lfos.push(lfo)
    }
    this.tapeOut = { dry: this.tapeIn, wet: target.wet, wetAmount: 0.35 }
  }

  start(fade = 2.5) {
    super.start(fade)
    this.nextHiss = this.sc.ctx.currentTime
  }

  /** The tape slows to a stop (pitch sinks) as it fades. */
  stop(fade = 2.5) {
    const now = this.sc.ctx.currentTime
    const d = this.tapeDelay.delayTime
    d.cancelScheduledValues(now)
    d.setValueAtTime(d.value, now)
    d.linearRampToValueAtTime(0.95, now + 1.3)
    super.stop(Math.min(fade, 1.4))
    window.setTimeout(() => this.lfos.forEach((o) => o.stop()), 2000)
  }

  protected step(t: number): number {
    const ctx = this.sc.ctx
    if (t >= this.nextHiss) {
      noise(ctx, { dry: this.gain }, t, 9, { level: 0.0045, type: 'highpass', from: 4200, q: 0.4, attack: 2 })
      this.nextHiss = t + 7.5
    }
    const bar = Math.floor(this.beat / 3)
    if (this.beat % 3 === 0) {
      const root = RSC_BASS[bar % RSC_BASS.length]
      pad(ctx, this.tapeOut, [root, root + 7, root + 16], t, this.BEAT * 3, { level: 0.022, cutoff: 700, attack: 0.5, release: 1.4 })
    }
    const note = RSC_TUNE[this.beat % RSC_TUNE.length]
    if (note !== null) {
      // Music-box tine: bright, quick FM bell with a slight random human timing.
      bell(ctx, this.tapeOut, note, t + Math.random() * 0.012, { level: 0.05, decay: 1.6, ratio: 5.2, brightness: 0.55 })
      if (this.beat % 3 === 0) bell(ctx, this.tapeOut, note - 12, t, { level: 0.02, decay: 1.2, ratio: 5.2, brightness: 0.4 })
    }
    this.beat++
    return this.BEAT
  }
}

/* ───────── Home / menu: "Event Horizon" — dark, mysterious, almost no chimes ───────── */

// Voiced in the range laptop / phone speakers actually reproduce (≈130–700 Hz).
const DS_CHORDS = [
  [48, 55, 62, 63, 67], // C minor (add9)
  [44, 51, 60, 63, 67], // Ab maj7
  [41, 48, 56, 60, 63], // F minor 9
  [49, 56, 60, 65, 68], // Db maj7 — the "Neapolitan" shadow
]
// A high, airy layer that drifts above (slow attack, no percussive edge).
const DS_AIR = [[74, 79], [72, 79], [72, 75], [72, 77]]

export class DeepSpaceMusic extends Scheduled {
  private nextSub = 0
  private nextChord = 0
  private nextRumble = 0
  private nextFall = 0
  private nextShimmer = 0
  private chord = 0

  start(fade = 2.5) {
    super.start(fade)
    const now = this.sc.ctx.currentTime
    this.nextSub = now + 0.1
    this.nextChord = now + 0.1
    this.nextRumble = now + 6
    this.nextFall = now + 14 + Math.random() * 8
    this.nextShimmer = now + 22 + Math.random() * 10
  }

  protected step(t: number): number {
    const ctx = this.sc.ctx
    // Sub drone: the deep gravity well everything sits in.
    if (t >= this.nextSub) {
      pad(ctx, { ...this.out, wetAmount: 0.35 }, [36, 43], t, 14, { level: 0.075, cutoff: 260, attack: 6, release: 8 })
      this.nextSub = t + 14
    }
    // Slow, dark chords — long overlaps, low cutoff, lots of space.
    if (t >= this.nextChord) {
      const idx = this.chord++ % DS_CHORDS.length
      // Immersion: the chord is split into two copies drifting in opposite directions
      // across the stereo field, and the airy layer floats from one side to the other.
      const side = idx % 2 === 0 ? 1 : -1
      pad(ctx, { ...this.out, wetAmount: 0.6 }, DS_CHORDS[idx], t, 11, { level: 0.055, cutoff: 1150, attack: 4.5, release: 7, pan: -0.55 * side, panTo: 0.25 * side })
      pad(ctx, { ...this.out, wetAmount: 0.6 }, DS_CHORDS[idx].map((n) => n + 0.06), t + 0.05, 11, { level: 0.05, cutoff: 1050, attack: 4.8, release: 7, pan: 0.55 * side, panTo: -0.25 * side })
      pad(ctx, { ...this.out, wetAmount: 0.85 }, DS_AIR[idx], t + 1.5, 9, { level: 0.03, cutoff: 2200, attack: 5, release: 7, pan: 0.8 * side, panTo: -0.8 * side })
      this.nextChord = t + 12
    }
    // Black-hole rumble: filtered noise that swells up and sinks away.
    if (t >= this.nextRumble) {
      noise(ctx, { ...this.out, wetAmount: 0.5 }, t, 11, { level: 0.04, type: 'lowpass', from: 140, to: 620, q: 0.6, attack: 5.5, pan: Math.random() * 1.2 - 0.6 })
      this.nextRumble = t + 18 + Math.random() * 12
    }
    // Light being pulled in: a slow falling tone deep in the reverb.
    if (t >= this.nextFall) {
      const hz = pick([330, 294, 262])
      tone(ctx, { ...this.out, wetAmount: 0.9 }, hz, t, 6, { level: 0.018, glideTo: hz / 2, type: 'triangle', pan: Math.random() * 1.2 - 0.6 })
      this.nextFall = t + 24 + Math.random() * 16
    }
    // A rare, faint shimmer far away (the only "chime" left).
    if (t >= this.nextShimmer) {
      bell(ctx, { ...this.out, wetAmount: 0.85 }, pick([75, 79, 82]), t, { level: 0.022, decay: 5, ratio: 3.5, brightness: 0.5 })
      this.nextShimmer = t + 26 + Math.random() * 18
    }
    return 0.5
  }
}
