import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AppRole, Profile } from '../types/auth'
import { useAuth } from './useAuth'

export const profileKey = (userId: string | undefined) => ['profile', userId] as const

/** The signed-in user's profile and role. Role defaults to 'customer' until it loads or if it cannot be read. */
export function useProfile() {
  const { user, isPending: sessionPending } = useAuth()

  const query = useQuery({
    queryKey: profileKey(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })

  const role: AppRole = query.data?.role ?? 'customer'

  return {
    profile: query.data ?? null,
    role,
    isAdmin: role === 'admin',
    isStaff: role === 'staff' || role === 'admin',
    isPending: sessionPending || (Boolean(user) && query.isPending),
    /** Set when the profile could not be read, for example if the SQL migration has not been run yet. */
    error: query.error as Error | null,
  }
}
