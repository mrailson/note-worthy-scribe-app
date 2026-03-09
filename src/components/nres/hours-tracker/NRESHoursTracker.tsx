import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HoursSettings } from './HoursSettings';
import { HoursEntryForm } from './HoursEntryForm';
import { HoursEntriesTable } from './HoursEntriesTable';
import { ExpenseEntryForm } from './ExpenseEntryForm';
import { ExpensesTable } from './ExpensesTable';
import { TrackerSummary } from './TrackerSummary';
import { TrackerReportModal } from './TrackerReportModal';
import { AdminClaimsReport } from './AdminClaimsReport';
import { ClaimantsManager } from './ClaimantsManager';
import { BuyBackClaimsTab } from './BuyBackClaimsTab';
import { BuyBackAccessSettingsModal } from './BuyBackAccessSettingsModal';
import { SDAFinanceGovernance } from '@/components/sda/SDAFinanceGovernance';
import { SDARisksMitigation } from '@/components/sda/SDARisksMitigation';
import { SDAEvidenceLibrary } from '@/components/sda/SDAEvidenceLibrary';
import { useNRESUserSettings } from '@/hooks/useNRESUserSettings';
import { useNRESHoursTracker } from '@/hooks/useNRESHoursTracker';
import { useNRESExpenses } from '@/hooks/useNRESExpenses';
import { useNRESClaimants } from '@/hooks/useNRESClaimants';
import { useNRESBuyBackAccess } from '@/hooks/useNRESBuyBackAccess';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ChevronDown, ChevronRight, Receipt, Users, Clock, ArrowLeftRight, PoundSterling, AlertTriangle, Settings, FolderOpen, Info } from 'lucide-react';

export function NRESHoursTracker() {
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [claimantsOpen, setClaimantsOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('time-expenses');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { 
    hourlyRate, 
    hasRateSet, 
    saving: savingSettings, 
    loading: loadingSettings,
    saveHourlyRate 
  } = useNRESUserSettings();

  const { admin, hasAccess, grantAccess, revokeByKey } = useNRESBuyBackAccess();

  const {
    entries,
    loading: loadingEntries,
    saving: savingEntry,
    addEntry,
    updateEntry,
    totalHours
  } = useNRESHoursTracker();

  const {
    expenses,
    loading: loadingExpenses,
    saving: savingExpense,
    addExpense,
    deleteExpense,
    totalExpenses
  } = useNRESExpenses();

  const {
    activeClaimants,
    practiceFilteredClaimants,
    loading: loadingClaimants
  } = useNRESClaimants();

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="flex items-center gap-2">
        <TabsList>
          <TabsTrigger value="time-expenses" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pre Go-Live Time & Expenses
          </TabsTrigger>
          <TabsTrigger value="buy-back" className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            SDA Resource &amp; Buy-Back Claims
          </TabsTrigger>
          <TabsTrigger value="finance-governance" className="flex items-center gap-2">
            <PoundSterling className="w-4 h-4" />
            Finance & Governance
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Risks & Mitigation
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Evidence Library
          </TabsTrigger>
        </TabsList>
        {activeTab === 'buy-back' && admin && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setSettingsOpen(true)}>
                  <Settings className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Access Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <TabsContent value="time-expenses" className="space-y-6">
        {/* Explainer Banner */}
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-foreground space-y-2">
            <p className="font-semibold">Pre Go-Live Time Reclaim</p>
            <p>
              This facility is for reclaiming time spent by Practice Managers, Member Practice GPs, and PCN Support staff involved in preparing the NRES neighbourhood project before go-live. The maximum budget for this programme is <strong>£30,000</strong>. Hours are claimed at agreed rates:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong>Attending GP</strong> (NRES business): £100 per hour</li>
              <li><strong>Practice Manager / PCN Support</strong>: £50 per hour</li>
            </ul>
          </div>
        </div>

        {/* Summary Cards */}
        <TrackerSummary
          totalHours={totalHours}
          totalExpenses={totalExpenses}
          hourlyRate={hourlyRate}
        />

        {/* Settings & Report */}
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <HoursSettings
            hourlyRate={hourlyRate}
            hasRateSet={hasRateSet}
            saving={savingSettings}
            onSaveRate={saveHourlyRate}
          />
          <TrackerReportModal
            entries={entries}
            expenses={expenses}
            hourlyRate={hourlyRate}
          />
        </div>

        <Separator />

        {/* Claimants Management Section */}
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

        {/* Time Tracking Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Time Tracking</h3>
          <HoursEntryForm 
            saving={savingEntry}
            claimants={practiceFilteredClaimants}
            onSubmit={addEntry}
          />
          <HoursEntriesTable
            entries={entries}
            hourlyRate={hourlyRate}
            loading={loadingEntries}
            claimants={practiceFilteredClaimants}
            onUpdate={updateEntry}
          />
        </div>

        <Separator />

        {/* Expenses Section */}
        <Collapsible open={expensesOpen} onOpenChange={setExpensesOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            {expensesOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <Receipt className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold">Expenses</h3>
            <span className="text-sm text-muted-foreground">({expenses.length} items)</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <ExpenseEntryForm
              saving={savingExpense}
              onSubmit={addExpense}
            />
            <ExpensesTable
              expenses={expenses}
              loading={loadingExpenses}
              onDelete={deleteExpense}
            />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Admin Report Section */}
        <AdminClaimsReport />
      </TabsContent>

      <TabsContent value="buy-back">
        <BuyBackClaimsTab />
      </TabsContent>

      <TabsContent value="finance-governance">
        <SDAFinanceGovernance />
      </TabsContent>

      <TabsContent value="risks">
        <SDARisksMitigation />
      </TabsContent>

      <TabsContent value="evidence">
        <SDAEvidenceLibrary />
      </TabsContent>

      {/* Access Settings Modal (lifted from BuyBackClaimsTab) */}
      <BuyBackAccessSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        hasAccess={hasAccess}
        grantAccess={grantAccess}
        revokeByKey={revokeByKey}
      />
    </Tabs>
  );
}
