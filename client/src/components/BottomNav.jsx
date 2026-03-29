import { Home, CalendarDays, Inbox, Plus, FlaskConical } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

const tabs = [
  { id: 'home',  label: 'Home',  Icon: Home },
  { id: 'year',  label: 'Year',  Icon: CalendarDays },
  { id: 'inbox', label: 'Inbox', Icon: Inbox },
  { id: 'add',   label: 'Add',   Icon: Plus, isAction: true },
  { id: 'debug', label: 'Debug', Icon: FlaskConical },
]

export default function BottomNav({ onAdd }) {
  const activeTab = useStore(s => s.activeTab)
  const setActiveTab = useStore(s => s.setActiveTab)
  const inboxCount = useStore(s => s.inboxItems.length)

  const handleTab = (tab) => {
    if (tab.id === 'add') { onAdd(); return }
    setActiveTab(tab.id)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-start justify-around"
      style={{
        background: 'oklch(0.13 0.025 260 / 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'var(--sab)',
        paddingLeft: 'var(--sal)',
        paddingRight: 'var(--sar)',
        height: 'var(--nav-height)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.82 }}
            onClick={() => handleTab(tab)}
            className="flex flex-col items-center justify-start gap-1 flex-1 pt-2.5"
            style={{ minHeight: 64 }}
          >
            {tab.isAction ? (
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'var(--accent)', boxShadow: '0 4px 20px oklch(0.82 0.16 75 / 0.4)' }}
              >
                <tab.Icon size={22} color="oklch(0.10 0.025 260)" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-1 relative">
                {/* Active pill indicator */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      initial={{ opacity: 0, scaleX: 0.5 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0.5 }}
                      className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                      style={{ background: 'var(--accent)' }}
                    />
                  )}
                </AnimatePresence>

                <div className="relative">
                  <tab.Icon
                    size={23}
                    strokeWidth={isActive ? 2.2 : 1.6}
                    color={isActive ? 'var(--accent)' : 'var(--text-muted)'}
                  />
                  {tab.id === 'inbox' && inboxCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: 'var(--cat-music)', color: '#fff' }}
                    >
                      {inboxCount}
                    </motion.span>
                  )}
                </div>

                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {tab.label}
                </span>
              </div>
            )}
          </motion.button>
        )
      })}
    </nav>
  )
}
