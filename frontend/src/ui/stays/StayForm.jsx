import { useEffect, useState } from 'react'
import Modal from '../common/Modal.jsx'
import DateRangeSheet from '../date/DateRangeSheet.jsx'
import { formatDisplay } from '../../engine/dates.js'
import { stayDuration } from '../../engine/schengen.js'
import { createStay, updateStay, validateStay } from '../../db/stays.js'

/**
 * Add/edit a stay.
 *
 * In edit mode EVERY field initialises from the passed stay — name, country
 * and both dates. State is keyed off `stay.id` so reopening the modal for a
 * different stay always re-seeds. There is no code path that renders an empty
 * date field for an existing stay.
 */
export default function StayForm({ open, stay, onClose }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [errors, setErrors] = useState({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(stay?.name ?? '')
    setCountry(stay?.country ?? '')
    setStartDate(stay?.startDate ?? null)
    setEndDate(stay?.endDate ?? null)
    setErrors({})
  }, [open, stay?.id])

  const duration =
    startDate && endDate ? stayDuration({ startDate, endDate }) : 0

  async function save() {
    const fields = { name, country: country || null, startDate, endDate }
    const found = validateStay(fields)
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }
    setSaving(true)
    try {
      if (stay) await updateStay(stay.id, fields)
      else await createStay(fields)
      onClose()
    } catch (e) {
      setErrors(e.fieldErrors || { name: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={stay ? 'Edit stay' : 'Add stay'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="stay-name" className="block text-xs text-fog-500 mb-1.5">Name</label>
            <input
              id="stay-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barcelona"
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3
                         text-fog-100 placeholder:text-fog-700 focus:border-accent outline-none"
            />
            {errors.name && <p className="mt-1.5 text-xs text-over">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="stay-country" className="block text-xs text-fog-500 mb-1.5">
              Country <span className="text-fog-700">(optional)</span>
            </label>
            <input
              id="stay-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Spain"
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3
                         text-fog-100 placeholder:text-fog-700 focus:border-accent outline-none"
            />
          </div>

          <div>
            <span className="block text-xs text-fog-500 mb-1.5">Dates</span>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 text-left
                         flex items-center justify-between focus:border-accent outline-none"
            >
              <span className="num text-fog-100" data-testid="start-date-value">
                {formatDisplay(startDate)}
              </span>
              <span className="text-fog-700 px-2">→</span>
              <span className="num text-fog-100" data-testid="end-date-value">
                {formatDisplay(endDate)}
              </span>
            </button>
            {(errors.startDate || errors.endDate) && (
              <p className="mt-1.5 text-xs text-over">{errors.startDate || errors.endDate}</p>
            )}
            <p className="mt-1.5 text-xs text-fog-700 num" data-testid="duration">
              {duration ? `${duration} days — entry and exit days both count` : ' '}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl2 bg-ink-800 text-fog-300">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl2 bg-accent text-ink-950 font-semibold
                         disabled:opacity-50 active:scale-[0.98] transition">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {sheetOpen && (
        <DateRangeSheet
          open={sheetOpen}
          value={{ startDate, endDate }}
          onCancel={() => setSheetOpen(false)}
          onConfirm={({ startDate: s, endDate: e }) => {
            setStartDate(s)
            setEndDate(e)
            setErrors((prev) => ({ ...prev, startDate: undefined, endDate: undefined }))
            setSheetOpen(false)
          }}
        />
      )}
    </>
  )
}
