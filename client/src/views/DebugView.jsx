import { apiUrl } from "./api.js"
import { useState } from 'react'

export default function DebugView({ session }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all') // all | parsed | empty | error

  async function runScan() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(apiUrl(`/api/gmail/debug?session=${session}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Scan failed')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = data?.emails?.filter(e => {
    if (filter === 'parsed') return e.parsedEvents.length > 0
    if (filter === 'empty') return e.parsedEvents.length === 0 && !e.parseError
    if (filter === 'error') return !!e.parseError
    return true
  }) || []

  const stats = data ? {
    total: data.total,
    parsed: data.emails.filter(e => e.parsedEvents.length > 0).length,
    empty: data.emails.filter(e => e.parsedEvents.length === 0 && !e.parseError).length,
    errors: data.emails.filter(e => !!e.parseError).length,
    senderMatch: data.emails.filter(e => e.matchedFilter === 'sender').length,
    subjectMatch: data.emails.filter(e => e.matchedFilter === 'subject').length,
    totalEvents: data.emails.reduce((sum, e) => sum + e.parsedEvents.length, 0),
  } : null

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Email Filter Debug</h1>
          <p className="text-gray-400 text-sm">Inspect the 100 most recent emails matching your event filters. Use this to tune what gets captured.</p>
        </div>

        {/* Scan button */}
        <button
          onClick={runScan}
          disabled={loading || !session}
          className="mb-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          {loading ? '⏳ Scanning inbox...' : '🔍 Run Debug Scan'}
        </button>

        {!session && (
          <p className="text-yellow-400 text-sm mb-6">⚠️ Not connected to Gmail. Go to Settings first.</p>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Emails scanned', value: stats.total, color: 'text-white' },
              { label: 'Events extracted', value: stats.totalEvents, color: 'text-green-400' },
              { label: 'No events found', value: stats.empty, color: 'text-yellow-400' },
              { label: 'Parse errors', value: stats.errors, color: 'text-red-400' },
              { label: 'Matched by sender', value: stats.senderMatch, color: 'text-blue-400' },
              { label: 'Matched by subject', value: stats.subjectMatch, color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-gray-400 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Active query */}
        {data?.query && (
          <div className="mb-4 p-3 bg-black/40 border border-white/10 rounded-lg">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Gmail Query</p>
            <p className="text-xs text-gray-300 font-mono break-all">{data.query}</p>
          </div>
        )}

        {/* Filter tabs */}
        {data && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: 'all', label: `All (${data.emails.length})` },
              { key: 'parsed', label: `✅ Events found (${stats.parsed})` },
              { key: 'empty', label: `⚪ No events (${stats.empty})` },
              { key: 'error', label: `❌ Errors (${stats.errors})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === t.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Email list */}
        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(email => {
              const hasEvents = email.parsedEvents.length > 0
              const hasError = !!email.parseError
              const isExpanded = expandedId === email.id

              const rowBorder = hasError
                ? 'border-red-800/50'
                : hasEvents
                ? 'border-green-800/50'
                : 'border-white/10'

              const dot = hasError ? '🔴' : hasEvents ? '🟢' : '⚪'

              return (
                <div
                  key={email.id}
                  className={`bg-white/5 border ${rowBorder} rounded-lg overflow-hidden`}
                >
                  {/* Row header — always visible */}
                  <button
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  >
                    <span className="mt-0.5 text-xs flex-shrink-0">{dot}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-white truncate">{email.subject || '(no subject)'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          email.matchedFilter === 'sender'    ? 'bg-blue-900/60 text-blue-300' :
                          email.matchedFilter === 'subject'   ? 'bg-purple-900/60 text-purple-300' :
                          email.matchedFilter === 'travel'    ? 'bg-emerald-900/60 text-emerald-300' :
                          email.matchedFilter === 'purchases' ? 'bg-orange-900/60 text-orange-300' :
                          'bg-teal-900/60 text-teal-300'
                        }`}>
                          {email.matchedFilter === 'travel' || email.matchedFilter === 'purchases'
                            ? `📬 gmail:${email.matchedFilter}`
                            : email.matchedFilter}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-gray-400 text-xs truncate">{email.from}</span>
                        <span className="text-gray-500 text-xs flex-shrink-0">{new Date(email.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {hasEvents && (
                      <span className="text-green-400 text-xs flex-shrink-0 font-medium">
                        {email.parsedEvents.length} event{email.parsedEvents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-gray-500 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 py-3 space-y-4">

                      {/* Parsed events */}
                      {hasEvents && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Extracted Events</p>
                          <div className="space-y-2">
                            {email.parsedEvents.map((ev, i) => (
                              <div key={i} className="bg-green-900/20 border border-green-800/40 rounded p-3 text-sm">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-green-300">{ev.title}</span>
                                  <span className="text-xs bg-green-900/60 text-green-400 px-2 py-0.5 rounded">{ev.category}</span>
                                  <span className="text-xs text-gray-400">confidence: {(ev.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <div className="text-gray-300 text-xs mt-1">
                                  {ev.startDate}{ev.endDate !== ev.startDate ? ` → ${ev.endDate}` : ''}{ev.location ? ` · ${ev.location}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parse error */}
                      {hasError && (
                        <div className="bg-red-900/20 border border-red-800/40 rounded p-3 text-sm text-red-300">
                          <p className="font-semibold mb-1">Parse Error</p>
                          <p className="font-mono text-xs">{email.parseError}</p>
                        </div>
                      )}

                      {/* Gmail labels */}
                      {email.labelIds?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Gmail Labels</p>
                          <div className="flex flex-wrap gap-1">
                            {email.labelIds.map(l => (
                              <span key={l} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded font-mono">{l}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Body excerpt */}
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Body Excerpt</p>
                        <pre className="bg-black/40 rounded p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto max-h-48 overflow-y-auto">
                          {email.bodyExcerpt || '(empty)'}
                        </pre>
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {data && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">No emails in this filter view.</div>
        )}

      </div>
    </div>
  )
}
