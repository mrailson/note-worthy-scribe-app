/** The 7 NRES neighbourhood practices */
export const NRES_PRACTICES = {
  parks: 'The Parks MC',
  brackley: 'Brackley MC',
  springfield: 'Springfield Surgery',
  towcester: 'Towcester MC',
  bugbrooke: 'Bugbrooke Surgery',
  brook: 'Brook Health Centre',
  denton: 'Denton Village Surgery',
} as const;

export type NRESPracticeKey = keyof typeof NRES_PRACTICES;

export const NRES_PRACTICE_KEYS = Object.keys(NRES_PRACTICES) as NRESPracticeKey[];

/** Get the display name for a practice key, checking both NRES and ENN practices */
export function getPracticeName(key: string | null | undefined): string {
  if (!key) return '—';
  if (key in NRES_PRACTICES) return NRES_PRACTICES[key as NRESPracticeKey];
  return key;
}
