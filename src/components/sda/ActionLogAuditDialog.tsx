import React from "react";
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

export interface ActionAuditEntry {
  id: string;
  timestamp: Date;
  userEmail: string;
  action: "Added" | "Edited" | "Deleted";
  itemName: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

interface ActionLogAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ActionAuditEntry[];
}

export const ActionLogAuditDialog: React.FC<ActionLogAuditDialogProps> = ({
  open,
  onOpenChange,
  entries,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[calc(100vh-8rem)] bg-background">
        <DialogHeader className="px-8 sm:px-10 pt-2">
          <DialogTitle>Action Log – Audit Trail</DialogTitle>
          <DialogDescription>
            All changes made to action items are recorded below.
          </DialogDescription>
        </DialogHeader>
        <div className="px-8 sm:px-10 pb-4">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No changes recorded yet.</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Date &amp; Time</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">User</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Action</th>
                    <th className="pb-2 pr-2 font-semibold text-muted-foreground">Item</th>
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
                      <td className="py-1.5 pr-2 truncate max-w-[120px]" title={entry.userEmail}>
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
                      <td className="py-1.5 pr-2 truncate max-w-[120px]" title={entry.itemName}>
                        {entry.itemName}
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{entry.field || "—"}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[80px]" title={entry.oldValue}>
                        {entry.oldValue || "—"}
                      </td>
                      <td className="py-1.5 text-muted-foreground truncate max-w-[80px]" title={entry.newValue}>
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
