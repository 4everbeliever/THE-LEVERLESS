export type ItemStatus = 'Available' | 'Rented out' | 'Maintenance'
export type BookingStatus = 'Reserved' | 'Checked out' | 'Returned' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'
export type PaymentMethod = 'Cash' | 'GCash' | 'Card' | 'Bank transfer'
export type ExtraType = 'Delivery' | 'Insurance' | 'Other'

export type Branch = {
  id: string
  name: string
  created_at: string
}

export type RentalItem = {
  id: string
  name: string
  category: string
  branch_id: string
  serial: string
  status: ItemStatus
  price: number
  image?: string | null
  created_at: string
  updated_at: string
  branches?: Branch
  branch?: string // Denormalized or joined branch name for UI convenience
}

export type BookingExtra = {
  id: string
  booking_id: string
  extra_type: ExtraType
  name: string
  unit_price: number
  quantity: number
  total_price: number
  created_at: string
}

export type Booking = {
  id: string
  item_id: string
  user_id: string
  customer_name?: string | null
  start_date: string
  end_date: string
  daily_rate: number
  rental_days: number
  rental_subtotal: number
  extras_total: number
  total_amount: number
  status: BookingStatus
  payment_status: PaymentStatus
  condition_notes?: string | null
  return_notes?: string | null
  is_damaged: boolean
  created_at: string
  updated_at: string
  items?: RentalItem
  item_name?: string
  branch_name?: string
}

export type Payment = {
  id: string
  booking_id: string
  user_id: string
  amount: number
  payment_method: PaymentMethod
  payment_status: string
  paid_at: string
  created_at: string
}

export type MaintenanceLog = {
  id: string
  item_id: string
  description: string
  hours_spent: number
  performed_at: string
  performed_by_id?: string | null
  staff_name?: string | null
  status: string
  created_at: string
  items?: {
    name: string
    serial: string
  }
}
