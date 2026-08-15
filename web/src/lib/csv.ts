// Client-side CSV export (UTF-8 with BOM so Excel opens it correctly).
export function downloadCSV(
  filename: string,
  rows: (string | number | boolean | null | undefined)[][],
) {
  const escape = (v: string | number | boolean | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
