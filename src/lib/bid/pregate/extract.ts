import type { CanonEntry, ExtractedClaim, IdentifierType, PregatePackage, PregateSection } from './types';
import { normalizeClaim } from './normalize';

const QUALIFIER_RE =
  /permission outstanding|\$[\d,.]+\s*[KMB]?\s+bind promised[^.]*|promised pre-work|nonsubscriber|not registered(?: in [A-Z]{2})?|permission none|pending confirmation|unconfirmed at send|exemption-documentation/gi;

const COVERAGE_LINE_RE =
  /\b(cyber(?:\s+liability)?|cgl|e\s*&\s*o|tech(?:nology)?\s*e\s*&\s*o|workers['’]?s?\s*comp(?:ensation)?|professional liability|auto liability)\b/i;

const MONEY_RE =
  /\$[\d,]+(?:\.\d{1,2})?\s*(?:[KMB]|billion|million|thousand)?(?:\+)?(?:\s*\/\s*hr)?|\b\d+(?:\.\d+)?[KMB]\+(?=\s)/gi;

const PERCENT_RE = /\b\d+(?:\.\d+)?%/g;

const DATE_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi;

const PHONE_RE = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const CERT_RE =
  /\b(?:WCAG\s*2\.\d\s*AA|ISO\s*9001|CMMI(?:-[A-Z]+)?|8\(a\)|HUBZone|WOSB|EDWOSB|SDVOSB|Trusted Tester|holds no certifications|no certifications)\b/gi;

const STREET_RE =
  /\b\d+\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*)*\s+(?:Ave(?:nue)?|St(?:reet)?|Blvd|Boulevard|Rd|Road|Dr(?:ive)?|Way|Ln|Lane|Pkwy|Parkway|Ct|Court)\b(?:,\s*[A-Za-z .]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/g;

interface Span {
  start: number;
  end: number;
}

function overlaps(consumed: readonly Span[], start: number, end: number): boolean {
  return consumed.some((s) => start < s.end && end > s.start);
}

function addSpan(consumed: Span[], start: number, end: number): void {
  consumed.push({ start, end });
}

function slug(heading: string): string {
  const s = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s.length > 0 ? s : 'section';
}

function pushClaim(
  out: ExtractedClaim[],
  spec: Omit<ExtractedClaim, 'id' | 'normalized'> & { identifierType?: IdentifierType },
): void {
  const duplicate = out.some(
    (c) =>
      c.location.sectionId === spec.location.sectionId &&
      c.location.line === spec.location.line &&
      c.kind === spec.kind &&
      c.value === spec.value,
  );
  if (duplicate) return;
  out.push({
    ...spec,
    id: `c${out.length + 1}`,
    normalized: normalizeClaim(spec.kind, spec.value, spec.identifierType),
  });
}

function labeledValue(line: string, labels: readonly string[]): { label: string; value: string } | null {
  for (const label of labels) {
    const re = new RegExp(`\\b${label}\\s*[:–—-]\\s*(.+)`, 'i');
    const m = re.exec(line);
    if (m && m[1].trim().length > 0) {
      return { label, value: m[1].trim() };
    }
  }
  return null;
}

function extractFromLine(
  section: PregateSection,
  lineNo: number,
  line: string,
  out: ExtractedClaim[],
): void {
  if (line.trim().length === 0) return;
  const consumed: Span[] = [];
  const location = { section: section.heading, sectionId: section.id, line: lineNo };

  QUALIFIER_RE.lastIndex = 0;
  let qm: RegExpExecArray | null;
  const qualifiers: string[] = [];
  while ((qm = QUALIFIER_RE.exec(line)) !== null) {
    qualifiers.push(qm[0]);
    addSpan(consumed, qm.index, qm.index + qm[0].length);
  }
  const qualifier = qualifiers.length > 0 ? qualifiers.join('; ') : undefined;

  const uei = labeledValue(line, ['UEI']);
  if (uei) {
    const token = uei.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
    if (token.length >= 12) {
      pushClaim(out, {
        kind: 'identifier',
        raw: line,
        value: token,
        location,
        context: line,
        qualifier,
        keyHint: 'uei',
        identifierType: 'uei',
      });
    }
  }
  const cage = labeledValue(line, ['CAGE']);
  if (cage) {
    const token = cage.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5);
    if (token.length === 5) {
      pushClaim(out, {
        kind: 'identifier',
        raw: line,
        value: token,
        location,
        context: line,
        qualifier,
        keyHint: 'cage',
        identifierType: 'cage',
      });
    }
  }
  const ein = labeledValue(line, ['EIN']);
  if (ein) {
    pushClaim(out, {
      kind: 'identifier',
      raw: line,
      value: ein.value,
      location,
      context: line,
      qualifier,
      keyHint: 'ein',
      identifierType: 'ein',
    });
  }
  const duns = labeledValue(line, ['DUNS']);
  if (duns) {
    pushClaim(out, {
      kind: 'identifier',
      raw: line,
      value: duns.value,
      location,
      context: line,
      qualifier,
      keyHint: 'duns',
      identifierType: 'duns',
    });
  }

  const addr = labeledValue(line, ['Address', 'LLC address of record', 'Street']);
  if (addr) {
    pushClaim(out, {
      kind: 'address',
      raw: line,
      value: addr.value,
      location,
      context: line,
      qualifier,
      keyHint: 'llc-address',
    });
  } else {
    STREET_RE.lastIndex = 0;
    const sm = STREET_RE.exec(line);
    if (sm && !overlaps(consumed, sm.index, sm.index + sm[0].length)) {
      pushClaim(out, {
        kind: 'address',
        raw: line,
        value: sm[0],
        location,
        context: line,
        qualifier,
        keyHint: 'llc-address',
      });
      addSpan(consumed, sm.index, sm.index + sm[0].length);
    }
  }

  const person = labeledValue(line, ['PI', 'Principal Investigator', 'Key personnel', 'Contact']);
  if (person) {
    pushClaim(out, {
      kind: 'person',
      raw: line,
      value: person.value.replace(/\s*\(.*\)\s*$/, '').trim(),
      location,
      context: line,
      qualifier,
    });
  }
  const org = labeledValue(line, ['Firm', 'Company', 'Offeror', 'Proposer', 'LLC']);
  if (org) {
    pushClaim(out, {
      kind: 'org',
      raw: line,
      value: org.value,
      location,
      context: line,
      qualifier,
      keyHint: 'legal-name',
    });
  }

  const coverageLine = COVERAGE_LINE_RE.test(line);
  MONEY_RE.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = MONEY_RE.exec(line)) !== null) {
    if (overlaps(consumed, mm.index, mm.index + mm[0].length)) continue;
    addSpan(consumed, mm.index, mm.index + mm[0].length);
    pushClaim(out, {
      kind: coverageLine ? 'coverage' : 'money',
      raw: mm[0],
      value: mm[0].trim(),
      location,
      context: line,
      qualifier,
      keyHint: coverageLine ? 'coverage' : undefined,
    });
  }

  PERCENT_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = PERCENT_RE.exec(line)) !== null) {
    if (overlaps(consumed, pm.index, pm.index + pm[0].length)) continue;
    addSpan(consumed, pm.index, pm.index + pm[0].length);
    pushClaim(out, {
      kind: 'percentage',
      raw: pm[0],
      value: pm[0],
      location,
      context: line,
      qualifier,
    });
  }

  DATE_RE.lastIndex = 0;
  let dm: RegExpExecArray | null;
  while ((dm = DATE_RE.exec(line)) !== null) {
    if (overlaps(consumed, dm.index, dm.index + dm[0].length)) continue;
    addSpan(consumed, dm.index, dm.index + dm[0].length);
    pushClaim(out, {
      kind: 'date',
      raw: dm[0],
      value: dm[0],
      location,
      context: line,
      qualifier,
    });
  }

  PHONE_RE.lastIndex = 0;
  let ph: RegExpExecArray | null;
  while ((ph = PHONE_RE.exec(line)) !== null) {
    if (overlaps(consumed, ph.index, ph.index + ph[0].length)) continue;
    addSpan(consumed, ph.index, ph.index + ph[0].length);
    pushClaim(out, {
      kind: 'identifier',
      raw: ph[0],
      value: ph[0],
      location,
      context: line,
      qualifier,
      keyHint: 'phone',
      identifierType: 'phone',
    });
  }

  EMAIL_RE.lastIndex = 0;
  let em: RegExpExecArray | null;
  while ((em = EMAIL_RE.exec(line)) !== null) {
    if (overlaps(consumed, em.index, em.index + em[0].length)) continue;
    addSpan(consumed, em.index, em.index + em[0].length);
    pushClaim(out, {
      kind: 'identifier',
      raw: em[0],
      value: em[0],
      location,
      context: line,
      qualifier,
      keyHint: 'email',
      identifierType: 'email',
    });
  }

  CERT_RE.lastIndex = 0;
  let cm: RegExpExecArray | null;
  while ((cm = CERT_RE.exec(line)) !== null) {
    if (overlaps(consumed, cm.index, cm.index + cm[0].length)) continue;
    addSpan(consumed, cm.index, cm.index + cm[0].length);
    pushClaim(out, {
      kind: 'certification',
      raw: cm[0],
      value: cm[0],
      location,
      context: line,
      qualifier,
      keyHint: /no certifications/i.test(cm[0]) ? 'firm-certs' : undefined,
    });
  }
}

function attachKeyHints(claims: ExtractedClaim[], canon: readonly CanonEntry[]): void {
  for (const claim of claims) {
    if (claim.keyHint && claim.keyHint !== 'coverage') continue;
    let best: { key: string; aliasLen: number } | null = null;
    for (const entry of canon) {
      const aliases = entry.aliases ?? (entry.entry === 'fact' ? [entry.key, entry.value] : [entry.key]);
      for (const alias of aliases) {
        if (alias.trim().length < 2) continue;
        if (claim.context.toLowerCase().includes(alias.toLowerCase())) {
          if (!best || alias.length > best.aliasLen) {
            best = { key: entry.key, aliasLen: alias.length };
          }
        }
      }
    }
    if (best) claim.keyHint = best.key;
  }
}

function emitCanonAnchored(
  pkg: PregatePackage,
  canon: readonly CanonEntry[],
  out: ExtractedClaim[],
): void {
  for (const section of pkg.sections) {
    section.lines.forEach((line, idx) => {
      if (line.trim().length === 0) return;
      const lineNo = idx + 1;
      for (const entry of canon) {
        if (entry.entry !== 'fact') continue;
        if (
          entry.kind !== 'person' &&
          entry.kind !== 'org' &&
          entry.kind !== 'certification' &&
          entry.kind !== 'address'
        ) {
          continue;
        }
        const aliases = entry.aliases ?? [entry.value, entry.key];
        const hit = aliases.find((a) => a.trim().length >= 2 && line.toLowerCase().includes(a.toLowerCase()));
        if (!hit) continue;
        const already = out.some(
          (c) =>
            c.location.sectionId === section.id &&
            c.location.line === lineNo &&
            (c.keyHint === entry.key || (c.kind === entry.kind && c.normalized === normalizeClaim(entry.kind, hit))),
        );
        if (already) continue;
        pushClaim(out, {
          kind: entry.kind,
          raw: hit,
          value: entry.kind === 'org' || entry.kind === 'person' ? hit : entry.value,
          location: { section: section.heading, sectionId: section.id, line: lineNo },
          context: line,
          keyHint: entry.key,
        });
      }
    });
  }
}

/**
 * Deterministic load-bearing claim extraction. No model, no network.
 * `canon` is used only to attach key hints and to surface named
 * people/orgs/certs already on the record — never to invent claims.
 */
export function extractLoadBearingClaims(
  pkg: PregatePackage,
  canon: readonly CanonEntry[] = [],
): ExtractedClaim[] {
  const out: ExtractedClaim[] = [];
  for (const section of pkg.sections) {
    section.lines.forEach((line, idx) => {
      extractFromLine(section, idx + 1, line, out);
    });
  }
  emitCanonAnchored(pkg, canon, out);
  attachKeyHints(out, canon);
  return out;
}

export function parsePackageText(text: string): PregateSection[] {
  const lines = text.split(/\r?\n/);
  const sections: { id: string; heading: string; lines: string[] }[] = [];
  let current: { id: string; heading: string; lines: string[] } = {
    id: 'body',
    heading: 'Body',
    lines: [],
  };
  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      sections.push(current);
      const title = heading[1].trim();
      current = { id: slug(title), heading: title, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections.filter((s) => s.lines.some((l) => l.trim().length > 0) || s.id !== 'body');
}

export function parsePackageFromMarkdown(
  pursuitId: string,
  title: string,
  text: string,
  submitted = true,
): PregatePackage {
  return {
    pursuitId,
    title,
    submitted,
    sections: parsePackageText(text),
  };
}
