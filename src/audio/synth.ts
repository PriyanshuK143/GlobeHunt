/**
 * Small library of original synthesized instruments (Web Audio, no assets).
 * Every voice is a short-lived node graph that stops itself, so nothing leaks.
 */

/**
 * Concert pitch A4 = 432 Hz (instead of 440). A small double-blind pilot study found
 * 432 Hz-tuned music lowered listeners' heart rate slightly more than 440 Hz
 * (Calamassi & Pomponi, Explore 2019; PMID 31031095). It also sounds a touch warmer.
 */
export const TUNING_A4 = 432
export const midiToHz = (m: number) => TUNING_A4 * Math.pow(2, (m - 69) / 12)

let noiseBuffer: AudioBuffer | null = null
export function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const len = ctx.sampleRate * 2
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

/** Generated stereo impulse response — a soft, wide "observatory" space. */
export function makeImpulse(ctx: BaseAudioContext, seconds = 3.8, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

export interface Out {
  dry: AudioNode
  /** Optional reverb send. */
  wet?: AudioNode
  wetAmount?: number
}

function connectOut(ctx: BaseAudioContext, node: AudioNode, out: Out) {
  node.connect(out.dry)
  if (out.wet && (out.wetAmount ?? 0) > 0) {
    const send = ctx.createGain()
    send.gain.value = out.wetAmount ?? 0.3
    node.connect(send)
    send.connect(out.wet)
  }
}

/** Warm analog-style pad: detuned saws + triangle through a slowly opening low-pass. */
export function pad(
  ctx: BaseAudioContext,
  out: Out,
  notes: number[],
  t: number,
  dur: number,
  opts: { level?: number; cutoff?: number; attack?: number; release?: number; pan?: number; panTo?: number } = {},
) {
  const level = opts.level ?? 0.05
  const attack = opts.attack ?? 2.4
  const release = opts.release ?? 3
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  const cutoff = opts.cutoff ?? 900
  filter.frequency.setValueAtTime(cutoff * 0.6, t)
  filter.frequency.linearRampToValueAtTime(cutoff, t + attack + dur * 0.4)
  filter.frequency.linearRampToValueAtTime(cutoff * 0.7, t + dur + release)
  filter.Q.value = 0.4
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(level, t + attack)
  env.gain.setValueAtTime(level, t + dur)
  env.gain.linearRampToValueAtTime(0.0001, t + dur + release)
  filter.connect(env)
  // Optional slow stereo drift: the layer glides between the ears while it sounds.
  if (opts.pan !== undefined) {
    const p = ctx.createStereoPanner()
    p.pan.setValueAtTime(opts.pan, t)
    p.pan.linearRampToValueAtTime(opts.panTo ?? opts.pan, t + dur + release)
    env.connect(p)
    connectOut(ctx, p, out)
  } else connectOut(ctx, env, out)
  const end = t + dur + release + 0.1
  for (const n of notes) {
    const f = midiToHz(n)
    for (const [type, detune, gain] of [
      ['sawtooth', -7, 0.35],
      ['sawtooth', 7, 0.35],
      ['triangle', 0, 0.6],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = gain / notes.length
      o.connect(g)
      g.connect(filter)
      o.start(t)
      o.stop(end)
    }
  }
}

/** Soft FM bell — the nostalgic "retro chime" voice of GLOBEHUNT. */
export function bell(
  ctx: BaseAudioContext,
  out: Out,
  midi: number,
  t: number,
  opts: { level?: number; decay?: number; ratio?: number; brightness?: number } = {},
) {
  const f = midiToHz(midi)
  const level = opts.level ?? 0.08
  const decay = opts.decay ?? 2.2
  const car = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  car.type = 'sine'
  mod.type = 'sine'
  car.frequency.value = f
  mod.frequency.value = f * (opts.ratio ?? 3.5)
  const idx = f * (opts.brightness ?? 1.2)
  modGain.gain.setValueAtTime(idx, t)
  modGain.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.05), t + decay * 0.6)
  mod.connect(modGain)
  modGain.connect(car.frequency)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(level, t + 0.006)
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  car.connect(env)
  connectOut(ctx, env, out)
  car.start(t)
  mod.start(t)
  car.stop(t + decay + 0.05)
  mod.stop(t + decay + 0.05)
}

/** Plucked triangle for gentle arpeggios. */
export function pluck(
  ctx: BaseAudioContext,
  out: Out,
  midi: number,
  t: number,
  opts: { level?: number; decay?: number; cutoff?: number; type?: OscillatorType } = {},
) {
  const o = ctx.createOscillator()
  o.type = opts.type ?? 'triangle'
  o.frequency.value = midiToHz(midi)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(opts.cutoff ?? 1600, t)
  filter.frequency.exponentialRampToValueAtTime(300, t + (opts.decay ?? 0.5))
  const env = ctx.createGain()
  const level = opts.level ?? 0.05
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(level, t + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, t + (opts.decay ?? 0.5))
  o.connect(filter)
  filter.connect(env)
  connectOut(ctx, env, out)
  o.start(t)
  o.stop(t + (opts.decay ?? 0.5) + 0.05)
}

/** Pure tone blip (telemetry pips, Quindar-style comm tones, ticks). */
export function tone(
  ctx: BaseAudioContext,
  out: Out,
  hz: number,
  t: number,
  dur: number,
  opts: { level?: number; type?: OscillatorType; pan?: number; glideTo?: number } = {},
) {
  const o = ctx.createOscillator()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(hz, t)
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur)
  const env = ctx.createGain()
  const level = opts.level ?? 0.03
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(level, t + Math.min(0.01, dur / 4))
  env.gain.setValueAtTime(level, t + dur * 0.7)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(env)
  let node: AudioNode = env
  if (opts.pan !== undefined) {
    const p = ctx.createStereoPanner()
    p.pan.value = opts.pan
    env.connect(p)
    node = p
  }
  connectOut(ctx, node, out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Filtered noise gesture: radio static, whooshes, air. */
export function noise(
  ctx: BaseAudioContext,
  out: Out,
  t: number,
  dur: number,
  opts: {
    level?: number
    type?: BiquadFilterType
    from?: number
    to?: number
    q?: number
    attack?: number
    tremolo?: number
    pan?: number
  } = {},
) {
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = opts.type ?? 'bandpass'
  filter.Q.value = opts.q ?? 1.2
  filter.frequency.setValueAtTime(opts.from ?? 800, t)
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  const env = ctx.createGain()
  const level = opts.level ?? 0.03
  const attack = opts.attack ?? dur * 0.3
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(level, t + attack)
  env.gain.linearRampToValueAtTime(0.0001, t + dur)
  src.connect(filter)
  filter.connect(env)
  let node: AudioNode = env
  if (opts.tremolo) {
    const trem = ctx.createGain()
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = opts.tremolo
    depth.gain.value = 0.5
    trem.gain.value = 0.5
    lfo.connect(depth)
    depth.connect(trem.gain)
    env.connect(trem)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
    node = trem
  }
  if (opts.pan !== undefined) {
    const p = ctx.createStereoPanner()
    p.pan.value = opts.pan
    node.connect(p)
    node = p
  }
  connectOut(ctx, node, out)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}
