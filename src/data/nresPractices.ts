import { ENN_ODS_CODES } from './ennPractices';

/** The 7 NRES neighbourhood practices */
export const NRES_PRACTICES = {
  parks: 'The Parks Medical Practice',
  brackley: 'Brackley Medical Centre',
  springfield: 'Springfield Surgery',
  towcester: 'Towcester Medical Centre',
  bugbrooke: 'Bugbrooke Medical Practice',
  brook: 'Brook Health Centre',
  denton: 'Denton Village Surgery',
} as const;

export type NRESPracticeKey = keyof typeof NRES_PRACTICES;

export const NRES_PRACTICE_KEYS = Object.keys(NRES_PRACTICES) as NRESPracticeKey[];

export const NRES_ODS_CODES: Record<NRESPracticeKey, string> = {
  parks: 'K83052',
  brackley: 'K83049',
  springfield: 'K83018',
  towcester: 'K83022',
  bugbrooke: 'K83070',
  brook: 'K83620',
  denton: 'K83068',
};

export const NRES_PRACTICE_ADDRESSES: Record<NRESPracticeKey, string> = {
  parks: 'The Parks Medical Practice, Alcester Road, Stratford Road, Towcester, NN12 6BX',
  brackley: 'Brackley Medical Centre, Halse Road, Brackley, NN13 6EQ',
  springfield: 'Springfield Surgery, Horsefair, Towcester, NN12 6BT',
  towcester: 'Towcester Medical Centre, Richmond Road, Towcester, NN12 6EX',
  bugbrooke: 'Bugbrooke Medical Practice, Levitts Road, Bugbrooke, Northampton, NN7 3QN',
  brook: 'Brook Health Centre, Stratford Road, Roade, Northampton, NN7 2NT',
  denton: 'Denton Village Surgery, Orchard Lane, Denton, Northampton, NN7 1HT',
};

export interface NRESPracticeContact {
  practiceManager: string;
  email: string;
  phone: string;
}

export const NRES_PRACTICE_CONTACTS: Record<NRESPracticeKey, NRESPracticeContact> = {
  parks: { practiceManager: 'Practice Manager', email: 'parks.k83052@nhs.net', phone: '01onal' },
  brackley: { practiceManager: 'Practice Manager', email: 'brackley.k83049@nhs.net', phone: '' },
  springfield: { practiceManager: 'Practice Manager', email: 'springfield.k83018@nhs.net', phone: '' },
  towcester: { practiceManager: 'Practice Manager', email: 'towcester.k83022@nhs.net', phone: '' },
  bugbrooke: { practiceManager: 'Lorraine Spicer', email: 'bugbrooke.k83070@nhs.net', phone: '01604 830348' },
  brook: { practiceManager: 'Practice Manager', email: 'brook.k83620@nhs.net', phone: '' },
  denton: { practiceManager: 'Nicola Draper', email: 'northantsicb.denton.enquiries@nhs.net', phone: '01604 890313' },
};

/** Get the display name for a practice key, checking both NRES and ENN practices */
export function getPracticeName(key: string | null | undefined): string {
  if (!key) return '—';
  if (key in NRES_PRACTICES) return NRES_PRACTICES[key as NRESPracticeKey];
  return key;
}

/** Get the ODS code for a practice key */
export function getOdsCode(key: string | null | undefined): string {
  if (!key) return '—';
  if (key in NRES_ODS_CODES) return NRES_ODS_CODES[key as NRESPracticeKey];
  // Also check ENN
  if (key in ENN_ODS_CODES) return ENN_ODS_CODES[key as keyof typeof ENN_ODS_CODES];
  return key;
}
