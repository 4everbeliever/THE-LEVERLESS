import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PaymentMethod } from '../types/rental'
import { bookingsKey } from './useBookings'

export const paymentsKey = ['payments'] as const

export type RecordPaymentInput = {
  bookingId: string
  amount: number
  paymentMethod: PaymentMethod
}

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('You must be signed in to make a payment.')

      const { data, error } = await supabase
        .from('payments')
        .insert({
          booking_id: input.bookingId,
          user_id: authData.user.id,
          amount: input.amount,
          payment_method: input.paymentMethod,
          payment_status: 'Paid',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKey })
      queryClient.invalidateQueries({ queryKey: bookingsKey })
    },
  })
}
