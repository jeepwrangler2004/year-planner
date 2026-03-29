import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Rule-based fallback parser ──────────────────────────────────────────────

const MONTH_MAP = {
  january:0, february:1, march:2, april:3, may:4, june:5,
  july:6, august:7, september:8, october:9, november:10, december:11,
  jan:0, feb:1, mar:2, apr:3, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
}

// Strong signals that the subject line is a real booking confirmation
const BOOKING_SIGNALS = [
  /your tickets?/i,
  /booking confirmation/i,
  /reservation confirmed/i,
  /order confirmation/i,
  /you'?re (?:going|confirmed)/i,
  /e-?tickets?/i,
  /itinerary/i,
  /boarding pass/i,
  /check-?in (?:information|details)/i,
  /doors open/i,
  /show starts/i,
  /your (?:stay|flight|trip|reservation|booking)/i,
  /see you there/i,
  /get ready/i,
  // Ticket transfer patterns (AXS, Ticketmaster, etc.)
  /tickets? (?:just )?(?:got )?sent to you/i,
  /ticket transfer/i,
  /transferred \d+ tickets?/i,
  /tickets? have been (?:sent|transferred)/i,
  /your tickets? (?:are )?ready/i,
  /admission confirmed/i,
  // Phrases from Claude's suggestions
  /you have tickets?/i,
  /here are your tickets?/i,
  // Luma / event registration
  /registration approved/i,
]

function detectCategory(from, subject) {
  const f = from.toLowerCase()
  const s = subject.toLowerCase()
  if (/flight|airline|airways|boarding|depart/i.test(s) ||
      /united|delta|southwest|jetblue|american airlines|lufthansa|ryanair|easyjet|british airways/i.test(f)) return 'travel'
  if (/hotel|resort|check.?in|checkout|stay/i.test(s) ||
      /airbnb|vrbo|booking\.com|hotels\.com|expedia/i.test(f)) return 'travel'
  if (/concert|festival|show|tour|venue|ticket|gig|rave|dj set/i.test(s) ||
      /ticketmaster|livenation|axs\.com|seatgeek|stubhub|dice\.fm|ra\.co|tixr\.com|etix\.com|seated\.com|bandsintown|songkick|frontgatetickets|eventbrite|universe\.com|posh\.vip|seetickets|whatstba|tokenproof|eventticketscenter|luma-mail\.com/i.test(f)) return 'music'
  if (/dinner|restaurant|reservation|table for/i.test(s) ||
      /opentable|resy\.com/i.test(f)) return 'food'
  if (/marathon|race|match|game|sport|triathlon/i.test(s)) return 'adventure'
  return 'other'
}

// Minimum date — accept anything from 2024 onwards (Gmail query handles the real floor)
const SCAN_FLOOR = new Date('2024-01-01')

function extractDateFromBody(body, emailDate) {
  const text = body.slice(0, 3000)
  const candidates = []

  // Anchor: the date the email was received. Used to infer the year when
  // the email body doesn't include one (e.g. "Sat 01 Aug").
  const emailSentDate = emailDate ? new Date(emailDate) : new Date()
  const emailYear     = emailSentDate.getFullYear()

  // "Sat 01 Aug, 4:00 PM" or "Sat 01 Aug 2026"
  const p1 = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[\s,]+(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,]*(?:(\d{4}))?/gi
  for (const m of text.matchAll(p1)) {
    const day   = parseInt(m[1])
    const month = MONTH_MAP[m[2].toLowerCase().slice(0, 3)]
    if (m[3]) {
      // Explicit year in the text — trust it
      const d = new Date(parseInt(m[3]), month, day)
      if (d >= SCAN_FLOOR) candidates.push(d)
    } else {
      // No year — start with the email's sent year.
      // If that lands BEFORE the email was sent (would be a past date from
      // the sender's perspective — unusual for a booking confirmation), bump
      // forward one year to get the most likely intended future date.
      let year = emailYear
      let d = new Date(year, month, day)
      if (d < emailSentDate) {
        year += 1
        d = new Date(year, month, day)
      }
      if (d >= SCAN_FLOOR) candidates.push(d)
    }
  }

  // "August 1, 2026" or "Aug 1, 2026" or "Aug 1st, 2026"
  const p2 = /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi
  for (const m of text.matchAll(p2)) {
    const month = MONTH_MAP[m[1].toLowerCase().slice(0, 3)]
    const day   = parseInt(m[2])
    const year  = parseInt(m[3])
    const d     = new Date(year, month, day)
    if (d >= SCAN_FLOOR) candidates.push(d)
  }

  // ISO: "2025-08-01" or "2026-08-01"
  const p3 = /(\d{4})-(\d{2})-(\d{2})/g
  for (const m of text.matchAll(p3)) {
    const year = parseInt(m[1])
    if (year < 2024 || year > 2030) continue
    const d = new Date(year, parseInt(m[2]) - 1, parseInt(m[3]))
    if (d >= SCAN_FLOOR) candidates.push(d)
  }

  // "01/08/2025" or "08/01/2026" — MM/DD/YYYY (US format)
  const p4 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g
  for (const m of text.matchAll(p4)) {
    const year = parseInt(m[3])
    if (year < 2024 || year > 2030) continue
    const d = new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))
    if (d >= SCAN_FLOOR) candidates.push(d)
  }

  // "1-16-26" or "12-25-25" — M-DD-YY / MM-DD-YY with dashes (AXS, some venues)
  const p5 = /(?<!\d)(\d{1,2})-(\d{1,2})-(\d{2})(?!\d)/g
  for (const m of text.matchAll(p5)) {
    const month = parseInt(m[1]) - 1
    const day   = parseInt(m[2])
    const year  = 2000 + parseInt(m[3])
    if (month < 0 || month > 11 || day < 1 || day > 31) continue
    if (year < 2024 || year > 2030) continue
    const d = new Date(year, month, day)
    if (d >= SCAN_FLOOR) candidates.push(d)
  }

  if (!candidates.length) return null
  // Return the earliest date in range
  return candidates.sort((a, b) => a - b)[0]
}

function extractLocationFromBody(body) {
  const text = body.slice(0, 3000)

  // "Venue: ..." / "Location: ..." / "Address: ..."
  const venueMatch = text.match(/(?:venue|location|address)[:\t\s]+([^\n\r]{4,80})/i)
  if (venueMatch) {
    let raw = venueMatch[1].trim()
    // Strip trailing pipe/semicolon separated metadata and phone numbers
    raw = raw.replace(/\s*[|;].*$/, '').replace(/\s+\(?\+?[\d\-\(\)]{7,}\)?.*$/, '').trim()
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean)
    if (!parts.length) return null
    // If first segment starts with a digit it's a street address — use city/state instead
    if (/^\d+/.test(parts[0])) return parts.slice(1, 3).join(', ')
    // Venue name — keep venue + city (first two comma-parts)
    return parts.slice(0, 2).join(', ')
  }

  // "at [Venue Name]" — common in invite/ticket emails
  const atMatch = text.match(/\bat\s+([A-Z][A-Za-z\s']{3,50}(?:Theater|Theatre|Arena|Hall|Center|Centre|Park|Terminal|Club|Bar|Garden|Forum|Amphitheater|Ballroom|Pavilion|Stadium|Field))/i)
  if (atMatch) return atMatch[1].trim()

  // City, State from address lines
  const cityMatch = text.match(/\b([A-Z][a-zA-Z\s]+,\s*(?:New York|Los Angeles|Chicago|Miami|Brooklyn|Manhattan|San Francisco|Boston|Austin|Nashville|Las Vegas|Seattle|Denver|Portland|Atlanta|Philadelphia|Houston|Dallas|Washington DC|London|Paris|Berlin|Tokyo|Sydney))\b/i)
  if (cityMatch) return cityMatch[1].trim()

  return null
}

/**
 * For flight/travel emails — extract origin and destination separately.
 * Returns { origin, destination }, either may be null.
 */
function extractFlightLocations(body) {
  const text = body.slice(0, 3000)

  // IATA arrow: "JFK → LAX" / "JFK -> LAX" / "JFK > LAX"
  const iataArrow = text.match(/\b([A-Z]{3})\s*(?:→|->|>|⟶|\u2192)\s*([A-Z]{3})\b/)
  if (iataArrow) return { origin: iataArrow[1], destination: iataArrow[2] }

  // City arrow: "New York → Miami"
  const cityArrow = text.match(/([A-Z][a-zA-Z\s]{2,25}?)\s*(?:→|->)\s*([A-Z][a-zA-Z\s]{2,25})\b/)
  if (cityArrow) return { origin: cityArrow[1].trim(), destination: cityArrow[2].trim() }

  // Labelled: "From: New York" + "To: Miami" (on their own lines)
  const fromM = text.match(/(?:^|\n)\s*(?:from|departing?|origin|departs?)[:\s]+([A-Za-z][^\n,\d]{2,35}?)(?:\n|,|\s{3,}|$)/im)
  const toM   = text.match(/(?:^|\n)\s*(?:to|arriving?|destination|arrives?)[:\s]+([A-Za-z][^\n,\d]{2,35}?)(?:\n|,|\s{3,}|$)/im)
  if (fromM || toM) {
    return {
      origin:      fromM ? fromM[1].trim().replace(/\s+/g, ' ') : null,
      destination: toM   ? toM[1].trim().replace(/\s+/g, ' ')   : null,
    }
  }

  // "flight from New York to Miami" inline
  const inline = text.match(/\bflight(?:\s+from)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  if (inline) return { origin: inline[1].trim(), destination: inline[2].trim() }

  return { origin: null, destination: null }
}

/**
 * Rule-based fallback — no LLM required.
 * Catches clear booking emails when GPT is unavailable.
 */
function parseEmailFallback({ subject, from, body, date: emailDate }) {
  if (!BOOKING_SIGNALS.some(p => p.test(subject))) return []

  // Strip common booking prefixes to get a clean event title
  let title = subject
    .replace(/^fwd?:\s*/i, '')
    .replace(/^re:\s*/i, '')
    .replace(/^your tickets?:\s*/i, '')
    .replace(/^booking confirmation[:\s–-]*/i, '')
    .replace(/^reservation confirmed[:\s–-]*/i, '')
    .replace(/^order confirmation[:\s–-]*/i, '')
    .replace(/^e-?tickets?[:\s–-]*/i, '')
    .replace(/^itinerary[:\s–-]*/i, '')
    .replace(/^you'?re going[:\s–-]*/i, '')
    .trim()

  if (!title || title.length < 3) return []

  const dateObj = extractDateFromBody(body, emailDate)
  if (!dateObj) return [] // No recognisable future date — skip

  const startDate = dateObj.toISOString().split('T')[0]
  const category  = detectCategory(from, subject)
  let   location  = extractLocationFromBody(body)
  let   origin    = null

  // For travel (flights), try to extract origin → destination pair
  if (category === 'travel') {
    const { origin: o, destination: d } = extractFlightLocations(body)
    if (o) origin = o
    if (d) location = d       // destination becomes the "location"
    else if (!location && o) origin = o  // at least keep origin if no dest
  }

  console.log(`[fallback] Extracted event: "${title}" on ${startDate}${origin ? ` [${origin} → ${location}]` : location ? ` @ ${location}` : ''}`)

  return [{
    title,
    category,
    startDate,
    endDate: startDate,
    location,
    origin,
    confidence: 0.75,
    emailFrom: from,
    parsedBy: 'fallback',
  }]
}

// ─── GPT parser ───────────────────────────────────────────────────────────────

/**
 * Extract events from email content.
 * Tries GPT-4o-mini first; falls back to rule-based parser if GPT fails.
 */
export async function parseEmailForEvents(emailData) {
  const { subject, from, body, date: emailDate } = emailData

  const prompt = `You are an event extraction assistant. Given an email, extract any concrete future events or experiences (flights, hotel stays, concerts, festivals, restaurant reservations, sports events, cruises, trips, etc.).

Email:
Subject: ${subject}
From: ${from}
Date received: ${emailDate}
Body excerpt:
${body.slice(0, 3000)}

Extract events and return JSON array. Each event:
{
  "title": "short descriptive name (e.g. 'Flight to Miami', 'Coachella', 'Dinner at Le Bernardin')",
  "category": "travel|music|family|food|wellness|adventure|other",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD or same as startDate for single-day",
  "location": "destination city/venue name, or null",
  "origin": "departure city or airport code for flights/travel, null for everything else",
  "confidence": 0.0-1.0,
  "emailFrom": "${from}"
}

Rules:
- Extract events on or after 2024-01-01 — include past events in that range, not just future ones
- Skip generic promotional emails with no specific booking/reservation
- Skip receipts that don't represent a planned experience
- Return [] if nothing relevant
- confidence: 0.9+ for clear bookings, 0.6-0.9 for likely events, below 0.6 skip

Return ONLY the JSON array, no other text.`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 512,
    })

    const text = response.choices[0].message.content.trim()
    const events = JSON.parse(text)
    return Array.isArray(events) ? events.filter(e => e.confidence >= 0.6) : []
  } catch (err) {
    console.error('GPT parse error (using fallback):', err.message)
    return parseEmailFallback(emailData)
  }
}
