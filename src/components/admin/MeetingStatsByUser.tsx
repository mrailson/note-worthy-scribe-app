import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface UserMeetingStats {
  user_id: string;
  email: string;
  full_name: string | null;
  meeting_count: number;
  completed_meetings: number;
  recording_meetings: number;
  first_meeting_date: string | null;
  latest_meeting_date: string | null;
}

export const MeetingStatsByUser = () => {
  const [stats, setStats] = useState<UserMeetingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMeetings, setTotalMeetings] = useState(0);

  useEffect(() => {
    fetchMeetingStats();
  }, []);

  const fetchMeetingStats = async () => {
    try {
      setLoading(true);
      console.log('[MeetingStatsByUser] Fetching via RPC get_meeting_stats_by_user');

      const { data, error } = await supabase.rpc('get_meeting_stats_by_user');
      if (error) {
        console.error('[MeetingStatsByUser] RPC error:', error);
        setStats([]);
        setTotalMeetings(0);
        return;
      }

      const results = (data || []) as UserMeetingStats[];
      console.log(`[MeetingStatsByUser] Received ${results.length} users`);

      // Only include users with >=1 meeting (RPC already ensures this, but keep explicit)
      const filtered = results.filter(r => (r.meeting_count || 0) >= 1);
      filtered.sort((a, b) => b.meeting_count - a.meeting_count);

      setStats(filtered);
      setTotalMeetings(filtered.reduce((sum, s) => sum + (s.meeting_count || 0), 0));
    } catch (error) {
      console.error('[MeetingStatsByUser] Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Meetings by User
          </CardTitle>
          <CardDescription>Loading meeting statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Meetings by User
        </CardTitle>
        <CardDescription>
          Total meetings in system: <Badge variant="secondary">{totalMeetings}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No meetings found in the system
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Recording</TableHead>
                  <TableHead>First Meeting</TableHead>
                  <TableHead>Latest Meeting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.user_id}>
                    <TableCell className="font-medium">
                      {stat.full_name || 'Unnamed User'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stat.email}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{stat.meeting_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-green-600">
                        {stat.completed_meetings}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.recording_meetings > 0 ? (
                        <Badge variant="outline" className="text-orange-600">
                          {stat.recording_meetings}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stat.first_meeting_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(stat.first_meeting_date), 'dd/MM/yyyy')}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stat.latest_meeting_date ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(stat.latest_meeting_date), 'dd/MM/yyyy HH:mm')}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
