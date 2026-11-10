import { createRoot } from 'react-dom/client'
import { StudioIntro } from './StudioIntro'

/**
 * Plays the studio intro over the site if the early gate in index.html chose to
 * (first page load of this browser session, see `data-intro`). It renders in its
 * own React root, so the app underneath never re-renders because of it, and it
 * removes itself completely when done.
 */
export function mountStudioIntro(): void {
  const html = document.documentElement
  if (html.dataset.intro !== 'play') return

  const app = document.getElementById('root')
  const host = document.createElement('div')
  document.body.appendChild(host)
  // Keep focus and clicks off the site while the intro covers it.
  app?.setAttribute('inert', '')

  const root = createRoot(host)
  const done = () => {
    app?.removeAttribute('inert')
    delete html.dataset.intro
    // Unmount outside React's event dispatch.
    window.setTimeout(() => {
      root.unmount()
      host.remove()
    }, 0)
  }
  root.render(<StudioIntro onDone={done} />)
}
