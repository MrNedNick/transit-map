/**
 * A GTFS-shaped CSV reader: quoted fields, escaped quotes, CRLF, and a UTF-8
 * BOM, which real agency exports do ship. Rows arrive as index maps rather
 * than objects — over 30 000 rows that difference is measurable.
 */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      i += ch === '\r' && source[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch;
    i++;
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return { header, rows };
}

/** Column index lookup that fails loudly instead of silently producing NaN. */
export function columns(header: string[], names: string[], file: string): number[] {
  return names.map((name) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`${file}: required column "${name}" is missing`);
    return index;
  });
}

/**
 * GTFS times run past midnight — `25:10:00` is ten past one in the morning of
 * the next service day, and dropping that is how night services disappear.
 */
export function parseGtfsTime(value: string): number {
  const h = Number(value.slice(0, value.indexOf(':')));
  const rest = value.slice(value.indexOf(':') + 1);
  const m = Number(rest.slice(0, 2));
  const s = Number(rest.slice(3, 5));
  return h * 3600 + m * 60 + s;
}

export function formatTime(seconds: number): string {
  const wrapped = ((seconds % 86400) + 86400) % 86400;
  const h = Math.floor(wrapped / 3600);
  const m = Math.floor((wrapped % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
