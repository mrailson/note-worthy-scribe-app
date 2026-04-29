/**
 * GL Code mapping for PML Finance
 * 
 * Claim Type × Staff Role → GL Code
 * 
 * ┌─────────────────────────────┬───────┬───────┬───────┐
 * │ Claim Type                  │  GP   │  ANP  │  ACP  │
 * ├─────────────────────────────┼───────┼───────┼───────┤
 * │ Additional (SDA Resource)   │ 5411  │ 5412  │ 5413  │
 * │ Buy-Back                    │ 5421  │ 5422  │ 5423  │
 * └─────────────────────────────┴───────┴───────┴───────┘
 */

export type ClaimType = 'buyback' | 'additional';
export type GLRole = 'GP' | 'ANP' | 'ACP' | 'NRES Management';

const GL_CODES: Record<ClaimType, Record<string, string>> = {
  additional: { GP: '5411', ANP: '5412', ACP: '5413' },
  buyback:    { GP: '5421', ANP: '5422', ACP: '5423' },
};

const GL_LABELS: Record<string, string> = {
  '5411': 'GP Additional',
  '5412': 'ANP Additional',
  '5413': 'ACP Additional',
  '5421': 'GP Buy-Back',
  '5422': 'ANP Buy-Back',
  '5423': 'ACP Buy-Back',
};

const GL_INVOICE_LABELS: Record<string, string> = {
  '5411': '5411 - GP Additional SDA',
  '5412': '5412 - ANP Additional SDA',
  '5413': '5413 - ACP Additional SDA',
  '5421': '5421 - GP - Buy Back',
  '5422': '5422 - ANP - Buy Back',
  '5423': '5423 - ACP - Buy Back',
};

const CLAIM_TYPE_CONFIG = {
  buyback: { label: 'Buy-Back', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  additional: { label: 'Additional', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
} as const;

/**
 * Get the GL code for a claim type + staff role combination.
 * Returns null for NRES Management (no PML GL code).
 */
export function getGLCode(claimType: ClaimType, role: string): string | null {
  const roleText = (role || '').trim().toUpperCase();
  // Normalise common role labels — GP Locum, GP Standard, GP Partner, etc. all map to GP.
  const normalisedRole = roleText.includes('NRES MANAGEMENT')
    ? 'NRES Management'
    : roleText.includes('ANP')
      ? 'ANP'
      : roleText.includes('ACP')
        ? 'ACP'
        : roleText.includes('GP') || roleText.includes('GENERAL PRACTITIONER')
          ? 'GP'
          : role;
  if (normalisedRole === 'NRES Management') return null;
  return GL_CODES[claimType]?.[normalisedRole] ?? null;
}

/**
 * Get the human-readable label for a GL code.
 * e.g. "5421 · GP Buy-Back"
 */
export function getGLLabel(glCode: string | null): string {
  if (!glCode) return 'N/A — Management';
  const label = GL_LABELS[glCode];
  return label ? `${glCode} · ${label}` : glCode;
}

/**
 * Get just the short label for a GL code.
 * e.g. "GP Buy-Back"
 */
export function getGLShortLabel(glCode: string | null): string {
  if (!glCode) return 'Management';
  return GL_LABELS[glCode] ?? glCode;
}

/**
 * Get the invoice-facing GL label for PML Finance.
 * e.g. "5421 - GP - Buy Back"
 */
export function getGLInvoiceLabel(glCode: string | null): string {
  if (!glCode) return 'N/A — Management';
  return GL_INVOICE_LABELS[glCode] ?? glCode;
}

/**
 * Get the claim type badge config.
 */
export function getClaimTypeBadge(claimType: ClaimType) {
  return CLAIM_TYPE_CONFIG[claimType] ?? CLAIM_TYPE_CONFIG.buyback;
}

/**
 * Recalculate GL codes for all staff details in a claim
 * when the claim type changes.
 */
export function recalculateGLCodes(staffDetails: any[], claimType: ClaimType): any[] {
  return staffDetails.map(s => ({
    ...s,
    gl_code: getGLCode(claimType, s.staff_role || 'GP'),
    gl_category: getGLCode(claimType, s.staff_role || 'GP') ?? 'N/A',
  }));
}

export { GL_CODES, GL_LABELS, GL_INVOICE_LABELS, CLAIM_TYPE_CONFIG };
