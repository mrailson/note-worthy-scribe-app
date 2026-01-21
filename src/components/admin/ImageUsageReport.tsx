import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Image, Clock, Users, Calendar, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortField = 'user' | 'image_studio' | 'quick_pick' | 'infographic' | 'total' | 'last_generated';
type SortDirection = 'asc' | 'desc';

interface UserImageStats {
  user_id: string;
  email: string;
  full_name: string | null;
  image_studio_count: number;
  quick_pick_count: number;
  infographic_count: number;
  total_images: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  last_generated: string | null;
}

interface SystemStats {
  image_studio_total: number;
  quick_pick_total: number;
  infographic_total: number;
  total_images: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  unique_users: number;
}

export const ImageUsageReport = () => {
  const [userStats, setUserStats] = useState<UserImageStats[]>([]);
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
        case 'image_studio': aVal = a.image_studio_count; bVal = b.image_studio_count; break;
        case 'quick_pick': aVal = a.quick_pick_count; bVal = b.quick_pick_count; break;
        case 'infographic': aVal = a.infographic_count; bVal = b.infographic_count; break;
        case 'total': aVal = a.total_images; bVal = b.total_images; break;
        case 'last_generated': 
          aVal = a.last_generated ? new Date(a.last_generated).getTime() : 0; 
          bVal = b.last_generated ? new Date(b.last_generated).getTime() : 0; 
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
    fetchImageUsageStats();
  }, []);

  const fetchImageUsageStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_image_usage_report');

      if (error) {
        console.error('Error fetching image usage report:', error);
        return;
      }

      const results = (data || []) as UserImageStats[];

      // Calculate system-wide totals
      const systemStatsCalc: SystemStats = {
        image_studio_total: results.reduce((sum, r) => sum + (r.image_studio_count || 0), 0),
        quick_pick_total: results.reduce((sum, r) => sum + (r.quick_pick_count || 0), 0),
        infographic_total: results.reduce((sum, r) => sum + (r.infographic_count || 0), 0),
        total_images: results.reduce((sum, r) => sum + (r.total_images || 0), 0),
        last_24h: results.reduce((sum, r) => sum + (r.last_24h || 0), 0),
        last_7d: results.reduce((sum, r) => sum + (r.last_7d || 0), 0),
        last_30d: results.reduce((sum, r) => sum + (r.last_30d || 0), 0),
        unique_users: results.length,
      };

      setSystemStats(systemStatsCalc);
      setUserStats(results);
    } catch (error) {
      console.error('Error fetching image usage stats:', error);
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
            <span className="text-sm text-muted-foreground">images</span>
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
            <span className="text-sm text-muted-foreground">images</span>
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
            <span className="text-sm text-muted-foreground">images</span>
          </div>
        </div>

        {/* All Time */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">All Time</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{systemStats?.total_images || 0}</span>
            <span className="text-sm text-muted-foreground">images</span>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            <div className="flex justify-between">
              <span>Unique users:</span>
              <span className="font-medium text-foreground">{systemStats?.unique_users || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Source Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Breakdown by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{systemStats?.image_studio_total || 0}</div>
              <div className="text-sm text-muted-foreground">Image Studio</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{systemStats?.quick_pick_total || 0}</div>
              <div className="text-sm text-muted-foreground">Quick Pick</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{systemStats?.infographic_total || 0}</div>
              <div className="text-sm text-muted-foreground">Infographic</div>
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
                <SortableHeader field="image_studio" className="text-center">Image Studio</SortableHeader>
                <SortableHeader field="quick_pick" className="text-center">Quick Pick</SortableHeader>
                <SortableHeader field="infographic" className="text-center">Infographic</SortableHeader>
                <SortableHeader field="total" className="text-center">Total</SortableHeader>
                <SortableHeader field="last_generated" className="text-right">Last Generated</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUserStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No images generated
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
                      {user.image_studio_count > 0 ? (
                        <Badge variant="outline" className="text-purple-600">{user.image_studio_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.quick_pick_count > 0 ? (
                        <Badge variant="outline" className="text-blue-600">{user.quick_pick_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.infographic_count > 0 ? (
                        <Badge variant="outline" className="text-green-600">{user.infographic_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{user.total_images}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {user.last_generated ? (
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(user.last_generated), 'dd/MM/yyyy HH:mm')}
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
