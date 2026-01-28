import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Languages, MessageSquare, Users, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface TranslationUserStats {
  user_id: string;
  email: string;
  full_name: string | null;
  total_sessions: number;
  total_messages: number;
  languages_used: string[] | null;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  last_session_at: string | null;
  avg_messages_per_session: number;
}

export const TranslationUsageReport = () => {
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<TranslationUserStats[]>([]);

  useEffect(() => {
    fetchTranslationStats();
  }, []);

  const fetchTranslationStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_translation_usage_report');
      
      if (error) throw error;
      setUserStats(data || []);
    } catch (error) {
      console.error('Error fetching translation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = userStats.reduce((acc, user) => ({
    total_sessions: acc.total_sessions + user.total_sessions,
    total_messages: acc.total_messages + user.total_messages,
    last_24h: acc.last_24h + user.last_24h,
    last_7d: acc.last_7d + user.last_7d,
    last_30d: acc.last_30d + user.last_30d,
  }), { total_sessions: 0, total_messages: 0, last_24h: 0, last_7d: 0, last_30d: 0 });

  // Get all unique languages
  const allLanguages = [...new Set(userStats.flatMap(u => u.languages_used || []))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              <div>
                <div className="text-2xl font-bold text-cyan-600">{userStats.length}</div>
                <div className="text-xs text-muted-foreground">Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-2xl font-bold text-emerald-600">{totals.total_sessions}</div>
                <div className="text-xs text-muted-foreground">Total Sessions</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-600" />
              <div>
                <div className="text-2xl font-bold text-violet-600">{totals.total_messages}</div>
                <div className="text-xs text-muted-foreground">Total Phrases</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-600">{allLanguages.length}</div>
                <div className="text-xs text-muted-foreground">Languages Used</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Languages Used */}
      {allLanguages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Languages Translated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allLanguages.sort().map(lang => (
                <Badge key={lang} variant="secondary" className="text-sm">
                  {lang}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage by User</CardTitle>
          <CardDescription>Translation sessions and phrases per user</CardDescription>
        </CardHeader>
        <CardContent>
          {userStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No translation usage data yet. Start using the Translation service to see statistics here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-center">Phrases</TableHead>
                    <TableHead className="text-center">Avg/Session</TableHead>
                    <TableHead className="text-center">24h</TableHead>
                    <TableHead className="text-center">7d</TableHead>
                    <TableHead className="text-center">30d</TableHead>
                    <TableHead>Languages</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStats.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{user.total_sessions}</TableCell>
                      <TableCell className="text-center">{user.total_messages}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{user.avg_messages_per_session}</TableCell>
                      <TableCell className="text-center">{user.last_24h}</TableCell>
                      <TableCell className="text-center">{user.last_7d}</TableCell>
                      <TableCell className="text-center">{user.last_30d}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(user.languages_used || []).slice(0, 3).map(lang => (
                            <Badge key={lang} variant="outline" className="text-xs">
                              {lang}
                            </Badge>
                          ))}
                          {(user.languages_used?.length || 0) > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(user.languages_used?.length || 0) - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_session_at 
                          ? format(new Date(user.last_session_at), 'dd MMM HH:mm')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total ({userStats.length} users)</TableCell>
                    <TableCell className="text-center">{totals.total_sessions}</TableCell>
                    <TableCell className="text-center">{totals.total_messages}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {totals.total_sessions > 0 
                        ? (totals.total_messages / totals.total_sessions).toFixed(1) 
                        : 0}
                    </TableCell>
                    <TableCell className="text-center">{totals.last_24h}</TableCell>
                    <TableCell className="text-center">{totals.last_7d}</TableCell>
                    <TableCell className="text-center">{totals.last_30d}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{allLanguages.length} languages</Badge>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
