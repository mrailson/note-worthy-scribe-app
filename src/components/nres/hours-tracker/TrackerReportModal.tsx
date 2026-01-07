import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { NRESHoursEntry, NRESExpense } from '@/types/nresHoursTypes';
import { useAuth } from '@/contexts/AuthContext';

interface TrackerReportModalProps {
  entries: NRESHoursEntry[];
  expenses: NRESExpense[];
  hourlyRate: number | null;
}

export function TrackerReportModal({ entries, expenses, hourlyRate }: TrackerReportModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const filteredData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    const filteredEntries = entries.filter(e => {
      const date = parseISO(e.work_date);
      return isWithinInterval(date, { start, end });
    });

    const filteredExpenses = expenses.filter(e => {
      const date = parseISO(e.expense_date);
      return isWithinInterval(date, { start, end });
    });

    const totalHours = filteredEntries.reduce((sum, e) => sum + Number(e.duration_hours), 0);
    const totalTimeAmount = hourlyRate ? totalHours * hourlyRate : 0;
    const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      entries: filteredEntries,
      expenses: filteredExpenses,
      totalHours,
      totalTimeAmount,
      totalExpenseAmount,
      grandTotal: totalTimeAmount + totalExpenseAmount
    };
  }, [entries, expenses, hourlyRate, startDate, endDate]);

  const formatTime = (time: string) => time.substring(0, 5);

  const generateCSV = () => {
    const lines = [
      'NRES Project Claim Report',
      `User: ${user?.email || 'Unknown'}`,
      `Period: ${format(parseISO(startDate), 'dd/MM/yyyy')} to ${format(parseISO(endDate), 'dd/MM/yyyy')}`,
      `Hourly Rate: £${hourlyRate?.toFixed(2) || 'Not set'}`,
      '',
      'TIME ENTRIES',
      'Date,Start,End,Hours,Activity,Notes,Amount'
    ];

    filteredData.entries.forEach(e => {
      const amount = hourlyRate ? (Number(e.duration_hours) * hourlyRate).toFixed(2) : '';
      lines.push(`${format(parseISO(e.work_date), 'dd/MM/yyyy')},${formatTime(e.start_time)},${formatTime(e.end_time)},${Number(e.duration_hours).toFixed(2)},${e.activity_type},"${e.description || ''}",£${amount}`);
    });

    lines.push(`Subtotal,,,${filteredData.totalHours.toFixed(2)} hours,,,£${filteredData.totalTimeAmount.toFixed(2)}`);
    lines.push('');
    lines.push('EXPENSES');
    lines.push('Date,Category,Description,Reference,Amount');

    filteredData.expenses.forEach(e => {
      lines.push(`${format(parseISO(e.expense_date), 'dd/MM/yyyy')},${e.category},"${e.description || ''}",${e.receipt_reference || ''},£${Number(e.amount).toFixed(2)}`);
    });

    lines.push(`Subtotal,,,,£${filteredData.totalExpenseAmount.toFixed(2)}`);
    lines.push('');
    lines.push(`GRAND TOTAL,£${filteredData.grandTotal.toFixed(2)}`);

    // Add UTF-8 BOM for proper encoding in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NRES-Claim-${format(parseISO(startDate), 'yyyyMMdd')}-${format(parseISO(endDate), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>NRES Project Claim Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Range Selection */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="report-start" className="text-xs">From</Label>
              <Input
                id="report-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="report-end" className="text-xs">To</Label>
              <Input
                id="report-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={generateCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Report Preview */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="mb-4 space-y-1 text-sm">
              <p><strong>User:</strong> {user?.email}</p>
              <p><strong>Period:</strong> {format(parseISO(startDate), 'dd/MM/yyyy')} to {format(parseISO(endDate), 'dd/MM/yyyy')}</p>
              <p><strong>Hourly Rate:</strong> £{hourlyRate?.toFixed(2) || 'Not set'}</p>
            </div>

            {/* Time Entries */}
            <h4 className="font-semibold text-sm mb-2 mt-4">TIME ENTRIES</h4>
            {filteredData.entries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Start</TableHead>
                    <TableHead className="text-xs">End</TableHead>
                    <TableHead className="text-xs">Hours</TableHead>
                    <TableHead className="text-xs">Activity</TableHead>
                    <TableHead className="text-xs">Notes</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.entries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{format(parseISO(e.work_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-xs">{formatTime(e.start_time)}</TableCell>
                      <TableCell className="text-xs">{formatTime(e.end_time)}</TableCell>
                      <TableCell className="text-xs">{Number(e.duration_hours).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{e.activity_type}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{e.description || '-'}</TableCell>
                      <TableCell className="text-xs text-right">
                        {hourlyRate ? `£${(Number(e.duration_hours) * hourlyRate).toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted">
                    <TableCell colSpan={3} className="text-xs">Subtotal</TableCell>
                    <TableCell className="text-xs">{filteredData.totalHours.toFixed(2)} hrs</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-xs text-right">£{filteredData.totalTimeAmount.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No time entries in this period.</p>
            )}

            {/* Expenses */}
            <h4 className="font-semibold text-sm mb-2 mt-6">EXPENSES</h4>
            {filteredData.expenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.expenses.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{format(parseISO(e.expense_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-xs">{e.category}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{e.description || '-'}</TableCell>
                      <TableCell className="text-xs">{e.receipt_reference || '-'}</TableCell>
                      <TableCell className="text-xs text-right">£{Number(e.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted">
                    <TableCell colSpan={4} className="text-xs">Subtotal</TableCell>
                    <TableCell className="text-xs text-right">£{filteredData.totalExpenseAmount.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No expenses in this period.</p>
            )}

            {/* Grand Total */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-bold">GRAND TOTAL</span>
                <span className="text-xl font-bold">£{filteredData.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
