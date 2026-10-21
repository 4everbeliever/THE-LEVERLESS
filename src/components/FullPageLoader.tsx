import { Brand } from './Brand'

export function FullPageLoader() {
  return (
    <div className="route-loader" role="status" aria-label="Loading">
      <Brand />
      <span className="loader-ring" />
    </div>
  )
}
