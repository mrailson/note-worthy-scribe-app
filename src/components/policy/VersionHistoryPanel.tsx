import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Download, Diamond } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PolicyVersion, getChangeTypePill } from '@/hooks/usePolicyVersions';

interface VersionHistoryPanelProps {
  versions: PolicyVersion[];
  isOpen: boolean;
  onViewVersion: (version: PolicyVersion) => void;
  onDownloadVersion: (version: PolicyVersion) => void;
}

export const VersionHistoryPanel = ({
  versions,
  isOpen,
  onViewVersion,
  onDownloadVersion,
}: VersionHistoryPanelProps) => {
  if (!versions || versions.length === 0) return null;

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: isOpen ? `${versions.length * 56 + 48}px` : '0px',
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div className="border-t mt-3 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Version History
        </div>
        <div className="space-y-0">
          {versions.map((version, idx) => {
            const isActive = version.status === 'active';
            const isInitial = version.change_type === 'initial';
            const isSuperseded = version.status === 'superseded';
            const pill = getChangeTypePill(version.change_type);

            return (
              <div
                key={version.id}
                className={`flex items-center gap-3 py-2 px-2 rounded text-xs ${
                  isActive ? 'border-l-2 border-l-green-500 bg-green-50/50 dark:bg-green-950/20' : ''
                } ${isSuperseded ? 'opacity-70' : ''}`}
              >
                {/* Version number */}
                <div className="w-14 shrink-0">
                  <span className="font-medium">v{version.version_number}</span>
                  {isActive && (
                    <div className="text-[9px] font-bold text-green-600 uppercase">Live</div>
                  )}
                </div>

                {/* Date */}
                <div className="w-20 shrink-0 text-muted-foreground">
                  {format(parseISO(version.created_at), 'dd/MM/yyyy')}
                </div>

                {/* Author */}
                <div className="w-24 shrink-0 truncate text-muted-foreground">
                  {version.created_by || '—'}
                </div>

                {/* Change type */}
                <div className="w-24 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${pill.color}`}>
                    {isInitial && <Diamond className="h-2.5 w-2.5" />}
                    {pill.pillLabel}
                  </span>
                </div>

                {/* Summary */}
                <div className="flex-1 truncate text-muted-foreground">
                  {version.change_summary}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onViewVersion(version)}
                    title="View this version"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onDownloadVersion(version)}
                    title="Download this version"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
