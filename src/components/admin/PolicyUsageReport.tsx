import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Clock, Calendar, TrendingUp, Users, ArrowUpDown, Stethoscope, UserCog, ShieldAlert, Lock, AlertTriangle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface PolicyUsageData {
  user_id: string;
  email: string;
  full_name: string | null;
  clinical_count: number;
  hr_count: number;
  health_safety_count: number;
  info_governance_count: number;
  business_continuity_count: number;
  patient_services_count: number;
  total_policies: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  last_created: string | null;
}

type SortField = 'user' | 'clinical' | 'hr' | 'health_safety' | 'info_governance' | 'business_continuity' | 'patient_services' | 'total' | 'last_created';
type SortDirection = 'asc' | 'desc';

export const PolicyUsageReport = () => {
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data: usageData = [], isLoading, error } = useQuery({
    queryKey: ['policy-usage-report'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_policy_usage_report');
      if (error) throw error;
      return (data || []) as PolicyUsageData[];
    },
  });

  const totals = useMemo(() => {
    return usageData.reduce(
      (acc, user) => ({
        today: acc.today + (user.last_24h || 0),
        last7d: acc.last7d + (user.last_7d || 0),
        last30d: acc.last30d + (user.last_30d || 0),
        allTime: acc.allTime + (user.total_policies || 0),
        clinical: acc.clinical + (user.clinical_count || 0),
        hr: acc.hr + (user.hr_count || 0),
        healthSafety: acc.healthSafety + (user.health_safety_count || 0),
        infoGovernance: acc.infoGovernance + (user.info_governance_count || 0),
        businessContinuity: acc.businessContinuity + (user.business_continuity_count || 0),
        patientServices: acc.patientServices + (user.patient_services_count || 0),
      }),
      { today: 0, last7d: 0, last30d: 0, allTime: 0, clinical: 0, hr: 0, healthSafety: 0, infoGovernance: 0, businessContinuity: 0, patientServices: 0 }
    );
  }, [usageData]);

  const sortedData = useMemo(() => {
    return [...usageData].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case 'user':
          aVal = a.full_name || a.email || '';
          bVal = b.full_name || b.email || '';
          break;
        case 'clinical':
          aVal = a.clinical_count || 0;
          bVal = b.clinical_count || 0;
          break;
        case 'hr':
          aVal = a.hr_count || 0;
          bVal = b.hr_count || 0;
          break;
        case 'health_safety':
          aVal = a.health_safety_count || 0;
          bVal = b.health_safety_count || 0;
          break;
        case 'info_governance':
          aVal = a.info_governance_count || 0;
          bVal = b.info_governance_count || 0;
          break;
        case 'business_continuity':
          aVal = a.business_continuity_count || 0;
          bVal = b.business_continuity_count || 0;
          break;
        case 'patient_services':
          aVal = a.patient_services_count || 0;
          bVal = b.patient_services_count || 0;
          break;
        case 'total':
          aVal = a.total_policies || 0;
          bVal = b.total_policies || 0;
          break;
        case 'last_created':
          aVal = a.last_created || '';
          bVal = b.last_created || '';
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [usageData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 font-medium"
        onClick={() => handleSort(field)}
      >
        {children}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load policy usage data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.today}</div>
            <p className="text-xs text-muted-foreground">policies created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last 7 Days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.last7d}</div>
            <p className="text-xs text-muted-foreground">policies created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Last 30 Days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.last30d}</div>
            <p className="text-xs text-muted-foreground">policies created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.allTime}</div>
            <p className="text-xs text-muted-foreground">total policies</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Policy Categories
          </CardTitle>
          <CardDescription>Breakdown by CQC category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Stethoscope className="h-5 w-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totals.clinical}</div>
              <p className="text-xs text-muted-foreground">Clinical</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
              <UserCog className="h-5 w-5 mx-auto mb-1 text-purple-600 dark:text-purple-400" />
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{totals.hr}</div>
              <p className="text-xs text-muted-foreground">HR</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
              <ShieldAlert className="h-5 w-5 mx-auto mb-1 text-amber-600 dark:text-amber-400" />
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{totals.healthSafety}</div>
              <p className="text-xs text-muted-foreground">Health & Safety</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <Lock className="h-5 w-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{totals.infoGovernance}</div>
              <p className="text-xs text-muted-foreground">Info Governance</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-600 dark:text-red-400" />
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{totals.businessContinuity}</div>
              <p className="text-xs text-muted-foreground">Business Continuity</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-teal-50 dark:bg-teal-950">
              <Heart className="h-5 w-5 mx-auto mb-1 text-teal-600 dark:text-teal-400" />
              <div className="text-xl font-bold text-teal-600 dark:text-teal-400">{totals.patientServices}</div>
              <p className="text-xs text-muted-foreground">Patient Services</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage by User Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usage by User
          </CardTitle>
          <CardDescription>Policy creation statistics per user</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No policy usage data available yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="user">User</SortableHeader>
                    <SortableHeader field="clinical" className="text-center">
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Clinical</Badge>
                    </SortableHeader>
                    <SortableHeader field="hr" className="text-center">
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">HR</Badge>
                    </SortableHeader>
                    <SortableHeader field="health_safety" className="text-center">
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">H&S</Badge>
                    </SortableHeader>
                    <SortableHeader field="info_governance" className="text-center">
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">IG</Badge>
                    </SortableHeader>
                    <SortableHeader field="business_continuity" className="text-center">
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">BC</Badge>
                    </SortableHeader>
                    <SortableHeader field="patient_services" className="text-center">
                      <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">PS</Badge>
                    </SortableHeader>
                    <SortableHeader field="total" className="text-center">Total</SortableHeader>
                    <SortableHeader field="last_created">Last Created</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{user.clinical_count || 0}</TableCell>
                      <TableCell className="text-center">{user.hr_count || 0}</TableCell>
                      <TableCell className="text-center">{user.health_safety_count || 0}</TableCell>
                      <TableCell className="text-center">{user.info_governance_count || 0}</TableCell>
                      <TableCell className="text-center">{user.business_continuity_count || 0}</TableCell>
                      <TableCell className="text-center">{user.patient_services_count || 0}</TableCell>
                      <TableCell className="text-center font-medium">{user.total_policies || 0}</TableCell>
                      <TableCell>
                        {user.last_created ? format(new Date(user.last_created), 'dd MMM yyyy, HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Totals</TableCell>
                    <TableCell className="text-center">{totals.clinical}</TableCell>
                    <TableCell className="text-center">{totals.hr}</TableCell>
                    <TableCell className="text-center">{totals.healthSafety}</TableCell>
                    <TableCell className="text-center">{totals.infoGovernance}</TableCell>
                    <TableCell className="text-center">{totals.businessContinuity}</TableCell>
                    <TableCell className="text-center">{totals.patientServices}</TableCell>
                    <TableCell className="text-center">{totals.allTime}</TableCell>
                    <TableCell>-</TableCell>
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
