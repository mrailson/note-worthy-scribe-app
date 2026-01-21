import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Presentation, Clock, Users, Calendar, TrendingUp, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortField = 'user' | 'total' | 'slides' | 'avg_slides' | 'last_created';
type SortDirection = 'asc' | 'desc';

interface UserPresentationStats {
  user_id: string;
  email: string;
  full_name: string | null;
  total_presentations: number;
  total_slides: number;
  avg_slides_per_presentation: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  last_created: string | null;
}

interface SystemStats {
  total_presentations: number;
  total_slides: number;
  avg_slides: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  unique_users: number;
}

export const PresentationUsageReport = () => {
  const [userStats, setUserStats] = useState<UserPresentationStats[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={cn("cursor-pointer hover:bg-muted/50 select-none transition-colors", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'desc' 
            ? <ChevronDown className="h-3 w-3" /> 
            : <ChevronUp className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

  const sortedUserStats = useMemo(() => {
    return [...userStats].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;
      
      switch (sortField) {
        case 'user': 
          aVal = a.full_name || a.email; 
          bVal = b.full_name || b.email; 
          break;
        case 'total': aVal = a.total_presentations; bVal = b.total_presentations; break;
        case 'slides': aVal = a.total_slides; bVal = b.total_slides; break;
        case 'avg_slides': aVal = a.avg_slides_per_presentation; bVal = b.avg_slides_per_presentation; break;
        case 'last_created': 
          aVal = a.last_created ? new Date(a.last_created).getTime() : 0; 
          bVal = b.last_created ? new Date(b.last_created).getTime() : 0; 
          break;
      }
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [userStats, sortField, sortDirection]);

  useEffect(() => {
    fetchPresentationUsageStats();
  }, []);

  const fetchPresentationUsageStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_presentation_usage_report');

      if (error) {
        console.error('Error fetching presentation usage report:', error);
        return;
      }

      const results = (data || []) as UserPresentationStats[];

      // Calculate system-wide totals
      const totalPresentations = results.reduce((sum, r) => sum + (r.total_presentations || 0), 0);
      const totalSlides = results.reduce((sum, r) => sum + (r.total_slides || 0), 0);
      
      const systemStatsCalc: SystemStats = {
        total_presentations: totalPresentations,
        total_slides: totalSlides,
        avg_slides: totalPresentations > 0 ? Math.round(totalSlides / totalPresentations) : 0,
        last_24h: results.reduce((sum, r) => sum + (r.last_24h || 0), 0),
        last_7d: results.reduce((sum, r) => sum + (r.last_7d || 0), 0),
        last_30d: results.reduce((sum, r) => sum + (r.last_30d || 0), 0),
        unique_users: results.length,
      };

      setSystemStats(systemStatsCalc);
      setUserStats(results);
    } catch (error) {
      console.error('Error fetching presentation usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Today</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-600">{systemStats?.last_24h || 0}</span>
            <span className="text-sm text-muted-foreground">presentations</span>
          </div>
        </div>

        {/* Last 7 Days */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last 7 Days</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">{systemStats?.last_7d || 0}</span>
            <span className="text-sm text-muted-foreground">presentations</span>
          </div>
        </div>

        {/* Last 30 Days */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last 30 Days</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{systemStats?.last_30d || 0}</span>
            <span className="text-sm text-muted-foreground">presentations</span>
          </div>
        </div>

        {/* All Time */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">All Time</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{systemStats?.total_presentations || 0}</span>
            <span className="text-sm text-muted-foreground">presentations</span>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            <div className="flex justify-between">
              <span>Unique users:</span>
              <span className="font-medium text-foreground">{systemStats?.unique_users || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slides Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Slides Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{systemStats?.total_slides || 0}</div>
              <div className="text-sm text-muted-foreground">Total Slides Generated</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{systemStats?.avg_slides || 0}</div>
              <div className="text-sm text-muted-foreground">Avg Slides per Presentation</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-User Table */}
      <div>
        <h4 className="text-sm font-medium mb-3">Usage by User</h4>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="user">User</SortableHeader>
                <SortableHeader field="total" className="text-center">Presentations</SortableHeader>
                <SortableHeader field="slides" className="text-center">Total Slides</SortableHeader>
                <SortableHeader field="avg_slides" className="text-center">Avg Slides</SortableHeader>
                <SortableHeader field="last_created" className="text-right">Last Created</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUserStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No presentations created
                  </TableCell>
                </TableRow>
              ) : (
                sortedUserStats.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name || 'Unnamed User'}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{user.total_presentations}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-purple-600">{user.total_slides}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">{user.avg_slides_per_presentation}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {user.last_created ? (
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(user.last_created), 'dd/MM/yyyy HH:mm')}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
