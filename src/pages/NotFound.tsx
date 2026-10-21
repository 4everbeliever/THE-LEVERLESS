import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Brand } from '../components/Brand'

export default function NotFound() {
  return (
    <main className="not-found-page">
      <Brand />
      <span className="not-found-code">404</span>
      <h1>That page is out on rent.</h1>
      <p>The page you’re looking for doesn’t exist or may have moved.</p>
      <Link className="button button-primary" to="/">
        <ArrowLeft size={16} />
        <span>Back to home</span>
      </Link>
    </main>
  )
}
