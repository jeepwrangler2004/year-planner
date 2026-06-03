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

test('rejects Live Nation on-sale marketing blasts before LLM extraction', async () => {
  const events = await parseEmailForEvents({
    subject: 'Christina P. is on sale TODAY! Get your tickets before they are gone.',
    from: 'Live Nation Concerts <reply@email.livenation.com>',
    date: 'Fri, 1 Mar 2024 10:00:00 -0500',
    body: `Christina P. is on sale TODAY! Get your tickets before they are gone.
Gramercy Theatre
March 23, 2024
Buy tickets now before they are gone.`,
  })

  assert.deepEqual(events, [])
})

test('keeps real Live Nation ticket confirmations', async () => {
  const events = await parseEmailForEvents({
    subject: 'Your tickets for LCD Soundsystem',
    from: 'Live Nation Concerts <reply@email.livenation.com>',
    date: 'Fri, 1 Mar 2024 10:00:00 -0500',
    body: `Your tickets are ready.
LCD Soundsystem
Sat, Mar 23 at 8:00 PM
Brooklyn Steel, Brooklyn, NY
Order #123456`,
  })

  assert.equal(events.length, 1)
  assert.equal(events[0].title, 'LCD Soundsystem')
  assert.equal(events[0].startDate, '2024-03-23')
  assert.equal(events[0].location, 'Brooklyn Steel, Brooklyn')
})
