import { useEffect, useRef } from 'react'

/**
 * Old-film treatment over the story: grain, dust, scratches, gate flicker and a soft
 * vignette. Drawn into a tiny canvas (scaled up = soft, low-res memory look) at ~12 fps.
 */
export function FilmFX({ animate }: { animate: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = 320
    const H = 180
    canvas.width = W
    canvas.height = H
    const img = ctx.createImageData(W, H)
    let raf = 0
    let last = 0
    let scratchX = -1
    let scratchLife = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 83) return
      last = now
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255
        d[i] = v
        d[i + 1] = v * 0.92
        d[i + 2] = v * 0.78
        d[i + 3] = 22
      }
      ctx.putImageData(img, 0, 0)
      // Dust specks and the odd hair.
      ctx.fillStyle = 'rgba(40, 22, 8, 0.55)'
      const specks = Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 3) : 0
      for (let i = 0; i < specks; i++) {
        ctx.beginPath()
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.2 + 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
      if (Math.random() < 0.05) {
        ctx.strokeStyle = 'rgba(40, 22, 8, 0.5)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        const x = Math.random() * W
        const y = Math.random() * H
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + 6, y + 4, x + 3, y + 12)
        ctx.stroke()
      }
      // A vertical scratch that lives for a few frames.
      if (scratchLife <= 0 && Math.random() < 0.04) {
        scratchX = Math.random() * W
        scratchLife = 3 + Math.floor(Math.random() * 6)
      }
      if (scratchLife > 0) {
        ctx.strokeStyle = 'rgba(255, 244, 214, 0.35)'
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.moveTo(scratchX, 0)
        ctx.lineTo(scratchX + (Math.random() - 0.5) * 2, H)
        ctx.stroke()
        scratchX += (Math.random() - 0.5) * 1.5
        scratchLife--
      }
    }
    if (animate) raf = requestAnimationFrame(draw)
    else draw(1000)
    return () => cancelAnimationFrame(raf)
  }, [animate])

  return (
    <div className={`film-fx ${animate ? 'is-animated' : ''}`} aria-hidden>
      <canvas ref={canvasRef} className="film-fx__grain" />
      <div className="film-fx__vignette" />
    </div>
  )
}
