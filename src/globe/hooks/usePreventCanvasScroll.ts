import { useEffect, type RefObject } from 'react'

/**
 * Prevents page scroll / browser gestures while interacting with the globe canvas.
 */
export function usePreventCanvasScroll(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const prevent = (event: Event) => {
      event.preventDefault()
    }

    el.addEventListener('wheel', prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })

    return () => {
      el.removeEventListener('wheel', prevent)
      el.removeEventListener('touchmove', prevent)
    }
  }, [containerRef])
}
