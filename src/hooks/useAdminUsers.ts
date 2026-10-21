import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AppRole, Profile } from '../types/auth'
import { profileKey } from './useProfile'

const usersKey = ['admin', 'users'] as const

/** All users. Row Level Security only returns other people's rows to admins. */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: usersKey,
    enabled,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select('id')
      if (error) throw error
      // RLS can silently filter an update down to zero rows; treat that as a failure.
      if (!data || data.length === 0) throw new Error('Role was not changed (permission denied).')
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: usersKey })
      queryClient.invalidateQueries({ queryKey: profileKey(id) })
    },
  })
}
