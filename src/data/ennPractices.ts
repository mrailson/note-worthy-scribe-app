/** The 11 ENN (East Northants Neighbourhood) practices (incl. Woodford branch) */
export const ENN_PRACTICES = {
  harborough: 'Harborough Fields Surgery',
  higham: 'Higham Ferrers Surgery',
  marshalls: "Marshalls Road Surgery",
  neneValley: 'Nene Valley Surgery',
  oundle: 'Oundle Medical Practice',
  parklands: 'Parklands Surgery',
  rushden: 'Rushden Medical Centre',
  spinney: 'Spinney Brook Medical Centre',
  cottons: 'The Cottons Medical Centre',
  meadows: 'The Meadows Surgery',
  woodford: 'Woodford Surgery (Spinney Branch)',
} as const;

export type ENNPracticeKey = keyof typeof ENN_PRACTICES;

export const ENN_PRACTICE_KEYS = Object.keys(ENN_PRACTICES) as ENNPracticeKey[];

export const ENN_ODS_CODES: Record<ENNPracticeKey, string> = {
  harborough: 'K83007',
  oundle: 'K83023',
  rushden: 'K83024',
  spinney: 'K83028',
  woodford: 'K83028-W',
  cottons: 'K83030',
  parklands: 'K83044',
  neneValley: 'K83065',
  marshalls: 'K83069',
  higham: 'K83080',
  meadows: 'K83616',
};

export const ENN_PRACTICE_ADDRESSES: Record<ENNPracticeKey, string> = {
  harborough: 'Harborough Field Surgery, 160 Newton Rd, Rushden, NN10 0GP',
  oundle: 'Glapthorn Rd, Peterborough PE8 4JA',
  rushden: 'Adnitt Road, Rushden, Northamptonshire, NN10 9TR',
  spinney: '59 High St, Irthlingborough, Wellingborough NN9 5GA',
  woodford: '13 Thrapston Road, Woodford, Kettering, Northamptonshire, NN14',
  cottons: 'The Cottons Medical Centre, Meadow Lane, Raunds, NN9 6UA',
  parklands: 'Parklands Surgery, Wymington Road, Rushden NN10 9EB',
  neneValley: 'Nene Valley Surgery, Green Lane, Thrapston, NN14 4QL',
  marshalls: "Marshalls Road Surgery, 7 Marshall's Rd, Raunds, Wellingborough NN9 6ET",
  higham: 'Higham Ferrers Surgery, Saffron Rd, Higham Ferrers, Rushden NN10 8ED',
  meadows: 'The Meadows Surgery, Meadow Lane, Thrapston, Kettering, Northamptonshire, NN14 4GD',
};

/** Hub assignments per the Jan 2026 data */
export type ENNHubName = 'Harborough Field Surgery' | 'The Cottons' | 'The Meadows Surgery';

export const ENN_HUB_ASSIGNMENTS: Record<ENNPracticeKey, ENNHubName> = {
  harborough: 'Harborough Field Surgery',
  rushden: 'Harborough Field Surgery',
  parklands: 'Harborough Field Surgery',
  higham: 'Harborough Field Surgery',
  spinney: 'The Cottons',
  woodford: 'The Cottons',
  cottons: 'The Cottons',
  marshalls: 'The Cottons',
  oundle: 'The Meadows Surgery',
  neneValley: 'The Meadows Surgery',
  meadows: 'The Meadows Surgery',
};

/** Key ENN totals (Jan 2026 data) */
export const ENN_TOTALS = {
  practices: 10,
  totalListSize: 90_241,
  annualApptsRequired: 74_846,
  weeklyApptsRequired: 1_438,
  totalAnnualIncome: 2_376_045.53,
  winterAppts: 21_352,
  nonWinterAppts: 53_495,
  weeklyNonWinter: 1_371,
} as const;

/** Get the display name for a practice key, or fallback */
export function getENNPracticeName(key: string | null | undefined): string {
  if (!key) return '—';
  return ENN_PRACTICES[key as ENNPracticeKey] ?? key;
}
