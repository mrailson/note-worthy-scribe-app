import { Download } from 'lucide-react';
import { generateInvoicePdf } from '@/utils/invoicePdfGenerator';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';

interface InvoiceDownloadLinkProps {
  claim: BuyBackClaim;
  neighbourhoodName?: string;
}

export function InvoiceDownloadLink({ claim, neighbourhoodName = 'NRES' }: InvoiceDownloadLinkProps) {
  if (!claim.invoice_number) return null;

  const handleDownload = () => {
    const pdfDoc = generateInvoicePdf({
      claim,
      invoiceNumber: claim.invoice_number || '',
      neighbourhoodName,
    });
    pdfDoc.save(`${claim.invoice_number}.pdf`);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 2 }}>Invoice</div>
      <button
        onClick={handleDownload}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 10px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          color: '#7c3aed',
          background: '#f5f3ff',
          border: '1px solid #e9d5ff',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#ede9fe';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#c4b5fd';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#e9d5ff';
        }}
      >
        <Download size={12} />
        {claim.invoice_number}.pdf
      </button>
    </div>
  );
}
