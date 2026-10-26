import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Branch, RentalItem } from '../types/rental'

export const itemsKey = ['items'] as const
export const branchesKey = ['branches'] as const

export function useItems() {
  return useQuery({
    queryKey: itemsKey,
    queryFn: async (): Promise<RentalItem[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, category, branch_id, serial, status, daily_price, image_url, created_at, updated_at, branches (id, name)')
        .order('created_at', { ascending: true })

      if (error) throw error

      return ((data ?? []) as any[]).map(item => {
        const rawStatus = String(item.status || 'available').toLowerCase()
        const displayStatus =
          rawStatus === 'rented_out'
            ? 'Rented out'
            : rawStatus === 'maintenance' || rawStatus === 'damaged'
              ? 'Maintenance'
              : 'Available'

        const price = Number(item.daily_price ?? item.price ?? 0)

        return {
          ...item,
          status: displayStatus,
          price,
          daily_price: price,
          image: item.image_url ?? item.image,
          image_url: item.image_url ?? item.image,
          branch: item.branches?.name ?? 'Tagbilaran',
        }
      }) as RentalItem[]
    },
  })
}

export function useBranches() {
  return useQuery({
    queryKey: branchesKey,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, created_at')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Branch[]
    },
  })
}

export type AddItemInput = {
  name: string
  serial: string
  category: string
  branch: string
  price?: number
  image?: string
}

export function useAddItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AddItemInput) => {
      // Find branch_id from branch name
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('name', input.branch)
        .single()

      if (branchError || !branchData) {
        throw new Error(`Branch "${input.branch}" not found.`)
      }

      const { data, error } = await supabase
        .from('items')
        .insert({
          name: input.name,
          serial: input.serial,
          category: input.category,
          branch_id: branchData.id,
          daily_price: input.price ?? 500,
          status: 'available',
          image_url: input.image ?? 'https://images.unsplash.com/photo-1504148455328-c376907d081c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}

export function useUpdateItemStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: 'available' | 'rented_out' | 'maintenance' | 'damaged'
    }) => {
      const { data, error } = await supabase
        .from('items')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKey })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useResetAllItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // 1. Try calling the dedicated RPC if available
      const { data, error } = await supabase.rpc('reset_all_inventory_available')
      if (!error) return data

      // 2. Direct database updates fallback
      const { error: itemError } = await supabase
        .from('items')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .neq('status', 'available')

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'returned',
          return_notes: 'Released to inventory',
          updated_at: new Date().toISOString(),
        })
        .in('status', ['reserved', 'checked_out'])

      if (itemError && bookingError) {
        throw new Error(
          itemError.message || bookingError.message || 'Failed to reset inventory.'
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKey })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

