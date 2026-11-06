import { BidAdapterError } from '../types';
import { isSourceHandle } from '../validate';
import {
  FINDING_PENALTY,
  UNBOUND_RECORD_VALUE,
  type CanonEntry,
  type CanonExclusion,
  type CanonFact,
  type ClaimCheck,
  type ExtractedClaim,
  type PregateFinding,
} from './types';
import { kindsCompatible, qualifiersCompatible, valuesEqual } from './normalize';

const DEFAULT_UNBOUND_HANDLE =
  'RECORD.md — no source for this claim (unbound, not silently passed)';

export function validateCanon(canon: readonly CanonEntry[]): void {
  const keys = new Set<string>();
  for (const [i, entry] of canon.entries()) {
    if (entry === null || typeof entry !== 'object') {
      throw new BidAdapterError(`canon[${i}] must be an object`);
    }
    if (typeof entry.key !== 'string' || entry.key.trim() === '') {
      throw new BidAdapterError(`canon[${i}].key is required`);
    }
    if (keys.has(entry.key)) {
      throw new BidAdapterError(`duplicate canon key "${entry.key}"`);
    }
    keys.add(entry.key);
    if (!isSourceHandle(entry.sourceHandle)) {
      throw new BidAdapterError(
        `canon[${i}] (${entry.key}) has no source handle (need file path+section, Linear issue/comment ID, or SAM notice ID)`,
      );
    }
    if (entry.entry === 'fact') {
      if (typeof entry.value !== 'string' || entry.value.trim() === '') {
        throw new BidAdapterError(`canon[${i}].value is required`);
      }
    } else if (entry.entry === 'exclusion') {
      if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
        throw new BidAdapterError(`canon[${i}] exclusion must name aliases`);
      }
    } else {
      const exhaustive: never = entry;
      throw new BidAdapterError(`canon[${i}] has unknown entry kind: ${String(exhaustive)}`);
    }
  }
}

function aliasHit(entry: CanonEntry, claim: ExtractedClaim): boolean {
  const aliases =
    entry.aliases ?? (entry.entry === 'fact' ? [entry.key, entry.value] : [entry.key]);
  const hay = `${claim.context} ${claim.value} ${claim.raw} ${claim.keyHint ?? ''}`.toLowerCase();
  return aliases.some((a) => a.trim().length >= 2 && hay.includes(a.toLowerCase()));
}

function bindCanon(claim: ExtractedClaim, canon: readonly CanonEntry[]): CanonEntry | null {
  const byKey = canon.find((e) => e.key === claim.keyHint);
  if (byKey) return byKey;

  const aliasMatches = canon.filter((e) => aliasHit(e, claim) && kindsCompatible(e.kind, claim.kind));
  if (aliasMatches.length === 1) return aliasMatches[0];
  if (aliasMatches.length > 1) {
    const facts = aliasMatches.filter((e): e is CanonFact => e.entry === 'fact');
    const valueHit = facts.find((f) => valuesEqual(claim.kind, claim.value, f.value, claim.identifierType));
    if (valueHit) return valueHit;
    return aliasMatches[0];
  }

  const facts = canon.filter((e): e is CanonFact => e.entry === 'fact');
  const valueHits = facts.filter(
    (f) => kindsCompatible(f.kind, claim.kind) && valuesEqual(claim.kind, claim.value, f.value, claim.identifierType),
  );
  if (valueHits.length === 1) return valueHits[0];
  return null;
}

function findingClaimText(claim: ExtractedClaim): string {
  return claim.context.trim().length > 0 ? claim.context.trim() : `${claim.kind}: ${claim.value}`;
}

function contradictionFinding(claim: ExtractedClaim, fact: CanonFact): PregateFinding {
  return {
    kind: 'contradiction',
    claim: findingClaimText(claim),
    location: claim.location,
    recordValue: fact.value,
    sourceHandle: fact.sourceHandle,
    penalty: FINDING_PENALTY,
  };
}

function unboundFinding(claim: ExtractedClaim, exclusion: CanonExclusion | null): PregateFinding {
  return {
    kind: 'unbound',
    claim: findingClaimText(claim),
    location: claim.location,
    recordValue: UNBOUND_RECORD_VALUE,
    sourceHandle: exclusion
      ? `${exclusion.sourceHandle}: ${exclusion.reason}`
      : DEFAULT_UNBOUND_HANDLE,
    penalty: FINDING_PENALTY,
  };
}

export function formatFindingLine(finding: PregateFinding): string {
  const loc = `${finding.location.section} line ${finding.location.line}`;
  if (finding.kind === 'contradiction') {
    return `${finding.claim} (${loc}) vs record ${finding.recordValue} (${finding.sourceHandle})`;
  }
  if (finding.kind === 'unbound') {
    return `Unbound claim: ${finding.claim} (${loc}) — no record source (${finding.sourceHandle})`;
  }
  const exhaustive: never = finding.kind;
  throw new Error(`unhandled finding kind: ${String(exhaustive)}`);
}

/**
 * Check each extracted claim against RECORD.md + firm canon.
 * Verified → supporting input. Mismatch → contradiction. No source → unbound.
 */
export function checkClaims(
  extracted: readonly ExtractedClaim[],
  canon: readonly CanonEntry[],
): ClaimCheck[] {
  validateCanon(canon);
  return extracted.map((claim) => {
    const bound = bindCanon(claim, canon);
    if (bound === null) {
      return {
        status: 'unbound',
        extracted: claim,
        canon: null,
        qualifierApplied: false,
        finding: unboundFinding(claim, null),
      };
    }
    if (bound.entry === 'exclusion') {
      return {
        status: 'unbound',
        extracted: claim,
        canon: bound,
        qualifierApplied: false,
        finding: unboundFinding(claim, bound),
      };
    }
    const match = valuesEqual(claim.kind, claim.value, bound.value, claim.identifierType);
    const qualifierApplied = qualifiersCompatible(claim.qualifier, bound.qualifier);
    if (match || qualifierApplied) {
      return {
        status: 'verified',
        extracted: claim,
        canon: bound,
        qualifierApplied,
        finding: null,
      };
    }
    return {
      status: 'contradiction',
      extracted: claim,
      canon: bound,
      qualifierApplied: false,
      finding: contradictionFinding(claim, bound),
    };
  });
}
