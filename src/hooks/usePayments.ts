import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PaymentMethod } from '../types/rental'
import { bookingsKey } from './useBookings'

export const paymentsKey = ['payments'] as const

export type RecordPaymentInput = {
  bookingId: string
  amount: number
  paymentMethod: PaymentMethod
  referenceNumber?: string
}

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      // Execute via RPC function record_payment (staff/admin only)
      const method = input.paymentMethod.toLowerCase().replace(/\s+/g, '_')
      const params: Record<string, any> = {
        p_booking_id: input.bookingId,
        p_amount: input.amount,
        p_method: method,
      }
      if (input.referenceNumber) {
        params.p_reference_number = input.referenceNumber
      }

      const { data, error } = await supabase.rpc('record_payment', params)

      if (error) {
        throw new Error(error.message || 'Failed to record payment.')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKey })
      queryClient.invalidateQueries({ queryKey: bookingsKey })
    },
  })
}
