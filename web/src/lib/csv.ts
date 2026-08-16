// Client-side CSV export (UTF-8 with BOM so Excel opens it correctly).
// `csvString` is pure (unit-tested); `downloadCSV` triggers the download.

export type CsvCell = string | number | boolean | null | undefined

// Prefix cells that could be interpreted as formulas by Excel/Sheets
// (=, +, -, @) with a leading apostrophe to neutralise CSV injection.
function sanitize(v: string): string {
  return /^[=+\-@]/.test(v) ? "'" + v : v
}

function escape(v: CsvCell): string {
  const s = v == null ? '' : String(v)
  const safe = sanitize(s)
  return /[",\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function csvString(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escape).join(',')).join('\n')
}

export function downloadCSV(filename: string, rows: CsvCell[][]) {
  const blob = new Blob(['\ufeff' + csvString(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
