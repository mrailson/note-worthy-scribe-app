import { useState } from 'react';
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
import { useNRESUserSettings } from '@/hooks/useNRESUserSettings';
import { useNRESHoursTracker } from '@/hooks/useNRESHoursTracker';
import { useNRESExpenses } from '@/hooks/useNRESExpenses';
import { Loader2, ChevronDown, ChevronRight, Receipt } from 'lucide-react';

export function NRESHoursTracker() {
  const [expensesOpen, setExpensesOpen] = useState(false);
  const { 
    hourlyRate, 
    hasRateSet, 
    saving: savingSettings, 
    loading: loadingSettings,
    saveHourlyRate 
  } = useNRESUserSettings();

  const {
    entries,
    loading: loadingEntries,
    saving: savingEntry,
    addEntry,
    updateEntry,
    deleteEntry,
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

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Time Tracking Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Time Tracking</h3>
        <HoursEntryForm 
          saving={savingEntry}
          onSubmit={addEntry}
        />
        <HoursEntriesTable
          entries={entries}
          hourlyRate={hourlyRate}
          loading={loadingEntries}
          onDelete={deleteEntry}
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

      {/* Admin Report Section - only visible to authorised users */}
      <AdminClaimsReport />
    </div>
  );
}
