import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  Building, 
  TrendingUp,
  Calendar,
  PoundSterling,
  TestTube
} from 'lucide-react';

interface PracticeStats {
  practice_ods: string;
  practice_name: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  previousMonth: number;
  allTime: number;
  isTestPatient: boolean;
}

interface UserStats {
  user_id: string;
  uploader_name: string;
  uploader_email: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  previousMonth: number;
  allTime: number;
}

const COST_PER_PAGE = 0.05; // 5 pence per page
const TEST_NHS_NUMBER = '9434765919';

const formatCurrency = (amount: number): string => {
  return `£${amount.toFixed(2)}`;
};

const formatNhsNumber = (nhs: string): string => {
  if (!nhs || nhs.length !== 10) return nhs;
  return `${nhs.slice(0, 3)} ${nhs.slice(3, 6)} ${nhs.slice(6)}`;
};

export function LGCaptureStats() {
  const [loading, setLoading] = useState(true);
  const [practiceStats, setPracticeStats] = useState<PracticeStats[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [totals, setTotals] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    previousMonth: 0,
    allTime: 0
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Get date boundaries
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      // Week start (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).toISOString();
      
      // Month start
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // Previous month
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      // Fetch all completed scans
      const { data: scans, error } = await supabase
        .from('lg_patients')
        .select('id, practice_ods, user_id, uploader_name, nhs_number, images_count, created_at')
        .eq('job_status', 'succeeded')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get practice names
      const { data: practices } = await supabase
        .from('gp_practices')
        .select('practice_code, name');

      const practiceMap = new Map<string, string>();
      practices?.forEach(p => practiceMap.set(p.practice_code, p.name));

      // Get user emails
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email');

      const emailMap = new Map<string, string>();
      profiles?.forEach(p => emailMap.set(p.user_id, p.email));

      // Process stats by practice
      const practiceStatsMap = new Map<string, PracticeStats>();
      const userStatsMap = new Map<string, UserStats>();
      let grandTotals = { today: 0, thisWeek: 0, thisMonth: 0, previousMonth: 0, allTime: 0 };

      scans?.forEach(scan => {
        const scanDate = new Date(scan.created_at);
        const pages = scan.images_count || 0;
        const isTestPatient = scan.nhs_number?.replace(/\s/g, '') === TEST_NHS_NUMBER;
        
        // Determine practice key - separate test patient
        const practiceKey = isTestPatient 
          ? `TEST_${scan.practice_ods}` 
          : scan.practice_ods;
        
        const practiceName = isTestPatient 
          ? `Test Patient (James Wilson NHS ${formatNhsNumber(TEST_NHS_NUMBER)})`
          : (practiceMap.get(scan.practice_ods) || scan.practice_ods);

        // Get or create practice stats
        if (!practiceStatsMap.has(practiceKey)) {
          practiceStatsMap.set(practiceKey, {
            practice_ods: scan.practice_ods,
            practice_name: practiceName,
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            previousMonth: 0,
            allTime: 0,
            isTestPatient
          });
        }
        const pStats = practiceStatsMap.get(practiceKey)!;

        // Get or create user stats
        const userKey = scan.user_id;
        if (!userStatsMap.has(userKey)) {
          userStatsMap.set(userKey, {
            user_id: scan.user_id,
            uploader_name: scan.uploader_name || 'Unknown',
            uploader_email: emailMap.get(scan.user_id) || '',
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            previousMonth: 0,
            allTime: 0
          });
        }
        const uStats = userStatsMap.get(userKey)!;

        // All time
        pStats.allTime += pages;
        uStats.allTime += pages;
        if (!isTestPatient) grandTotals.allTime += pages;

        // Today
        if (scanDate >= new Date(todayStart)) {
          pStats.today += pages;
          uStats.today += pages;
          if (!isTestPatient) grandTotals.today += pages;
        }

        // This week
        if (scanDate >= new Date(weekStart)) {
          pStats.thisWeek += pages;
          uStats.thisWeek += pages;
          if (!isTestPatient) grandTotals.thisWeek += pages;
        }

        // This month
        if (scanDate >= new Date(monthStart)) {
          pStats.thisMonth += pages;
          uStats.thisMonth += pages;
          if (!isTestPatient) grandTotals.thisMonth += pages;
        }

        // Previous month
        if (scanDate >= new Date(prevMonthStart) && scanDate <= new Date(prevMonthEnd)) {
          pStats.previousMonth += pages;
          uStats.previousMonth += pages;
          if (!isTestPatient) grandTotals.previousMonth += pages;
        }
      });

      // Convert to arrays and sort
      const practiceStatsArray = Array.from(practiceStatsMap.values())
        .sort((a, b) => {
          // Test patients last
          if (a.isTestPatient && !b.isTestPatient) return 1;
          if (!a.isTestPatient && b.isTestPatient) return -1;
          return b.allTime - a.allTime;
        });

      const userStatsArray = Array.from(userStatsMap.values())
        .sort((a, b) => b.allTime - a.allTime);

      setPracticeStats(practiceStatsArray);
      setUserStats(userStatsArray);
      setTotals(grandTotals);

    } catch (error) {
      console.error('Error fetching LG Capture stats:', error);
      toast.error('Failed to fetch LG Capture statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const generateBillingStatement = (practice: PracticeStats) => {
    const now = new Date();
    const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const prevMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const statement = `
LLOYD GEORGE DIGITISATION BILLING STATEMENT
============================================

Practice: ${practice.practice_name}
ODS Code: ${practice.practice_ods}
Generated: ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}

CURRENT MONTH (${monthName})
----------------------------
Pages Scanned: ${practice.thisMonth.toLocaleString()}
Cost @ 5p/page: ${formatCurrency(practice.thisMonth * COST_PER_PAGE)}

PREVIOUS MONTH (${prevMonthName})
----------------------------
Pages Scanned: ${practice.previousMonth.toLocaleString()}
Cost @ 5p/page: ${formatCurrency(practice.previousMonth * COST_PER_PAGE)}

ALL TIME TOTAL
----------------------------
Pages Scanned: ${practice.allTime.toLocaleString()}
Cost @ 5p/page: ${formatCurrency(practice.allTime * COST_PER_PAGE)}

----------------------------
Payment Terms: Net 30 days
    `.trim();

    // Download as text file
    const blob = new Blob([statement], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LG_Billing_${practice.practice_ods}_${now.toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Billing statement downloaded');
  };

  // Calculate billable totals (excluding test patients)
  const billableStats = practiceStats.filter(p => !p.isTestPatient);
  const billableTotals = {
    thisMonth: billableStats.reduce((sum, p) => sum + p.thisMonth, 0),
    previousMonth: billableStats.reduce((sum, p) => sum + p.previousMonth, 0),
    allTime: billableStats.reduce((sum, p) => sum + p.allTime, 0)
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.today.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">pages scanned</p>
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
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.thisMonth * COST_PER_PAGE)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PoundSterling className="h-4 w-4" />
              Previous Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.previousMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.previousMonth * COST_PER_PAGE)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.allTime.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.allTime * COST_PER_PAGE)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Practice Stats Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Pages Scanned by Practice
              </CardTitle>
              <CardDescription>
                Excludes blank pages. Cost: 5p per page.
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStats}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practice</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">This Week</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">Prev Month</TableHead>
                <TableHead className="text-right">All Time</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {practiceStats.map((practice) => (
                <TableRow 
                  key={`${practice.practice_ods}-${practice.isTestPatient}`}
                  className={practice.isTestPatient ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {practice.isTestPatient && (
                        <TestTube className="h-4 w-4 text-amber-600" />
                      )}
                      <div>
                        <div className="font-medium">{practice.practice_name}</div>
                        <div className="text-xs text-muted-foreground">{practice.practice_ods}</div>
                      </div>
                      {practice.isTestPatient && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          Test
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{practice.today.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{practice.thisWeek.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{practice.thisMonth.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{practice.previousMonth.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{practice.allTime.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-primary font-semibold">
                    {formatCurrency(practice.allTime * COST_PER_PAGE)}
                  </TableCell>
                  <TableCell>
                    {!practice.isTestPatient && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateBillingStatement(practice)}
                        title="Download billing statement"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {practiceStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No LG Capture data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Billing Summary */}
          {billableStats.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />
                  Billable Summary (excludes test patients)
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">This Month</p>
                    <p className="font-mono font-semibold text-lg">
                      {billableTotals.thisMonth.toLocaleString()} pages
                    </p>
                    <p className="text-primary font-semibold">
                      {formatCurrency(billableTotals.thisMonth * COST_PER_PAGE)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Previous Month</p>
                    <p className="font-mono font-semibold text-lg">
                      {billableTotals.previousMonth.toLocaleString()} pages
                    </p>
                    <p className="text-primary font-semibold">
                      {formatCurrency(billableTotals.previousMonth * COST_PER_PAGE)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">All Time Total</p>
                    <p className="font-mono font-semibold text-lg">
                      {billableTotals.allTime.toLocaleString()} pages
                    </p>
                    <p className="text-primary font-semibold">
                      {formatCurrency(billableTotals.allTime * COST_PER_PAGE)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pages Scanned by User
          </CardTitle>
          <CardDescription>
            Individual user scanning activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">This Week</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">Prev Month</TableHead>
                <TableHead className="text-right">All Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userStats.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.uploader_name}</div>
                      <div className="text-xs text-muted-foreground">{user.uploader_email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{user.today.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{user.thisWeek.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{user.thisMonth.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{user.previousMonth.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{user.allTime.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {userStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No user data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
