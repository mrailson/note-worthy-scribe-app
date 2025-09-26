// Meeting Crossover Monitoring Component
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import { detectDataCrossover, clearMeetingCache } from '@/utils/meetingValidation';

interface CrossoverIssue {
  meeting_id: string;
  meeting_title: string;
  summary_meeting_id: string;
  potential_crossover: boolean;
  last_updated: string;
}

export const MeetingCrossoverMonitor: React.FC = () => {
  const { user } = useAuth();
  const [crossoverIssues, setCrossoverIssues] = useState<CrossoverIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const checkForCrossoverIssues = async () => {
    if (!user?.id) {
      toast.error('User authentication required');
      return;
    }

    setIsChecking(true);
    try {
      console.log('🔍 Checking for meeting data crossover issues...');
      
      const issues = await detectDataCrossover();
      setCrossoverIssues(issues);
      setLastChecked(new Date());
      
      if (issues.length === 0) {
        console.log('✅ No crossover issues detected');
        toast.success('No meeting data crossover detected');
      } else {
        console.warn(`⚠️ Found ${issues.length} potential crossover issues`, issues);
        toast.warning(`Found ${issues.length} potential meeting data crossover issues`);
      }
    } catch (error) {
      console.error('❌ Error checking for crossover issues:', error);
      toast.error('Failed to check for crossover issues');
    } finally {
      setIsChecking(false);
    }
  };

  const handleClearCache = () => {
    clearMeetingCache();
    toast.success('Meeting cache cleared successfully');
  };

  const handleViewAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('system_audit_log')
        .select('*')
        .eq('table_name', 'meeting_summaries')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Error fetching audit log:', error);
        toast.error('Failed to fetch audit log');
        return;
      }

      console.log('📋 Meeting summary audit log:', data);
      toast.info(`Found ${data?.length || 0} recent meeting summary operations`);
    } catch (error) {
      console.error('❌ Exception fetching audit log:', error);
      toast.error('Failed to fetch audit log');
    }
  };

  // Auto-check on component mount
  useEffect(() => {
    checkForCrossoverIssues();
  }, []);

  // Only show to system admins or if issues are detected
  useEffect(() => {
    const shouldShow = crossoverIssues.length > 0 || user?.email?.includes('@nhs.net');
    setIsVisible(shouldShow);
  }, [crossoverIssues, user]);

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          Meeting Data Integrity Monitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-amber-700">
              Last checked: {lastChecked ? lastChecked.toLocaleString() : 'Never'}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkForCrossoverIssues}
                disabled={isChecking}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Check Now'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearCache}
              >
                Clear Cache
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleViewAuditLog}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Audit Log
              </Button>
            </div>
          </div>

          {crossoverIssues.length === 0 ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                No meeting data crossover issues detected. All meeting summaries are properly linked.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  <strong>Warning:</strong> {crossoverIssues.length} potential meeting data crossover issues detected.
                  This could indicate that meeting notes are showing content from different meetings.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                {crossoverIssues.slice(0, 5).map((issue, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded border border-amber-200">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{issue.meeting_title}</div>
                      <div className="text-xs text-amber-600">
                        Meeting ID: {issue.meeting_id.slice(0, 8)}... | 
                        Summary ID: {issue.summary_meeting_id.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-amber-500">
                        Last updated: {new Date(issue.last_updated).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-2">
                      Mismatch
                    </Badge>
                  </div>
                ))}
                
                {crossoverIssues.length > 5 && (
                  <div className="text-xs text-amber-600 text-center py-2">
                    ... and {crossoverIssues.length - 5} more issues
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-xs text-amber-600 bg-amber-100 p-2 rounded">
            <strong>Prevention measures active:</strong> Enhanced validation, audit logging, 
            and database constraints are now in place to prevent future crossover issues.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};