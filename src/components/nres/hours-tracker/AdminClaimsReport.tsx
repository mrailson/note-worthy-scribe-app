import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Users, Download, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserClaim {
  user_id: string;
  email: string;
  total_hours: number;
  total_amount: number;
  entry_count: number;
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

// Authorised admin users
const ADMIN_EMAILS = [
  'm.green28@nhs.net',
  'mark.gray1@nhs.net'
];

export function AdminClaimsReport() {
  const { user, isSystemAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<AllEntry[]>([]);
  const [userSettings, setUserSettings] = useState<Record<string, number>>({});
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Check if current user has admin access
  const hasAccess = isSystemAdmin || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  const fetchAllData = async () => {
    if (!hasAccess) return;

    setLoading(true);
    try {
      // Fetch all entries (admin RLS policy should allow this)
      const { data: entriesData, error: entriesError } = await supabase
        .from('nres_hours_entries')
        .select('*')
        .order('work_date', { ascending: false });

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        return;
      }

      // Fetch all user settings for hourly rates
      const { data: settingsData, error: settingsError } = await supabase
        .from('nres_user_settings')
        .select('user_id, hourly_rate');

      if (settingsError) {
        console.error('Error fetching settings:', settingsError);
      }

      // Build settings map
      const settingsMap: Record<string, number> = {};
      settingsData?.forEach(s => {
        if (s.hourly_rate) {
          settingsMap[s.user_id] = s.hourly_rate;
        }
      });

      // Get unique user IDs
      const userIds = [...new Set(entriesData?.map(e => e.user_id) || [])];

      // Fetch user emails from profiles or auth
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const emailMap: Record<string, string> = {};
      profilesData?.forEach(p => {
        if (p.email) {
          emailMap[p.id] = p.email;
        }
      });

      setEntries(entriesData || []);
      setUserSettings(settingsMap);
      setUserEmails(emailMap);
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

      if (userMap.has(userId)) {
        const existing = userMap.get(userId)!;
        existing.total_hours += Number(entry.duration_hours);
        existing.total_amount += amount;
        existing.entry_count += 1;
      } else {
        userMap.set(userId, {
          user_id: userId,
          email: userEmails[userId] || userId.substring(0, 8) + '...',
          total_hours: Number(entry.duration_hours),
          total_amount: amount,
          entry_count: 1
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [entries, userSettings, userEmails, startDate, endDate]);

  const grandTotalHours = userClaims.reduce((sum, u) => sum + u.total_hours, 0);
  const grandTotalAmount = userClaims.reduce((sum, u) => sum + u.total_amount, 0);

  const exportCSV = () => {
    const BOM = '\uFEFF';
    const lines = [
      'NRES Claims Summary Report',
      `Period: ${format(parseISO(startDate), 'dd/MM/yyyy')} to ${format(parseISO(endDate), 'dd/MM/yyyy')}`,
      `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      '',
      'User,Entries,Total Hours,Total Amount'
    ];

    userClaims.forEach(claim => {
      lines.push(`${claim.email},${claim.entry_count},${claim.total_hours.toFixed(2)},£${claim.total_amount.toFixed(2)}`);
    });

    lines.push('');
    lines.push(`GRAND TOTAL,${userClaims.reduce((s, u) => s + u.entry_count, 0)},${grandTotalHours.toFixed(2)},£${grandTotalAmount.toFixed(2)}`);

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
              <Button onClick={exportCSV} variant="outline" size="sm" disabled={loading || userClaims.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : userClaims.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No claims found for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userClaims.map((claim) => (
                      <TableRow key={claim.user_id}>
                        <TableCell className="font-medium">{claim.email}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{claim.entry_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{claim.total_hours.toFixed(2)} hrs</TableCell>
                        <TableCell className="text-right font-medium">£{claim.total_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted">
                      <TableCell>GRAND TOTAL</TableCell>
                      <TableCell className="text-center">
                        <Badge>{userClaims.reduce((s, u) => s + u.entry_count, 0)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{grandTotalHours.toFixed(2)} hrs</TableCell>
                      <TableCell className="text-right text-lg">£{grandTotalAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
