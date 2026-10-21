import { Wrench } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Wrench size={19} strokeWidth={1.8} />
      </span>
      {!compact && (
        <span>
          Toolshed<span> Rentals</span>
        </span>
      )}
    </div>
  )
}
