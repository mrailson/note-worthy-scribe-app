import { type ClaimLine, type ClaimsRole } from '@/hooks/useNRESClaims';

interface ClaimsSummaryCardsProps {
  claims: ClaimLine[];
  role: ClaimsRole;
  onCardClick?: (filterKey: string) => void;
}

function byStatus(claims: ClaimLine[], statuses: string[]) {
  return claims.filter(c => statuses.includes(c.status));
}

function totalValue(arr: ClaimLine[]) {
  return arr.reduce((s, c) => s + (c.claimed_amount || 0), 0);
}

function fmt(v: number) {
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
}

type Card = { label: string; value: number | string; amount?: number; color: string; icon: string; filterKey?: string };

export function ClaimsSummaryCards({ claims, role, onCardClick }: ClaimsSummaryCardsProps) {
  const cards: Card[] = role === 'super_admin' ? [
    { label: 'Total Claims', value: claims.length, color: '#0f172a', icon: '📋', filterKey: 'all' },
    { label: 'Drafts', value: byStatus(claims, ['draft']).length, amount: totalValue(byStatus(claims, ['draft'])), color: '#64748b', icon: '📝', filterKey: 'draft' },
    { label: 'Submitted', value: byStatus(claims, ['submitted']).length, amount: totalValue(byStatus(claims, ['submitted'])), color: '#2563eb', icon: '📤', filterKey: 'submitted' },
    { label: 'Verified', value: byStatus(claims, ['verified']).length, amount: totalValue(byStatus(claims, ['verified'])), color: '#7c3aed', icon: '✅', filterKey: 'verified' },
    { label: 'Approved', value: byStatus(claims, ['approved']).length, amount: totalValue(byStatus(claims, ['approved'])), color: '#059669', icon: '👍', filterKey: 'approved' },
    { label: 'Paid', value: byStatus(claims, ['paid']).length, amount: totalValue(byStatus(claims, ['paid'])), color: '#16a34a', icon: '💰', filterKey: 'paid' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️', filterKey: 'queried' },
  ] : role === 'finance' ? [
    { label: 'Awaiting Invoice', value: byStatus(claims, ['approved']).length, amount: totalValue(byStatus(claims, ['approved'])), color: '#d97706', icon: '📄', filterKey: 'approved' },
    { label: 'Invoiced', value: byStatus(claims, ['invoice_created']).length, amount: totalValue(byStatus(claims, ['invoice_created'])), color: '#0891b2', icon: '🧾', filterKey: 'invoice_created' },
    { label: 'Scheduled', value: byStatus(claims, ['scheduled']).length, amount: totalValue(byStatus(claims, ['scheduled'])), color: '#2563eb', icon: '📅', filterKey: 'scheduled' },
    { label: 'Paid', value: byStatus(claims, ['paid']).length, amount: totalValue(byStatus(claims, ['paid'])), color: '#16a34a', icon: '✅', filterKey: 'paid' },
    { label: 'Total Pipeline', value: fmt(totalValue(claims)), color: '#0f172a', icon: '💷', filterKey: 'all' },
  ] : role === 'approver' ? [
    { label: 'Awaiting Approval', value: byStatus(claims, ['verified']).length, amount: totalValue(byStatus(claims, ['verified'])), color: '#7c3aed', icon: '⏳', filterKey: 'awaiting_pml_approval' },
    { label: 'Approved', value: byStatus(claims, ['approved', 'invoice_created', 'scheduled', 'paid']).length, color: '#059669', icon: '✅', filterKey: 'approved_and_paid' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️', filterKey: 'queried' },
    { label: 'Total Claims', value: claims.length, color: '#0f172a', icon: '📋', filterKey: 'all' },
  ] : role === 'verifier' ? [
    { label: 'Awaiting Verification', value: byStatus(claims, ['submitted']).length, amount: totalValue(byStatus(claims, ['submitted'])), color: '#2563eb', icon: '⏳', filterKey: 'submitted' },
    { label: 'Verified', value: byStatus(claims, ['verified', 'approved', 'invoice_created', 'scheduled', 'paid']).length, color: '#7c3aed', icon: '✅', filterKey: 'verified' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️', filterKey: 'queried' },
    { label: 'All Claims', value: claims.length, color: '#0f172a', icon: '📋', filterKey: 'all' },
  ] : [
    { label: 'Draft', value: byStatus(claims, ['draft']).length, color: '#64748b', icon: '📝', filterKey: 'draft' },
    { label: 'Submitted', value: byStatus(claims, ['submitted', 'verified', 'approved', 'invoice_created', 'scheduled']).length, color: '#2563eb', icon: '📤', filterKey: 'in_progress' },
    { label: 'Paid', value: byStatus(claims, ['paid']).length, color: '#16a34a', icon: '✅', filterKey: 'paid' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️', filterKey: 'queried' },
  ];

  return (
    <div
      className="grid gap-2.5 mb-5"
      style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 7)}, 1fr)` }}
    >
      {cards.map(c => {
        const isQueried = c.label.toLowerCase().includes('queried') || c.label.toLowerCase().includes('query');
        const queriedCount = typeof c.value === 'number' ? c.value : 0;
        const showPulse = isQueried && queriedCount > 0;
        const clickable = !!onCardClick && !!c.filterKey;
        return (
          <button
            type="button"
            key={c.label}
            onClick={clickable ? () => onCardClick!(c.filterKey!) : undefined}
            disabled={!clickable}
            className={`text-left bg-white rounded-lg p-3 border border-slate-200 shadow-sm transition-all ${showPulse ? 'ring-2 ring-red-400/50' : ''} ${clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300' : 'cursor-default'}`}
            style={{ borderLeft: `3px solid ${c.color}` }}
          >
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              {c.icon} {c.label}
              {showPulse && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
            </div>
            <div className="text-xl font-extrabold mt-1" style={{ color: c.color }}>
              {typeof c.value === 'number' ? c.value : c.value}
            </div>
            {'amount' in c && c.amount !== undefined && (
              <div className="text-[11px] text-slate-400 mt-0.5">{fmt(c.amount as number)}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
