import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, Users, Download, Loader2, Calendar, Clock, Receipt } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserClaim {
  user_id: string;
  user_name: string;
  practice_name: string;
  total_hours: number;
  total_amount: number;
  entry_count: number;
  entries: AllEntry[];
}

interface UserExpenseClaim {
  user_id: string;
  user_name: string;
  practice_name: string;
  total_expenses: number;
  expense_count: number;
  expenses: AllExpense[];
}

interface AllEntry {
  id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  activity_type: string;
  description: string | null;
}

interface AllExpense {
  id: string;
  user_id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  receipt_reference: string | null;
}

// Format currency with thousand separators
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Authorised admin users
const ADMIN_EMAILS = [
  'm.green28@nhs.net',
  'mark.gray1@nhs.net',
  'amanda.taylor75@nhs.net',
  'carolyn.abbisogni@nhs.net'
];

const normaliseEmail = (email: unknown): string | null => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
};

const ADMIN_EMAILS_SET = new Set(ADMIN_EMAILS.map((e) => e.trim().toLowerCase()));

export function AdminClaimsReport() {
  const { user, isSystemAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<AllEntry[]>([]);
  const [expenses, setExpenses] = useState<AllExpense[]>([]);
  const [userSettings, setUserSettings] = useState<Record<string, number>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string; practice_name: string }>>({});
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Check if current user has admin access
  const authEmail =
    normaliseEmail(user?.email) ?? normaliseEmail((user as any)?.user_metadata?.email);
  const hasAccess = isSystemAdmin || (authEmail ? ADMIN_EMAILS_SET.has(authEmail) : false);

  const fetchAllData = async () => {
    if (!hasAccess) return;

    setLoading(true);
    try {
      // Fetch all entries and expenses in parallel
      const [entriesResult, expensesResult, settingsResult, usersResult] = await Promise.all([
        supabase
          .from('nres_hours_entries')
          .select('*')
          .order('work_date', { ascending: false }),
        supabase
          .from('nres_expenses')
          .select('*')
          .order('expense_date', { ascending: false }),
        supabase
          .from('nres_user_settings')
          .select('user_id, hourly_rate'),
        supabase.rpc('get_users_with_practices')
      ]);

      if (entriesResult.error) {
        console.error('Error fetching entries:', entriesResult.error);
      }
      if (expensesResult.error) {
        console.error('Error fetching expenses:', expensesResult.error);
      }

      // Build settings map
      const settingsMap: Record<string, number> = {};
      settingsResult.data?.forEach(s => {
        if (s.hourly_rate) {
          settingsMap[s.user_id] = s.hourly_rate;
        }
      });

      // Build profile map from users with practices
      const profileMap: Record<string, { name: string; practice_name: string }> = {};
      
      if (usersResult.data) {
        usersResult.data.forEach((u) => {
          const assignments = u.practice_assignments as Array<{ practice_name: string }> | null;
          const practiceName = assignments?.[0]?.practice_name || 'Not Set';
          profileMap[u.user_id] = {
            name: u.full_name || u.email || u.user_id.substring(0, 8) + '...',
            practice_name: practiceName
          };
        });
      }

      setEntries(entriesResult.data || []);
      setExpenses(expensesResult.data || []);
      setUserSettings(settingsMap);
      setUserProfiles(profileMap);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && hasAccess) {
      fetchAllData();
    }
  }, [isOpen, hasAccess]);

  // Filter entries by date range and aggregate by user
  const userClaims = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const filteredEntries = entries.filter(e => {
      const date = parseISO(e.work_date);
      return isWithinInterval(date, { start, end });
    });

    // Group by user
    const userMap = new Map<string, UserClaim>();

    filteredEntries.forEach(entry => {
      const userId = entry.user_id;
      const hourlyRate = userSettings[userId] || 50; // Default £50/hr
      const amount = Number(entry.duration_hours) * hourlyRate;
      const profile = userProfiles[userId] || { name: userId.substring(0, 8) + '...', practice_name: 'Unknown' };

      if (userMap.has(userId)) {
        const existing = userMap.get(userId)!;
        existing.total_hours += Number(entry.duration_hours);
        existing.total_amount += amount;
        existing.entry_count += 1;
        existing.entries.push(entry);
      } else {
        userMap.set(userId, {
          user_id: userId,
          user_name: profile.name,
          practice_name: profile.practice_name,
          total_hours: Number(entry.duration_hours),
          total_amount: amount,
          entry_count: 1,
          entries: [entry]
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [entries, userSettings, userProfiles, startDate, endDate]);

  // Filter expenses by date range and aggregate by user
  const userExpenseClaims = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const filteredExpenses = expenses.filter(e => {
      const date = parseISO(e.expense_date);
      return isWithinInterval(date, { start, end });
    });

    // Group by user
    const userMap = new Map<string, UserExpenseClaim>();

    filteredExpenses.forEach(expense => {
      const userId = expense.user_id;
      const profile = userProfiles[userId] || { name: userId.substring(0, 8) + '...', practice_name: 'Unknown' };

      if (userMap.has(userId)) {
        const existing = userMap.get(userId)!;
        existing.total_expenses += Number(expense.amount);
        existing.expense_count += 1;
        existing.expenses.push(expense);
      } else {
        userMap.set(userId, {
          user_id: userId,
          user_name: profile.name,
          practice_name: profile.practice_name,
          total_expenses: Number(expense.amount),
          expense_count: 1,
          expenses: [expense]
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.total_expenses - a.total_expenses);
  }, [expenses, userProfiles, startDate, endDate]);

  const grandTotalHours = userClaims.reduce((sum, u) => sum + u.total_hours, 0);
  const grandTotalAmount = userClaims.reduce((sum, u) => sum + u.total_amount, 0);
  const grandTotalExpenses = userExpenseClaims.reduce((sum, u) => sum + u.total_expenses, 0);
  const overallGrandTotal = grandTotalAmount + grandTotalExpenses;

  const exportCSV = () => {
    const BOM = '\uFEFF';
    const lines = [
      'NRES Claims Summary Report',
      `Period: ${format(parseISO(startDate), 'dd/MM/yyyy')} to ${format(parseISO(endDate), 'dd/MM/yyyy')}`,
      `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      '',
      '=== TIME CLAIMS ===',
      'User Name,Practice,Date,Start Time,End Time,Hours,Activity Type,Description,Amount'
    ];

    userClaims.forEach(claim => {
      const hourlyRate = userSettings[claim.user_id] || 50;
      claim.entries
        .sort((a, b) => a.work_date.localeCompare(b.work_date))
        .forEach(entry => {
          const amount = Number(entry.duration_hours) * hourlyRate;
          const description = entry.description ? `"${entry.description.replace(/"/g, '""')}"` : '';
          lines.push(`"${claim.user_name}","${claim.practice_name}",${format(parseISO(entry.work_date), 'dd/MM/yyyy')},${entry.start_time.substring(0, 5)},${entry.end_time.substring(0, 5)},${Number(entry.duration_hours).toFixed(2)},"${entry.activity_type || ''}",${description},£${amount.toFixed(2)}`);
        });
    });

    lines.push('');
    lines.push(`TIME CLAIMS TOTAL,,,,,${grandTotalHours.toFixed(2)},,,£${grandTotalAmount.toFixed(2)}`);
    lines.push('');
    lines.push('=== EXPENSES ===');
    lines.push('User Name,Practice,Date,Category,Description,Receipt Ref,Amount');

    userExpenseClaims.forEach(claim => {
      claim.expenses
        .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
        .forEach(expense => {
          const description = expense.description ? `"${expense.description.replace(/"/g, '""')}"` : '';
          lines.push(`"${claim.user_name}","${claim.practice_name}",${format(parseISO(expense.expense_date), 'dd/MM/yyyy')},"${expense.category}",${description},"${expense.receipt_reference || ''}",£${Number(expense.amount).toFixed(2)}`);
        });
    });

    lines.push('');
    lines.push(`EXPENSES TOTAL,,,,,,£${grandTotalExpenses.toFixed(2)}`);
    lines.push('');
    lines.push(`OVERALL GRAND TOTAL,,,,,,£${overallGrandTotal.toFixed(2)}`);

    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NRES-Admin-Report-${format(parseISO(startDate), 'yyyyMMdd')}-${format(parseISO(endDate), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasAccess) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-200 bg-amber-50/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-amber-100/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Users className="w-4 h-4 text-amber-600" />
                Admin Claims Report
                <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300">
                  Admin Only
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center gap-1 text-blue-600 mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs font-medium">Time Claims</span>
                </div>
                <p className="text-lg font-bold">£{formatCurrency(grandTotalAmount)}</p>
                <p className="text-xs text-muted-foreground">{grandTotalHours.toFixed(1)} hrs</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200">
                <div className="flex items-center gap-1 text-amber-600 mb-1">
                  <Receipt className="w-3 h-3" />
                  <span className="text-xs font-medium">Expenses</span>
                </div>
                <p className="text-lg font-bold">£{formatCurrency(grandTotalExpenses)}</p>
                <p className="text-xs text-muted-foreground">{userExpenseClaims.reduce((s, u) => s + u.expense_count, 0)} items</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 border border-purple-200 col-span-2">
                <div className="flex items-center gap-1 text-purple-600 mb-1">
                  <Users className="w-3 h-3" />
                  <span className="text-xs font-medium">Overall Total</span>
                </div>
                <p className="text-xl font-bold">£{formatCurrency(overallGrandTotal)}</p>
              </div>
            </div>

            {/* Quick Date Filters */}
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
                className="text-xs"
              >
                <Calendar className="w-3 h-3 mr-1" />
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const lastMonth = subMonths(new Date(), 1);
                  setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
                }}
                className="text-xs"
              >
                <Calendar className="w-3 h-3 mr-1" />
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate('2020-01-01');
                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                }}
                className="text-xs"
              >
                <Calendar className="w-3 h-3 mr-1" />
                All Time
              </Button>
            </div>

            {/* Date Range Selection */}
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label htmlFor="admin-start" className="text-xs">From</Label>
                <Input
                  id="admin-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-40"
                />
              </div>
              <div>
                <Label htmlFor="admin-end" className="text-xs">To</Label>
                <Input
                  id="admin-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-40"
                />
              </div>
              <Button onClick={fetchAllData} variant="outline" size="sm" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Refresh
              </Button>
              <Button onClick={exportCSV} variant="outline" size="sm" disabled={loading || (userClaims.length === 0 && userExpenseClaims.length === 0)}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="hours" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="hours" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Claims ({userClaims.length})
                  </TabsTrigger>
                  <TabsTrigger value="expenses" className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Expenses ({userExpenseClaims.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="hours" className="mt-4">
                  {userClaims.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No time claims found for this period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User Name</TableHead>
                            <TableHead>Practice</TableHead>
                            <TableHead className="text-center">Entries</TableHead>
                            <TableHead className="text-right">Total Hours</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userClaims.map((claim) => (
                            <TableRow key={claim.user_id}>
                              <TableCell className="font-medium">{claim.user_name}</TableCell>
                              <TableCell className="text-muted-foreground">{claim.practice_name}</TableCell>
                              <TableCell className="text-center">
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                                      {claim.entry_count}
                                    </Badge>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-80 max-h-64 overflow-y-auto" align="start">
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold">Entry Details</h4>
                                      <div className="text-xs space-y-1">
                                        {claim.entries
                                          .sort((a, b) => a.work_date.localeCompare(b.work_date))
                                          .map((entry) => (
                                            <div key={entry.id} className="flex justify-between items-start py-1 border-b border-border/50 last:border-0">
                                              <div className="flex-1 min-w-0 mr-2">
                                                <span className="font-medium">{format(parseISO(entry.work_date), 'dd/MM/yyyy')}</span>
                                                <span className="text-muted-foreground ml-2">
                                                  {entry.start_time.substring(0, 5)} - {entry.end_time.substring(0, 5)}
                                                </span>
                                                {entry.activity_type && (
                                                  <div className="text-muted-foreground">{entry.activity_type}</div>
                                                )}
                                                {entry.description && (
                                                  <div className="text-muted-foreground italic">{entry.description}</div>
                                                )}
                                              </div>
                                              <span className="font-medium whitespace-nowrap">{Number(entry.duration_hours).toFixed(2)} hrs</span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              </TableCell>
                              <TableCell className="text-right">{claim.total_hours.toFixed(2)} hrs</TableCell>
                              <TableCell className="text-right font-medium">£{formatCurrency(claim.total_amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold bg-muted">
                            <TableCell>TOTAL</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center">
                              <Badge>{userClaims.reduce((s, u) => s + u.entry_count, 0)}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{grandTotalHours.toFixed(2)} hrs</TableCell>
                            <TableCell className="text-right text-lg">£{formatCurrency(grandTotalAmount)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="expenses" className="mt-4">
                  {userExpenseClaims.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No expenses found for this period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User Name</TableHead>
                            <TableHead>Practice</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userExpenseClaims.map((claim) => (
                            <TableRow key={claim.user_id}>
                              <TableCell className="font-medium">{claim.user_name}</TableCell>
                              <TableCell className="text-muted-foreground">{claim.practice_name}</TableCell>
                              <TableCell className="text-center">
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                                      {claim.expense_count}
                                    </Badge>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-80 max-h-64 overflow-y-auto" align="start">
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold">Expense Details</h4>
                                      <div className="text-xs space-y-1">
                                        {claim.expenses
                                          .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
                                          .map((expense) => (
                                            <div key={expense.id} className="flex justify-between items-start py-1 border-b border-border/50 last:border-0">
                                              <div className="flex-1 min-w-0 mr-2">
                                                <span className="font-medium">{format(parseISO(expense.expense_date), 'dd/MM/yyyy')}</span>
                                                <div className="text-muted-foreground">{expense.category}</div>
                                                {expense.description && (
                                                  <div className="text-muted-foreground italic">{expense.description}</div>
                                                )}
                                                {expense.receipt_reference && (
                                                  <div className="text-muted-foreground">Ref: {expense.receipt_reference}</div>
                                                )}
                                              </div>
                                              <span className="font-medium whitespace-nowrap">£{Number(expense.amount).toFixed(2)}</span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              </TableCell>
                              <TableCell className="text-right font-medium">£{formatCurrency(claim.total_expenses)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold bg-muted">
                            <TableCell>TOTAL</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center">
                              <Badge>{userExpenseClaims.reduce((s, u) => s + u.expense_count, 0)}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-lg">£{formatCurrency(grandTotalExpenses)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
