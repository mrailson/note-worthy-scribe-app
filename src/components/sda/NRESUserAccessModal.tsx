import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Search, Download, Users, Building2, Mail, ArrowUpDown, Info } from "lucide-react";
import { useNRESUserAccess } from "@/hooks/useNRESUserAccess";
import { format } from "date-fns";

interface NRESUserAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = "full_name" | "practice_name";
type SortDirection = "asc" | "desc";

export const NRESUserAccessModal = ({
  open,
  onOpenChange,
}: NRESUserAccessModalProps) => {
  const { data: users = [], isLoading } = useNRESUserAccess();
  const [searchTerm, setSearchTerm] = useState("");
  const [organisationFilter, setOrganisationFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("practice_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Get unique organisations for filter
  const organisations = useMemo(() => {
    const orgs = new Set<string>();
    users.forEach((user) => {
      if (user.practice_name) {
        orgs.add(user.practice_name);
      }
    });
    return Array.from(orgs).sort();
  }, [users]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Apply organisation filter
    if (organisationFilter !== "all") {
      result = result.filter((user) => user.practice_name === organisationFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term) ||
          user.practice_name?.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = (sortField === "full_name" ? a.full_name : a.practice_name) || "";
      const bValue = (sortField === "full_name" ? b.full_name : b.practice_name) || "";
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [users, searchTerm, organisationFilter, sortField, sortDirection]);

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Organisation", "Access Granted"];
    const rows = filteredAndSortedUsers.map((user) => [
      user.full_name || "-",
      user.email || "-",
      user.practice_name || "-",
      format(new Date(user.activated_at), "dd/MM/yyyy"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nres-users-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="font-semibold cursor-pointer hover:bg-slate-100 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === field ? "text-[#005EB8]" : "text-slate-400"}`} />
      </div>
    </TableHead>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="w-5 h-5 text-[#005EB8]" />
            NRES Dashboard Access
          </DialogTitle>
        </DialogHeader>

        {/* Explainer */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-slate-600">
          <Info className="w-4 h-4 text-[#005EB8] mt-0.5 shrink-0" />
          <p>
            To request access for additional users, your Practice Manager can grant it from Notewell, or contact{" "}
            <a href="mailto:malcolm.railson@nhs.net" className="text-[#005EB8] hover:underline font-medium">
              malcolm.railson@nhs.net
            </a>
          </p>
        </div>

        {/* Search, Filter and Actions */}
        <div className="flex items-center gap-3 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={organisationFilter} onValueChange={setOrganisationFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="All Organisations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organisations</SelectItem>
              {organisations.map((org) => (
                <SelectItem key={org} value={org}>
                  {org}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-auto mt-4 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <SortableHeader field="full_name">Name</SortableHeader>
                <TableHead className="font-semibold">Email</TableHead>
                <SortableHeader field="practice_name">Organisation</SortableHeader>
                <TableHead className="font-semibold text-right">
                  Access Granted
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-slate-500"
                  >
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-slate-500"
                  >
                    {searchTerm || organisationFilter !== "all" ? "No users match your filters" : "No users found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedUsers.map((user) => (
                  <TableRow key={user.user_id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {user.full_name || (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.email ? (
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {user.email}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.practice_name ? (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {user.practice_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {format(new Date(user.activated_at), "dd MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t mt-2 text-sm text-slate-500">
          <span>
            Showing {filteredAndSortedUsers.length} of {users.length} users with NRES access
          </span>
          <span className="text-xs">
            Data refreshes automatically
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
