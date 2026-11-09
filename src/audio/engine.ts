import { CreditsMusic, DeepSpaceMusic, MissionControlMusic, RetroClassMusic, SpaceAmbience, type SceneContext } from './scenes'
import { bell, getNoise, makeImpulse, noise, pad, pluck, tone, type Out } from './synth'

export type MusicScene = 'none' | 'home' | 'gameplay' | 'credits' | 'howto'

export type SfxName =
  | 'click'
  | 'announce'
  | 'challenge'
  | 'place'
  | 'adjust'
  | 'discovery'
  | 'miss'
  | 'timeout'
  | 'roundEnd'
  | 'tick'
  | 'travel'
  | 'win'
  | 'results'
  | 'memory'
  | 'schoolBell'
  | 'pop'

export interface AudioLevels {
  master: number
  music: number
  ambient: number
  sfx: number
  muted: boolean
}

interface Stoppable {
  start: (fade?: number) => void
  stop: (fade?: number) => void
  setTension?: (v: number) => void
}

const CROSSFADE = 2.8
/** Fade-in for the first music after the player's first click / key press. */
const FIRST_FADE = 5
const SMOOTH = 0.12

/**
 * Single audio manager for the whole game.
 * - One AudioContext, created only after a user gesture (autoplay-safe).
 * - Buses: music / ambient / sfx → master → gentle compressor → speakers,
 *   plus a shared generated reverb.
 * - Scenes are idempotent: calling setScene('home') twice never doubles the music.
 * - Fades out and suspends when the tab is hidden; resumes on return.
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private buses!: Record<'music' | 'ambient' | 'sfx', GainNode>
  private reverb!: ConvolverNode
  private scene: MusicScene = 'none'
  private wantedScene: MusicScene = 'none'
  private music: Stoppable | null = null
  private ambience: Stoppable | null = null
  private levels: AudioLevels = { master: 0.7, music: 0.5, ambient: 0.5, sfx: 0.7, muted: false }
  private hidden = false
  private ducked = false
  private tension = 0
  private lastSfx = new Map<SfxName, number>()
  private aircraft: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode } | null = null

  /** Debug snapshot (dev tools / tests). */
  debugState() {
    return { context: this.ctx?.state ?? 'none', scene: this.scene, wanted: this.wantedScene, aircraft: Boolean(this.aircraft), levels: this.levels }
  }

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  private listeners = new Set<() => void>()
  /** Notified whenever audio becomes playable (or is suspended again). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  /**
   * Try to start without a click. Browsers only allow this on sites you often play
   * media on (Chrome's "media engagement"), so it may stay suspended until the first
   * click / key press — then unlock() takes over. Never throws.
   */
  tryAutoStart(): void {
    try {
      if (!this.ctx) this.build()
      const ctx = this.ctx
      if (!ctx || ctx.state === 'running' || this.hidden) return
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') this.applyScene()
        })
        .catch(() => {})
    } catch {
      // Audio unavailable — stay silent.
    }
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) this.build()
      if (this.ctx && this.ctx.state !== 'running' && !this.hidden) {
        void this.ctx.resume().then(() => this.applyScene())
      } else {
        this.applyScene()
      }
    } catch {
      // Audio unavailable — the game must keep working silently.
    }
  }

  private build() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor({ latencyHint: 'interactive' })
    this.ctx = ctx
    ctx.addEventListener('statechange', () => this.notify())
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    comp.attack.value = 0.02
    comp.release.value = 0.3
    comp.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.connect(comp)
    this.reverb = ctx.createConvolver()
    // Longer, deeper space for immersion.
    this.reverb.buffer = makeImpulse(ctx, 5.2, 2.4)
    const reverbReturn = ctx.createGain()
    reverbReturn.gain.value = 0.55
    this.reverb.connect(reverbReturn)
    reverbReturn.connect(this.master)
    this.buses = {
      music: ctx.createGain(),
      ambient: ctx.createGain(),
      sfx: ctx.createGain(),
    }
    Object.values(this.buses).forEach((b) => b.connect(this.master))
    getNoise(ctx)
    this.applyLevels(true)

    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private onVisibility = () => {
    const ctx = this.ctx
    if (!ctx) return
    this.hidden = document.hidden
    const now = ctx.currentTime
    if (document.hidden) {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setTargetAtTime(0, now, 0.08)
      window.setTimeout(() => {
        if (document.hidden) void ctx.suspend().catch(() => {})
      }, 400)
    } else {
      void ctx
        .resume()
        .then(() => this.applyLevels())
        .catch(() => {})
    }
  }

  setLevels(levels: AudioLevels): void {
    this.levels = levels
    this.applyLevels()
  }

  private applyLevels(immediate = false) {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    const set = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(now)
      if (immediate) p.setValueAtTime(v, now)
      else p.setTargetAtTime(v, now, SMOOTH)
    }
    const l = this.levels
    set(this.master.gain, l.muted || this.hidden ? 0 : l.master)
    const duck = this.ducked ? 0.35 : 1
    // Music sits forward; UI sounds stay a little under it.
    set(this.buses.music.gain, l.music * 1.9 * duck)
    set(this.buses.ambient.gain, l.ambient * 1.15 * duck)
    set(this.buses.sfx.gain, l.sfx * 0.72)
  }

  /** Softly lower music + ambience (e.g. while a pause menu is open). */
  setDucked(ducked: boolean): void {
    if (this.ducked === ducked) return
    this.ducked = ducked
    this.applyLevels()
  }

  /** Gameplay tension 0..1 (last seconds of a round). Ignored by scenes without it. */
  setTension(v: number): void {
    if (Math.abs(v - this.tension) < 0.02 && v !== 0) return
    this.tension = v
    this.music?.setTension?.(v)
  }

  /** Desired soundtrack. Idempotent; remembered until audio is unlocked. */
  setScene(scene: MusicScene): void {
    this.wantedScene = scene
    this.applyScene()
  }

  private out(bus: 'music' | 'ambient' | 'sfx', wet: number): Out {
    return { dry: this.buses[bus], wet: this.reverb, wetAmount: wet }
  }

  private applyScene() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    if (this.scene === this.wantedScene) return
    // The very first soundtrack after audio unlocks fades in slowly instead of popping in.
    const fade = this.scene === 'none' ? FIRST_FADE : CROSSFADE
    this.scene = this.wantedScene
    this.music?.stop(CROSSFADE)
    this.ambience?.stop(CROSSFADE)
    this.music = null
    this.ambience = null
    const sc: SceneContext = { ctx, music: this.out('music', 0.4), ambient: this.out('ambient', 0.5) }
    switch (this.scene) {
      case 'home':
        this.music = new DeepSpaceMusic(sc, sc.music)
        this.ambience = new SpaceAmbience(sc, sc.ambient, false)
        break
      case 'gameplay':
        this.music = new MissionControlMusic(sc, sc.music)
        this.ambience = new SpaceAmbience(sc, sc.ambient, true)
        this.music.setTension?.(this.tension)
        break
      case 'credits':
        this.music = new CreditsMusic(sc, sc.music)
        break
      case 'howto':
        this.music = new RetroClassMusic(sc, sc.music)
        break
      case 'none':
        break
    }
    this.music?.start(fade)
    this.ambience?.start(fade)
  }

  /** One-shot sound. Rate-limited per sound so React re-renders can't stack them. */
  play(name: SfxName): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const nowMs = performance.now()
    const minGap = name === 'tick' ? 600 : name === 'adjust' ? 250 : 120
    if (nowMs - (this.lastSfx.get(name) ?? 0) < minGap) return
    this.lastSfx.set(name, nowMs)

    const t = ctx.currentTime + 0.01
    const out = this.out('sfx', 0.3)
    const wet = this.out('sfx', 0.6)
    switch (name) {
      case 'click':
        // Soft, low "tap" on the 432 Hz series: 864 → 648 Hz, quick and rounded.
        tone(ctx, out, 864, t, 0.06, { level: 0.038, glideTo: 648, type: 'triangle' })
        break
      case 'announce':
        noise(ctx, wet, t, 1.6, { level: 0.02, type: 'bandpass', from: 300, to: 2400, q: 0.8, attack: 1.1 })
        bell(ctx, wet, 74, t + 0.9, { level: 0.06, decay: 3 })
        bell(ctx, wet, 81, t + 1.05, { level: 0.05, decay: 3 })
        break
      case 'challenge':
        // A new place to find: two warm rising chimes, like turning an atlas page.
        bell(ctx, wet, 76, t, { level: 0.07, decay: 2.2 })
        bell(ctx, wet, 83, t + 0.13, { level: 0.06, decay: 2.6 })
        break
      case 'place':
        tone(ctx, out, 648, t, 0.08, { level: 0.05, glideTo: 432, type: 'triangle' })
        noise(ctx, out, t, 0.04, { level: 0.012, type: 'bandpass', from: 1800, attack: 0.002 })
        break
      case 'adjust':
        tone(ctx, out, 972, t, 0.05, { level: 0.025, glideTo: 729, type: 'triangle' })
        break
      case 'discovery':
        // The signature "found it!" moment: bright arpeggio, shimmer and a warm swell.
        ;[74, 78, 81, 86].forEach((n, i) => bell(ctx, wet, n, t + i * 0.075, { level: 0.075, decay: 2.6 }))
        ;[90, 93].forEach((n, i) => bell(ctx, wet, n, t + 0.38 + i * 0.09, { level: 0.03, decay: 3.2, brightness: 0.6 }))
        pad(ctx, wet, [62, 66, 69, 74], t, 0.8, { level: 0.05, attack: 0.25, release: 2.2, cutoff: 1800 })
        break
      case 'miss':
        pluck(ctx, out, 57, t, { level: 0.06, decay: 0.28, cutoff: 900 })
        pluck(ctx, out, 53, t + 0.1, { level: 0.05, decay: 0.35, cutoff: 700 })
        break
      case 'timeout':
        bell(ctx, wet, 69, t, { level: 0.05, decay: 2, brightness: 0.5 })
        bell(ctx, wet, 64, t + 0.22, { level: 0.045, decay: 2.6, brightness: 0.5 })
        break
      case 'roundEnd':
        bell(ctx, wet, 79, t, { level: 0.045, decay: 2.2, brightness: 0.6 })
        bell(ctx, wet, 74, t + 0.16, { level: 0.04, decay: 2.6, brightness: 0.6 })
        break
      case 'tick':
        tone(ctx, out, 1296, t, 0.035, { level: 0.02 })
        break
      case 'travel':
        // Stylised atmospheric swoosh for camera travel (not an engine).
        noise(ctx, wet, t, 1.5, { level: 0.022, type: 'bandpass', from: 250, to: 1400, q: 0.9, attack: 0.6 })
        break
      case 'win':
        ;[72, 76, 79, 84].forEach((n, i) => bell(ctx, wet, n, t + i * 0.12, { level: 0.07, decay: 3.2 }))
        pad(ctx, wet, [60, 64, 67, 72, 76], t + 0.2, 1.8, { level: 0.06, attack: 0.5, release: 3, cutoff: 1600 })
        break
      case 'results':
        ;[67, 72, 76].forEach((n, i) => bell(ctx, wet, n, t + i * 0.14, { level: 0.055, decay: 3 }))
        break
      case 'memory':
        // Into the flashback: a long rising whoosh with a shimmer on top.
        noise(ctx, wet, t, 2.4, { level: 0.03, type: 'bandpass', from: 180, to: 3200, q: 0.7, attack: 1.6 })
        tone(ctx, wet, 440, t + 0.4, 1.8, { level: 0.012, glideTo: 1320, type: 'triangle' })
        bell(ctx, wet, 88, t + 1.9, { level: 0.03, decay: 3, brightness: 0.5 })
        break
      case 'schoolBell':
        // Soft classroom bell: a few quick strikes of a bright FM bell.
        for (let i = 0; i < 4; i++) bell(ctx, wet, 84, t + i * 0.11, { level: 0.04 - i * 0.006, decay: 1.4, ratio: 2.76, brightness: 1.4 })
        break
      case 'pop':
        // Happy "found it!" pop + a tiny two-note cheer.
        tone(ctx, out, 520, t, 0.09, { level: 0.07, glideTo: 1100 })
        bell(ctx, wet, 79, t + 0.07, { level: 0.06, decay: 1.8 })
        bell(ctx, wet, 84, t + 0.17, { level: 0.06, decay: 2.4 })
        break
    }
  }

  /* ───────── Credits aircraft: soft, stylised air rush (never a roaring jet) ───────── */

  startAircraft(): void {
    const ctx = this.ctx
    if (!ctx || this.aircraft) return
    const src = ctx.createBufferSource()
    src.buffer = getNoise(ctx)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 600
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.value = 0
    const pan = ctx.createStereoPanner()
    src.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(this.buses.sfx)
    src.start()
    gain.gain.setTargetAtTime(0.012, ctx.currentTime, 0.8)
    this.aircraft = { src, filter, gain, pan }
  }

  /** pan ∈ [-1, 1], intensity ∈ [0, 1] (speed / closeness), smoke on/off. */
  updateAircraft(pan: number, intensity: number, smoking: boolean): void {
    const ctx = this.ctx
    const a = this.aircraft
    if (!ctx || !a) return
    const now = ctx.currentTime
    a.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.15)
    a.filter.frequency.setTargetAtTime(420 + intensity * 900 + (smoking ? 300 : 0), now, 0.2)
    a.gain.gain.setTargetAtTime(0.006 + intensity * 0.014, now, 0.25)
  }

  stopAircraft(): void {
    const ctx = this.ctx
    const a = this.aircraft
    if (!ctx || !a) return
    this.aircraft = null
    a.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
    window.setTimeout(() => {
      try {
        a.src.stop()
      } catch {
        /* already stopped */
      }
      a.pan.disconnect()
    }, 2500)
  }
}

export const audio = new AudioEngine()

if (import.meta.env.DEV) {
  ;(window as unknown as { __GLOBEHUNT_AUDIO__?: unknown }).__GLOBEHUNT_AUDIO__ = audio
}
