import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Activity, ArrowRight, Clock, Shield, Trash2, Archive } from 'lucide-react';
import type { EdgeFunction } from './EdgeFunctionAuditTypes';
import { TableCell, TableRow } from '@/components/ui/table';

interface EdgeFunctionExpandedRowProps {
  fn: EdgeFunction;
  onCheckLogs: (name: string) => void;
}

const deletionModeColors: Record<string, string> = {
  'Retain': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  'Archive (disable deploy)': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Remove after confirmation': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const bucketColors: Record<string, string> = {
  '<7 days': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  '7-30 days': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  '31-90 days': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  '>90 days': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  'Never / Unknown': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export const EdgeFunctionExpandedRow: React.FC<EdgeFunctionExpandedRowProps> = ({ fn, onCheckLogs }) => {
  return (
    <TableRow className="bg-slate-50/50 dark:bg-slate-900/30 border-b-0">
      <TableCell colSpan={10} className="py-4 px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {/* Archive Rationale */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Archive Rationale</h4>
            <p className="text-sm text-foreground leading-relaxed">{fn.archiveRationale}</p>
          </div>

          {/* Replacement Reference */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Replacement</h4>
            {fn.replacementExists ? (
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="outline" className="font-mono text-xs">
                  {fn.replacementReference || 'Unknown'}
                </Badge>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No replacement — standalone function</span>
            )}
          </div>

          {/* Deletion Mode */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deletion Mode</h4>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${deletionModeColors[fn.deletionMode] || ''}`}>
              {fn.deletionMode === 'Retain' && <Shield className="h-3 w-3" />}
              {fn.deletionMode === 'Archive (disable deploy)' && <Archive className="h-3 w-3" />}
              {fn.deletionMode === 'Remove after confirmation' && <Trash2 className="h-3 w-3" />}
              {fn.deletionMode}
            </span>
          </div>

          {/* Last Invocation Bucket */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Last Invocation</h4>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bucketColors[fn.lastInvocationBucket] || ''}`}>
              <Clock className="h-3 w-3" />
              {fn.lastInvocationBucket}
            </span>
          </div>

          {/* Check Logs + Log Dates */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Log Activity</h4>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCheckLogs(fn.name)}
                disabled={fn.logStatus === 'loading'}
                className="text-xs h-7"
              >
                {fn.logStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Activity className="h-3 w-3 mr-1" />
                    {fn.logStatus === 'loaded' ? 'Re-check Logs' : 'Check Logs'}
                  </>
                )}
              </Button>
              {fn.logStatus === 'loaded' && fn.lastLogDates && fn.lastLogDates.length > 0 && (
                <div className="space-y-0.5 pl-1">
                  {fn.lastLogDates.map((d, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground">{d}</div>
                  ))}
                </div>
              )}
              {fn.logStatus === 'loaded' && (!fn.lastLogDates || fn.lastLogDates.length === 0) && (
                <span className="text-xs text-red-500 font-medium pl-1">No recent logs found</span>
              )}
              {fn.logStatus === 'error' && (
                <span className="text-xs text-red-500 pl-1">Error fetching logs</span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
};
