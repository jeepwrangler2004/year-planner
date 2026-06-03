import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseEmailForEvents } from './emailParser.js'

test('parses AXS resale transfer emails with Gmail-style event card date', async () => {
  const events = await parseEmailForEvents({
    subject: 'Tickets Just Got Sent To You',
    from: 'AXS Tickets <noreply@axs.com>',
    date: 'Mon, 2 Jun 2026 09:17:00 -0400',
    body: `Chris Lake - Admissions
Sat, Jun 6 at 7:00 PM
Under the K Bridge Park, Brooklyn, NY
Tickets Just Got Sent To You`,
  })

  assert.equal(events.length, 1)
  assert.equal(events[0].title, 'Chris Lake - Admissions')
  assert.equal(events[0].category, 'music')
  assert.equal(events[0].startDate, '2026-06-06')
  assert.equal(events[0].endDate, '2026-06-06')
  assert.equal(events[0].location, 'Under the K Bridge Park, Brooklyn')
})
