/** The 10 ENN (East Northants Neighbourhood) practices */
export const ENN_PRACTICES = {
  harborough: 'Harborough Field Surgery',
  oundle: 'Oundle Medical Practice',
  rushden: 'Rushden Medical Centre',
  spinney: 'Spinney Brook Medical Centre',
  cottons: 'The Cottons Medical Centre',
  parklands: 'Parklands Medical Centre',
  neneValley: 'Nene Valley Surgery',
  marshalls: "Marshalls Road Surgery",
  higham: 'Higham Ferrers Surgery',
  meadows: 'The Meadows Surgery',
} as const;

export type ENNPracticeKey = keyof typeof ENN_PRACTICES;

export const ENN_PRACTICE_KEYS = Object.keys(ENN_PRACTICES) as ENNPracticeKey[];

export const ENN_ODS_CODES: Record<ENNPracticeKey, string> = {
  harborough: 'K83007',
  oundle: 'K83023',
  rushden: 'K83024',
  spinney: 'K83028',
  cottons: 'K83030',
  parklands: 'K83044',
  neneValley: 'K83065',
  marshalls: 'K83069',
  higham: 'K83080',
  meadows: 'K83616',
};

/** Get the display name for a practice key, or fallback */
export function getENNPracticeName(key: string | null | undefined): string {
  if (!key) return '—';
  return ENN_PRACTICES[key as ENNPracticeKey] ?? key;
}
