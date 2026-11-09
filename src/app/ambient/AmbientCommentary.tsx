import { useAmbientCommentary, type AmbientCommentaryOptions } from './commentary'

interface AmbientCommentaryProps extends AmbientCommentaryOptions {
  /** Placement: gameplay sits bottom-left, clear of target/timer/score. */
  placement?: 'gameplay' | 'showcase'
}

/** Ambient one-liner. Non-interactive (pointer-events: none), never blocks play. */
export function AmbientCommentary({ placement = 'gameplay', ...options }: AmbientCommentaryProps) {
  const { message, visible, id } = useAmbientCommentary(options)
  // Always mounted so the opacity transition runs for every new line.
  return (
    <p
      data-line={id}
      className={`ambient-commentary ambient-commentary--${placement} ${visible ? 'is-visible' : ''}`}
      aria-hidden
    >
      {message ?? ''}
    </p>
  )
}
