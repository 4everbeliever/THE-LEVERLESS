import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Booking } from '../types/rental'
import { itemsKey } from './useInventory'

export const bookingsKey = ['bookings'] as const

export function useBookings() {
  return useQuery({
    queryKey: bookingsKey,
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          item_id,
          user_id,
          customer_name,
          start_date,
          end_date,
          daily_rate,
          rental_days,
          rental_subtotal,
          extras_total,
          total_amount,
          status,
          payment_status,
          condition_notes,
          return_notes,
          is_damaged,
          created_at,
          updated_at,
          items (
            id,
            name,
            serial,
            category,
            price,
            branches (name)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      return ((data ?? []) as any[]).map(b => ({
        ...b,
        daily_rate: Number(b.daily_rate),
        rental_subtotal: Number(b.rental_subtotal),
        extras_total: Number(b.extras_total),
        total_amount: Number(b.total_amount),
        item_name: b.items?.name ?? 'Unknown equipment',
        branch_name: b.items?.branches?.name ?? '',
      })) as Booking[]
    },
  })
}

export type CreateBookingInput = {
  itemId: string
  startDate: string
  endDate: string
  delivery?: boolean
  insurance?: boolean
}

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      // 1. Create booking (totals and customer default on server)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          item_id: input.itemId,
          start_date: input.startDate,
          end_date: input.endDate,
          status: 'Reserved',
          payment_status: 'Unpaid',
        })
        .select()
        .single()

      if (bookingError) throw bookingError

      // 2. Add extras if selected
      const extrasToInsert = []
      if (input.delivery) {
        extrasToInsert.push({
          booking_id: booking.id,
          extra_type: 'Delivery' as const,
          name: 'Delivery (Drop-off & collection)',
          unit_price: 350,
          quantity: 1,
        })
      }
      if (input.insurance) {
        const days = Math.max(1, Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 60 * 60 * 24)))
        extrasToInsert.push({
          booking_id: booking.id,
          extra_type: 'Insurance' as const,
          name: 'Insurance (Damage protection)',
          unit_price: 85 * days,
          quantity: 1,
        })
      }

      if (extrasToInsert.length > 0) {
        const { error: extrasError } = await supabase
          .from('booking_extras')
          .insert(extrasToInsert)

        if (extrasError) throw extrasError
      }

      return booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsKey })
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}

export function useCheckoutBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, conditionNotes }: { id: string; conditionNotes: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'Checked out',
          condition_notes: conditionNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsKey })
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}

export function useReturnBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, returnNotes, isDamaged }: { id: string; returnNotes: string; isDamaged: boolean }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'Returned',
          return_notes: returnNotes,
          is_damaged: isDamaged,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsKey })
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}
