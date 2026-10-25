export type ItemStatus = 'Available' | 'Rented out' | 'Maintenance' | 'Damaged' | 'available' | 'rented_out' | 'maintenance' | 'damaged'
export type BookingStatus = 'Reserved' | 'Checked out' | 'Returned' | 'Cancelled' | 'reserved' | 'checked_out' | 'returned' | 'cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded' | 'Partial' | 'unpaid' | 'paid' | 'partial' | 'refunded'
export type PaymentMethod = 'Cash' | 'GCash' | 'Card' | 'Bank transfer' | 'cash' | 'gcash' | 'card' | 'bank_transfer'
export type ExtraType = 'Delivery' | 'Insurance' | 'Other' | 'delivery' | 'insurance' | 'other'

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
  daily_price?: number
  image?: string | null
  image_url?: string | null
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
  price?: number
  quantity: number
  total_price: number
  created_at: string
}

export type Booking = {
  id: string
  item_id: string
  user_id: string
  customer_id?: string
  customer_name?: string | null
  start_date: string
  end_date: string
  start_at?: string
  end_at?: string
  daily_rate: number
  rental_days: number
  rental_subtotal: number
  extras_total: number
  total_amount: number
  total?: number
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

export type EquipmentCategory = {
  id: string
  code: string
  name: string
  description?: string | null
  safety_guidelines?: string | null
  created_at: string
}

export type ExtrasCatalogItem = {
  id: string
  code: string
  extra_type: ExtraType
  name: string
  base_price: number
  description?: string | null
  is_active: boolean
  created_at: string
}

export type BookingItem = {
  id: string
  booking_id: string
  item_id: string
  daily_rate_at_booking: number
  quantity: number
  item_condition_out?: string | null
  item_condition_in?: string | null
  checked_out_at?: string | null
  returned_at?: string | null
  is_damaged: boolean
  created_at: string
  items?: RentalItem
}

export type MaintenanceTechnician = {
  id: string
  maintenance_id: string
  technician_id: string
  assigned_role: 'lead_technician' | 'assistant_technician' | 'safety_inspector' | 'quality_auditor'
  hours_logged: number
  task_notes?: string | null
  sign_off_status: 'pending' | 'approved' | 'rejected'
  signed_off_at?: string | null
  assigned_at: string
}

export type AuditLog = {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  changed_fields?: string[] | null
  performed_by?: string | null
  client_ip?: string | null
  created_at: string
}

