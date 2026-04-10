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
  bt_pcn: 'Brackley & Towcester PCN Ltd',
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
  bt_pcn: 'N/A',
};

export const NRES_PRACTICE_ADDRESSES: Record<NRESPracticeKey, string> = {
  parks: 'The Parks Medical Practice, Alcester Road, Stratford Road, Towcester, NN12 6BX',
  brackley: 'Brackley Medical Centre, Halse Road, Brackley, NN13 6EQ',
  springfield: 'Springfield Surgery, Horsefair, Towcester, NN12 6BT',
  towcester: 'Towcester Medical Centre, Richmond Road, Towcester, NN12 6EX',
  bugbrooke: 'Bugbrooke Medical Practice, Levitts Road, Bugbrooke, Northampton, NN7 3QN',
  brook: 'Brook Health Centre, Stratford Road, Roade, Northampton, NN7 2NT',
  denton: 'Denton Village Surgery, Orchard Lane, Denton, Northampton, NN7 1HT',
  bt_pcn: 'Brackley Medical Centre, Halse Road, Brackley, NN13 6EQ',
};

export interface NRESPracticeContact {
  practiceManager: string;
  email: string;
  phone: string;
}

export const NRES_PRACTICE_CONTACTS: Record<NRESPracticeKey, NRESPracticeContact> = {
  parks: { practiceManager: 'Alex Whitehead', email: 'alexander.whitehead@nhs.net', phone: '' },
  brackley: { practiceManager: 'Mel Thompson', email: 'mel.thompson3@nhs.net', phone: '' },
  springfield: { practiceManager: 'Hayley Willingham', email: 'hayley.willingham1@nhs.net', phone: '' },
  towcester: { practiceManager: 'Chloe Lamont', email: 'chloe.lamont1@nhs.net', phone: '' },
  bugbrooke: { practiceManager: 'Lorraine Spicer', email: 'lorraine.spicer@nhs.net', phone: '01604 830348' },
  brook: { practiceManager: 'Anita Carter', email: 'anita.carter5@nhs.net', phone: '' },
  denton: { practiceManager: 'Nicola Draper', email: 'nicola.draper3@nhs.net', phone: '01604 890313' },
  bt_pcn: { practiceManager: 'Amanda Palin', email: 'amanda.palin2@nhs.net', phone: '' },
};

export interface NRESPracticeBankDetails {
  bankName: string;
  sortCode: string;
  accountNumber: string;
  accountName: string;
}

/** Bank details for invoice remittance — only populated where known */
export const NRES_PRACTICE_BANK_DETAILS: Partial<Record<NRESPracticeKey, NRESPracticeBankDetails>> = {
  bt_pcn: {
    bankName: 'Lloyds Bank',
    sortCode: '30-11-08',
    accountNumber: '28122560',
    accountName: 'Brackley & Towcester PCN Ltd',
  },
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
