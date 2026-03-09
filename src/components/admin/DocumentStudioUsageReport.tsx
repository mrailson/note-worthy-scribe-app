import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText,
  RefreshCw,
  Calendar,
  Clock,
  TrendingUp,
  Hash,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Type,
  ListOrdered,
} from 'lucide-react';

interface UserStats {
  user_id: string;
  user_name: string;
  user_email: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  totalWords: number;
  lastGeneratedAt: string | null;
  topDocumentType: string | null;
}

interface RecentUsage {
  id: string;
  user_email: string;
  user_name: string | null;
  document_type: string;
  document_type_name: string | null;
  title: string | null;
  free_form_request: string | null;
  request_summary: string | null;
  word_count: number;
  action: string;
  created_at: string;
}

type SortField = 'user_name' | 'today' | 'thisWeek' | 'thisMonth' | 'allTime' | 'totalWords' | 'lastGeneratedAt';
type SortDir = 'asc' | 'desc';

type RecentSortField = 'created_at' | 'user_name' | 'document_type_name' | 'word_count' | 'title';

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function DocumentStudioUsageReport() {
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [recentUsage, setRecentUsage] = useState<RecentUsage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('allTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [recentSortField, setRecentSortField] = useState<RecentSortField>('created_at');
  const [recentSortDir, setRecentSortDir] = useState<SortDir>('desc');
  const [activeView, setActiveView] = useState('users');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [{ data: statsData, error: statsError }, { data: recentData, error: recentError }] = await Promise.all([
        supabase.rpc('get_document_studio_stats_by_user'),
        supabase.rpc('get_document_studio_recent_usage', { limit_count: 100 }),
      ]);

      if (statsError) throw statsError;
      if (recentError) throw recentError;

      const mapped: UserStats[] = (statsData || []).map((row: any) => ({
        user_id: row.user_id,
        user_name: row.full_name || 'Unknown',
        user_email: row.email || '',
        today: Number(row.today_count) || 0,
        thisWeek: Number(row.this_week_count) || 0,
        thisMonth: Number(row.this_month_count) || 0,
        allTime: Number(row.all_time_count) || 0,
        totalWords: Number(row.total_words) || 0,
        lastGeneratedAt: row.last_generated_at,
        topDocumentType: row.top_document_type,
      }));

      mapped.sort((a, b) => b.allTime - a.allTime);
      setUserStats(mapped);
      setRecentUsage((recentData || []) as RecentUsage[]);
    } catch (error) {
      console.error('Error fetching Document Studio stats:', error);
      toast.error('Failed to fetch Document Studio statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Aggregate totals
  const totals = useMemo(() => {
    return userStats.reduce(
      (acc, u) => ({
        today: acc.today + u.today,
        thisWeek: acc.thisWeek + u.thisWeek,
        thisMonth: acc.thisMonth + u.thisMonth,
        allTime: acc.allTime + u.allTime,
        totalWords: acc.totalWords + u.totalWords,
      }),
      { today: 0, thisWeek: 0, thisMonth: 0, allTime: 0, totalWords: 0 }
    );
  }, [userStats]);

  // Sorted user stats
  const sortedUsers = useMemo(() => {
    const filtered = selectedUserId === 'all' ? [...userStats] : userStats.filter(u => u.user_id === selectedUserId);
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'lastGeneratedAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (sortField === 'user_name') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [userStats, selectedUserId, sortField, sortDir]);

  // Sorted recent usage
  const sortedRecent = useMemo(() => {
    const copy = [...recentUsage];
    copy.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (recentSortField) {
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'user_name':
          aVal = (a.user_name || a.user_email || '').toLowerCase();
          bVal = (b.user_name || b.user_email || '').toLowerCase();
          break;
        case 'document_type_name':
          aVal = (a.document_type_name || '').toLowerCase();
          bVal = (b.document_type_name || '').toLowerCase();
          break;
        case 'word_count':
          aVal = a.word_count;
          bVal = b.word_count;
          break;
        case 'title':
          aVal = (a.title || '').toLowerCase();
          bVal = (b.title || '').toLowerCase();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return recentSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return recentSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [recentUsage, recentSortField, recentSortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleRecentSort = (field: RecentSortField) => {
    if (recentSortField === field) {
      setRecentSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setRecentSortField(field);
      setRecentSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Document Studio Statistics
          </h2>
          <p className="text-muted-foreground">
            Document generation usage metrics and request analysis
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.today.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">documents generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.thisWeek.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">documents generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.thisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">documents generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4" />
              All Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.allTime.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">total documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Type className="h-4 w-4" />
              Total Words
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalWords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">words generated</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed detail views */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            By User
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            Recent Requests
          </TabsTrigger>
        </TabsList>

        {/* Users Table */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Document Studio — Usage By User
                  </CardTitle>
                  <CardDescription>Click column headers to sort</CardDescription>
                </div>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Filter by user..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {userStats.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.user_name || user.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort('user_name')}>
                      <span className="flex items-center">User <SortIcon field="user_name" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('today')}>
                      <span className="flex items-center justify-end">Today <SortIcon field="today" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('thisWeek')}>
                      <span className="flex items-center justify-end">This Week <SortIcon field="thisWeek" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('thisMonth')}>
                      <span className="flex items-center justify-end">This Month <SortIcon field="thisMonth" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('allTime')}>
                      <span className="flex items-center justify-end">All Time <SortIcon field="allTime" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('totalWords')}>
                      <span className="flex items-center justify-end">Words <SortIcon field="totalWords" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('lastGeneratedAt')}>
                      <span className="flex items-center justify-end">Last Generated <SortIcon field="lastGeneratedAt" sortField={sortField} sortDir={sortDir} /></span>
                    </TableHead>
                    <TableHead>Top Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No Document Studio usage data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.user_name}</div>
                            <div className="text-xs text-muted-foreground">{user.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{user.today}</TableCell>
                        <TableCell className="text-right">{user.thisWeek}</TableCell>
                        <TableCell className="text-right">{user.thisMonth}</TableCell>
                        <TableCell className="text-right font-medium">{user.allTime}</TableCell>
                        <TableCell className="text-right">{user.totalWords.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{formatDateTime(user.lastGeneratedAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {user.topDocumentType || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Requests Table */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Recent Document Requests
              </CardTitle>
              <CardDescription>
                Last 100 document generation requests with summary details — click headers to sort
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleRecentSort('created_at')}>
                      <span className="flex items-center">Date <SortIcon field="created_at" sortField={recentSortField} sortDir={recentSortDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleRecentSort('user_name')}>
                      <span className="flex items-center">User <SortIcon field="user_name" sortField={recentSortField} sortDir={recentSortDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleRecentSort('document_type_name')}>
                      <span className="flex items-center">Type <SortIcon field="document_type_name" sortField={recentSortField} sortDir={recentSortDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleRecentSort('title')}>
                      <span className="flex items-center">Title <SortIcon field="title" sortField={recentSortField} sortDir={recentSortDir} /></span>
                    </TableHead>
                    <TableHead>Request Summary</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleRecentSort('word_count')}>
                      <span className="flex items-center justify-end">Words <SortIcon field="word_count" sortField={recentSortField} sortDir={recentSortDir} /></span>
                    </TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No recent requests available
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRecent.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDateTime(row.created_at)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{row.user_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{row.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{row.document_type_name || row.document_type}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={row.title || ''}>
                          {row.title || '-'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px]">
                          <div className="truncate text-muted-foreground" title={row.request_summary || row.free_form_request || ''}>
                            {row.request_summary || row.free_form_request || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{row.word_count?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-xs capitalize">{row.action}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
