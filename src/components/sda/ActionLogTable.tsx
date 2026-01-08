import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ActionLogItem } from "@/data/nresBoardActionsData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionLogTableProps {
  actions: ActionLogItem[];
}

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

export const ActionLogTable = ({ actions }: ActionLogTableProps) => {
  const [filterActionId, setFilterActionId] = useState<string>("all");
  const [filterDateRaised, setFilterDateRaised] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterDueDate, setFilterDueDate] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Get unique values for each filter
  const uniqueActionIds = useMemo(() => [...new Set(actions.map(a => a.actionId))], [actions]);
  const uniqueDatesRaised = useMemo(() => [...new Set(actions.map(a => a.dateRaised))], [actions]);
  const uniqueOwners = useMemo(() => [...new Set(actions.map(a => a.owner))], [actions]);
  const uniqueDueDates = useMemo(() => [...new Set(actions.map(a => a.dueDate))], [actions]);
  const uniquePriorities = useMemo(() => [...new Set(actions.map(a => a.priority))], [actions]);
  const uniqueStatuses = useMemo(() => [...new Set(actions.map(a => a.status))], [actions]);

  // Filter the actions
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      if (filterActionId !== "all" && action.actionId !== filterActionId) return false;
      if (filterDateRaised !== "all" && action.dateRaised !== filterDateRaised) return false;
      if (filterOwner !== "all" && action.owner !== filterOwner) return false;
      if (filterDueDate !== "all" && action.dueDate !== filterDueDate) return false;
      if (filterPriority !== "all" && action.priority !== filterPriority) return false;
      if (filterStatus !== "all" && action.status !== filterStatus) return false;
      return true;
    });
  }, [actions, filterActionId, filterDateRaised, filterOwner, filterDueDate, filterPriority, filterStatus]);

  const hasActiveFilters = filterActionId !== "all" || filterDateRaised !== "all" || filterOwner !== "all" || 
                           filterDueDate !== "all" || filterPriority !== "all" || filterStatus !== "all";

  const clearAllFilters = () => {
    setFilterActionId("all");
    setFilterDateRaised("all");
    setFilterOwner("all");
    setFilterDueDate("all");
    setFilterPriority("all");
    setFilterStatus("all");
  };

  return (
    <div className="space-y-3">
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg">
        <span className="text-sm font-medium text-slate-600 mr-1">Filters:</span>
        
        <Select value={filterActionId} onValueChange={setFilterActionId}>
          <SelectTrigger className="w-[80px] h-8 text-xs bg-white">
            <SelectValue placeholder="ID" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All IDs</SelectItem>
            {uniqueActionIds.map(id => (
              <SelectItem key={id} value={id}>{id}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDateRaised} onValueChange={setFilterDateRaised}>
          <SelectTrigger className="w-[110px] h-8 text-xs bg-white">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            {uniqueDatesRaised.map(date => (
              <SelectItem key={date} value={date}>{date}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[90px] h-8 text-xs bg-white">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {uniqueOwners.map(owner => (
              <SelectItem key={owner} value={owner}>{owner}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDueDate} onValueChange={setFilterDueDate}>
          <SelectTrigger className="w-[110px] h-8 text-xs bg-white">
            <SelectValue placeholder="Due Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Due Dates</SelectItem>
            {uniqueDueDates.map(date => (
              <SelectItem key={date} value={date}>{date}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[100px] h-8 text-xs bg-white">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {uniquePriorities.map(priority => (
              <SelectItem key={priority} value={priority}>{priority}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[90px] h-8 text-xs bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
            className="h-8 text-xs text-slate-500 hover:text-slate-700"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-slate-500">
          Showing {filteredActions.length} of {actions.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-700 w-[60px]">ID</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[90px]">Date</TableHead>
              <TableHead className="font-semibold text-slate-700 min-w-[200px]">Description</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[60px]">Owner</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[90px]">Due Date</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[80px]">Priority</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[70px]">Status</TableHead>
              <TableHead className="font-semibold text-slate-700 min-w-[150px]">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  No actions match the current filters
                </TableCell>
              </TableRow>
            ) : (
              filteredActions.map((action, index) => (
                <TableRow 
                  key={action.actionId}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                >
                  <TableCell className="font-mono text-sm text-slate-600">{action.actionId}</TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">{action.dateRaised}</TableCell>
                  <TableCell className="text-sm text-slate-900">{action.description}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-700">{action.owner}</TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">{action.dueDate}</TableCell>
                  <TableCell>{getPriorityBadge(action.priority)}</TableCell>
                  <TableCell>{getStatusBadge(action.status)}</TableCell>
                  <TableCell className="text-sm text-slate-500">{action.notes}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
