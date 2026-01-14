import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Users, User, Layers } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { NRESHoursEntry, NRESExpense } from '@/types/nresHoursTypes';
import { getClaimantRate } from '@/types/nresHoursTypes';
import { useAuth } from '@/contexts/AuthContext';

interface TrackerReportModalProps {
  entries: NRESHoursEntry[];
  expenses: NRESExpense[];
  hourlyRate: number | null;
}

type ReportView = 'combined' | 'by-type' | 'by-claimant';

interface ClaimantSummary {
  name: string;
  type: 'gp' | 'pm' | 'personal';
  hours: number;
  rate: number | null;
  amount: number;
  entries: NRESHoursEntry[];
}

export function TrackerReportModal({ entries, expenses, hourlyRate }: TrackerReportModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportView, setReportView] = useState<ReportView>('combined');

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

    // Calculate totals with mixed rates
    let totalHours = 0;
    let totalTimeAmount = 0;

    filteredEntries.forEach(e => {
      const hours = Number(e.duration_hours);
      const claimantRate = getClaimantRate(e.claimant_type);
      const rate = claimantRate ?? hourlyRate;
      
      totalHours += hours;
      if (rate) {
        totalTimeAmount += hours * rate;
      }
    });

    const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Group by claimant type
    const byType = {
      gp: { hours: 0, amount: 0, entries: [] as NRESHoursEntry[] },
      pm: { hours: 0, amount: 0, entries: [] as NRESHoursEntry[] },
      personal: { hours: 0, amount: 0, entries: [] as NRESHoursEntry[] }
    };

    filteredEntries.forEach(e => {
      const type = e.claimant_type || 'personal';
      const key = type === 'gp' ? 'gp' : type === 'pm' ? 'pm' : 'personal';
      const hours = Number(e.duration_hours);
      const claimantRate = getClaimantRate(e.claimant_type);
      const rate = claimantRate ?? hourlyRate;
      
      byType[key].hours += hours;
      byType[key].amount += rate ? hours * rate : 0;
      byType[key].entries.push(e);
    });

    // Group by individual claimant
    const byClaimant: Record<string, ClaimantSummary> = {};

    filteredEntries.forEach(e => {
      const name = e.claimant_name || 'Self';
      const type = e.claimant_type || 'personal';
      const key = `${name}-${type}`;
      const hours = Number(e.duration_hours);
      const claimantRate = getClaimantRate(e.claimant_type);
      const rate = claimantRate ?? hourlyRate;

      if (!byClaimant[key]) {
        byClaimant[key] = {
          name,
          type: type as 'gp' | 'pm' | 'personal',
          hours: 0,
          rate,
          amount: 0,
          entries: []
        };
      }

      byClaimant[key].hours += hours;
      byClaimant[key].amount += rate ? hours * rate : 0;
      byClaimant[key].entries.push(e);
    });

    return {
      entries: filteredEntries,
      expenses: filteredExpenses,
      totalHours,
      totalTimeAmount,
      totalExpenseAmount,
      grandTotal: totalTimeAmount + totalExpenseAmount,
      byType,
      byClaimant: Object.values(byClaimant).sort((a, b) => b.amount - a.amount)
    };
  }, [entries, expenses, hourlyRate, startDate, endDate]);

  const formatTime = (time: string) => time.substring(0, 5);

  const getEntryRate = (entry: NRESHoursEntry): number | null => {
    const claimantRate = getClaimantRate(entry.claimant_type);
    return claimantRate ?? hourlyRate;
  };

  const getTypeLabel = (type: string): string => {
    if (type === 'gp') return 'GP (£100/hr)';
    if (type === 'pm') return 'Practice Manager (£50/hr)';
    return 'Personal Rate';
  };

  const generateCSV = () => {
    const lines = [
      'NRES Project Claim Report',
      `Submitted by: ${user?.email || 'Unknown'}`,
      `Period: ${format(parseISO(startDate), 'dd/MM/yyyy')} to ${format(parseISO(endDate), 'dd/MM/yyyy')}`,
      '',
    ];

    // Summary by type
    lines.push('SUMMARY BY CLAIM TYPE');
    lines.push('Type,Hours,Rate,Amount');
    if (filteredData.byType.gp.hours > 0) {
      lines.push(`GP,${filteredData.byType.gp.hours.toFixed(2)},£100.00,£${filteredData.byType.gp.amount.toFixed(2)}`);
    }
    if (filteredData.byType.pm.hours > 0) {
      lines.push(`Practice Manager,${filteredData.byType.pm.hours.toFixed(2)},£50.00,£${filteredData.byType.pm.amount.toFixed(2)}`);
    }
    if (filteredData.byType.personal.hours > 0) {
      lines.push(`Personal Rate,${filteredData.byType.personal.hours.toFixed(2)},£${hourlyRate?.toFixed(2) || 'Not set'},£${filteredData.byType.personal.amount.toFixed(2)}`);
    }
    lines.push('');

    // Summary by claimant
    lines.push('SUMMARY BY CLAIMANT');
    lines.push('Name,Type,Hours,Rate,Amount');
    filteredData.byClaimant.forEach(c => {
      const rateStr = c.rate ? `£${c.rate.toFixed(2)}` : 'Not set';
      lines.push(`"${c.name}",${getTypeLabel(c.type)},${c.hours.toFixed(2)},${rateStr},£${c.amount.toFixed(2)}`);
    });
    lines.push('');

    // Detailed time entries
    lines.push('DETAILED TIME ENTRIES');
    lines.push('Date,Claimant,Type,Start,End,Hours,Activity,Notes,Rate,Amount');

    filteredData.entries.forEach(e => {
      const rate = getEntryRate(e);
      const amount = rate ? (Number(e.duration_hours) * rate).toFixed(2) : '';
      const claimantName = e.claimant_name || 'Self';
      const claimantType = e.claimant_type ? (e.claimant_type === 'gp' ? 'GP' : 'PM') : 'Personal';
      lines.push(`${format(parseISO(e.work_date), 'dd/MM/yyyy')},"${claimantName}",${claimantType},${formatTime(e.start_time)},${formatTime(e.end_time)},${Number(e.duration_hours).toFixed(2)},${e.activity_type},"${e.description || ''}",£${rate?.toFixed(2) || 'N/A'},£${amount}`);
    });

    lines.push(`Time Subtotal,,,,,${filteredData.totalHours.toFixed(2)} hours,,,,£${filteredData.totalTimeAmount.toFixed(2)}`);
    lines.push('');

    // Expenses
    lines.push('EXPENSES');
    lines.push('Date,Category,Description,Reference,Amount');

    filteredData.expenses.forEach(e => {
      lines.push(`${format(parseISO(e.expense_date), 'dd/MM/yyyy')},${e.category},"${e.description || ''}",${e.receipt_reference || ''},£${Number(e.amount).toFixed(2)}`);
    });

    lines.push(`Expenses Subtotal,,,,£${filteredData.totalExpenseAmount.toFixed(2)}`);
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
              <p><strong>Submitted by:</strong> {user?.email}</p>
              <p><strong>Period:</strong> {format(parseISO(startDate), 'dd/MM/yyyy')} to {format(parseISO(endDate), 'dd/MM/yyyy')}</p>
            </div>

            {/* View Tabs */}
            <Tabs value={reportView} onValueChange={(v) => setReportView(v as ReportView)}>
              <TabsList className="mb-4">
                <TabsTrigger value="combined" className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Combined
                </TabsTrigger>
                <TabsTrigger value="by-type" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  By Type
                </TabsTrigger>
                <TabsTrigger value="by-claimant" className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  By Claimant
                </TabsTrigger>
              </TabsList>

              <TabsContent value="combined">
                {/* Combined View - All entries */}
                <h4 className="font-semibold text-sm mb-2">TIME ENTRIES</h4>
                {filteredData.entries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Claimant</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                        <TableHead className="text-xs">Hours</TableHead>
                        <TableHead className="text-xs">Activity</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.entries.map(e => {
                        const rate = getEntryRate(e);
                        const amount = rate ? Number(e.duration_hours) * rate : null;
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">{format(parseISO(e.work_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-xs">{e.claimant_name || 'Self'}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={e.claimant_type === 'gp' ? 'default' : e.claimant_type === 'pm' ? 'secondary' : 'outline'} className="text-xs">
                                {e.claimant_type === 'gp' ? 'GP' : e.claimant_type === 'pm' ? 'PM' : 'Personal'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{formatTime(e.start_time)} - {formatTime(e.end_time)}</TableCell>
                            <TableCell className="text-xs">{Number(e.duration_hours).toFixed(2)}</TableCell>
                            <TableCell className="text-xs">{e.activity_type}</TableCell>
                            <TableCell className="text-xs text-right">
                              {amount ? `£${amount.toFixed(2)}` : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-semibold bg-muted">
                        <TableCell colSpan={4} className="text-xs">Subtotal</TableCell>
                        <TableCell className="text-xs">{filteredData.totalHours.toFixed(2)} hrs</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-xs text-right">£{filteredData.totalTimeAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No time entries in this period.</p>
                )}
              </TabsContent>

              <TabsContent value="by-type">
                {/* By Type View */}
                <h4 className="font-semibold text-sm mb-2">SUMMARY BY CLAIM TYPE</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Hourly Rate</TableHead>
                      <TableHead className="text-xs">Total Hours</TableHead>
                      <TableHead className="text-xs text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.byType.gp.hours > 0 && (
                      <TableRow>
                        <TableCell>
                          <Badge>GP</Badge>
                        </TableCell>
                        <TableCell className="text-xs">£100.00</TableCell>
                        <TableCell className="text-xs">{filteredData.byType.gp.hours.toFixed(2)} hrs</TableCell>
                        <TableCell className="text-xs text-right font-medium">£{filteredData.byType.gp.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    {filteredData.byType.pm.hours > 0 && (
                      <TableRow>
                        <TableCell>
                          <Badge variant="secondary">PM</Badge>
                        </TableCell>
                        <TableCell className="text-xs">£50.00</TableCell>
                        <TableCell className="text-xs">{filteredData.byType.pm.hours.toFixed(2)} hrs</TableCell>
                        <TableCell className="text-xs text-right font-medium">£{filteredData.byType.pm.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    {filteredData.byType.personal.hours > 0 && (
                      <TableRow>
                        <TableCell>
                          <Badge variant="outline">Personal</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{hourlyRate ? `£${hourlyRate.toFixed(2)}` : 'Not set'}</TableCell>
                        <TableCell className="text-xs">{filteredData.byType.personal.hours.toFixed(2)} hrs</TableCell>
                        <TableCell className="text-xs text-right font-medium">£{filteredData.byType.personal.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="font-semibold bg-muted">
                      <TableCell colSpan={2} className="text-xs">Total</TableCell>
                      <TableCell className="text-xs">{filteredData.totalHours.toFixed(2)} hrs</TableCell>
                      <TableCell className="text-xs text-right">£{filteredData.totalTimeAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="by-claimant">
                {/* By Claimant View */}
                <h4 className="font-semibold text-sm mb-2">SUMMARY BY CLAIMANT</h4>
                {filteredData.byClaimant.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Claimant Name</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Hourly Rate</TableHead>
                        <TableHead className="text-xs">Total Hours</TableHead>
                        <TableHead className="text-xs text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.byClaimant.map((c, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">{c.name}</TableCell>
                          <TableCell>
                            <Badge variant={c.type === 'gp' ? 'default' : c.type === 'pm' ? 'secondary' : 'outline'} className="text-xs">
                              {c.type === 'gp' ? 'GP' : c.type === 'pm' ? 'PM' : 'Personal'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{c.rate ? `£${c.rate.toFixed(2)}` : 'Not set'}</TableCell>
                          <TableCell className="text-xs">{c.hours.toFixed(2)} hrs</TableCell>
                          <TableCell className="text-xs text-right font-medium">£{c.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted">
                        <TableCell colSpan={3} className="text-xs">Total</TableCell>
                        <TableCell className="text-xs">{filteredData.totalHours.toFixed(2)} hrs</TableCell>
                        <TableCell className="text-xs text-right">£{filteredData.totalTimeAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No time entries in this period.</p>
                )}
              </TabsContent>
            </Tabs>

            {/* Expenses - shown in all views */}
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