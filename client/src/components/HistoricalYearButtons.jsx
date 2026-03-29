import { motion } from 'framer-motion'

const HISTORICAL_YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]

/**
 * HistoricalYearButtons - Individual year ingest buttons for 2012-2022
 * 
 * Each button triggers POST /api/gmail/ingest with sinceDate=Jan1 beforeDate=Dec31
 */
export default function HistoricalYearButtons({ onIngestYear, isIngesting }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        Historical Years
      </p>
      <div className="flex flex-wrap gap-2">
        {HISTORICAL_YEARS.map(year => (
          <motion.button
            key={year}
            whileTap={{ scale: 0.88 }}
            onClick={() => onIngestYear(year)}
            disabled={isIngesting}
            className="text-xs px-3 py-2 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: 'var(--bg-card)', 
              color: 'var(--text-secondary)', 
              border: '1px solid var(--border)' 
            }}
          >
            {year}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
