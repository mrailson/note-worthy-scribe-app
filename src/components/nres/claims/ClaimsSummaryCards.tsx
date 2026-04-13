import { type ClaimLine, type ClaimsRole } from '@/hooks/useNRESClaims';

interface ClaimsSummaryCardsProps {
  claims: ClaimLine[];
  role: ClaimsRole;
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

export function ClaimsSummaryCards({ claims, role }: ClaimsSummaryCardsProps) {
  const cards = role === 'super_admin' ? [
    { label: 'Total Claims', value: claims.length, color: '#0f172a', icon: '📋' },
    { label: 'Submitted', value: byStatus(claims, ['submitted']).length, amount: totalValue(byStatus(claims, ['submitted'])), color: '#2563eb', icon: '📤' },
    { label: 'Verified', value: byStatus(claims, ['verified']).length, amount: totalValue(byStatus(claims, ['verified'])), color: '#7c3aed', icon: '✅' },
    { label: 'Approved', value: byStatus(claims, ['approved']).length, amount: totalValue(byStatus(claims, ['approved'])), color: '#059669', icon: '👍' },
    { label: 'Paid', value: byStatus(claims, ['paid']).length, amount: totalValue(byStatus(claims, ['paid'])), color: '#16a34a', icon: '💰' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️' },
    { label: 'Total Value', value: fmt(totalValue(claims)), color: '#0891b2', icon: '💷' },
  ] : role === 'finance' ? [
    { label: 'Awaiting Invoice', value: byStatus(claims, ['approved']).length, amount: totalValue(byStatus(claims, ['approved'])), color: '#d97706', icon: '📄' },
    { label: 'Invoiced', value: byStatus(claims, ['invoice_created']).length, amount: totalValue(byStatus(claims, ['invoice_created'])), color: '#0891b2', icon: '🧾' },
    { label: 'Scheduled', value: byStatus(claims, ['scheduled']).length, amount: totalValue(byStatus(claims, ['scheduled'])), color: '#2563eb', icon: '📅' },
    { label: 'Paid', value: byStatus(claims, ['paid']).length, amount: totalValue(byStatus(claims, ['paid'])), color: '#16a34a', icon: '✅' },
    { label: 'Total Pipeline', value: fmt(totalValue(claims)), color: '#0f172a', icon: '💷' },
  ] : role === 'approver' ? [
    { label: 'Awaiting Approval', value: byStatus(claims, ['verified']).length, amount: totalValue(byStatus(claims, ['verified'])), color: '#7c3aed', icon: '⏳' },
    { label: 'Approved', value: byStatus(claims, ['approved', 'invoice_created', 'scheduled', 'paid']).length, color: '#059669', icon: '✅' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️' },
    { label: 'Total Claims', value: claims.length, color: '#0f172a', icon: '📋' },
  ] : role === 'verifier' ? [
    { label: 'Awaiting Verification', value: byStatus(claims, ['submitted']).length, amount: totalValue(byStatus(claims, ['submitted'])), color: '#2563eb', icon: '⏳' },
    { label: 'Verified', value: byStatus(claims, ['verified', 'approved', 'invoice_created', 'scheduled', 'paid']).length, color: '#7c3aed', icon: '✅' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️' },
    { label: 'All Claims', value: claims.length, color: '#0f172a', icon: '📋' },
    { label: 'Total Value', value: fmt(totalValue(claims)), color: '#0891b2', icon: '💷' },
  ] : [
    { label: 'Draft', value: byStatus(claims, ['draft']).length, color: '#64748b', icon: '📝' },
    { label: 'Submitted', value: byStatus(claims, ['submitted', 'verified', 'approved', 'invoice_created', 'scheduled']).length, color: '#2563eb', icon: '📤' },
    { label: 'Paid', value: byStatus(claims, ['paid']).length, color: '#16a34a', icon: '✅' },
    { label: 'Queried', value: byStatus(claims, ['queried']).length, color: '#dc2626', icon: '⚠️' },
  ];

  return (
    <div
      className="grid gap-2.5 mb-5"
      style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 7)}, 1fr)` }}
    >
      {cards.map(c => (
        <div
          key={c.label}
          className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm"
          style={{ borderLeft: `3px solid ${c.color}` }}
        >
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {c.icon} {c.label}
          </div>
          <div className="text-xl font-extrabold mt-1" style={{ color: c.color }}>
            {typeof c.value === 'number' ? c.value : c.value}
          </div>
          {'amount' in c && c.amount !== undefined && (
            <div className="text-[11px] text-slate-400 mt-0.5">{fmt(c.amount as number)}</div>
          )}
        </div>
      ))}
    </div>
  );
}
