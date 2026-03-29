/**
 * Returns a display string for an event's location.
 * - Travel events with both origin + destination: "JFK → MIA"
 * - Travel events with only origin or only destination: just that value
 * - All other events: the location field as-is
 */
export function locationLabel(event) {
  if (event.origin && event.location) return `${event.origin} → ${event.location}`
  if (event.origin)                   return event.origin
  return event.location || null
}

/**
 * Returns true when the event has a route (origin → destination) to display.
 */
export function hasRoute(event) {
  return Boolean(event.origin && event.location)
}
