import { useState, useMemo } from "react";
import { format, differenceInDays, addDays, startOfWeek, eachWeekOfInterval, endOfWeek } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X, Filter, FileSpreadsheet, GanttChart, Table as TableIcon } from "lucide-react";
import { ActionInfoTooltip } from "./ActionInfoTooltip";
import { PPGUpdateModal, PPGUpdateTrigger } from "./PPGUpdateModal";
import * as XLSX from "xlsx-js-style";
import type { NRESBoardAction, BoardActionStatus, BoardActionPriority } from "@/types/nresBoardActions";
import { GanttChartView } from "./GanttChartView";

interface BoardActionsTableProps {
  actions: NRESBoardAction[];
  onEdit: (action: NRESBoardAction) => void;
  onDelete: (id: string) => void;
}

type SortField = "reference_number" | "action_title" | "responsible_person" | "meeting_date" | "due_date" | "status" | "priority";
type SortDirection = "asc" | "desc" | null;

interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

interface FilterState {
  reference: string;
  title: string;
  responsible: string;
  status: BoardActionStatus | "all";
  priority: BoardActionPriority | "all";
}

const getStatusBadgeVariant = (status: BoardActionStatus) => {
  switch (status) {
    case "pending":
      return "secondary";
    case "in-progress":
      return "default";
    case "completed":
      return "outline";
    case "overdue":
      return "destructive";
    default:
      return "secondary";
  }
};

const getStatusLabel = (status: BoardActionStatus) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "in-progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    default:
      return status;
  }
};

const getPriorityBadgeClass = (priority: BoardActionPriority) => {
  switch (priority) {
    case "low":
      return "bg-muted text-muted-foreground";
    case "medium":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "high":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const priorityOrder = { high: 3, medium: 2, low: 1 };
const statusOrder = { overdue: 4, "in-progress": 3, pending: 2, completed: 1 };

export const BoardActionsTable = ({ actions, onEdit, onDelete }: BoardActionsTableProps) => {
  const [sort, setSort] = useState<SortState>({ field: null, direction: null });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table');
  const [ppgModalOpen, setPpgModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    reference: "",
    title: "",
    responsible: "",
    status: "all",
    priority: "all",
  });

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

  const clearFilters = () => {
    setFilters({
      reference: "",
      title: "",
      responsible: "",
      status: "all",
      priority: "all",
    });
  };

  const exportToExcel = () => {
    const now = new Date();
    
    // Border style
    const border = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };
    
    // Header style (bold with grey background)
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "E0E0E0" } },
      border,
      alignment: { horizontal: "center", vertical: "center" },
    };
    
    // Data cell style
    const cellStyle = { border };
    
    // Title style
    const titleStyle = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "left" },
    };

    if (viewMode === 'gantt') {
      // Gantt-style export
      exportGanttExcel(now, border, headerStyle, cellStyle, titleStyle);
    } else {
      // Table-style export
      exportTableExcel(now, border, headerStyle, cellStyle, titleStyle);
    }
  };

  const exportTableExcel = (
    now: Date,
    border: object,
    headerStyle: object,
    cellStyle: object,
    titleStyle: object
  ) => {
    const numCols = 9;
    
    // Build title rows
    const titleRows: (string | { v: string; s: object })[][] = [
      [{ v: "NRES New Models Pilot - Action Tracker", s: titleStyle }],
      [{ v: `Downloaded: ${format(now, "dd/MM/yyyy")} at ${format(now, "HH:mm")}`, s: { font: { italic: true } } }],
      [], // Empty spacing row
      ["Reference", "Action", "Description", "Responsible", "Meeting Date", "Due Date", "Status", "Priority", "Notes"].map(
        (h) => ({ v: h, s: headerStyle })
      ),
    ];
    
    // Build data rows with borders
    const dataRows = filteredAndSortedActions.map((action) => [
      { v: action.reference_number || "", s: cellStyle },
      { v: action.action_title, s: cellStyle },
      { v: action.description || "", s: cellStyle },
      { v: action.responsible_person, s: cellStyle },
      { v: format(new Date(action.meeting_date), "dd/MM/yyyy"), s: cellStyle },
      { v: action.due_date ? format(new Date(action.due_date), "dd/MM/yyyy") : "", s: cellStyle },
      { v: getStatusLabel(action.status), s: cellStyle },
      { v: action.priority.charAt(0).toUpperCase() + action.priority.slice(1), s: cellStyle },
      { v: action.notes || "", s: cellStyle },
    ]);
    
    const allRows = [...titleRows, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 18 },  // Reference
      { wch: 40 },  // Action
      { wch: 50 },  // Description
      { wch: 20 },  // Responsible
      { wch: 14 },  // Meeting Date
      { wch: 14 },  // Due Date
      { wch: 14 },  // Status
      { wch: 12 },  // Priority
      { wch: 40 }   // Notes
    ];
    
    // Merge title and date cells across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },  // Title row
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }   // Date row
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actions");
    XLSX.writeFile(wb, `NMP-Actions-${format(now, "yyyy-MM-dd")}.xlsx`);
  };

  const exportGanttExcel = (
    now: Date,
    border: object,
    headerStyle: object,
    cellStyle: object,
    titleStyle: object
  ) => {
    if (filteredAndSortedActions.length === 0) {
      exportTableExcel(now, border, headerStyle, cellStyle, titleStyle);
      return;
    }

    // Calculate date range for Gantt
    const dates = filteredAndSortedActions.flatMap(a => {
      const meetingDate = new Date(a.meeting_date);
      const dueDate = a.due_date ? new Date(a.due_date) : addDays(meetingDate, 14);
      return [meetingDate, dueDate];
    });
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const startDate = startOfWeek(addDays(minDate, -7), { weekStartsOn: 1 });
    const endDate = endOfWeek(addDays(maxDate, 7), { weekStartsOn: 1 });
    
    // Generate week columns
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
    
    // Status colours for bars
    const statusColors: Record<string, string> = {
      'pending': 'A0A0A0',
      'in-progress': '005EB8',
      'completed': '22C55E',
      'overdue': 'EF4444',
    };

    const fixedCols = 5; // Ref, Action, Owner, Start, End
    const numCols = fixedCols + weeks.length;
    
    // Build header rows
    const titleRows: (string | { v: string; s: object })[][] = [
      [{ v: "NRES New Models Pilot - Action Tracker (Gantt View)", s: titleStyle }],
      [{ v: `Downloaded: ${format(now, "dd/MM/yyyy")} at ${format(now, "HH:mm")}`, s: { font: { italic: true } } }],
      [], // Empty spacing row
    ];

    // Column headers
    const headers = [
      { v: "Ref", s: headerStyle },
      { v: "Action", s: headerStyle },
      { v: "Owner", s: headerStyle },
      { v: "Start", s: headerStyle },
      { v: "End", s: headerStyle },
      ...weeks.map(w => ({ v: format(w, "dd MMM"), s: headerStyle }))
    ];
    titleRows.push(headers);
    
    // Build data rows with Gantt bars
    const dataRows = filteredAndSortedActions.map((action) => {
      const meetingDate = new Date(action.meeting_date);
      const dueDate = action.due_date ? new Date(action.due_date) : addDays(meetingDate, 14);
      
      const baseRow: ({ v: string; s: object })[] = [
        { v: action.reference_number || "", s: cellStyle },
        { v: action.action_title, s: cellStyle },
        { v: action.responsible_person, s: cellStyle },
        { v: format(meetingDate, "dd/MM/yyyy"), s: cellStyle },
        { v: format(dueDate, "dd/MM/yyyy"), s: cellStyle },
      ];
      
      // Add Gantt bar cells for each week
      weeks.forEach((weekStart) => {
        const weekEnd = addDays(weekStart, 6);
        const isInRange = meetingDate <= weekEnd && dueDate >= weekStart;
        
        if (isInRange) {
          baseRow.push({
            v: "█",
            s: {
              ...cellStyle,
              font: { color: { rgb: statusColors[action.status] || '005EB8' }, bold: true, sz: 14 },
              fill: { fgColor: { rgb: statusColors[action.status] || '005EB8' } },
              alignment: { horizontal: "center" },
            }
          });
        } else {
          baseRow.push({ v: "", s: cellStyle });
        }
      });
      
      return baseRow;
    });
    
    const allRows = [...titleRows, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 },  // Ref
      { wch: 35 },  // Action
      { wch: 18 },  // Owner
      { wch: 12 },  // Start
      { wch: 12 },  // End
      ...weeks.map(() => ({ wch: 8 }))  // Week columns
    ];
    
    // Merge title and date cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }
    ];
    
    // Add legend row
    const legendRowIndex = allRows.length + 1;
    const legendItems = [
      { label: "Pending", color: "A0A0A0" },
      { label: "In Progress", color: "005EB8" },
      { label: "Completed", color: "22C55E" },
      { label: "Overdue", color: "EF4444" },
    ];
    
    legendItems.forEach((item, i) => {
      const colIndex = i * 2;
      ws[XLSX.utils.encode_cell({ r: legendRowIndex, c: colIndex })] = {
        v: "█",
        s: { font: { color: { rgb: item.color }, bold: true, sz: 12 } }
      };
      ws[XLSX.utils.encode_cell({ r: legendRowIndex, c: colIndex + 1 })] = {
        v: item.label,
        s: { font: { sz: 10 } }
      };
    });
    
    // Update range to include legend
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: legendRowIndex, c: numCols - 1 }
    });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gantt");
    XLSX.writeFile(wb, `NMP-Gantt-${format(now, "yyyy-MM-dd")}.xlsx`);
  };

  const hasActiveFilters = filters.reference || filters.title || filters.responsible || filters.status !== "all" || filters.priority !== "all";

  // Get unique responsible persons for filter dropdown
  const uniqueResponsiblePersons = useMemo(() => {
    return [...new Set(actions.map((a) => a.responsible_person))].sort();
  }, [actions]);

  // Filter and sort actions
  const filteredAndSortedActions = useMemo(() => {
    let result = [...actions];

    // Apply filters
    if (filters.reference) {
      result = result.filter((a) =>
        (a.reference_number || "").toLowerCase().includes(filters.reference.toLowerCase())
      );
    }
    if (filters.title) {
      result = result.filter((a) =>
        a.action_title.toLowerCase().includes(filters.title.toLowerCase())
      );
    }
    if (filters.responsible) {
      result = result.filter((a) =>
        a.responsible_person.toLowerCase().includes(filters.responsible.toLowerCase())
      );
    }
    if (filters.status !== "all") {
      result = result.filter((a) => a.status === filters.status);
    }
    if (filters.priority !== "all") {
      result = result.filter((a) => a.priority === filters.priority);
    }

    // Apply sorting
    if (sort.field && sort.direction) {
      result.sort((a, b) => {
        let comparison = 0;

        switch (sort.field) {
          case "reference_number":
            comparison = (a.reference_number || "").localeCompare(b.reference_number || "");
            break;
          case "action_title":
            comparison = a.action_title.localeCompare(b.action_title);
            break;
          case "responsible_person":
            comparison = a.responsible_person.localeCompare(b.responsible_person);
            break;
          case "meeting_date":
            comparison = new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime();
            break;
          case "due_date":
            const aDue = a.due_date ? new Date(a.due_date).getTime() : 0;
            const bDue = b.due_date ? new Date(b.due_date).getTime() : 0;
            comparison = aDue - bDue;
            break;
          case "status":
            comparison = statusOrder[a.status] - statusOrder[b.status];
            break;
          case "priority":
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
            break;
        }

        return sort.direction === "desc" ? -comparison : comparison;
      });
    }

    return result;
  }, [actions, filters, sort]);

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-3">
        <p>No project timeline entries yet. Click "Add Action" to create one.</p>
        <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 mt-3">
          <p className="font-medium text-slate-600">This section is being developed with:</p>
          <p>Anshal Pratyush, Principal Medical Limited (PML)</p>
          <p>
            <a href="mailto:a.pratyush@nhs.net" className="text-[#005EB8] hover:underline">a.pratyush@nhs.net</a>
            {" • "}
            <a href="tel:07780719767" className="text-[#005EB8] hover:underline">07780 719767</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter toggle, export, and clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-muted" : ""}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                Active
              </Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant={viewMode === 'gantt' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode(viewMode === 'table' ? 'gantt' : 'table')}
          >
            {viewMode === 'table' ? (
              <>
                <GanttChart className="h-4 w-4 mr-2" />
                Gantt View
              </>
            ) : (
              <>
                <TableIcon className="h-4 w-4 mr-2" />
                Table View
              </>
            )}
          </Button>
        </div>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        ) : (
          <div />
        )}
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-muted/50 rounded-lg">
          <Input
            placeholder="Ref..."
            value={filters.reference}
            onChange={(e) => setFilters((f) => ({ ...f, reference: e.target.value }))}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Title..."
            value={filters.title}
            onChange={(e) => setFilters((f) => ({ ...f, title: e.target.value }))}
            className="h-8 text-sm"
          />
          <Select
            value={filters.responsible || "all-responsible"}
            onValueChange={(v) => setFilters((f) => ({ ...f, responsible: v === "all-responsible" ? "" : v }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Responsible..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-responsible">All people</SelectItem>
              {uniqueResponsiblePersons.map((person) => (
                <SelectItem key={person} value={person}>
                  {person}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v as BoardActionStatus | "all" }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.priority}
            onValueChange={(v) => setFilters((f) => ({ ...f, priority: v as BoardActionPriority | "all" }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Priority..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedActions.length} of {actions.length} actions
        </p>
      )}

      {/* Table or Gantt View */}
      {viewMode === 'gantt' ? (
        <GanttChartView actions={filteredAndSortedActions} onEdit={onEdit} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
            <TableRow>
                <TableHead className="w-[70px]">
                  <button
                    onClick={() => handleSort("reference_number")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors text-xs"
                  >
                    Ref
                    {getSortIcon("reference_number")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <button
                    onClick={() => handleSort("action_title")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Action
                    {getSortIcon("action_title")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <button
                    onClick={() => handleSort("responsible_person")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Responsible
                    {getSortIcon("responsible_person")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <button
                    onClick={() => handleSort("meeting_date")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Meeting
                    {getSortIcon("meeting_date")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <button
                    onClick={() => handleSort("due_date")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Due Date
                    {getSortIcon("due_date")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Status
                    {getSortIcon("status")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[80px]">
                  <button
                    onClick={() => handleSort("priority")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Priority
                    {getSortIcon("priority")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    No actions match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedActions.map((action) => (
                  <TableRow key={action.id}>
                  <TableCell className="py-2">
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono whitespace-nowrap">
                        {action.reference_number || "-"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{action.action_title}</p>
                        {action.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {action.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{action.responsible_person}</TableCell>
                    <TableCell>
                      {format(new Date(action.meeting_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {action.due_date
                        ? format(new Date(action.due_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(action.status)}>
                        {getStatusLabel(action.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadgeClass(action.priority)}`}>
                        {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {/* Show PPG Update trigger for action 007 */}
                        {action.reference_number === "NMP-007" && (
                          <PPGUpdateTrigger onClick={() => setPpgModalOpen(true)} />
                        )}
                        <ActionInfoTooltip action={action} />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(action)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(action.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* PPG Update Modal for Action 007 */}
      <PPGUpdateModal open={ppgModalOpen} onOpenChange={setPpgModalOpen} />
    </div>
  );
};
