import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Set dummy Supabase credentials for testing environment
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ophgpdwzoeuheshcfrrc.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'dummy-anon-key'

afterEach(() => {
  cleanup()
})
