import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, MessageSquare, Plus, Pencil, Trash2, ClipboardList } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import * as XLSX from "xlsx-js-style";
import { ActionLogItem } from "@/data/nresBoardActionsData";
import { PPGUpdateModal } from "./board-actions/PPGUpdateModal";
import { ActionLogEditDialog } from "./ActionLogEditDialog";
import { ActionLogAuditDialog, ActionAuditEntry } from "./ActionLogAuditDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useNRESPeople } from "@/contexts/NRESPeopleContext";
import { getPersonByInitials } from "@/data/nresPeopleDirectory";

interface ActionLogMetadata {
  sourceMeeting: string;
  nextMeeting: string;
  lastUpdated?: string;
}

interface ActionLogTableProps {
  actions: ActionLogItem[];
  metadata?: ActionLogMetadata;
}

type SortField = "actionId" | "dateRaised" | "owner" | "dueDate" | "priority" | "status";
type SortDirection = "asc" | "desc" | null;

interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

const priorityOrder = { High: 3, Medium: 2, Low: 1 };
const statusOrder = { Open: 2, Closed: 1 };

const getPriorityBadge = (priority: ActionLogItem['priority']) => {
  switch (priority) {
    case 'High':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">High</Badge>;
    case 'Medium':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Medium</Badge>;
    case 'Low':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Low</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
};

const getStatusBadge = (status: ActionLogItem['status']) => {
  switch (status) {
    case 'Open':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
    case 'Closed':
      return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Parse DD/MM/YYYY date string to Date object for comparison
const parseDate = (dateStr: string): Date => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export const ActionLogTable = ({ actions: initialActions, metadata }: ActionLogTableProps) => {
  const { user } = useAuth();
  const { people } = useNRESPeople();
  const [actions, setActions] = useState<ActionLogItem[]>(initialActions);
  const [sort, setSort] = useState<SortState>({ field: null, direction: null });
  const [showOpenOnly, setShowOpenOnly] = useState(true);
  const [ppgModalOpen, setPpgModalOpen] = useState(false);

  // CRUD state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionLogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionLogItem | null>(null);

  // Audit state
  const [auditEntries, setAuditEntries] = useState<ActionAuditEntry[]>([]);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);

  const userEmail = user?.email ?? "unknown";

  const getNextId = useCallback(() => {
    const maxId = actions.reduce((max, a) => Math.max(max, parseInt(a.actionId, 10) || 0), 0);
    return String(maxId + 1).padStart(3, "0");
  }, [actions]);

  const addAuditEntry = useCallback(
    (action: ActionAuditEntry["action"], itemName: string, field?: string, oldValue?: string, newValue?: string) => {
      setAuditEntries((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          userEmail,
          action,
          itemName,
          field,
          oldValue,
          newValue,
        },
        ...prev,
      ]);
    },
    [userEmail]
  );

  // Handlers
  const handleAdd = () => {
    setEditingItem(null);
    setEditDialogOpen(true);
  };

  const handleEdit = (item: ActionLogItem) => {
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const handleSave = (updated: ActionLogItem) => {
    if (editingItem) {
      // Edit — field-level diffs
      const fields: { key: keyof ActionLogItem; label: string }[] = [
        { key: "description", label: "Description" },
        { key: "owner", label: "Owner" },
        { key: "dateRaised", label: "Date Raised" },
        { key: "dueDate", label: "Due Date" },
        { key: "priority", label: "Priority" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
      ];
      const itemLabel = `${editingItem.actionId} – ${editingItem.description.slice(0, 30)}`;
      fields.forEach(({ key, label }) => {
        const oldVal = String(editingItem[key] ?? "");
        const newVal = String(updated[key] ?? "");
        if (oldVal !== newVal) {
          addAuditEntry("Edited", itemLabel, label, oldVal || "—", newVal || "—");
        }
      });
      setActions((prev) => prev.map((a) => (a.actionId === updated.actionId ? updated : a)));
    } else {
      // Add
      addAuditEntry("Added", `${updated.actionId} – ${updated.description.slice(0, 30)}`);
      setActions((prev) => [...prev, updated]);
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    addAuditEntry("Deleted", `${deleteTarget.actionId} – ${deleteTarget.description.slice(0, 30)}`);
    setActions((prev) => prev.filter((a) => a.actionId !== deleteTarget.actionId));
    setDeleteTarget(null);
  };

  const handleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        if (prev.direction === "asc") return { field, direction: "desc" };
        if (prev.direction === "desc") return { field: null, direction: null };
        return { field, direction: "asc" };
      }
      return { field, direction: "asc" };
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sort.field !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    if (sort.direction === "asc") return <ArrowUp className="h-3 w-3" />;
    return <ArrowDown className="h-3 w-3" />;
  };

  const filteredAndSortedActions = useMemo(() => {
    let result = showOpenOnly ? actions.filter(a => a.status === 'Open') : actions;
    
    if (!sort.field || !sort.direction) return result;

    return [...result].sort((a, b) => {
      const multiplier = sort.direction === "asc" ? 1 : -1;

      switch (sort.field) {
        case "actionId":
          return multiplier * a.actionId.localeCompare(b.actionId);
        case "dateRaised":
          return multiplier * (parseDate(a.dateRaised).getTime() - parseDate(b.dateRaised).getTime());
        case "owner":
          return multiplier * a.owner.localeCompare(b.owner);
        case "dueDate":
          return multiplier * (parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime());
        case "priority":
          return multiplier * (priorityOrder[a.priority] - priorityOrder[b.priority]);
        case "status":
          return multiplier * (statusOrder[a.status] - statusOrder[b.status]);
        default:
          return 0;
      }
    });
  }, [actions, sort, showOpenOnly]);

  const openCount = actions.filter(a => a.status === 'Open').length;

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];
    
    // Use the metadata lastUpdated if available, otherwise use current date
    let lastUpdatedStr: string;
    if (metadata?.lastUpdated) {
      // Parse DD/MM/YYYY HH:mm format
      const [datePart, timePart] = metadata.lastUpdated.split(' ');
      const [day, month, year] = datePart.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      lastUpdatedStr = format(date, "d MMMM yyyy") + ` at ${timePart || '00:00'}`;
    } else {
      lastUpdatedStr = format(new Date(), "d MMMM yyyy 'at' HH:mm");
    }
    
    // Style definitions
    const titleStyle = {
      font: { bold: true, sz: 16, name: 'Calibri', color: { rgb: "1E3A5F" } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    
    const subtitleStyle = {
      font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: "2E5B8C" } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };

    const lastUpdatedStyle = {
      font: { italic: true, sz: 10, name: 'Calibri', color: { rgb: "666666" } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };

    const headerStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: "D9E2EC" } },
      border: {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
      },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };

    const cellStyle = {
      font: { sz: 10, name: 'Calibri' },
      border: {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
      },
      alignment: { vertical: 'center', wrapText: true }
    };

    // Priority colour styles
    const priorityStyles: Record<string, any> = {
      High: { ...cellStyle, fill: { fgColor: { rgb: "FF6B6B" } }, font: { sz: 10, name: 'Calibri', bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: 'center', vertical: 'center' } },
      Medium: { ...cellStyle, fill: { fgColor: { rgb: "FFB84D" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
      Low: { ...cellStyle, fill: { fgColor: { rgb: "90EE90" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
    };

    // Status colour styles
    const statusStyles: Record<string, any> = {
      Open: { ...cellStyle, fill: { fgColor: { rgb: "ADD8E6" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
      Closed: { ...cellStyle, fill: { fgColor: { rgb: "B8B8B8" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
    };


    // Row 1: Title
    rows.push(['NRES Programme Board - Action Log']);
    
    // Row 2: Subtitle
    rows.push(['Rural East & South Neighbourhood Access Service']);
    
    // Row 3: Last Updated
    rows.push([`Last Updated: ${lastUpdatedStr}`]);
    
    // Row 4: Empty spacer
    rows.push([]);
    
    // Row 5: Headers
    rows.push(['Action ID', 'Date Raised', 'Action Description', 'Owner', 'Due Date', 'Priority', 'Status', 'Notes/Update']);
    
    // Data rows
    filteredAndSortedActions.forEach(action => {
      rows.push([
        action.actionId,
        action.dateRaised,
        action.description,
        action.owner,
        action.dueDate,
        action.priority,
        action.status,
        action.notes || ""
      ]);
    });
    
    
    // Source and next meeting
    if (metadata) {
      rows.push([]);
      rows.push([`Source Meeting: ${metadata.sourceMeeting}`]);
      rows.push([`Next Meeting: ${metadata.nextMeeting}`]);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 20 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 10 }
    ];
    
    // Merge cells for title and subtitle
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    ];
    
    // Set row heights
    ws['!rows'] = [
      { hpt: 30 },
      { hpt: 22 },
      { hpt: 18 },
      { hpt: 15 },
      { hpt: 25 },
    ];
    
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    
    // Apply title and subtitle styles
    if (ws['A1']) ws['A1'].s = titleStyle;
    if (ws['A2']) ws['A2'].s = subtitleStyle;
    if (ws['A3']) ws['A3'].s = lastUpdatedStyle;
    
    // Apply header styles (now row 5)
    cols.slice(0, 8).forEach(col => {
      const cell = ws[`${col}5`];
      if (cell) cell.s = headerStyle;
    });
    
    // Apply data row styles with colour-coded Priority and Status (now starting row 6)
    for (let i = 0; i < filteredAndSortedActions.length; i++) {
      const rowNum = 6 + i;
      const action = filteredAndSortedActions[i];
      
      cols.slice(0, 8).forEach(col => {
        const cell = ws[`${col}${rowNum}`];
        if (cell) {
          if (col === 'F') {
            cell.s = priorityStyles[action.priority] || cellStyle;
          } else if (col === 'G') {
            cell.s = statusStyles[action.status] || cellStyle;
          } else {
            cell.s = cellStyle;
          }
        }
      });
    }
    
    
    XLSX.utils.book_append_sheet(wb, ws, "Action Log");
    const dateStr = format(new Date(), "yyyy-MM-dd");
    XLSX.writeFile(wb, `NRES_Programme_Board_Action_Log_${dateStr}.xlsx`);
  };

  return (
    <TooltipProvider>
    <div className="space-y-3">
      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Switch 
            id="show-open-only" 
            checked={showOpenOnly} 
            onCheckedChange={setShowOpenOnly}
          />
          <Label htmlFor="show-open-only" className="text-sm text-slate-600 cursor-pointer">
            Open Action Items ({openCount})
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Action</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAuditDialogOpen(true)}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 relative"
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Audit</span>
            {auditEntries.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                {auditEntries.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <span className="text-xs text-slate-500">
            Last updated: {format(new Date(), "d MMMM yyyy")}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead 
              className="font-semibold text-slate-700 w-[60px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("actionId")}
            >
              <div className="flex items-center gap-1">
                ID
                {getSortIcon("actionId")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[90px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("dateRaised")}
            >
              <div className="flex items-center gap-1">
                Date
                {getSortIcon("dateRaised")}
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700 min-w-[200px]">Description</TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[60px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("owner")}
            >
              <div className="flex items-center gap-1">
                Owner
                {getSortIcon("owner")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[90px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("dueDate")}
            >
              <div className="flex items-center gap-1">
                Due Date
                {getSortIcon("dueDate")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[80px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("priority")}
            >
              <div className="flex items-center gap-1">
                Priority
                {getSortIcon("priority")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[70px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("status")}
            >
              <div className="flex items-center gap-1">
                Status
                {getSortIcon("status")}
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700 min-w-[150px]">Notes</TableHead>
            <TableHead className="font-semibold text-slate-700 w-[70px]"></TableHead>
          </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedActions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                  No open actions
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedActions.map((action, index) => (
            <TableRow 
              key={action.actionId}
              className={`group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
            >
              <TableCell className="font-mono text-sm text-slate-600">{action.actionId}</TableCell>
              <TableCell className="text-sm text-slate-600 whitespace-nowrap">{action.dateRaised}</TableCell>
              <TableCell className="text-sm text-slate-900">{action.description}</TableCell>
              <TableCell className="text-sm font-medium text-slate-700">
                {(() => {
                  const person = getPersonByInitials(people, action.owner);
                  return person ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                          {action.owner}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="text-sm">
                          <p className="font-semibold">{person.name}</p>
                          <p className="text-muted-foreground">{person.role} — {person.organisation}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    action.owner
                  );
                })()}
              </TableCell>
              <TableCell className="text-sm text-slate-600 whitespace-nowrap">{action.dueDate}</TableCell>
              <TableCell>{getPriorityBadge(action.priority)}</TableCell>
              <TableCell>{getStatusBadge(action.status)}</TableCell>
              <TableCell className="text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <span>{action.notes}</span>
                  {action.actionId === "007" && (
                    <button
                      onClick={() => setPpgModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-[#005EB8] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors whitespace-nowrap"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Update
                    </button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(action)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(action)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* PPG Update Modal */}
      <PPGUpdateModal open={ppgModalOpen} onOpenChange={setPpgModalOpen} />

      {/* Edit / Add Dialog */}
      <ActionLogEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={editingItem}
        nextId={getNextId()}
        onSave={handleSave}
      />

      {/* Audit Dialog */}
      <ActionLogAuditDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        entries={auditEntries}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Action {deleteTarget?.actionId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleteTarget?.description}" from the action log. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
};
