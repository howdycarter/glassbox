import { evidence, record } from '../fixtures';
import type { CanonEntry, PregateInput, PregatePackage } from './types';

const RECORD = 'pursuit/TEST-RECORD.md';
const RATE_CARD = 'rate-card-proposal.md §APPROVED Oct 19, 2026';
const INVENTORY = 'Capability_Inventory.md §G.2';
const INVENTORY_RESTRICT = 'Capability_Inventory.md §Deploy-restrictions';
const INSURANCE = 'insurance-record-2026-10-24.md §Coverage Bound';

/**
 * Synthetic already-submitted package. Expected contradictions are
 * known in advance (CHR-2283 done-when): one rate mismatch, two
 * unbound résumé figures. Integrity value 88.
 */
export const WORKED_EXAMPLE_PACKAGE: PregatePackage = {
  pursuitId: 'CHR-2283-FIXTURE',
  title: 'TEST already-submitted package for Phase 2 pre-gate (synthetic, known contradictions)',
  submitted: true,
  sections: [
    {
      id: 'cover',
      heading: 'Cover',
      lines: [
        'Newton & Carter LLC',
        'UEI: ABCDE123FG45',
        'Address: 100 Congress Ave, Austin, TX 78701',
        'Phone: (512) 553-2217',
      ],
    },
    {
      id: 'attachment-c',
      heading: 'Attachment C rate table',
      lines: ['UX Researcher / Human-Centered Design $125/hr Approved firm rate card'],
    },
    {
      id: 'insurance',
      heading: 'Insurance',
      lines: [
        'Cyber liability $25K endorsement with the $1M bind promised pre-work',
      ],
    },
    {
      id: 'attachment-r',
      heading: 'Attachment R résumé',
      lines: [
        "Home Depot Pro Xtra program $20B+ in sales",
        'Earned $200K+ across 59 projects as an Expert-Vetted freelancer on Upwork',
      ],
    },
  ],
};

export const WORKED_EXAMPLE_CANON: CanonEntry[] = [
  {
    entry: 'fact',
    key: 'legal-name',
    kind: 'org',
    value: 'Newton & Carter LLC',
    sourceHandle: `${RECORD} §legal-name`,
    aliases: ['Newton & Carter LLC'],
    feedClass: 'blueforce',
  },
  {
    entry: 'fact',
    key: 'uei',
    kind: 'identifier',
    value: 'ABCDE123FG45',
    sourceHandle: `${RECORD} §uei`,
    aliases: ['UEI'],
    feedClass: 'blueforce',
  },
  {
    entry: 'fact',
    key: 'llc-address',
    kind: 'address',
    value: '100 Congress Ave, Austin, TX 78701',
    sourceHandle: `${RECORD} §llc-address`,
    aliases: ['Address', '100 Congress'],
    feedClass: 'blueforce',
  },
  {
    entry: 'fact',
    key: 'phone',
    kind: 'identifier',
    value: '(512) 553-2217',
    sourceHandle: `${RECORD} §phone`,
    aliases: ['Phone'],
    feedClass: 'blueforce',
  },
  {
    entry: 'fact',
    key: 'cyber-coverage',
    kind: 'coverage',
    value: '$25K',
    sourceHandle: INSURANCE,
    aliases: ['cyber liability', 'cyber'],
    qualifier: '$1M bind promised pre-work',
    feedClass: 'link',
  },
  {
    entry: 'fact',
    key: 'rate-researcher',
    kind: 'money',
    value: '$115/hr',
    sourceHandle: RATE_CARD,
    aliases: ['UX Researcher', 'Human-Centered Design', 'HCD Specialist'],
    feedClass: 'blueforce',
  },
  {
    entry: 'exclusion',
    key: 'unbound-hd-sales',
    kind: 'money',
    aliases: ['$20B', '20B'],
    sourceHandle: INVENTORY,
    reason: "'$20B': site-only — the figure appears nowhere in this record",
  },
  {
    entry: 'exclusion',
    key: 'unbound-upwork',
    kind: 'money',
    aliases: ['Upwork'],
    sourceHandle: INVENTORY_RESTRICT,
    reason: 'Upwork material is excluded in full (testimonials, stats) by standing rule',
  },
];

export const WORKED_EXAMPLE_S3_BLOCKERS = [
  'S3-BLOCKER: accessibility VPAT not attached (synthetic)',
] as const;

export const WORKED_EXAMPLE_INPUT: PregateInput = {
  package: WORKED_EXAMPLE_PACKAGE,
  canon: WORKED_EXAMPLE_CANON,
  recordEvidenceQuality: 'record-card',
  s3Blockers: [...WORKED_EXAMPLE_S3_BLOCKERS],
};

/** Same package against a summary-only Phase 1 record — degraded cap 60. */
export const SUMMARY_ONLY_RECORD = record(
  [
    evidence('requirement-clarity', { reliability: 0.5, supports: true }),
    evidence('deadline-realism', { reliability: 0.5, supports: true }),
  ],
  { pursuitId: 'CHR-2283-FIXTURE', title: WORKED_EXAMPLE_PACKAGE.title },
);

export const SUMMARY_ONLY_INPUT: PregateInput = {
  package: WORKED_EXAMPLE_PACKAGE,
  canon: WORKED_EXAMPLE_CANON,
  record: SUMMARY_ONLY_RECORD,
  s3Blockers: [...WORKED_EXAMPLE_S3_BLOCKERS],
};

/** Kind sweep — extraction only (not the scored worked example). */
export const KIND_SWEEP_PACKAGE: PregatePackage = {
  pursuitId: 'CHR-2283-KINDS',
  title: 'TEST kind-coverage draft (extraction only)',
  submitted: true,
  sections: [
    {
      id: 'scoring',
      heading: 'Scoring',
      lines: [
        'Accessibility is 15% of the rubric.',
        'Kickoff is January 15, 2027.',
        'PI: Chris Carter',
        'Firm: Newton & Carter LLC',
        'CAGE: 9ABC1',
        'The firm holds no certifications.',
      ],
    },
  ],
};

export const KIND_SWEEP_CANON: CanonEntry[] = [
  {
    entry: 'fact',
    key: 'pi',
    kind: 'person',
    value: 'Chris Carter',
    sourceHandle: `${RECORD} §pi`,
    aliases: ['Chris Carter'],
  },
  {
    entry: 'fact',
    key: 'legal-name',
    kind: 'org',
    value: 'Newton & Carter LLC',
    sourceHandle: `${RECORD} §legal-name`,
    aliases: ['Newton & Carter LLC'],
  },
  {
    entry: 'fact',
    key: 'cage',
    kind: 'identifier',
    value: '9ABC1',
    sourceHandle: `${RECORD} §cage`,
    aliases: ['CAGE'],
  },
  {
    entry: 'fact',
    key: 'firm-certs',
    kind: 'certification',
    value: 'none',
    sourceHandle: `${RECORD} §certs`,
    aliases: ['no certifications', 'holds no certifications'],
  },
  {
    entry: 'fact',
    key: 'kickoff',
    kind: 'date',
    value: 'January 15, 2027',
    sourceHandle: `${RECORD} §kickoff`,
    aliases: ['Kickoff'],
  },
  {
    entry: 'fact',
    key: 'access-weight',
    kind: 'percentage',
    value: '15%',
    sourceHandle: `${RECORD} §scoring`,
    aliases: ['Accessibility'],
  },
];

/**
 * Value mismatch that stays verified because both sides carry the same
 * uncertainty qualifier (Lane A Wave rule).
 */
export const QUALIFIER_PACKAGE: PregatePackage = {
  pursuitId: 'CHR-2283-QUALIFIER',
  title: 'TEST qualifier-consistent mismatch',
  submitted: true,
  sections: [
    {
      id: 'optionals',
      heading: 'Optionals',
      lines: ['AVL integration $200 pending confirmation'],
    },
  ],
};

export const QUALIFIER_CANON: CanonEntry[] = [
  {
    entry: 'fact',
    key: 'avl-optional',
    kind: 'money',
    value: '$150',
    sourceHandle: `${RECORD} §avl`,
    aliases: ['AVL'],
    qualifier: 'pending confirmation',
  },
];

export const WORKED_EXAMPLE_MARKDOWN = `## Cover
Newton & Carter LLC
UEI: ABCDE123FG45
Address: 100 Congress Ave, Austin, TX 78701
Phone: (512) 553-2217

## Attachment C rate table
UX Researcher / Human-Centered Design $125/hr Approved firm rate card

## Insurance
Cyber liability $25K endorsement with the $1M bind promised pre-work

## Attachment R résumé
Home Depot Pro Xtra program $20B+ in sales
Earned $200K+ across 59 projects as an Expert-Vetted freelancer on Upwork
`;
