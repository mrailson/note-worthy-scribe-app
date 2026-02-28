import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, Users, Download, Loader2, Calendar, List, LayoutGrid, Trash2, ArrowUpDown, FileCheck, Undo2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserClaim {
  user_id: string;
  user_name: string;
  practice_name: string;
  total_hours: number;
  total_amount: number;
  entry_count: number;
  entries: AllEntry[];
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
  entered_by: string | null;
  claimant_name: string | null;
  claimant_type: string | null;
  invoice_status: string | null;
  invoiced_date: string | null;
  invoiced_by: string | null;
}

interface ClaimantInfo {
  name: string;
  member_practice: string | null;
  role: string;
}

interface DetailedEntry extends AllEntry {
  user_name: string;
  practice_name: string;
  hourly_rate: number;
  amount: number;
  entered_by_name: string;
}

type SortField = 'work_date' | 'user_name' | 'practice_name' | 'duration_hours' | 'amount' | 'entered_by_name';
type SummarySortField = 'user_name' | 'practice_name' | 'entry_count' | 'total_hours' | 'total_amount';
type SortDirection = 'asc' | 'desc';

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

export function AdminClaimsReport() {
  const { user, isSystemAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<AllEntry[]>([]);
  const [userSettings, setUserSettings] = useState<Record<string, number>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string; practice_name: string }>>({});
  const [claimants, setClaimants] = useState<Record<string, ClaimantInfo>>({});
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'practice'>('summary');
  const [filterName, setFilterName] = useState<string>('all');
  const [filterPractice, setFilterPractice] = useState<string>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('work_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [summarySortField, setSummarySortField] = useState<SummarySortField>('total_amount');
  const [summarySortDirection, setSummarySortDirection] = useState<SortDirection>('desc');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [practiceSortField, setPracticeSortField] = useState<'practice' | 'claimCount' | 'totalHours' | 'totalAmount'>('totalAmount');
  const [practiceSortDirection, setPracticeSortDirection] = useState<SortDirection>('desc');
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [markingInvoiced, setMarkingInvoiced] = useState(false);

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

      // Fetch all claimants to get their member_practice
      const { data: claimantsData, error: claimantsError } = await supabase
        .from('nres_claimants')
        .select('name, member_practice, role');

      if (claimantsError) {
        console.error('Error fetching claimants:', claimantsError);
      }

      // Build claimants map by name (for lookup)
      const claimantsMap: Record<string, ClaimantInfo> = {};
      claimantsData?.forEach(c => {
        claimantsMap[c.name] = {
          name: c.name,
          member_practice: c.member_practice,
          role: c.role
        };
      });

      // Build settings map
      const settingsMap: Record<string, number> = {};
      settingsData?.forEach(s => {
        if (s.hourly_rate) {
          settingsMap[s.user_id] = s.hourly_rate;
        }
      });

      // Fetch all users with their practice assignments using the RPC function
      const { data: usersWithPractices } = await supabase
        .rpc('get_users_with_practices');

      // Build profile map from users with practices
      const profileMap: Record<string, { name: string; practice_name: string }> = {};
      
      if (usersWithPractices) {
        usersWithPractices.forEach((u) => {
          const assignments = u.practice_assignments as Array<{ practice_name: string }> | null;
          const practiceName = assignments?.[0]?.practice_name || 'Not Set';
          profileMap[u.user_id] = {
            name: u.full_name || u.email || u.user_id.substring(0, 8) + '...',
            practice_name: practiceName
          };
        });
      }

      setEntries(entriesData || []);
      setUserSettings(settingsMap);
      setUserProfiles(profileMap);
      setClaimants(claimantsMap);
      setSelectedEntries(new Set());
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

  // Get unique names and practices from entries that exist in the date range
  const { uniqueNames, uniquePractices } = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    const names = new Set<string>();
    const practices = new Set<string>();
    
    entries.forEach(e => {
      const date = parseISO(e.work_date);
      if (isWithinInterval(date, { start, end })) {
        if (e.claimant_name) {
          const claimant = claimants[e.claimant_name];
          names.add(e.claimant_name);
          practices.add(claimant?.member_practice || 'Not Set');
        } else {
          const profile = userProfiles[e.user_id];
          if (profile) {
            names.add(profile.name);
            practices.add(profile.practice_name);
          }
        }
      }
    });
    
    return {
      uniqueNames: Array.from(names).sort(),
      uniquePractices: Array.from(practices).sort()
    };
  }, [entries, userProfiles, claimants, startDate, endDate]);

  // Filter entries by date range and aggregate by user/claimant
  const { userClaims, detailedEntries } = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const getEntryDetails = (e: AllEntry) => {
      if (e.claimant_name) {
        const claimant = claimants[e.claimant_name];
        return {
          displayName: e.claimant_name,
          practiceName: claimant?.member_practice || 'Not Set',
          groupKey: `name:${e.claimant_name}`
        };
      } else {
        const profile = userProfiles[e.user_id] || { name: e.user_id.substring(0, 8) + '...', practice_name: 'Unknown' };
        const matchingClaimant = claimants[profile.name];
        return {
          displayName: profile.name,
          practiceName: matchingClaimant?.member_practice || profile.practice_name,
          groupKey: `name:${profile.name}`
        };
      }
    };

    const filteredEntries = entries.filter(e => {
      const date = parseISO(e.work_date);
      if (!isWithinInterval(date, { start, end })) return false;
      
      const details = getEntryDetails(e);
      
      if (filterName !== 'all' && details.displayName !== filterName) return false;
      if (filterPractice !== 'all' && details.practiceName !== filterPractice) return false;
      
      // Invoice status filter
      if (invoiceFilter === 'pending' && e.invoice_status === 'invoiced') return false;
      if (invoiceFilter === 'invoiced' && e.invoice_status !== 'invoiced') return false;
      
      return true;
    });

    // Build detailed entries list
    const detailed: DetailedEntry[] = filteredEntries.map(entry => {
      const details = getEntryDetails(entry);
      const enteredByProfile = entry.entered_by ? userProfiles[entry.entered_by] : null;
      const hourlyRate = userSettings[entry.user_id] || 50;
      const amount = Number(entry.duration_hours) * hourlyRate;
      
      return {
        ...entry,
        user_name: details.displayName,
        practice_name: details.practiceName,
        hourly_rate: hourlyRate,
        amount,
        entered_by_name: enteredByProfile?.name || (entry.entered_by ? entry.entered_by.substring(0, 8) + '...' : details.displayName)
      };
    });

    // Sort detailed entries
    detailed.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'work_date':
          comparison = a.work_date.localeCompare(b.work_date);
          break;
        case 'user_name':
          comparison = a.user_name.localeCompare(b.user_name);
          break;
        case 'practice_name':
          comparison = a.practice_name.localeCompare(b.practice_name);
          break;
        case 'duration_hours':
          comparison = Number(a.duration_hours) - Number(b.duration_hours);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'entered_by_name':
          comparison = a.entered_by_name.localeCompare(b.entered_by_name);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    // Group by claimant/user for summary
    const claimMap = new Map<string, UserClaim>();

    filteredEntries.forEach(entry => {
      const details = getEntryDetails(entry);
      const hourlyRate = userSettings[entry.user_id] || 50;
      const amount = Number(entry.duration_hours) * hourlyRate;

      if (claimMap.has(details.groupKey)) {
        const existing = claimMap.get(details.groupKey)!;
        existing.total_hours += Number(entry.duration_hours);
        existing.total_amount += amount;
        existing.entry_count += 1;
        existing.entries.push(entry);
      } else {
        claimMap.set(details.groupKey, {
          user_id: details.groupKey,
          user_name: details.displayName,
          practice_name: details.practiceName,
          total_hours: Number(entry.duration_hours),
          total_amount: amount,
          entry_count: 1,
          entries: [entry]
        });
      }
    });

    const unsortedClaims = Array.from(claimMap.values());

    return {
      userClaims: unsortedClaims,
      detailedEntries: detailed
    };
  }, [entries, userSettings, userProfiles, claimants, startDate, endDate, filterName, filterPractice, invoiceFilter, sortField, sortDirection]);

  // Sort summary claims
  const sortedUserClaims = useMemo(() => {
    const sorted = [...userClaims];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (summarySortField) {
        case 'user_name':
          comparison = a.user_name.localeCompare(b.user_name);
          break;
        case 'practice_name':
          comparison = a.practice_name.localeCompare(b.practice_name);
          break;
        case 'entry_count':
          comparison = a.entry_count - b.entry_count;
          break;
        case 'total_hours':
          comparison = a.total_hours - b.total_hours;
          break;
        case 'total_amount':
          comparison = a.total_amount - b.total_amount;
          break;
      }
      return summarySortDirection === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [userClaims, summarySortField, summarySortDirection]);

  const grandTotalHours = userClaims.reduce((sum, u) => sum + u.total_hours, 0);
  const grandTotalAmount = userClaims.reduce((sum, u) => sum + u.total_amount, 0);

  // Practice summary view - group by practice, merging Oak Lane into Brackley & Towcester PCN
  const practiceSummary = useMemo(() => {
    const practiceMap = new Map<string, { practice: string; claimCount: number; totalHours: number; totalAmount: number }>();
    
    userClaims.forEach(claim => {
      // Merge Oak Lane into Brackley & Towcester PCN
      let practiceName = claim.practice_name;
      if (practiceName?.toLowerCase().includes('oak lane')) {
        practiceName = 'Brackley & Towcester PCN';
      }
      
      const existing = practiceMap.get(practiceName);
      if (existing) {
        existing.claimCount += claim.entry_count;
        existing.totalHours += claim.total_hours;
        existing.totalAmount += claim.total_amount;
      } else {
        practiceMap.set(practiceName, {
          practice: practiceName,
          claimCount: claim.entry_count,
          totalHours: claim.total_hours,
          totalAmount: claim.total_amount
        });
      }
    });
    
    const sorted = Array.from(practiceMap.values());
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (practiceSortField) {
        case 'practice': comparison = a.practice.localeCompare(b.practice); break;
        case 'claimCount': comparison = a.claimCount - b.claimCount; break;
        case 'totalHours': comparison = a.totalHours - b.totalHours; break;
        case 'totalAmount': comparison = a.totalAmount - b.totalAmount; break;
      }
      return practiceSortDirection === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [userClaims, practiceSortField, practiceSortDirection]);

  // Selectable entries (uninvoiced only)
  const selectableEntries = useMemo(() => 
    detailedEntries.filter(e => e.invoice_status !== 'invoiced'),
    [detailedEntries]
  );

  const allSelectableSelected = selectableEntries.length > 0 && selectableEntries.every(e => selectedEntries.has(e.id));

  const handleToggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(selectableEntries.map(e => e.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMarkInvoiced = async (entryIds: string[], date: string) => {
    if (!user?.id) return;
    setMarkingInvoiced(true);
    try {
      const { error } = await supabase
        .from('nres_hours_entries')
        .update({
          invoice_status: 'invoiced',
          invoiced_date: date,
          invoiced_by: user.id
        } as any)
        .in('id', entryIds);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        entryIds.includes(e.id)
          ? { ...e, invoice_status: 'invoiced', invoiced_date: date, invoiced_by: user.id }
          : e
      ));
      setSelectedEntries(new Set());
      setShowInvoiceDialog(false);
      toast.success(`${entryIds.length} ${entryIds.length === 1 ? 'entry' : 'entries'} marked as invoiced`);
    } catch (error) {
      console.error('Error marking invoiced:', error);
      toast.error('Failed to mark entries as invoiced');
    } finally {
      setMarkingInvoiced(false);
    }
  };

  const handleUnmarkInvoiced = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('nres_hours_entries')
        .update({
          invoice_status: null,
          invoiced_date: null,
          invoiced_by: null
        } as any)
        .eq('id', entryId);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        e.id === entryId
          ? { ...e, invoice_status: null, invoiced_date: null, invoiced_by: null }
          : e
      ));
      toast.success('Invoice status removed');
    } catch (error) {
      console.error('Error unmarking invoiced:', error);
      toast.error('Failed to remove invoice status');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSummarySort = (field: SummarySortField) => {
    if (summarySortField === field) {
      setSummarySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSummarySortField(field);
      setSummarySortDirection('desc');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const entry = detailedEntries.find((e) => e.id === entryId);
    const confirmText = entry
      ? `Delete this entry?\n\n${entry.user_name}\n${format(parseISO(entry.work_date), 'dd/MM/yyyy')} ${entry.start_time.substring(0, 5)}–${entry.end_time.substring(0, 5)}\n${entry.activity_type || 'No activity'}\n${entry.description || 'No description'}`
      : 'Are you sure you want to delete this entry?';

    if (!confirm(confirmText)) return;
    
    try {
      const { error } = await supabase
        .from('nres_hours_entries')
        .delete()
        .eq('id', entryId);
      
      if (error) throw error;
      
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast.success('Entry deleted');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const exportCSV = () => {
    const BOM = '\uFEFF';
    const lines = [
      'NRES Claims Summary Report',
      `Period: ${format(parseISO(startDate), 'dd/MM/yyyy')} to ${format(parseISO(endDate), 'dd/MM/yyyy')}`,
      `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      '',
      'User Name,Practice,Date,Start Time,End Time,Hours,Activity Type,Description,Amount,Entered By,Invoice Status,Invoiced Date,Invoiced By'
    ];

    detailedEntries
      .sort((a, b) => a.user_name.localeCompare(b.user_name) || a.work_date.localeCompare(b.work_date))
      .forEach(entry => {
        const description = entry.description ? `"${entry.description.replace(/"/g, '""')}"` : '';
        const invoiceStatus = entry.invoice_status === 'invoiced' ? 'Invoiced' : 'Pending';
        const invoicedDate = entry.invoiced_date ? format(parseISO(entry.invoiced_date), 'dd/MM/yyyy') : '';
        const invoicedByName = entry.invoiced_by ? (userProfiles[entry.invoiced_by]?.name || entry.invoiced_by.substring(0, 8) + '...') : '';
        lines.push(`"${entry.user_name}","${entry.practice_name}",${format(parseISO(entry.work_date), 'dd/MM/yyyy')},${entry.start_time.substring(0, 5)},${entry.end_time.substring(0, 5)},${Number(entry.duration_hours).toFixed(2)},"${entry.activity_type || ''}",${description},£${entry.amount.toFixed(2)},"${entry.entered_by_name}","${invoiceStatus}","${invoicedDate}","${invoicedByName}"`);
      });

    lines.push('');
    lines.push(`GRAND TOTAL,,,,,${grandTotalHours.toFixed(2)},,,,£${grandTotalAmount.toFixed(2)}`);
    lines.push('');
    lines.push('Note: "Entered By" shows the user who created each time entry for audit purposes.');

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

            {/* Date Range and Filters */}
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
              <div>
                <Label className="text-xs">Filter by Name</Label>
                <Select value={filterName} onValueChange={setFilterName}>
                  <SelectTrigger className="w-40 mt-1">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Filter by Practice</Label>
                <Select value={filterPractice} onValueChange={setFilterPractice}>
                  <SelectTrigger className="w-48 mt-1">
                    <SelectValue placeholder="All Practices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Practices</SelectItem>
                    {uniquePractices.map(practice => (
                      <SelectItem key={practice} value={practice}>{practice}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Invoice Status</Label>
                <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                  <SelectTrigger className="w-36 mt-1">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                  </SelectContent>
                </Select>
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
              <>
                {/* Floating action bar for bulk invoicing */}
                {selectedEntries.size > 0 && (
                  <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border bg-background p-3 shadow-md">
                    <span className="text-sm font-medium">
                      {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'} selected
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
                        setShowInvoiceDialog(true);
                      }}
                    >
                      <FileCheck className="w-4 h-4 mr-1" />
                      Mark as Invoiced
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEntries(new Set())}
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}

                {/* View Mode Tabs */}
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'summary' | 'detailed' | 'practice')}>
                  <div className="flex items-center justify-between">
                    <TabsList>
                      <TabsTrigger value="summary" className="gap-2">
                        <LayoutGrid className="w-4 h-4" />
                        Summary
                      </TabsTrigger>
                      <TabsTrigger value="detailed" className="gap-2">
                        <List className="w-4 h-4" />
                        Detailed
                      </TabsTrigger>
                      <TabsTrigger value="practice" className="gap-2">
                        <Users className="w-4 h-4" />
                        By Practice
                      </TabsTrigger>
                    </TabsList>
                    <span className="text-sm text-muted-foreground">
                      {detailedEntries.length} entries
                    </span>
                  </div>

                  {/* Summary View */}
                  <TabsContent value="summary">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSummarySort('user_name')}>
                              <div className="flex items-center gap-1">
                                User Name
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSummarySort('practice_name')}>
                              <div className="flex items-center gap-1">
                                Practice
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead className="text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSummarySort('entry_count')}>
                              <div className="flex items-center justify-center gap-1">
                                Entries
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSummarySort('total_hours')}>
                              <div className="flex items-center justify-end gap-1">
                                Total Hours
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSummarySort('total_amount')}>
                              <div className="flex items-center justify-end gap-1">
                                Total Amount
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedUserClaims.map((claim) => (
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
                            <TableCell>GRAND TOTAL</TableCell>
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
                  </TabsContent>

                  {/* Detailed View */}
                  <TabsContent value="detailed">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allSelectableSelected}
                                onCheckedChange={handleToggleSelectAll}
                                aria-label="Select all"
                              />
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('work_date')}
                            >
                              <div className="flex items-center gap-1">
                                Date
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('user_name')}
                            >
                              <div className="flex items-center gap-1">
                                User
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('practice_name')}
                            >
                              <div className="flex items-center gap-1">
                                Practice
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Activity</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('duration_hours')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Hours
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('amount')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Amount
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort('entered_by_name')}
                            >
                              <div className="flex items-center gap-1">
                                Entered By
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailedEntries.map((entry) => {
                            const isInvoiced = entry.invoice_status === 'invoiced';
                            const invoicedByName = entry.invoiced_by ? (userProfiles[entry.invoiced_by]?.name || entry.invoiced_by.substring(0, 8) + '...') : '';
                            
                            return (
                              <TableRow key={entry.id} className={isInvoiced ? 'bg-green-50/50' : ''}>
                                <TableCell>
                                  {!isInvoiced ? (
                                    <Checkbox
                                      checked={selectedEntries.has(entry.id)}
                                      onCheckedChange={() => handleToggleSelect(entry.id)}
                                      aria-label={`Select entry ${entry.id}`}
                                    />
                                  ) : null}
                                </TableCell>
                                <TableCell>{format(parseISO(entry.work_date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="font-medium">{entry.user_name}</TableCell>
                                <TableCell className="text-muted-foreground">{entry.practice_name}</TableCell>
                                <TableCell>
                                  {entry.start_time.substring(0, 5)} - {entry.end_time.substring(0, 5)}
                                </TableCell>
                                <TableCell>{entry.activity_type || '-'}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {entry.description || '-'}
                                </TableCell>
                                <TableCell className="text-right">{Number(entry.duration_hours).toFixed(2)}</TableCell>
                                <TableCell className="text-right font-medium">£{formatCurrency(entry.amount)}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{entry.entered_by_name}</TableCell>
                                <TableCell>
                                  {isInvoiced ? (
                                    <HoverCard>
                                      <HoverCardTrigger asChild>
                                        <Badge className="bg-green-600 hover:bg-green-700 text-white cursor-pointer text-xs">
                                          Invoiced
                                        </Badge>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="w-56" align="start">
                                        <div className="space-y-1 text-xs">
                                          <p><span className="font-semibold">Date:</span> {entry.invoiced_date ? format(parseISO(entry.invoiced_date), 'dd/MM/yyyy') : '-'}</p>
                                          <p><span className="font-semibold">Marked by:</span> {invoicedByName}</p>
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Pending</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {isInvoiced ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => handleUnmarkInvoiced(entry.id)}
                                        title="Remove invoice status"
                                      >
                                        <Undo2 className="w-4 h-4" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => {
                                          setInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
                                          setSelectedEntries(new Set([entry.id]));
                                          setShowInvoiceDialog(true);
                                        }}
                                        title="Mark as invoiced"
                                      >
                                        <FileCheck className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteEntry(entry.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="font-bold bg-muted">
                            <TableCell></TableCell>
                            <TableCell colSpan={6}>GRAND TOTAL</TableCell>
                            <TableCell className="text-right">{grandTotalHours.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-lg">£{formatCurrency(grandTotalAmount)}</TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* Practice Summary View */}
                  <TabsContent value="practice">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => { if (practiceSortField === 'practice') setPracticeSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setPracticeSortField('practice'); setPracticeSortDirection('asc'); } }}>
                              <div className="flex items-center gap-1">Practice <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="text-center cursor-pointer hover:bg-muted/50" onClick={() => { if (practiceSortField === 'claimCount') setPracticeSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setPracticeSortField('claimCount'); setPracticeSortDirection('desc'); } }}>
                              <div className="flex items-center justify-center gap-1">Claims <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => { if (practiceSortField === 'totalHours') setPracticeSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setPracticeSortField('totalHours'); setPracticeSortDirection('desc'); } }}>
                              <div className="flex items-center justify-end gap-1">Total Hours <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => { if (practiceSortField === 'totalAmount') setPracticeSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setPracticeSortField('totalAmount'); setPracticeSortDirection('desc'); } }}>
                              <div className="flex items-center justify-end gap-1">Total Amount <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {practiceSummary.map(row => (
                            <TableRow key={row.practice}>
                              <TableCell className="font-medium">{row.practice}</TableCell>
                              <TableCell className="text-center">{row.claimCount}</TableCell>
                              <TableCell className="text-right">{row.totalHours.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium">£{formatCurrency(row.totalAmount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2 font-bold bg-muted/50">
                            <TableCell>Grand Total</TableCell>
                            <TableCell className="text-center">{practiceSummary.reduce((s, r) => s + r.claimCount, 0)}</TableCell>
                            <TableCell className="text-right">{practiceSummary.reduce((s, r) => s + r.totalHours, 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">£{formatCurrency(practiceSummary.reduce((s, r) => s + r.totalAmount, 0))}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Mark as Invoiced Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Invoiced to SNO/PML</DialogTitle>
            <DialogDescription>
              {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'} will be marked as invoiced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="invoice-date" className="text-sm">Invoice Date</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} disabled={markingInvoiced}>
              Cancel
            </Button>
            <Button
              onClick={() => handleMarkInvoiced(Array.from(selectedEntries), invoiceDate)}
              disabled={markingInvoiced || !invoiceDate}
            >
              {markingInvoiced ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileCheck className="w-4 h-4 mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
