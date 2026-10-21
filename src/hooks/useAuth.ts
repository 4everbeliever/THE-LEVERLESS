import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export const authSessionKey = ['auth', 'session'] as const

export function useAuth() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: authSessionKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData<Session | null>(authSessionKey, session)
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  return {
    session: query.data ?? null,
    user: query.data?.user ?? null,
    isPending: query.isPending,
    error: query.error,
  }
}
