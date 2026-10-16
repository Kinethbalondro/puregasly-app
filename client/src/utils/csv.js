// Minimal client-side CSV export - no library needed. Escapes quotes/commas/
// newlines per RFC 4180 so it opens cleanly in Excel/Sheets.
function escapeCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// columns: [{ key, label }], rows: [{ ...data }]
export function toCSV(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

export function downloadCSV(filename, csvString) {
  // Leading BOM so Excel detects UTF-8 correctly (otherwise ₱ etc. can show as mojibake).
  const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
