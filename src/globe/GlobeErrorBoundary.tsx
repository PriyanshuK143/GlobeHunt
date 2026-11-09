import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class GlobeErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[GLOBEHUNT] Globe failed to render', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="globe-error" role="alert">
          <p>Unable to load the globe.</p>
          <p className="globe-error__detail">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
