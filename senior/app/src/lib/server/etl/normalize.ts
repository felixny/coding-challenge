export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      if (char === '\r') i++;
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeaderKey);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isSeparatorRow(row)) continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = row[j] ?? '';
    }

    if (hasContent(record)) {
      records.push(record);
    }
  }

  return records;
}

function normalizeHeaderKey(header: string): string {
  const cleaned = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return CANONICAL_HEADERS[cleaned] ?? cleaned;
}

const CANONICAL_HEADERS: Record<string, string> = {
  category: 'category',
  pack: 'pack_size',
  pack_size: 'pack_size',
  unitsize: 'unit_size',
  unit_size: 'unit_size',
  sales_total: 'total_sale',
  total_sale: 'total_sale',
  linkcode: 'link_code',
  link_code: 'link_code',
  upc: 'upc_plu',
  plu: 'upc_plu',
  upcplu: 'upc_plu',
  upc_plu: 'upc_plu',
  price_type: 'price_type',
  price_priority: 'price_priority',
  price_multiple: 'price_multiple',
  unit_multiple: 'unit_multiple',
  start_date: 'start_date',
  end_date: 'end_date',
  sale_time: 'sale_time',
  sale_time_zone: 'sale_time_zone',
  unit_price: 'unit_price',
  units_sold: 'units_sold',
  description: 'description',
  department: 'department',
  store: 'store'
};

function isSeparatorRow(row: string[]): boolean {
  const first = row[0]?.trim() ?? '';
  return /^-+$/.test(first) || first === '-------';
}

function hasContent(record: Record<string, string>): boolean {
  return Object.values(record).some((value) => cleanString(value) !== null);
}

export function cleanString(value: string | undefined | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === 'NULL' || upper === 'N/A' || upper === 'NA') return null;
  return trimmed;
}

export function cleanUpc(value: string | undefined | null): string | null {
  const cleaned = cleanString(value);
  return cleaned?.replace(/\s+/g, '') ?? null;
}

export function parseOptionalNumber(value: string | undefined | null): number | null {
  const cleaned = cleanString(value);
  if (cleaned == null) return null;

  const normalized = cleaned.replace(/[$,\s]/g, '');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSaleTimeMs(value: string | undefined | null): number | null {
  const cleaned = cleanString(value);
  if (cleaned == null) return null;

  if (/^\d+$/.test(cleaned)) {
    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric)) return null;
    return cleaned.length <= 10 ? numeric * 1000 : numeric;
  }

  const normalized = cleaned.includes('T') ? cleaned : cleaned.replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeDescriptionCase(value: string | undefined | null): string | null {
  const cleaned = cleanString(value);
  if (cleaned == null) return null;

  return cleaned
    .toLowerCase()
    .replace(/(^|[\s(/])([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

export function isPlaceholderUpc(upc: string | null): boolean {
  if (!upc) return false;
  return /^9{6,}$/.test(upc.replace(/\D/g, ''));
}
