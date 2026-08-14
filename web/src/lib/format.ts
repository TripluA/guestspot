import i18n from '../i18n'

export function toPbDate(localValue: string): string {
  // datetime-local value "YYYY-MM-DDTHH:mm" is in the browser's local zone.
  return new Date(localValue + ':00').toISOString()
}

export function fromPbDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

export function fmtDT(value: string | null | undefined, withTime = true): string {
  const d = fromPbDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(i18n.language === 'ro' ? 'ro-RO' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: withTime ? 'short' : undefined,
  }).format(d)
}

export function fmtRange(from: string | null | undefined, to: string | null | undefined): string {
  return `${fmtDT(from)} → ${fmtDT(to)}`
}

export function isPast(value: string | null | undefined): boolean {
  const d = fromPbDate(value)
  return d ? d.getTime() < Date.now() : false
}

export function cmpSpotNumber(a: string, b: string): number {
  const num = (s: string) => parseInt(s.match(/\d+$/)?.[0] ?? s, 10)
  const x = num(a)
  const y = num(b)
  if (!isNaN(x) && !isNaN(y) && x !== y) return x - y
  return a.localeCompare(b)
}

export function localNowOffset(hours = 0): string {
  const d = new Date(Date.now() + hours * 3600 * 1000)
  const p = (n: number) => ('0' + n).slice(-2)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
