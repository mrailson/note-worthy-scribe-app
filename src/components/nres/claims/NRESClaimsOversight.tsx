import { useState, useMemo } from 'react';
import { useNRESClaims, type ClaimStatus } from '@/hooks/useNRESClaims';
import { ClaimsSummaryCards } from './ClaimsSummaryCards';
import { CreateClaimPanel } from './CreateClaimPanel';
import { ClaimsHistory } from './ClaimsHistory';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const ROLE_DISPLAY = [
  { key: 'super_admin', label: 'Super Admin', icon: '🛡️' },
  { key: 'practice', label: 'Practice', icon: '🏥' },
  { key: 'verifier', label: 'Verifier', icon: '✅' },
  { key: 'approver', label: 'Approver', icon: '👨‍⚕️' },
  { key: 'finance', label: 'PML Finance', icon: '💷' },
] as const;

export function NRESClaimsOversight() {
  const {
    claims, practices, evidence, auditLog, loading, saving,
    claimsRole, userEmail,
    createClaimLine, declareAndSubmit, advanceStatus,
    raiseQuery, resubmitQueried, deleteClaim,
    fetchEvidence, fetchAuditLog,
    getAction, canQuery,
  } = useNRESClaims();

  const [view, setView] = useState<'dashboard' | 'create' | 'claims'>('dashboard');
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('');

  // Default to first practice if none selected
  const effectivePracticeId = selectedPracticeId || (practices.length > 0 ? practices[0].id : '');

  // Filter claims for practice role
  const visibleClaims = useMemo(() => {
    if (claimsRole === 'practice') {
      return claims.filter(c => c.practice_id === effectivePracticeId);
    }
    return claims;
  }, [claims, claimsRole, effectivePracticeId]);

  const showCreateTab = claimsRole === 'practice' || claimsRole === 'super_admin';
  const showPracticeSelector = claimsRole === 'practice' || claimsRole === 'super_admin';

  const handleCreateAndSubmit = async (entry: Parameters<typeof createClaimLine>[0]) => {
    const result = await createClaimLine(entry);
    return result?.id;
  };

  const handleExpandClaim = (claimId: string) => {
    fetchEvidence(claimId);
    fetchAuditLog(claimId);
  };

  const roleInfo = ROLE_DISPLAY.find(r => r.key === claimsRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading claims...</span>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div
        className="rounded-t-lg px-5 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #0C4A6E 0%, #005eb8 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="bg-white rounded px-2.5 py-0.5 text-[13px] font-extrabold tracking-tight" style={{ color: '#005eb8' }}>
            NRES
          </div>
          <span className="text-white text-sm font-semibold">Claims & Oversight</span>
          <span className="text-blue-300 text-[11px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>
            Per-Line Invoice Model
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{ background: '#1E3A5F', color: '#7DD3FC' }}
            >
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white text-[11px] font-semibold">{userEmail}</div>
              <div className="text-slate-400 text-[9px]">{roleInfo?.icon} {roleInfo?.label}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-5 flex justify-between items-center">
        <div className="flex gap-0">
          {[
            { k: 'dashboard' as const, l: 'Dashboard', show: true },
            { k: 'create' as const, l: 'Create Claims', show: showCreateTab },
            { k: 'claims' as const, l: 'Claims History', show: true },
          ].filter(n => n.show).map(n => (
            <button
              key={n.k}
              onClick={() => setView(n.k)}
              className="px-4 py-2.5 text-xs cursor-pointer border-none bg-transparent transition-all"
              style={{
                fontWeight: view === n.k ? 700 : 500,
                color: view === n.k ? '#0C4A6E' : '#64748B',
                borderBottom: view === n.k ? '2.5px solid #0C4A6E' : '2.5px solid transparent',
              }}
            >
              {n.l}
            </button>
          ))}
        </div>
        {showPracticeSelector && practices.length > 0 && (
          <div className="flex items-center gap-1.5">
            {claimsRole === 'super_admin' && (
              <span className="text-[10px] text-slate-500 font-semibold">On behalf of:</span>
            )}
            <Select value={effectivePracticeId} onValueChange={setSelectedPracticeId}>
              <SelectTrigger className="h-8 text-[11px] font-semibold w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {practices.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="max-w-[1100px] mx-auto px-4 py-5 pb-16">
        {(view === 'dashboard' || view === 'claims') && (
          <>
            {view === 'dashboard' && <ClaimsSummaryCards claims={visibleClaims} role={claimsRole} />}
            <ClaimsHistory
              claims={visibleClaims}
              practices={practices}
              role={claimsRole}
              evidence={evidence}
              auditLog={auditLog}
              saving={saving}
              getAction={getAction}
              canQuery={canQuery}
              onAdvanceStatus={(id, from, to) => advanceStatus(id, from, to)}
              onResubmit={resubmitQueried}
              onQuery={raiseQuery}
              onExpandClaim={handleExpandClaim}
            />
          </>
        )}
        {view === 'create' && showCreateTab && (
          <CreateClaimPanel
            practices={practices}
            selectedPracticeId={effectivePracticeId}
            claimsRole={claimsRole}
            saving={saving}
            onCreateAndSubmit={handleCreateAndSubmit}
            onDeclareAndSubmit={declareAndSubmit}
          />
        )}
      </main>
    </div>
  );
}
