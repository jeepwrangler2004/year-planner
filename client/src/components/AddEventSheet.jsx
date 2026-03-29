import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useStore, CATEGORIES } from '../store/useStore'
import { format } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')

export default function AddEventSheet({ open, onClose, prefillDate }) {
  const addEvent = useStore(s => s.addEvent)
  const [form, setForm] = useState({
    title: '',
    category: 'travel',
    startDate: prefillDate || today,
    endDate: prefillDate || today,
    location: '',
    notes: '',
  })

  useEffect(() => {
    if (prefillDate) setForm(f => ({ ...f, startDate: prefillDate, endDate: prefillDate }))
  }, [prefillDate])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = () => {
    if (!form.title.trim()) return
    addEvent(form)
    onClose()
    setForm({ title: '', category: 'travel', startDate: today, endDate: today, location: '', notes: '' })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-3 pb-10"
            style={{ background: 'var(--bg-elevated)', maxHeight: '92dvh', overflowY: 'auto' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Add Event
              </h2>
              <button onClick={onClose}>
                <X size={20} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Title */}
            <div className="mb-5">
              <input
                type="text"
                placeholder="What is it?"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="w-full text-lg font-semibold bg-transparent outline-none border-b pb-2"
                style={{
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)',
                  caretColor: 'var(--accent)',
                }}
                autoFocus
              />
            </div>

            {/* Category */}
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Category
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map(cat => (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => set('category', cat.id)}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl flex-shrink-0 border transition-all"
                    style={{
                      background: form.category === cat.id ? `${cat.cssVar}22` : 'var(--bg-card)',
                      borderColor: form.category === cat.id ? cat.cssVar : 'transparent',
                      color: form.category === cat.id ? cat.cssVar : 'var(--text-secondary)',
                    }}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-[10px] font-medium">{cat.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                When?
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Start</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>End</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => set('endDate', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="mb-7">
              <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Where? <span className="normal-case tracking-normal ml-1">(optional)</span>
              </p>
              <input
                type="text"
                placeholder="City, venue, or place"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', caretColor: 'var(--accent)' }}
              />
            </div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!form.title.trim()}
              className="w-full py-4 rounded-2xl text-base font-semibold"
              style={{
                background: form.title.trim() ? 'var(--accent)' : 'var(--bg-card)',
                color: form.title.trim() ? 'var(--bg-base)' : 'var(--text-muted)',
              }}
            >
              Add to My Year
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
