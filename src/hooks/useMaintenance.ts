import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { MaintenanceLog } from '../types/rental'
import { itemsKey } from './useInventory'

export const maintenanceKey = ['maintenance'] as const

export function useMaintenanceLogs() {
  return useQuery({
    queryKey: maintenanceKey,
    queryFn: async (): Promise<MaintenanceLog[]> => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select(`
          id,
          item_id,
          description,
          hours_spent,
          performed_at,
          performed_by,
          staff_name,
          created_at,
          items (
            name,
            serial
          )
        `)
        .order('performed_at', { ascending: false })

      if (error) throw error

      return ((data ?? []) as any[]).map(log => ({
        ...log,
        performed_by_id: log.performed_by,
        status: log.status || 'Completed',
        hours_spent: Number(log.hours_spent),
      })) as MaintenanceLog[]
    },
  })
}

export type CreateMaintenanceLogInput = {
  itemId: string
  description: string
  hoursSpent: number
  performedAt: string
  staffName?: string
}

export function useCreateMaintenanceLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateMaintenanceLogInput) => {
      const { data: authData } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('maintenance_logs')
        .insert({
          item_id: input.itemId,
          description: input.description,
          hours_spent: input.hoursSpent,
          performed_at: input.performedAt,
          performed_by: authData.user?.id ?? null,
          staff_name: input.staffName ?? authData.user?.email?.split('@')[0] ?? 'Staff',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKey })
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}
