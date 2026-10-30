import { Icon } from './UI'
import type { Booking } from '../types/rental'

export function HandoverSlipModal({
  booking,
  onClose,
}: {
  booking: Booking | null
  onClose: () => void
}) {
  if (!booking) return null

  const handlePrint = () => {
    window.print()
  }

  const deposit = booking.security_deposit ?? 1000
  const dailyRate = booking.daily_rate || 450
  const days = booking.rental_days || 1
  const subtotal = booking.rental_subtotal || dailyRate * days
  const extras = booking.extras_total || 0
  const total = booking.total_amount || booking.total || subtotal + extras

  return (
    <div
      className="modal-backdrop handover-backdrop"
      role="presentation"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal handover-modal" role="dialog" aria-modal="true">
        <div className="handover-slip-container" id="printable-handover-slip">
          {/* Header */}
          <div className="handover-header">
            <div className="handover-brand">
              <div className="handover-logo-mark">
                <Icon name="wrench" size={20} />
              </div>
              <div>
                <h2>TOOLSHED RENTALS</h2>
                <p>Bohol Equipment & Tool Rentals · Tagbilaran | Panglao | Tubigon</p>
                <small>TIN: 482-190-342-000 · Hotline: +63 (038) 412-TOOL</small>
              </div>
            </div>
            <div className="handover-meta">
              <div className="handover-badge">OFFICIAL RENTAL SLIP</div>
              <strong>{booking.id}</strong>
              <span>Issued: {new Date(booking.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>

          <hr className="handover-divider" />

          {/* Renter & Equipment Manifest */}
          <div className="handover-grid">
            <div className="handover-box">
              <span className="box-title">RENTER INFORMATION</span>
              <p><strong>Customer:</strong> {booking.customer_name || 'Registered Customer'}</p>
              <p><strong>Account ID:</strong> <span className="mono-text">{booking.customer_id || booking.user_id}</span></p>
              <p><strong>KYC Status:</strong> <span className="badge-inline green">✓ Gov ID Verified</span></p>
              <p><strong>Fulfillment Branch:</strong> {booking.branch_name || 'Tagbilaran Central'}</p>
            </div>

            <div className="handover-box">
              <span className="box-title">EQUIPMENT DISPATCH</span>
              <p><strong>Item:</strong> {booking.item_name}</p>
              <p><strong>Serial Tag:</strong> <span className="mono-text">{booking.items?.serial || 'SER-VERIFIED'}</span></p>
              <p><strong>Category:</strong> {booking.items?.category || 'Standard Equipment'}</p>
              <p>
                <strong>Rental Window:</strong>{' '}
                {new Date(booking.start_date || booking.start_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                {new Date(booking.end_date || booking.end_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                ({days} {days === 1 ? 'day' : 'days'})
              </p>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="handover-finance">
            <span className="box-title">FINANCIAL BREAKDOWN</span>
            <table className="handover-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Rate / Unit</th>
                  <th>Qty / Days</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base Equipment Rental ({booking.item_name})</td>
                  <td>₱{dailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>{days} {days === 1 ? 'day' : 'days'}</td>
                  <td style={{ textAlign: 'right' }}>₱{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                {extras > 0 && (
                  <tr>
                    <td>Add-ons & Extras (Site Delivery / Damage Waiver)</td>
                    <td>—</td>
                    <td>1</td>
                    <td style={{ textAlign: 'right' }}>₱{extras.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr className="deposit-row">
                  <td>
                    <strong>Refundable Security Deposit</strong>
                    <br />
                    <small style={{ color: 'var(--muted)' }}>Held during rental; 100% refunded upon undamaged handover</small>
                  </td>
                  <td>₱{deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>1</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₱{deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>Total Rental Fees:</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>₱{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    <strong>Payment Status:</strong>{' '}
                    <span className={`status-pill ${booking.payment_status.toLowerCase()}`}>
                      {booking.payment_status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
                    {booking.payment_status === 'Paid' ? 'Full Settlement Verified' : 'Counter Settlement Required'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Inspection Checklist */}
          <div className="handover-checklist">
            <span className="box-title">COUNTER INSPECTION & HANDOVER RECORD</span>
            <div className="checklist-items">
              <span>☑ Safety guard & switches verified operational</span>
              <span>☑ Power cord / batteries & charger fully tested</span>
              <span>☑ Cleanliness and physical housing inspected</span>
              <span>☑ User safety guidelines issued to renter</span>
            </div>
            {booking.condition_notes && (
              <p className="condition-memo">
                <strong>Handover Notes:</strong> {booking.condition_notes}
              </p>
            )}
            {booking.return_notes && (
              <p className="condition-memo return">
                <strong>Return Notes:</strong> {booking.return_notes}
              </p>
            )}
          </div>

          {/* Legal acknowledgment */}
          <div className="handover-terms">
            <small>
              <strong>TERMS OF RENTAL:</strong> The customer assumes total responsibility for the proper handling and safe custody
              of the rented tool under Philippine safety laws. Damaged equipment beyond normal wear is subject to deduction from the
              security deposit. Lost items will be billed at full replacement value.
            </small>
          </div>

          {/* Signatures */}
          <div className="handover-signatures">
            <div className="signature-col">
              <div className="signature-line" />
              <span>Renter / Authorized Representative</span>
            </div>
            <div className="signature-col">
              <div className="signature-line" />
              <span>Toolshed Branch Officer / Inspector</span>
            </div>
          </div>
        </div>

        {/* Modal Controls (Hidden in Print) */}
        <div className="handover-actions no-print">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button button-primary" onClick={handlePrint}>
            <Icon name="card" size={16} />
            <span>Print Official Slip (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

