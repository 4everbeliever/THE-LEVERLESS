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
        .select('id, name, category, branch_id, serial, status, price, image, created_at, updated_at, branches (id, name)')
        .order('created_at', { ascending: true })

      if (error) throw error

      return ((data ?? []) as any[]).map(item => ({
        ...item,
        price: Number(item.price),
        branch: item.branches?.name ?? 'Tagbilaran',
      })) as RentalItem[]
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
          price: input.price ?? 500,
          status: 'Available',
          image: input.image ?? 'https://images.unsplash.com/photo-1504148455328-c376907d081c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420',
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
