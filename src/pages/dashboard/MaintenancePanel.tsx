import { FormEvent, useState } from 'react'
import { Badge, Button, Card, EmptyState, Field, Icon, Input, PageTitle, Select } from '../../components/UI'
import { useItems } from '../../hooks/useInventory'
import { useCreateMaintenanceLog, useMaintenanceLogs } from '../../hooks/useMaintenance'

export function MaintenancePanel() {
  const { data: items = [] } = useItems()
  const { data: logs = [], isPending: logsLoading, error: logsError } = useMaintenanceLogs()
  const createLog = useCreateMaintenanceLog()
  const [saved, setSaved] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('1')
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split('T')[0])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedItemId) return

    createLog.mutate(
      {
        itemId: selectedItemId,
        description,
        hoursSpent: Number(hours) || 0,
        performedAt,
      },
      {
        onSuccess: () => {
          setSaved(true)
          setDescription('')
          setHours('1')
          window.setTimeout(() => setSaved(false), 3000)
        },
      }
    )
  }

  return (
    <>
      <PageTitle eyebrow="EQUIPMENT CARE" title="Maintenance" copy="Log repairs and keep every item safe and rental-ready." />
      <div className="maintenance-layout">
        <Card className="form-card">
          <div className="card-title">
            <span className="title-icon"><Icon name="wrench" /></span>
            <div>
              <h2>New maintenance log</h2>
              <p>Record work performed on an item.</p>
            </div>
          </div>
          {saved && <div className="success-banner"><Icon name="check" />Maintenance log saved successfully.</div>}
          {createLog.error && (
            <div className="error-banner" style={{ marginBottom: 14 }}>
              <Icon name="alert" />
              <div><strong>Failed to save log</strong><span>{(createLog.error as Error).message}</span></div>
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            <Field label="Rental item">
              <Select required value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                <option value="">Select an item</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.serial}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description">
              <textarea
                className="input textarea"
                placeholder="Describe the issue and work performed..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </Field>
            <div className="field-row">
              <Field label="Hours spent">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                />
                <span />
              </Field>
              <Field label="Performed at">
                <Input
                  type="date"
                  value={performedAt}
                  onChange={e => setPerformedAt(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Button type="submit" disabled={createLog.isPending}>
              {createLog.isPending ? 'Saving log…' : 'Save maintenance log'}
            </Button>
          </form>
        </Card>

        <Card className="history-card">
          <div className="section-heading inner">
            <div>
              <h2>Maintenance history</h2>
              <p>Recent logs across all branches.</p>
            </div>
            <Select aria-label="History date">
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </Select>
          </div>

          {logsError && (
            <div className="error-banner" style={{ marginBottom: 14 }}>
              <Icon name="alert" />
              <div><strong>Failed to load history</strong><span>{(logsError as Error).message}</span></div>
            </div>
          )}

          {logsLoading ? (
            <div style={{ padding: 24, fontSize: 11, textAlign: 'center', opacity: 0.7 }}>
              Loading maintenance history…
            </div>
          ) : logs.length ? (
            <div className="history-list">
              {logs.map(log => (
                <div className="history-item" key={log.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{log.items?.name ?? 'Equipment'}</strong>
                    <p>{log.description}</p>
                    <span>
                      {new Date(log.performed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      · {log.staff_name || 'Staff'}
                    </span>
                  </div>
                  <Badge tone="green">{log.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No maintenance logs" copy="Logs will appear here once maintenance is recorded." />
          )}
        </Card>
      </div>
    </>
  )
}
