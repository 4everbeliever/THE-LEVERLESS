import { FormEvent, useState } from 'react'
import { Button, Card, Field, Icon, Input, PageTitle, Select } from '../../components/UI'
import { useAddItem, useBranches } from '../../hooks/useInventory'

export function AddItemPanel({ done }: { done: () => void }) {
  const { data: branches = [] } = useBranches()
  const addItem = useAddItem()
  const [error, setError] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') || '').trim()
    const serial = String(form.get('serial') || '').trim()
    const category = String(form.get('category') || '').trim()
    const branch = String(form.get('branch') || '').trim()
    const price = Number(form.get('price')) || 500

    if (!serial) {
      setError('A unique serial number is required.')
      return
    }

    addItem.mutate(
      { name, serial, category, branch, price },
      {
        onSuccess: () => done(),
        onError: err => setError((err as Error).message || 'Failed to add item.'),
      }
    )
  }

  return (
    <>
      <PageTitle eyebrow="INVENTORY" title="Add a new item" copy="Register equipment and assign it to a branch." />
      <Card className="add-item-card">
        <div className="form-intro">
          <span className="large-title-icon"><Icon name="box" size={27} /></span>
          <div>
            <h2>Item details</h2>
            <p>Enter the equipment information exactly as it appears on the asset tag.</p>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <Icon name="alert" />
            <div><strong>Could not add item</strong><span>{error}</span></div>
          </div>
        )}

        <form onSubmit={submit} className="add-form">
          <Field label="Item name">
            <Input name="name" placeholder="e.g. Makita Cordless Drill" required />
          </Field>
          <Field label="Serial number" error={error ? error : undefined}>
            <Input name="serial" placeholder="e.g. MKD-2025-0183" required />
          </Field>
          <Field label="Category">
            <Select name="category" required defaultValue="">
              <option value="" disabled>Select a category</option>
              <option>Power tools</option>
              <option>Cutting tools</option>
              <option>Heavy equipment</option>
              <option>Demolition</option>
            </Select>
          </Field>
          <Field label="Branch">
            <Select name="branch" required defaultValue="">
              <option value="" disabled>Select a branch</option>
              {branches.length > 0 ? (
                branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)
              ) : (
                <>
                  <option>Tagbilaran</option>
                  <option>Panglao</option>
                  <option>Tubigon</option>
                </>
              )}
            </Select>
          </Field>
          <Field label="Daily price (PHP)">
            <Input name="price" type="number" placeholder="450" defaultValue={500} min={0} required />
          </Field>
          <div className="form-divider" />
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={done}>Cancel</Button>
            <Button type="submit" disabled={addItem.isPending}>
              {addItem.isPending ? 'Adding item…' : 'Add item to inventory'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
