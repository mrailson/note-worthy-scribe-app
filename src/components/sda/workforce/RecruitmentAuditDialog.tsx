import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export interface RecruitmentAuditEntry {
  id: string;
  timestamp: Date;
  userEmail: string;
  action: string;
  practiceName?: string;
  staffName: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

interface RecruitmentAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecruitmentAuditDialog: React.FC<RecruitmentAuditDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [entries, setEntries] = useState<RecruitmentAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAuditEntries();
    }
  }, [open]);

  const fetchAuditEntries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('nres_recruitment_audit' as any)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching audit entries:', error);
        return;
      }

      if (data) {
        setEntries((data as any[]).map((row) => ({
          id: row.id,
          timestamp: new Date(row.timestamp),
          userEmail: row.user_email,
          action: row.action,
          practiceName: row.practice_name,
          staffName: row.staff_name,
          field: row.field,
          oldValue: row.old_value,
          newValue: row.new_value,
        })));
      }
    } catch (err) {
      console.error('Error fetching audit entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[calc(100vh-8rem)] bg-background">
        <DialogHeader className="px-8 sm:px-10 pt-2">
          <DialogTitle>Recruitment Tracker – Audit Trail</DialogTitle>
          <DialogDescription>
            All changes made to recruitment data are recorded below.
          </DialogDescription>
        </DialogHeader>
        <div className="px-8 sm:px-10 pb-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading audit trail…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No changes recorded yet.</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Date &amp; Time</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">User</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Action</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Practice</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Staff</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Field</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">From</th>
                    <th className="pb-2 font-semibold text-muted-foreground">To</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/30">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">
                        {format(entry.timestamp, "dd/MM/yy HH:mm")}
                      </td>
                      <td className="py-1.5 pr-2 truncate max-w-[110px]" title={entry.userEmail}>
                        {entry.userEmail}
                      </td>
                      <td className="py-1.5 pr-2">
                        <Badge
                          variant="secondary"
                          className={`text-[9px] px-1.5 py-0 h-4 border-0 ${
                            entry.action === "Deleted"
                              ? "bg-destructive/15 text-destructive"
                              : entry.action === "Added"
                              ? "bg-[#4EA72E]/15 text-[#4EA72E]"
                              : "bg-[#7B7BC7]/15 text-[#7B7BC7]"
                          }`}
                        >
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 truncate max-w-[90px]" title={entry.practiceName}>
                        {entry.practiceName || "—"}
                      </td>
                      <td className="py-1.5 pr-2 truncate max-w-[100px]" title={entry.staffName}>
                        {entry.staffName}
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{entry.field || "—"}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[70px]" title={entry.oldValue}>
                        {entry.oldValue || "—"}
                      </td>
                      <td className="py-1.5 text-muted-foreground truncate max-w-[70px]" title={entry.newValue}>
                        {entry.newValue || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
