import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Guidance links for each of the 15 NHS complaint compliance checks.
 * Maps the numbered prefix (1–15) to relevant CQC/NHS references.
 */
export interface ComplianceGuidanceLink {
  label: string;
  url: string;
}

const COMPLIANCE_GUIDANCE: Record<number, ComplianceGuidanceLink[]> = {
  1: [
    { label: 'NHS Complaints Regulations 2009 (Regulation 15)', url: 'https://www.legislation.gov.uk/uksi/2009/309/regulation/15' },
    { label: 'CQC Regulation 16 – Receiving and acting on complaints', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-16-receiving-acting-complaints' },
  ],
  2: [
    { label: 'NHS Complaints Regulations 2009 (Regulation 14)', url: 'https://www.legislation.gov.uk/uksi/2009/309/regulation/14' },
    { label: 'CQC Key Line of Enquiry – Responsive', url: 'https://www.cqc.org.uk/guidance-providers/gps/key-lines-enquiry-responsive' },
  ],
  3: [
    { label: 'NHS Complaints Regulations 2009', url: 'https://www.legislation.gov.uk/uksi/2009/309/contents' },
    { label: 'CQC Regulation 17.2 – Good Governance', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
  ],
  4: [
    { label: 'Data Protection Act 2018', url: 'https://www.legislation.gov.uk/ukpga/2018/12/contents' },
    { label: 'UK GDPR – Article 6 (Lawful basis)', url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/' },
    { label: 'CQC Regulation 17 – Good Governance (Information)', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
  ],
  5: [
    { label: 'CQC Regulation 17 – Good Governance', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
    { label: 'CQC Regulation 20 – Duty of Candour', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-20-duty-candour' },
  ],
  6: [
    { label: 'CQC Key Line of Enquiry – Well-led', url: 'https://www.cqc.org.uk/guidance-providers/gps/key-lines-enquiry-well-led' },
    { label: 'NHS Resolution – Learning from complaints', url: 'https://resolution.nhs.uk/' },
  ],
  7: [
    { label: 'CQC Regulation 17 – Good Governance (Records)', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
    { label: 'NHS England – Records Management Code of Practice', url: 'https://transform.england.nhs.uk/information-governance/guidance/records-management-code/' },
  ],
  8: [
    { label: 'CQC Regulation 17 – Good Governance (Leadership)', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
    { label: 'CQC Key Line of Enquiry – Well-led', url: 'https://www.cqc.org.uk/guidance-providers/gps/key-lines-enquiry-well-led' },
  ],
  9: [
    { label: 'NHS Complaints Regulations 2009 (Timescales)', url: 'https://www.legislation.gov.uk/uksi/2009/309/contents' },
    { label: 'NHS Constitution – Complaints pledge', url: 'https://www.gov.uk/government/publications/the-nhs-constitution-for-england' },
  ],
  10: [
    { label: 'NHS Complaints Regulations 2009 (Regulation 14(3))', url: 'https://www.legislation.gov.uk/uksi/2009/309/regulation/14' },
    { label: 'PHSO – Principles of Good Complaint Handling', url: 'https://www.ombudsman.org.uk/about-us/our-principles/principles-good-complaint-handling' },
  ],
  11: [
    { label: 'NHS Complaints Regulations 2009 (Escalation routes)', url: 'https://www.legislation.gov.uk/uksi/2009/309/contents' },
    { label: 'Parliamentary & Health Service Ombudsman (PHSO)', url: 'https://www.ombudsman.org.uk/' },
  ],
  12: [
    { label: 'CQC Regulation 17 – Good Governance (Improvement)', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
    { label: 'CQC Key Line of Enquiry – Well-led (Learning culture)', url: 'https://www.cqc.org.uk/guidance-providers/gps/key-lines-enquiry-well-led' },
  ],
  13: [
    { label: 'CQC Key Line of Enquiry – Responsive', url: 'https://www.cqc.org.uk/guidance-providers/gps/key-lines-enquiry-responsive' },
    { label: 'NHS England – Quality Improvement', url: 'https://www.england.nhs.uk/quality-service-improvement-and-redesign-qsir-tools/' },
  ],
  14: [
    { label: 'CQC Regulation 18 – Staffing', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-18-staffing' },
    { label: 'CQC Key Line of Enquiry – Well-led', url: 'https://www.cqc.org.uk/guidance-providers/gps/key-lines-enquiry-well-led' },
  ],
  15: [
    { label: 'NHS England – Quality Assurance', url: 'https://www.england.nhs.uk/quality-service-improvement-and-redesign-qsir-tools/' },
    { label: 'CQC Regulation 17 – Good Governance (Monitoring)', url: 'https://www.cqc.org.uk/guidance-providers/regulations/regulation-17-good-governance' },
  ],
};

/**
 * Extracts the numbered index from a compliance item string like "(3) Some text" → 3
 */
function extractNumber(complianceItem: string): number | null {
  const match = complianceItem?.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Gets the guidance links for a given compliance item string.
 */
export function getComplianceGuidanceLinks(complianceItem: string): ComplianceGuidanceLink[] {
  const num = extractNumber(complianceItem);
  return num ? COMPLIANCE_GUIDANCE[num] || [] : [];
}

/**
 * React component to render guidance links for a compliance check.
 */
export const ComplianceGuidanceLinks: React.FC<{ complianceItem: string }> = ({ complianceItem }) => {
  const links = getComplianceGuidanceLinks(complianceItem);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          {link.label}
        </a>
      ))}
    </div>
  );
};
