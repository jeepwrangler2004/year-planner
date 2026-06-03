import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildGmailOpenLinks } from './gmailLinks.js'

test('builds Gmail open links using thread id first so web/app opens the actual message', () => {
  const links = buildGmailOpenLinks({
    gmailId: 'api-message-id',
    gmailThreadId: 'thread-123',
  })

  assert.equal(links.webUrl, 'https://mail.google.com/mail/u/0/#all/thread-123')
  assert.equal(links.appUrl, 'https://mail.google.com/mail/u/0/#all/thread-123')
})

test('falls back to existing Gmail web URL or message id for older localStorage items', () => {
  assert.equal(
    buildGmailOpenLinks({ gmailWebUrl: 'https://mail.google.com/mail/u/0/#all/thread-from-server' }).webUrl,
    'https://mail.google.com/mail/u/0/#all/thread-from-server'
  )
  assert.equal(
    buildGmailOpenLinks({ gmailId: 'legacy-message-id' }).webUrl,
    'https://mail.google.com/mail/u/0/#all/legacy-message-id'
  )
})
