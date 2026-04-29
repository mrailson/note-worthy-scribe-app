import { useState, useMemo } from 'react';
import { useNRESClaims, type ClaimsRole } from '@/hooks/useNRESClaims';
import { ClaimsSummaryCards } from './ClaimsSummaryCards';
import { CreateClaimPanel } from './CreateClaimPanel';
import { ClaimsHistory } from './ClaimsHistory';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useNRESSystemRoles } from '@/hooks/useNRESSystemRoles';

const ROLE_DISPLAY = [
  { key: 'super_admin', label: 'Super Admin', icon: '🛡️' },
  { key: 'practice', label: 'Practice', icon: '🏥' },
  { key: 'verifier', label: 'Mgmt Lead', icon: '📋' },
  { key: 'approver', label: 'SNO Approver', icon: '✅' },
  { key: 'finance', label: 'PML Finance', icon: '💰' },
] as const;

const TEST_ROLES: { value: ClaimsRole; label: string }[] = [
  { value: 'super_admin', label: 'Admin' },
  { value: 'practice', label: 'Practice' },
  { value: 'verifier', label: 'Mgmt Lead' },
  { value: 'approver', label: 'SNO Approver' },
  { value: 'finance', label: 'PML Finance' },
];

export function NRESClaimsOversight() {
  const {
    claims, practices, evidence, auditLog, loading, saving,
    claimsRole: actualRole, userEmail,
    createClaimLine, declareAndSubmit, advanceStatus,
    raiseQuery, resubmitQueried,
    fetchEvidence, fetchAuditLog,
    getAction, canQuery,
  } = useNRESClaims();

  const { isSuperAdmin } = useNRESSystemRoles();
  const [testRoleOverride, setTestRoleOverride] = useState<ClaimsRole | null>(null);

  // Only super_admin can use the test mode role switcher
  const effectiveRole: ClaimsRole = (isSuperAdmin && testRoleOverride) ? testRoleOverride : actualRole;

  const [view, setView] = useState<'dashboard' | 'create' | 'claims'>('dashboard');
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('');

  // Default to first practice if none selected
  const effectivePracticeId = selectedPracticeId || (practices.length > 0 ? practices[0].id : '');

  // Filter claims based on effective role
  const visibleClaims = useMemo(() => {
    let filtered = claims;
    if (effectiveRole === 'practice') {
      filtered = claims.filter(c => c.practice_id === effectivePracticeId);
    } else if (effectiveRole === 'verifier') {
      filtered = claims.filter(c => ['submitted', 'verified', 'approved', 'invoice_created', 'scheduled', 'paid'].includes(c.status));
    } else if (effectiveRole === 'approver') {
      filtered = claims.filter(c => ['verified', 'approved', 'invoice_created', 'scheduled', 'paid'].includes(c.status));
    } else if (effectiveRole === 'finance') {
      filtered = claims.filter(c => ['approved', 'invoice_created', 'scheduled', 'paid'].includes(c.status));
    }
    return filtered;
  }, [claims, effectiveRole, effectivePracticeId]);

  const showCreateTab = effectiveRole === 'practice' || effectiveRole === 'super_admin';
  const showPracticeSelector = effectiveRole === 'practice' || effectiveRole === 'super_admin';

  const handleCreateAndSubmit = async (entry: Parameters<typeof createClaimLine>[0]) => {
    const result = await createClaimLine(entry);
    return result?.id;
  };

  const handleExpandClaim = (claimId: string) => {
    fetchEvidence(claimId);
    fetchAuditLog(claimId);
  };

  const roleInfo = ROLE_DISPLAY.find(r => r.key === effectiveRole);

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
            {effectiveRole === 'super_admin' && (
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

      {/* TEST mode role switcher — super_admin only */}
      {isSuperAdmin && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-1.5 flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
            🧪 TEST
          </span>
          {TEST_ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setTestRoleOverride(testRoleOverride === r.value ? null : r.value)}
              className="px-2.5 py-1 rounded-full border-none text-[10px] font-semibold cursor-pointer transition-all"
              style={
                effectiveRole === r.value
                  ? { background: '#005eb8', color: '#fff' }
                  : { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="max-w-[1100px] mx-auto px-4 py-5 pb-16">
        {(view === 'dashboard' || view === 'claims') && (
          <>
            {view === 'dashboard' && <ClaimsSummaryCards claims={visibleClaims} role={effectiveRole} />}
            <ClaimsHistory
              claims={visibleClaims}
              practices={practices}
              role={effectiveRole}
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
            claimsRole={effectiveRole}
            saving={saving}
            onCreateAndSubmit={handleCreateAndSubmit}
            onDeclareAndSubmit={declareAndSubmit}
          />
        )}
      </main>
    </div>
  );
}
