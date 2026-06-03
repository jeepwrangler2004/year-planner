const GMAIL_WEB_BASE = 'https://mail.google.com/mail/u/0/#all/'

export function buildGmailOpenLinks(item = {}) {
  const openId = item.gmailThreadId || item.threadId || item.gmailId
  const fallbackUrl = openId ? `${GMAIL_WEB_BASE}${encodeURIComponent(openId)}` : null
  const webUrl = item.gmailWebUrl || fallbackUrl

  return {
    webUrl,
    // Gmail uses universal links on mobile when the Gmail app is installed/configured;
    // otherwise this gracefully stays in the browser. Custom googlegmail:// message
    // deep-links are not stable enough for message view, so do not gamble with them.
    appUrl: webUrl,
  }
}

export function openGmailMessage(item, openWindow = window.open) {
  const { appUrl, webUrl } = buildGmailOpenLinks(item)
  const targetUrl = appUrl || webUrl
  if (!targetUrl) return false

  openWindow(targetUrl, '_blank', 'noopener,noreferrer')
  return true
}
