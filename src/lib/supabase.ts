import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

const requestTimeoutMs = 20_000

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController()
  const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const abortRequest = () => controller.abort()
  const timeout = window.setTimeout(abortRequest, requestTimeoutMs)

  if (requestSignal?.aborted) {
    abortRequest()
  } else {
    requestSignal?.addEventListener('abort', abortRequest, { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
    requestSignal?.removeEventListener('abort', abortRequest)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
})
