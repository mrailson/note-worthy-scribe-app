import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/nres/InfoTooltip';
import { ChevronDown, ChevronRight, BookOpen, CheckCircle2, Printer, Download } from 'lucide-react';
import type { RateSettings } from '@/hooks/useNRESBuyBackRateSettings';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';

function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ClaimsUserGuideProps {
  neighbourhoodName: string;
  rateSettings: RateSettings;
  onCostMultiplier: number;
  staffRoles: string[];
  isENN?: boolean;
}

/* ── Callout boxes ─────────────────────────────────────────────── */
function CalloutBox({ type, children }: { type: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'sky' | 'slate'; children: React.ReactNode }) {
  const styles = {
    green: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-200',
    red: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/30 dark:border-red-700 dark:text-red-200',
    amber: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-200',
    blue: 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-200',
    purple: 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-950/30 dark:border-purple-700 dark:text-purple-200',
    sky: 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/30 dark:border-sky-700 dark:text-sky-200',
    slate: 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-950/30 dark:border-slate-700 dark:text-slate-200',
  };
  return <div className={`rounded-lg border p-3 text-sm ${styles[type]}`}>{children}</div>;
}

/* ── Step indicator ─────────────────────────────────────────────── */
function StepFlow() {
  const steps = [
    { num: '1', label: 'Add Staff', who: 'Practice' },
    { num: '2', label: 'Claim & Upload', who: 'Practice' },
    { num: '3', label: 'Submit', who: 'Practice' },
    { num: '4', label: 'Verify', who: 'Mgmt Lead' },
    { num: '5', label: 'SNO Approval', who: 'SNO Approver' },
    { num: '6', label: 'Paid', who: 'PML Finance' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{s.num}</div>
            <span className="text-[10px] font-semibold mt-0.5">{s.label}</span>
            <span className="text-[9px] text-muted-foreground">{s.who}</span>
          </div>
          {i < steps.length - 1 && <div className="w-4 h-0.5 bg-primary/40 mt-[-12px]" />}
        </div>
      ))}
    </div>
  );
}

/* ── Tab 1: Overview ────────────────────────────────────────────── */
function OverviewTab({ neighbourhoodName }: { neighbourhoodName: string }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-[#003087] mb-1">What Is This?</h3>
        <p className="text-muted-foreground">
          This system manages monthly reimbursement claims for staff working on the {neighbourhoodName} SDA (Same Day Access) Programme — Part A of the Neighbourhood Access Service.
        </p>
      </div>

      <h3 className="font-semibold text-[#003087]">Five Categories of Claim</h3>
      <CalloutBox type="blue">
        <p className="font-semibold mb-1">🔄 Buy-Back Staff</p>
        <p>Existing practice staff whose time is "bought back" for SDA work. The practice releases them from their normal duties to deliver Part A (SDA) sessions. The practice claims reimbursement for their time at agreed rates.</p>
        <CalloutBox type="amber">
          <p className="font-semibold">⚠️ Critical:</p>
          <p>Buy-back staff <strong>must</strong> have matching Part B (LTC) delivery evidenced. Payments will <strong>not</strong> be released without this.</p>
        </CalloutBox>
      </CalloutBox>

      <CalloutBox type="green">
        <p className="font-semibold mb-1">✨ New SDA Staff</p>
        <p>Newly recruited GPs, ACPs, or ANPs hired specifically for the SDA programme. They are <strong>additional</strong> capacity — not bought back from existing practice work.</p>
        <p className="mt-1">✅ No Part B evidence required — they are additional, not replacing existing staff.</p>
      </CalloutBox>

      <CalloutBox type="purple">
        <p className="font-semibold mb-1">👨‍⚕️ GP Locum</p>
        <p>External locum GPs covering SDA sessions when substantive staff are unavailable. Billed at <strong>fixed</strong> rates: <strong>£750/day</strong> or <strong>£375/session</strong> (1 session = 4 hrs 10 mins / half-day). No on-costs are added (locums invoice gross).</p>
        <p className="mt-1 text-xs">✅ No Part B evidence required — locums are additional sessional cover, not buy-back.</p>
      </CalloutBox>

      <CalloutBox type="sky">
        <p className="font-semibold mb-1">🗣️ Meeting Attendance</p>
        <p>GPs and Practice Managers paid per attended SDA governance meeting (e.g. clinical leads, neighbourhood board). Rates: <strong>£100/hr</strong> for Practice Partner (GP), <strong>£50/hr</strong> for Practice Managers.</p>
      </CalloutBox>

      <CalloutBox type="slate">
        <p className="font-semibold mb-1">🧭 NRES Management</p>
        <p>Time worked by named programme leads (Neighbourhood Manager, Programme Lead, Management Leads). Calculated as <strong>agreed hourly rate × hours per week × working weeks in the month</strong>.</p>
        <p className="mt-1 text-xs">Each role has a person, hourly rate and max hours/week configured in settings.</p>
      </CalloutBox>

      <CalloutBox type="red">
        <p className="font-semibold mb-1">🚫 The Golden Rule</p>
        <p>Staff must be working <strong>exclusively</strong> on SDA (Part A) during their funded hours. No LTC (Part B) activity is permitted during buy-back or new SDA time. Mixed roles must have clear, separated allocations.</p>
      </CalloutBox>

      <div>
        <h3 className="font-semibold text-[#003087] mb-1">Key People</h3>
        <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
          <li><strong>Practice Manager / Admin</strong> — creates claims, uploads evidence, submits</li>
          <li><strong>Management Leads</strong> (Malcolm, Amanda, Lucy) — validates claims, assists practices</li>
          <li><strong>SNO Approver</strong> — approves, queries, or rejects claims before invoicing</li>
          <li><strong>PML Finance</strong> — processes payments, marks as paid</li>
        </ul>
      </div>
    </div>
  );
}

/* ── Tab 2: How to Claim ────────────────────────────────────────── */
function HowToClaimTab() {
  return (
    <div className="space-y-5 text-sm">
      <StepFlow />

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Step 1: Add Your Staff (One-Time Setup)</h4>
        <Badge variant="outline" className="mb-1 text-[10px]">Practice Manager</Badge>
        <ul className="text-muted-foreground list-disc list-inside space-y-0.5 mt-1">
          <li>Go to the "NRES SDA Staff" section</li>
          <li>Click the + button to add each staff member working on SDA</li>
          <li>Set: Practice, Category (Buy-Back or New SDA), Name, Role, Allocation Type, Weekly allocation, and Start Date (if mid-month)</li>
          <li>The system calculates the maximum monthly claimable amount automatically</li>
        </ul>
        <CalloutBox type="blue">ℹ️ You only need to do this once per staff member. They persist across months.</CalloutBox>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Step 2: Create Monthly Claim & Upload Evidence</h4>
        <Badge variant="outline" className="mb-1 text-[10px]">Practice Manager</Badge>
        <ul className="text-muted-foreground list-disc list-inside space-y-0.5 mt-1">
          <li>Select your practice and the claim month</li>
          <li>Click "+ Create Claim" — the system pulls in all your active SDA staff</li>
          <li>Review each staff member's calculated amount</li>
          <li>Adjust the claimed amount <strong>down</strong> if their actual salary is below the cap (you can <strong>never</strong> claim above the maximum rate)</li>
          <li>Upload the required evidence (see "Evidence" tab)</li>
          <li>Confirm all role requirements (ground rules checklist)</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Step 3: Submit</h4>
        <Badge variant="outline" className="mb-1 text-[10px]">Practice Manager</Badge>
        <ul className="text-muted-foreground list-disc list-inside space-y-0.5 mt-1">
          <li>Tick the declaration checkbox confirming all staff are working 100% on Part A</li>
          <li>Check all mandatory evidence is uploaded</li>
          <li>Check all role requirements are acknowledged</li>
          <li>Click "Submit" — the claim moves to your Management Lead</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Step 4: Verification</h4>
        <Badge variant="outline" className="mb-1 text-[10px]">Management Lead</Badge>
        <ul className="text-muted-foreground list-disc list-inside space-y-0.5 mt-1">
          <li>Reviews the claim against clinical rotas</li>
          <li>Checks Part B evidence (for buy-back staff)</li>
          <li>If OK → can add further supporting documents if needed, then clicks "Verify & Forward to SNO Approver"</li>
          <li>If issues → clicks "Return" with notes (claim comes back to practice)</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Step 5: SNO Approver Review</h4>
        <Badge variant="outline" className="mb-1 text-[10px]">SNO Approver</Badge>
        <div className="space-y-1 mt-1">
          <CalloutBox type="green">✅ <strong>Approve</strong> — invoice is automatically generated. Claim moves to "Invoiced" status.</CalloutBox>
          <CalloutBox type="amber">❓ <strong>Query</strong> — Claim returns to editable status. This is <strong>not</strong> a rejection — it's a request for clarification.</CalloutBox>
          <CalloutBox type="red">❌ <strong>Reject</strong> — Claim is permanently closed. A new claim must be created from scratch.</CalloutBox>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Step 6: Payment</h4>
        <Badge variant="outline" className="mb-1 text-[10px]">PML Finance</Badge>
        <p className="text-muted-foreground">Once invoiced, PML processes payment within 30 days. The claim status updates to "Paid" when payment is confirmed.</p>
      </div>

      <div className="pt-2 border-t">
        <h4 className="font-semibold text-[#003087] mb-2">Category-Specific Workflow Notes</h4>
        <div className="space-y-2">
          <CalloutBox type="purple">
            <p className="font-semibold mb-1">👨‍⚕️ GP Locum claims</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Role is <strong>auto-locked</strong> to "GP Locum" — cannot be changed.</li>
              <li>Choose allocation type: <strong>Days</strong> or <strong>Sessions</strong>.</li>
              <li>Enter the <strong>total worked that month</strong> (system multiplies by £750/day or £375/session — 1 session = 4 hrs 10 mins).</li>
              <li>Upload the locum invoice/timesheet as evidence.</li>
            </ul>
          </CalloutBox>
          <CalloutBox type="sky">
            <p className="font-semibold mb-1">🗣️ Meeting Attendance claims</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Hours come <strong>automatically</strong> from the Meeting Schedule attendance log — you do not enter them manually.</li>
              <li>The system applies £100/hr for Practice Partner (GP) or £50/hr for Practice Manager per attended hour.</li>
              <li>Review the auto-populated lines, excluding travel time, then submit.</li>
            </ul>
          </CalloutBox>
          <CalloutBox type="slate">
            <p className="font-semibold mb-1">🧭 NRES Management claims</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Select the named role from the dropdown — the hourly rate auto-fills.</li>
              <li>Enter the <strong>hours per week</strong> worked.</li>
              <li>The system multiplies by working weeks in the month (bank holidays excluded).</li>
            </ul>
          </CalloutBox>
        </div>
      </div>
    </div>
  );
}

/* ── Tab 3: Evidence Required ────────────────────────────────────── */
function EvidenceTab() {
  const { config, loading } = useNRESEvidenceConfig();

  const buybackItems = config.filter(c => c.applies_to === 'all' || c.applies_to === 'buyback');
  const newSdaItems = config.filter(c => c.applies_to === 'all' || c.applies_to === 'new_sda');

  const renderList = (items: typeof config) => (
    <div className="space-y-1">
      {items.map(c => (
        <div key={c.id} className="flex items-start gap-2 text-sm">
          {c.is_mandatory
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            : <span className="w-4 h-4 rounded border border-muted-foreground/30 shrink-0 mt-0.5 flex items-center justify-center text-[10px] text-muted-foreground">○</span>}
          <div>
            <span className="font-medium">{c.label}</span>
            <span className="ml-1.5 text-muted-foreground">{c.is_mandatory ? '— REQUIRED' : '— OPTIONAL'}</span>
            {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading evidence config…</p>;

  // Legend cell
  const L = ({ v }: { v: 'R' | 'O' | '–' | '?' | '✓' }) => {
    const map: Record<string, string> = {
      R: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 font-bold',
      O: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-semibold',
      '–': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      '?': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 font-semibold',
      '✓': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 font-bold',
    };
    return <span className={`inline-block min-w-[26px] text-center px-1.5 py-0.5 rounded text-[11px] ${map[v]}`}>{v}</span>;
  };

  const invoiceRows: { item: string; gpl: any; nsd: any; bb: any; mgmt: any; meet: any }[] = [
    { item: 'Name (or unique identifier)', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Role', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'GL category (GP / ANP / non-clinical etc.)', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Date(s) worked', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Hours worked (e.g. 9am–6pm, 8.5 hrs)', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Sessions claimed', gpl: 'R', nsd: '–', bb: 'R', mgmt: '–', meet: '–' },
    { item: 'Rate being claimed', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Practice bank details', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Practice ODS code & invoice sequence (auto)', gpl: 'R', nsd: 'R', bb: 'R', mgmt: 'R', meet: 'R' },
    { item: 'Meeting title / purpose', gpl: '–', nsd: '–', bb: '–', mgmt: '–', meet: 'R' },
  ];

  const evidenceRows: { item: string; gpl: any; nsd: any; bb: any; mgmt: any; meet: any }[] = [
    { item: 'Signed timesheet / rota screenshot', gpl: 'R', nsd: 'R', bb: 'R', mgmt: '–', meet: '–' },
    { item: 'Locum invoice (locum to practice)', gpl: 'R', nsd: '–', bb: '–', mgmt: '–', meet: '–' },
    { item: 'GMC number', gpl: 'R', nsd: 'O', bb: '–', mgmt: '–', meet: '–' },
    { item: 'Indemnity confirmation', gpl: '?', nsd: '–', bb: '–', mgmt: '–', meet: '–' },
    { item: 'Contract of employment', gpl: '–', nsd: 'R', bb: '–', mgmt: '–', meet: '–' },
    { item: 'Job description', gpl: '–', nsd: 'R', bb: '–', mgmt: '–', meet: '–' },
    { item: 'Start date evidence (offer letter / payroll)', gpl: '–', nsd: 'R', bb: '–', mgmt: '–', meet: '–' },
    { item: 'Existing contract (redacted as needed)', gpl: '–', nsd: '–', bb: 'R', mgmt: '–', meet: '–' },
    { item: 'Pay slip extract (redaction policy applies)', gpl: '–', nsd: '–', bb: '?', mgmt: '–', meet: '–' },
    { item: 'Part B substantiation (rota / SDA slot evidence)', gpl: '–', nsd: '–', bb: 'R', mgmt: '–', meet: '–' },
    { item: 'Clinical system slot type screenshot (SDA slots)', gpl: 'R', nsd: 'R', bb: 'R', mgmt: '–', meet: '–' },
    { item: 'Meeting agenda / minutes / attendance list', gpl: '–', nsd: '–', bb: '–', mgmt: 'O', meet: 'R' },
    { item: 'NRES management activity log / hours summary', gpl: '–', nsd: '–', bb: '–', mgmt: 'R', meet: '–' },
  ];

  const MatrixTable = ({ rows, firstCol }: { rows: typeof invoiceRows; firstCol: string }) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            <th className="text-left p-2 font-semibold">{firstCol}</th>
            <th className="p-2 font-semibold text-center">GP Locum</th>
            <th className="p-2 font-semibold text-center">New SDA</th>
            <th className="p-2 font-semibold text-center">Buy-Back</th>
            <th className="p-2 font-semibold text-center">NRES Mgmt</th>
            <th className="p-2 font-semibold text-center">Meeting Att.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{r.item}</td>
              <td className="p-2 text-center"><L v={r.gpl} /></td>
              <td className="p-2 text-center"><L v={r.nsd} /></td>
              <td className="p-2 text-center"><L v={r.bb} /></td>
              <td className="p-2 text-center"><L v={r.mgmt} /></td>
              <td className="p-2 text-center"><L v={r.meet} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 text-sm">
      {/* SNO-approved evidence matrix */}
      <CalloutBox type="green">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold mb-0.5">✅ SNO-Approved Evidence Requirements (v1.0)</p>
            <p className="text-xs">Agreed with Andrew Moore (PML / SNO) — sign-off matrix governing every claim type. Download the source document below.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1 text-xs shrink-0">
            <a href="/documents/SDA_Claims_Evidence_Requirements_v1.0.docx" download>
              <Download className="w-3.5 h-3.5" /> Download Word doc
            </a>
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
          <span className="font-semibold mr-1">Legend:</span>
          <span className="flex items-center gap-1"><L v="R" /> Required</span>
          <span className="flex items-center gap-1"><L v="O" /> Optional</span>
          <span className="flex items-center gap-1"><L v="–" /> Not applicable</span>
          <span className="flex items-center gap-1"><L v="?" /> Decision pending</span>
        </div>
      </CalloutBox>

      <div>
        <h3 className="font-semibold text-[#003087] mb-1">Table 1 — Data items shown on the invoice</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Captured by the NRES Verifier role and rendered as line-level detail on the invoice PDF sent to PML finance (SAGE Intact ready).
        </p>
        <MatrixTable rows={invoiceRows} firstCol="Data item on invoice" />
      </div>

      <div>
        <h3 className="font-semibold text-[#003087] mb-1">Table 2 — Supporting evidence uploaded to Notewell</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Audit trail attached to each claim. Visible to the SNO during approval and forwarded with the invoice email to PML finance for archive.
        </p>
        <MatrixTable rows={evidenceRows} firstCol="Supporting evidence in Notewell" />
      </div>

      <CalloutBox type="amber">
        <p className="font-semibold mb-1">📝 Open items pending SNO confirmation</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>Q1 — Indemnity confirmation:</strong> standard for all GP locum claims, or only off-agency?</li>
          <li><strong>Q2 — Buy-Back pay slip:</strong> required in addition to existing contract, or contract sufficient?</li>
          <li><strong>Q3 — Redaction policy:</strong> NI number, home address and bank details may be redacted; name/identifier retained.</li>
          <li><strong>Q4 — Buy-Back Part B:</strong> rota screenshot sufficient, or written narrative also required?</li>
          <li><strong>Q5 — NRES Management:</strong> monthly hours summary vs activity-level detail.</li>
          <li><strong>Q6 — Meeting Attendance:</strong> date + title + duration vs full minutes/attendance list.</li>
          <li><strong>Q7 — Other claim types:</strong> any further categories (training backfill, project work) to configure now.</li>
        </ul>
      </CalloutBox>

      <div className="pt-2 border-t">
        <h3 className="font-semibold text-[#003087] mb-1">Live evidence configuration</h3>
        <p className="text-muted-foreground text-xs mb-2">As configured in the system today (programme admin can update):</p>
      </div>

      <CalloutBox type="blue">
        <p className="font-semibold mb-2">🔄 Buy-Back Staff — Evidence Checklist</p>
        {renderList(buybackItems)}
        <div className="mt-2">
          <CalloutBox type="amber">
            <p className="font-semibold">⚠️ Why Part B Evidence?</p>
            <p>Buy-back means the practice is releasing existing staff from their normal LTC work. The programme needs proof the practice has backfilled this LTC work. Payments will <strong>not</strong> be released until Part B is evidenced.</p>
          </CalloutBox>
        </div>
      </CalloutBox>

      <CalloutBox type="green">
        <p className="font-semibold mb-2">✨ New SDA Staff — Evidence Checklist</p>
        {renderList(newSdaItems)}
        <p className="mt-2 text-xs">✅ No Part B evidence needed — new SDA staff are additional capacity.</p>
      </CalloutBox>

      <CalloutBox type="purple">
        <p className="font-semibold mb-1">👨‍⚕️ GP Locum — Evidence Checklist</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>Locum invoice or timesheet (REQUIRED)</strong> — must show name, dates, sessions/days worked.</li>
          <li>Session/day breakdown matching the claimed amount.</li>
          <li>No Part B evidence required.</li>
        </ul>
      </CalloutBox>

      <CalloutBox type="sky">
        <p className="font-semibold mb-1">🗣️ Meeting Attendance — Evidence Checklist</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>Meeting agenda (uploaded with the meeting record).</li>
          <li>Attendance log — <strong>auto-captured</strong> from the Meeting Schedule.</li>
          <li>Travel time does not count towards claimable attended hours.</li>
          <li>No Part B evidence required.</li>
        </ul>
      </CalloutBox>

      <CalloutBox type="slate">
        <p className="font-semibold mb-1">🧭 NRES Management — Evidence Checklist</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>Timesheet of hours worked per week.</li>
          <li>Brief activity summary for the month.</li>
          <li>No Part B evidence required.</li>
        </ul>
      </CalloutBox>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Upload Tips</h4>
        <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
          <li>Drag and drop files directly onto the upload area</li>
          <li>Paste screenshots with Ctrl+V</li>
          <li>Multiple files can be uploaded at once</li>
          <li>Accepted formats: PDF, PNG, JPG, DOCX, XLSX</li>
          <li>Redacting payslips: black out personal details but keep name, role, salary, and dates visible</li>
        </ul>
      </div>
    </div>
  );
}

/* ── Tab 4: Rates & Caps ────────────────────────────────────────── */
function RatesTab({ rateSettings, onCostMultiplier }: { rateSettings: RateSettings; onCostMultiplier: number }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-[#003087] mb-2">Maximum Reclaimable Rates</h3>
        <p className="text-xs text-muted-foreground mb-2">Rates are set by the Programme Board and reviewed periodically. Current maximum rates:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Role</th>
                <th className="text-right p-2 font-medium">Base Annual Rate</th>
                <th className="text-right p-2 font-medium">Base Hourly Rate</th>
                <th className="text-right p-2 font-medium">
                  <div className="flex items-center justify-end gap-1">
                    Hourly (incl. On-Costs)
                    <InfoTooltip content={`Base hourly rate × ${onCostMultiplier.toFixed(4)} (1 + ${rateSettings.on_costs_pct.toFixed(2)}% on-costs)`} />
                  </div>
                </th>
                <th className="text-right p-2 font-medium">NI ({rateSettings.employer_ni_pct}%)</th>
                <th className="text-right p-2 font-medium">Pension ({rateSettings.employer_pension_pct}%)</th>
                <th className="text-right p-2 font-medium">Total Annual</th>
                <th className="text-right p-2 font-medium">Max Monthly</th>
              </tr>
            </thead>
            <tbody>
              {rateSettings.roles_config
                .filter(r => r.key !== 'gp_locum' && r.label.toLowerCase() !== 'gp locum')
                .map(role => {
                const niAmt = role.annual_rate * (rateSettings.employer_ni_pct / 100);
                const penAmt = role.annual_rate * (rateSettings.employer_pension_pct / 100);
                const totalAnnual = role.annual_rate + niAmt + penAmt;
                const fullTimeAnnual = role.allocation_default === 'sessions' ? role.annual_rate * 9 : role.annual_rate;
                const hourlyRate = fullTimeAnnual / (37.5 * 52);
                const maxAlloc = role.allocation_default === 'sessions' ? 9 : role.allocation_default === 'hours' ? 37.5 : 1;
                const maxMonthly = role.allocation_default === 'sessions'
                  ? (maxAlloc * totalAnnual) / 12
                  : role.allocation_default === 'hours'
                  ? ((maxAlloc / 37.5) * totalAnnual) / 12
                  : (maxAlloc * totalAnnual) / 12;
                return (
                  <tr key={role.key} className="border-t">
                    <td className="p-2 font-medium">{role.label}</td>
                    <td className="p-2 text-right">{fmtGBP(role.annual_rate)}</td>
                    <td className="p-2 text-right">{fmtGBP(hourlyRate)}/hr</td>
                    <td className="p-2 text-right font-medium">{fmtGBP(hourlyRate * onCostMultiplier)}/hr</td>
                    <td className="p-2 text-right">{fmtGBP(niAmt)}</td>
                    <td className="p-2 text-right">{fmtGBP(penAmt)}</td>
                    <td className="p-2 text-right font-medium">{fmtGBP(totalAnnual)}</td>
                    <td className="p-2 text-right font-semibold text-primary">{fmtGBP(maxMonthly)}/mo</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          On-costs: Employer NI ({rateSettings.employer_ni_pct}%) + Employer Pension ({rateSettings.employer_pension_pct}%) = {rateSettings.on_costs_pct.toFixed(2)}% total.
        </p>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">How Rates Work</h4>
        <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
          <li>The <strong>maximum</strong> rate is what can be claimed — you may claim <strong>less</strong> if the staff member's actual salary is below the cap</li>
          <li>You can <strong>never</strong> claim more than the maximum — the system enforces this automatically</li>
          <li>On-costs (NI + Pension) are added automatically — you do not calculate these</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-[#003087] mb-1">Allocation Types</h4>
        <ul className="text-muted-foreground space-y-1">
          <li><strong>Sessions</strong> — for GPs. 1 session = a half-day (4 hrs 10 mins). Monthly = sessions × annual rate × on-costs ÷ 12</li>
          <li><strong>Hours per week</strong> — for ANPs, ACPs, nurses. Monthly = (hours ÷ 37.5) × annual rate × on-costs ÷ 12</li>
          <li><strong>WTE</strong> — direct proportion. Monthly = WTE × annual rate × on-costs ÷ 12</li>
        </ul>
      </div>

      <CalloutBox type="blue">
        <p className="font-semibold mb-1">ℹ️ Pro-Rata</p>
        <p>If a staff member starts mid-month, set their Start Date. The system automatically calculates a pro-rata amount based on working days from the start date to the end of the month.</p>
        <p className="mt-1 text-xs">Example: Staff member starts 15th April in a 30-day month → 16 working days out of 30 = 53.3% of the full monthly amount.</p>
      </CalloutBox>

      {/* GP Locum rates */}
      <div className="pt-2 border-t">
        <h3 className="font-semibold text-[#003087] mb-2">👨‍⚕️ GP Locum Rates</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Allocation</th>
                <th className="text-right p-2 font-medium">Fixed Rate</th>
                <th className="text-right p-2 font-medium">On-Costs</th>
                <th className="text-right p-2 font-medium">Max / Month</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-medium">Day</td>
                <td className="p-2 text-right font-semibold text-primary">{fmtGBP(750)}/day</td>
                <td className="p-2 text-right text-muted-foreground">None</td>
                <td className="p-2 text-right">23 days</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-medium">Session (4 hrs 10 mins / half-day)</td>
                <td className="p-2 text-right font-semibold text-primary">{fmtGBP(375)}/session</td>
                <td className="p-2 text-right text-muted-foreground">None</td>
                <td className="p-2 text-right">46 sessions</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Locums invoice gross — no employer NI or pension is added. The daily/session rate is a <strong>cap</strong>: claim less if the invoice is lower.</p>
      </div>

      {/* Meeting Attendance rates */}
      <div className="pt-2 border-t">
        <h3 className="font-semibold text-[#003087] mb-2">🗣️ Meeting Attendance Rates</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Role</th>
                <th className="text-right p-2 font-medium">Hourly Rate</th>
                <th className="text-right p-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-medium">Practice Partner (GP)</td>
                <td className="p-2 text-right font-semibold text-primary">{fmtGBP(rateSettings.meeting_gp_rate)}/hr</td>
                <td className="p-2 text-right text-muted-foreground">Auto from Meeting Schedule</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-medium">Practice Manager</td>
                <td className="p-2 text-right font-semibold text-primary">{fmtGBP(rateSettings.meeting_pm_rate)}/hr</td>
                <td className="p-2 text-right text-muted-foreground">Auto from Meeting Schedule</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Hours are pulled automatically from the Meeting Schedule attendance log. Travel time does not count.</p>
      </div>

      {/* NRES Management rates */}
      <div className="pt-2 border-t">
        <h3 className="font-semibold text-[#003087] mb-2">🧭 NRES Management Rates</h3>
        {rateSettings.management_roles_config && rateSettings.management_roles_config.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Role</th>
                  <th className="text-left p-2 font-medium">Person</th>
                  <th className="text-right p-2 font-medium">Hourly Rate</th>
                  <th className="text-right p-2 font-medium">Max Hours/Week</th>
                </tr>
              </thead>
              <tbody>
                {rateSettings.management_roles_config.filter(r => r.is_active).map(r => (
                  <tr key={r.key} className="border-t">
                    <td className="p-2 font-medium">{r.label}</td>
                    <td className="p-2 text-muted-foreground">{r.person_name || '—'}</td>
                    <td className="p-2 text-right font-semibold text-primary">{fmtGBP(r.hourly_rate)}/hr</td>
                    <td className="p-2 text-right">{r.max_hours_per_week} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No management roles configured yet.</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">Monthly value = hourly rate × hours/week × working weeks in the month (bank holidays excluded).</p>
      </div>
    </div>
  );
}

/* ── Tab 5: Claim Rules ─────────────────────────────────────────── */
function ClaimRulesTab() {
  return (
    <div className="space-y-4 text-sm">
      <CalloutBox type="red">
        <p className="font-semibold">🚫 The Golden Rule</p>
        <p>Staff must work <strong>exclusively</strong> on SDA (Part A) during funded hours. No LTC (Part B) activity during buy-back time. Ever.</p>
      </CalloutBox>

      <CalloutBox type="green">
        <p className="font-semibold mb-1">✅ Must Do</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Submit claims within 30 calendar days of the end of the claim month</li>
          <li>Upload all mandatory evidence before submitting</li>
          <li>Confirm the declaration checkbox before submitting</li>
          <li>Ensure all role-specific requirements are acknowledged</li>
          <li>Report any changes to staff allocation promptly</li>
          <li>Notify your Management Lead of any staffing changes</li>
        </ul>
      </CalloutBox>

      <CalloutBox type="red">
        <p className="font-semibold mb-1">🚫 Must Not</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Claim above the maximum reclaimable rate for any role</li>
          <li>Submit a claim without Part B evidence (buy-back staff only)</li>
          <li>Include LTC activity in SDA-funded hours</li>
          <li>Claim for staff who have not started working</li>
          <li>Submit duplicate claims for the same staff member in the same month</li>
        </ul>
      </CalloutBox>

      <CalloutBox type="amber">
        <p className="font-semibold mb-1">⚠️ What Happens If…</p>
        <ul className="space-y-1">
          <li><strong>You miss the 30-day window</strong> → Your Management Lead will contact you. The Programme Board may grant an extension, reallocate funds, or hold them in reserve.</li>
          <li><strong>Your claim is queried</strong> → You'll see the query notes on your claim. Fix the issue and resubmit. This is not a rejection.</li>
          <li><strong>Your claim is rejected</strong> → Permanently closed. Create a new claim. Contact your Management Lead.</li>
          <li><strong>A staff member leaves mid-month</strong> → Adjust their allocation for that month. Add a note explaining.</li>
          <li><strong>A staff member's role changes</strong> → Update their record in SDA Staff. The change applies to future claims.</li>
        </ul>
      </CalloutBox>

      <CalloutBox type="blue">
        <p className="font-semibold mb-1">📋 Role-Specific Requirements</p>
        <p>Each role has specific ground rules that must be acknowledged before submitting a claim. These appear as a checklist on each staff line in your claim. You must tick every required rule.</p>
      </CalloutBox>

      <CalloutBox type="purple">
        <p className="font-semibold mb-1">👨‍⚕️ GP Locum & 🗣️ Meeting Attendance — Special Rules</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>No Part B evidence required</strong> — these are additional/sessional, not buy-back.</li>
          <li>The locum daily/session rate (£750/day or £375/session — half-day, 4 hrs 10 mins) is a <strong>cap</strong> — claim less if the invoice is lower.</li>
          <li>Meeting hours are auto-captured — they cannot be edited manually on the claim, and travel time does not count.</li>
        </ul>
      </CalloutBox>

      <CalloutBox type="slate">
        <p className="font-semibold mb-1">🧭 NRES Management — Special Rules</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>Working weeks per month <strong>auto-exclude bank holidays</strong>.</li>
          <li>Hours per week must not exceed the configured maximum for the role.</li>
          <li>Each role is tied to a named person — you cannot reassign without admin.</li>
        </ul>
      </CalloutBox>
    </div>
  );
}

/* ── Tab 6: Status Guide ────────────────────────────────────────── */
function StatusGuideTab() {
  const statuses = [
    { icon: '⚪', label: 'Draft', colour: 'bg-slate-100 text-slate-700', desc: 'Claim created, not yet submitted. You can edit everything.', who: 'Practice' },
    { icon: '🔵', label: 'Submitted', colour: 'bg-blue-100 text-blue-700', desc: 'Submitted for verification. Waiting for your Management Lead to review.', who: 'Management Lead' },
    { icon: '🟡', label: 'Verified', colour: 'bg-yellow-100 text-yellow-700', desc: 'Management Lead has verified. Waiting for SNO Approver review.', who: 'SNO Approver' },
    { icon: '🟢', label: 'Approved', colour: 'bg-emerald-100 text-emerald-700', desc: 'Approved by the SNO Approver. Invoice generated automatically.', who: 'PML Finance (payment)' },
    { icon: '🟠', label: 'Queried', colour: 'bg-orange-100 text-orange-700', desc: 'The SNO Approver has a question. Read the query notes, amend and resubmit. This is NOT a rejection.', who: 'Practice / Mgmt Lead' },
    { icon: '🔷', label: 'Invoiced', colour: 'bg-indigo-100 text-indigo-700', desc: 'Invoice generated and sent to PML. Awaiting payment processing.', who: 'PML Finance' },
    { icon: '✅', label: 'Paid', colour: 'bg-green-100 text-green-700', desc: 'Payment processed. Complete.', who: 'Nobody — done!' },
    { icon: '🔴', label: 'Rejected', colour: 'bg-red-100 text-red-700', desc: 'Permanently rejected. Cannot be reopened. Create a new claim.', who: 'Practice (new claim)' },
  ];

  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold text-[#003087]">Claim Status Reference</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2.5 font-medium">Status</th>
              <th className="text-left p-2.5 font-medium">What It Means</th>
              <th className="text-left p-2.5 font-medium">Who Acts Next</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map(s => (
              <tr key={s.label} className="border-t">
                <td className="p-2.5">
                  <Badge className={`${s.colour} text-[10px]`}>{s.icon} {s.label}</Badge>
                </td>
                <td className="p-2.5 text-muted-foreground">{s.desc}</td>
                <td className="p-2.5 font-medium">{s.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CalloutBox type="blue">
        <p className="text-xs">
          <strong>Normal flow:</strong> Draft → Submitted → Verified by Management → Approved by SNO Approver → Invoiced → Paid<br />
          <strong>Query flow:</strong> … → Verified → Queried → (edit) → Submitted → Verified → …<br />
          <strong>Reject flow:</strong> … → Rejected (CLOSED — start new claim)
        </p>
      </CalloutBox>
    </div>
  );
}

/* ── Tab 7: FAQ ──────────────────────────────────────────────────── */
function FAQTab() {
  const faqs: { q: string; a: string }[] = [
    { q: 'Can I edit a claim after submitting?', a: 'No. Once submitted, only your Management Lead can return it to you for changes. If PML queries it, it comes back as editable.' },
    { q: "Why can't I claim above the maximum rate?", a: 'The maximum rates are set by the Programme Board in line with NHS pay scales. The system enforces these caps automatically. If your staff member earns less than the cap, claim their actual cost.' },
    { q: 'What if my staff member works different hours each month?', a: "You can adjust the sessions/hours on each claim to reflect actual hours worked that month. The staff record sets the default, but you can change it per claim." },
    { q: 'Do I need to upload evidence every month?', a: "Yes. Evidence is per claim, per month, per staff member. Each month needs fresh rota evidence showing that month's activity." },
    { q: 'What counts as acceptable rota evidence?', a: 'A screenshot or export from your clinical system (SystmOne, EMIS) showing the staff member\'s name, dates, session types, and that the sessions are coded as SDA.' },
    { q: 'What if a staff member started mid-month?', a: 'Set their Start Date on the claim. The system automatically pro-rates the amount based on working days.' },
    { q: 'Can I claim for a staff member who was on annual leave?', a: "Yes — annual leave is part of their contracted time. You don't need to deduct leave days. Claim the normal allocation." },
    { q: 'Can I claim for a staff member who was off sick?', a: 'Short-term sickness (a few days) — claim the normal amount. Extended sickness — adjust the allocation to reflect actual sessions worked and add a note explaining.' },
    { q: "What's the difference between Buy-Back and New SDA?", a: "Buy-Back = existing staff released from normal work for SDA. You must prove their normal work (Part B/LTC) is being covered. New SDA = newly recruited staff — additional capacity, so no Part B evidence needed." },
    { q: 'Who do I contact if I need help?', a: 'Your NRES Management Lead: Malcolm Railson (malcolm.railson@nhs.net), Amanda Palin (amanda.palin2@nhs.net), or Lucy Hibberd.' },
    { q: 'What is the 30-day claim window?', a: 'You have 30 calendar days from the end of the claim month to submit. For example, an April claim must be submitted by 30th May. If you miss the deadline, contact your Management Lead.' },
    { q: 'How do GP Locum claims differ from Buy-Back?', a: 'GP Locum is external sessional cover billed at fixed rates — £750/day or £375/session (1 session = a half-day, 4 hrs 10 mins) — with no on-costs added. The session/day rate is a cap; claim less if the invoice is lower. Buy-Back is for existing practice staff released from their normal duties — that requires Part B (LTC) evidence; locum claims do not.' },
    { q: 'How is Meeting Attendance calculated?', a: 'Hours are pulled automatically from the Meeting Schedule attendance log. Each attended hour is multiplied by £100 for Practice Partner (GP) or £50 for Practice Manager. Travel time does not count. You do not enter hours manually — the system creates the lines for you.' },
    { q: "Why don't Meeting/Locum claims need Part B evidence?", a: 'Both are additional/sessional time, not buy-back of existing staff. Nothing is being released from normal LTC work, so there is no Part B backfill to evidence.' },
    { q: 'How are NRES Management working weeks calculated?', a: 'The system counts weekdays (Mon–Fri) in the claim month and subtracts any bank holidays that fall on a weekday. Working weeks = working days ÷ 5. Your monthly value = hourly rate × hours/week × working weeks.' },
    { q: 'Can one staff member appear in multiple categories?', a: 'Yes — for example, a GP can be Buy-Back staff (for SDA sessions) AND claim Meeting Attendance for governance meetings they attend. Each category is recorded as a separate line with its own evidence and rate.' },
  ];

  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-semibold text-[#003087]">Frequently Asked Questions</h3>
      {faqs.map((f, i) => (
        <div key={i} className="border rounded-lg p-3">
          <p className="font-semibold text-[#003087] mb-1">Q: {f.q}</p>
          <p className="text-muted-foreground">{f.a}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export function ClaimsUserGuide({ neighbourhoodName, rateSettings, onCostMultiplier, isENN }: ClaimsUserGuideProps) {
  const [open, setOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-teal-200 dark:border-teal-800 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-teal-50/50 dark:hover:bg-teal-900/30 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#003087] dark:text-blue-300">📘 How the Staff Claims Scheme Works</h2>
                <p className="text-sm text-muted-foreground">Complete guide — all 5 claim categories, evidence, rates, claim steps, approvals & FAQ</p>
              </div>
            </div>
            <div className="text-slate-500">
              {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-5 border-t border-teal-100 dark:border-teal-800 pt-4">
            <Tabs defaultValue="overview" className="w-full">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="how-to-claim" className="text-xs">How to Claim</TabsTrigger>
                  <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>
                  <TabsTrigger value="rates" className="text-xs">Rates & Caps</TabsTrigger>
                  <TabsTrigger value="rules" className="text-xs">Claim Rules</TabsTrigger>
                  <TabsTrigger value="status" className="text-xs">Status Guide</TabsTrigger>
                  <TabsTrigger value="faq" className="text-xs">FAQ</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handlePrint} className="text-xs gap-1">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </Button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <TabsContent value="overview"><OverviewTab neighbourhoodName={neighbourhoodName} /></TabsContent>
                <TabsContent value="how-to-claim"><HowToClaimTab /></TabsContent>
                <TabsContent value="evidence"><EvidenceTab /></TabsContent>
                <TabsContent value="rates"><RatesTab rateSettings={rateSettings} onCostMultiplier={onCostMultiplier} /></TabsContent>
                <TabsContent value="rules"><ClaimRulesTab /></TabsContent>
                <TabsContent value="status"><StatusGuideTab /></TabsContent>
                <TabsContent value="faq"><FAQTab /></TabsContent>
              </div>
            </Tabs>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
