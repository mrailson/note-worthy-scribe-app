import { Separator } from '@/components/ui/separator';
import { HoursSettings } from './HoursSettings';
import { HoursEntryForm } from './HoursEntryForm';
import { HoursEntriesTable } from './HoursEntriesTable';
import { ExpenseEntryForm } from './ExpenseEntryForm';
import { ExpensesTable } from './ExpensesTable';
import { TrackerSummary } from './TrackerSummary';
import { TrackerReportModal } from './TrackerReportModal';
import { useNRESUserSettings } from '@/hooks/useNRESUserSettings';
import { useNRESHoursTracker } from '@/hooks/useNRESHoursTracker';
import { useNRESExpenses } from '@/hooks/useNRESExpenses';
import { Loader2 } from 'lucide-react';

export function NRESHoursTracker() {
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
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Expenses</h3>
        <ExpenseEntryForm
          saving={savingExpense}
          onSubmit={addExpense}
        />
        <ExpensesTable
          expenses={expenses}
          loading={loadingExpenses}
          onDelete={deleteExpense}
        />
      </div>
    </div>
  );
}
