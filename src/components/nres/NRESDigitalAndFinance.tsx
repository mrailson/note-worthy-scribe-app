import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SDADigitalIntegration } from '@/components/sda/SDADigitalIntegration';
import { SDAFinanceGovernance } from '@/components/sda/SDAFinanceGovernance';
import { SDARisksMitigation } from '@/components/sda/SDARisksMitigation';
import { SDAEvidenceLibrary } from '@/components/sda/SDAEvidenceLibrary';
import { SDAWorkforceInnovation } from '@/components/sda/SDAWorkforceInnovation';
import { HoursSettings } from '@/components/nres/hours-tracker/HoursSettings';
import { HoursEntryForm } from '@/components/nres/hours-tracker/HoursEntryForm';
import { HoursEntriesTable } from '@/components/nres/hours-tracker/HoursEntriesTable';
import { ExpenseEntryForm } from '@/components/nres/hours-tracker/ExpenseEntryForm';
import { ExpensesTable } from '@/components/nres/hours-tracker/ExpensesTable';
import { TrackerSummary } from '@/components/nres/hours-tracker/TrackerSummary';
import { TrackerReportModal } from '@/components/nres/hours-tracker/TrackerReportModal';
import { AdminClaimsReport } from '@/components/nres/hours-tracker/AdminClaimsReport';
import { ClaimantsManager } from '@/components/nres/hours-tracker/ClaimantsManager';
import { useAuth } from '@/contexts/AuthContext';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { useNRESUserSettings } from '@/hooks/useNRESUserSettings';
import { useNRESHoursTracker } from '@/hooks/useNRESHoursTracker';
import { useNRESExpenses } from '@/hooks/useNRESExpenses';
import { useNRESClaimants } from '@/hooks/useNRESClaimants';
import { Monitor, PoundSterling, Clock, AlertTriangle, FolderOpen, Users, Receipt, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface NRESDigitalAndFinanceProps {
  hideEvidenceLibrary?: boolean;
  hideBoardLeadership?: boolean;
  customInsuranceChecklist?: Array<{ practice: string; insurances: Array<{ confirmed: boolean; amount: string; type: string }> }>;
  customInsuranceCheckedBy?: string;
  customInsuranceUpdatedDate?: string;
  neighbourhoodName?: 'NRES' | 'ENN';
  interactiveInsurance?: boolean;
}

export function NRESDigitalAndFinance({
  hideEvidenceLibrary = false,
  hideBoardLeadership = false,
  customInsuranceChecklist,
  customInsuranceCheckedBy,
  customInsuranceUpdatedDate,
  neighbourhoodName = 'NRES',
  interactiveInsurance = false,
}: NRESDigitalAndFinanceProps) {
  const { user } = useAuth();
  const isAdmin = !!user?.email && NRES_ADMIN_EMAILS.includes(user.email.toLowerCase());

  const [subTab, setSubTab] = useState('digital');
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [claimantsOpen, setClaimantsOpen] = useState(false);

  const {
    hourlyRate,
    hasRateSet,
    saving: savingSettings,
    saveHourlyRate,
  } = useNRESUserSettings();

  const {
    entries,
    loading: loadingEntries,
    saving: savingEntry,
    addEntry,
    updateEntry,
    
  } = useNRESHoursTracker();

  const {
    expenses,
    loading: loadingExpenses,
    saving: savingExpense,
    addExpense,
    deleteExpense,
    totalExpenses,
  } = useNRESExpenses();

  const {
    practiceFilteredClaimants,
    practiceId: userPracticeId,
  } = useNRESClaimants();

  const practiceClaimantNames = useMemo(
    () => new Set(practiceFilteredClaimants.map(c => c.name)),
    [practiceFilteredClaimants],
  );

  const filteredEntries = useMemo(() => {
    if (isAdmin) return entries;
    return entries.filter(e => {
      const isOwnEntry = e.user_id === user?.id;
      const isPracticeClaimantEntry = !!e.claimant_name && practiceClaimantNames.has(e.claimant_name);
      const isSamePracticeEntry = !!userPracticeId && e.practice_id === userPracticeId;
      return isOwnEntry || isPracticeClaimantEntry || isSamePracticeEntry;
    });
  }, [entries, isAdmin, practiceClaimantNames, user?.id, userPracticeId]);

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
      <TabsList className="mb-4 flex-wrap h-auto gap-1">
        <TabsTrigger value="digital" className="flex items-center gap-2">
          <Monitor className="w-4 h-4" />
          Digital Integration
        </TabsTrigger>
        <TabsTrigger value="finance-governance" className="flex items-center gap-2">
          <PoundSterling className="w-4 h-4" />
          Finance &amp; Governance
        </TabsTrigger>
        {neighbourhoodName !== 'ENN' && (
          <TabsTrigger value="time-expenses" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pre Go-Live Time &amp; Expenses
          </TabsTrigger>
        )}
        <TabsTrigger value="risks" className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Risks &amp; Mitigation
        </TabsTrigger>
        {!hideEvidenceLibrary && (
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Evidence Library
          </TabsTrigger>
        )}
        <TabsTrigger value="workforce" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Workforce
        </TabsTrigger>
      </TabsList>

      {/* Digital Integration */}
      <TabsContent value="digital">
        <SDADigitalIntegration />
      </TabsContent>

      {/* Finance & Governance */}
      <TabsContent value="finance-governance">
        <SDAFinanceGovernance
          hideBoardLeadership={hideBoardLeadership}
          customInsuranceChecklist={customInsuranceChecklist}
          customInsuranceCheckedBy={customInsuranceCheckedBy}
          customInsuranceUpdatedDate={customInsuranceUpdatedDate}
          neighbourhoodName={neighbourhoodName}
          interactiveInsurance={interactiveInsurance}
        />
      </TabsContent>

      {/* Pre Go-Live Time & Expenses */}
      <TabsContent value="time-expenses" className="space-y-6">
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-foreground space-y-2">
            <p className="font-semibold">Pre Go-Live Time Reclaim</p>
            <p>
              This facility is for reclaiming time spent by Practice Managers, Member Practice GPs, and {neighbourhoodName === 'ENN' ? '3Sixty' : 'PCN'} Support staff involved in preparing the {neighbourhoodName} neighbourhood project before go-live. The maximum budget for this programme is <strong>£30,000</strong>. Hours are claimed at agreed rates:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong>Attending GP</strong> ({neighbourhoodName} business): £100 per hour</li>
              <li><strong>Practice Manager / {neighbourhoodName === 'ENN' ? '3Sixty' : 'PCN'} Support</strong>: £50 per hour</li>
            </ul>
          </div>
        </div>

        <TrackerSummary
          totalHours={filteredEntries.reduce((sum, e) => sum + Number(e.duration_hours), 0)}
          totalExpenses={totalExpenses}
          hourlyRate={hourlyRate}
          entries={filteredEntries}
        />

        <div className="flex flex-wrap gap-4 items-start justify-between">
          <HoursSettings
            hourlyRate={hourlyRate}
            hasRateSet={hasRateSet}
            saving={savingSettings}
            onSaveRate={saveHourlyRate}
          />
          <TrackerReportModal
            entries={filteredEntries}
            expenses={expenses}
            hourlyRate={hourlyRate}
          />
        </div>

        <Separator />

        <Collapsible open={claimantsOpen} onOpenChange={setClaimantsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            {claimantsOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Manage Claimants</h3>
            <span className="text-sm text-muted-foreground">({practiceFilteredClaimants.length} active)</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <ClaimantsManager />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Time Tracking</h3>
          <HoursEntryForm
            saving={savingEntry}
            claimants={practiceFilteredClaimants}
            onSubmit={addEntry}
          />
          <HoursEntriesTable
            entries={filteredEntries}
            hourlyRate={hourlyRate}
            loading={loadingEntries}
            claimants={practiceFilteredClaimants}
            onUpdate={updateEntry}
          />
        </div>

        <Separator />

        <Collapsible open={expensesOpen} onOpenChange={setExpensesOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            {expensesOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <Receipt className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold">Expenses</h3>
            <span className="text-sm text-muted-foreground">({expenses.length} items)</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <ExpenseEntryForm saving={savingExpense} onSubmit={addExpense} />
            <ExpensesTable expenses={expenses} loading={loadingExpenses} onDelete={deleteExpense} />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <AdminClaimsReport />
      </TabsContent>

      {/* Risks & Mitigation */}
      <TabsContent value="risks">
        <SDARisksMitigation neighbourhoodName={neighbourhoodName} />
      </TabsContent>

      {/* Evidence Library */}
      {!hideEvidenceLibrary && (
        <TabsContent value="evidence">
          <SDAEvidenceLibrary />
        </TabsContent>
      )}

      {/* Workforce */}
      <TabsContent value="workforce">
        <SDAWorkforceInnovation />
      </TabsContent>
    </Tabs>
  );
}
