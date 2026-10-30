import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Booking } from '../types/rental'
import { itemsKey } from './useInventory'

export const bookingsKey = ['bookings'] as const

const normalizeBookingStatus = (status: string) => {
  const s = String(status || 'reserved').toLowerCase()
  if (s === 'checked_out') return 'Checked out'
  if (s === 'returned') return 'Returned'
  if (s === 'cancelled') return 'Cancelled'
  return 'Reserved'
}

const normalizePaymentStatus = (status: string) => {
  const s = String(status || 'unpaid').toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'partial') return 'Partial'
  return 'Unpaid'
}

export function useBookings() {
  return useQuery({
    queryKey: bookingsKey,
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          item_id,
          customer_id,
          start_at,
          end_at,
          daily_rate,
          rental_days,
          rental_subtotal,
          extras_total,
          total,
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
            daily_price,
            branches (name)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      return ((data ?? []) as any[]).map(b => {
        const total = Number(b.total ?? b.total_amount ?? 0)
        const dailyRate = Number(b.daily_rate ?? 0)
        const startDate = b.start_at ?? b.start_date
        const endDate = b.end_at ?? b.end_date
        const normalizedStatus = normalizeBookingStatus(b.status)
        const isOverdue = normalizedStatus === 'Checked out' && Boolean(endDate) && new Date(endDate).getTime() < Date.now()

        return {
          ...b,
          user_id: b.customer_id ?? b.user_id,
          customer_id: b.customer_id ?? b.user_id,
          start_date: startDate,
          end_date: endDate,
          start_at: startDate,
          end_at: endDate,
          daily_rate: dailyRate,
          rental_days: b.rental_days ?? 1,
          rental_subtotal: Number(b.rental_subtotal ?? dailyRate),
          extras_total: Number(b.extras_total ?? 0),
          security_deposit: Number(b.security_deposit ?? 1000),
          is_overdue: isOverdue,
          total_amount: total,
          total,
          status: normalizedStatus,
          payment_status: normalizePaymentStatus(b.payment_status),
          item_name: b.items?.name ?? 'Unknown equipment',
          branch_name: b.items?.branches?.name ?? '',
        }
      }) as Booking[]
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
      const extrasArray = []
      if (input.delivery) {
        extrasArray.push({
          extra_type: 'delivery',
          name: 'Delivery (Drop-off & collection)',
          quantity: 1,
          price: 350,
        })
      }
      if (input.insurance) {
        const days = Math.max(
          1,
          Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 60 * 60 * 24))
        )
        extrasArray.push({
          extra_type: 'insurance',
          name: 'Insurance (Damage protection)',
          quantity: 1,
          price: 85 * days,
        })
      }

      // Execute via RPC function create_booking
      const { data, error } = await supabase.rpc('create_booking', {
        p_item_id: input.itemId,
        p_start_at: new Date(input.startDate).toISOString(),
        p_end_at: new Date(input.endDate).toISOString(),
        p_extras: extrasArray,
      })

      if (error) {
        if (error.code === '23P01' || error.message?.includes('already booked')) {
          throw new Error('This item is already booked for the selected dates.')
        }
        throw new Error(error.message || 'Failed to create booking.')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsKey })
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('cancel_booking', {
        p_booking_id: id,
      })

      if (error) {
        throw new Error(error.message || 'Failed to cancel booking.')
      }
      return data
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
      const { data, error } = await supabase.rpc('check_out_booking', {
        p_booking_id: id,
        p_condition_notes: conditionNotes,
      })

      if (error) {
        throw new Error(error.message || 'Failed to check out booking.')
      }
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
      const { data, error } = await supabase.rpc('return_booking', {
        p_booking_id: id,
        p_return_notes: returnNotes,
        p_damaged: isDamaged,
      })

      if (error) {
        throw new Error(error.message || 'Failed to return booking.')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsKey })
      queryClient.invalidateQueries({ queryKey: itemsKey })
    },
  })
}
