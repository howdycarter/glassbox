import type { ClaimKind, IdentifierType } from './types';

const MONTHS: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

export function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeQualifier(value: string): string {
  return collapseWs(value.toLowerCase().replace(/[^a-z0-9]+/g, ' '));
}

export function qualifiersCompatible(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const na = normalizeQualifier(a);
  const nb = normalizeQualifier(b);
  if (na.length === 0 || nb.length === 0) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const permission = (s: string) =>
    /\bpermission\b/.test(s) && /\b(outstanding|none|pending|not granted|disclosed)\b/.test(s);
  if (permission(na) && permission(nb)) return true;
  const bind = (s: string) => /\bbind\b/.test(s) && /\b(promised|pre work|prework)\b/.test(s);
  if (bind(na) && bind(nb)) return true;
  return false;
}

export function parseMoneyAmount(raw: string): { amount: number; perHour: boolean } | null {
  const perHour = /\/\s*hr\b/i.test(raw);
  let s = raw.replace(/[$,+\s]/g, '').replace(/\/\s*hr\b/i, '');
  let mul = 1;
  if (/billion\b/i.test(raw) || /b$/i.test(s)) {
    mul = 1_000_000_000;
    s = s.replace(/b$/i, '');
  } else if (/million\b/i.test(raw) || /m$/i.test(s)) {
    mul = 1_000_000;
    s = s.replace(/m$/i, '');
  } else if (/thousand\b/i.test(raw) || /k$/i.test(s)) {
    mul = 1_000;
    s = s.replace(/k$/i, '');
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return { amount: n * mul, perHour };
}

export function normalizeMoney(raw: string): string {
  const parsed = parseMoneyAmount(raw);
  if (!parsed) return collapseWs(raw).toLowerCase();
  return `${parsed.amount}${parsed.perHour ? '/hr' : ''}`;
}

export function normalizePercent(raw: string): string {
  const m = /(-?\d+(?:\.\d+)?)\s*%/.exec(raw);
  if (!m) return collapseWs(raw);
  return String(Number.parseFloat(m[1]));
}

export function normalizeDate(raw: string): string {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(
      raw,
    );
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    const day = named[2].padStart(2, '0');
    return `${named[3]}-${month}-${day}`;
  }
  return collapseWs(raw).toLowerCase();
}

export function normalizeIdentifier(raw: string, idType?: IdentifierType): string {
  switch (idType) {
    case 'phone':
      return raw.replace(/\D/g, '');
    case 'email':
      return collapseWs(raw).toLowerCase();
    case 'uei':
    case 'cage':
    case 'ein':
    case 'duns':
    case 'solicitation':
      return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    case undefined:
      if (/\d{3}.*\d{3}.*\d{4}/.test(raw) && raw.replace(/\D/g, '').length === 10) {
        return raw.replace(/\D/g, '');
      }
      if (raw.includes('@')) return collapseWs(raw).toLowerCase();
      return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    default: {
      const exhaustive: never = idType;
      throw new Error(`unhandled identifier type: ${String(exhaustive)}`);
    }
  }
}

export function normalizeClaim(kind: ClaimKind, raw: string, idType?: IdentifierType): string {
  switch (kind) {
    case 'money':
    case 'coverage':
      return normalizeMoney(raw);
    case 'percentage':
      return normalizePercent(raw);
    case 'date':
      return normalizeDate(raw);
    case 'identifier':
      return normalizeIdentifier(raw, idType);
    case 'person':
    case 'org':
    case 'certification':
    case 'address':
      return collapseWs(raw).toLowerCase();
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled claim kind: ${String(exhaustive)}`);
    }
  }
}

export function kindsCompatible(a: ClaimKind, b: ClaimKind): boolean {
  if (a === b) return true;
  if ((a === 'coverage' && b === 'money') || (a === 'money' && b === 'coverage')) return true;
  if ((a === 'org' && b === 'person') || (a === 'person' && b === 'org')) return false;
  return false;
}

export function valuesEqual(
  kind: ClaimKind,
  left: string,
  right: string,
  idType?: IdentifierType,
): boolean {
  return normalizeClaim(kind, left, idType) === normalizeClaim(kind, right, idType);
}
