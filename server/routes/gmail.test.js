import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createIngestAllProgressPayload } from './gmail.js'

test('bulk ingest progress payload carries newly parsed events to SSE clients', () => {
  const event = {
    title: 'Chris Lake - Admissions',
    startDate: '2026-06-06',
    gmailId: 'abc123',
  }

  const payload = createIngestAllProgressPayload({
    year: 2026,
    yearIndex: 14,
    totalYears: 15,
    totalEvents: 9,
    status: 'running',
    newEvents: [event],
  })

  assert.equal(payload.type, 'progress')
  assert.equal(payload.eventsFound, 9)
  assert.deepEqual(payload.newEvents, [event])
})
