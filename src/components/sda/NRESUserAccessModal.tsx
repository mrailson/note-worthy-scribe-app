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
import { Search, Download, Users, Building2, Mail } from "lucide-react";
import { useNRESUserAccess } from "@/hooks/useNRESUserAccess";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface NRESUserAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NRESUserAccessModal = ({
  open,
  onOpenChange,
}: NRESUserAccessModalProps) => {
  const { data: users = [], isLoading } = useNRESUserAccess();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.practice_name?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Group users by practice for summary
  const practiceGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    users.forEach((user) => {
      const practice = user.practice_name || "Unassigned";
      groups[practice] = (groups[practice] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [users]);

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Organisation", "Access Granted"];
    const rows = filteredUsers.map((user) => [
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="w-5 h-5 text-[#005EB8]" />
            NRES Dashboard Access
          </DialogTitle>
        </DialogHeader>

        {/* Search and Actions */}
        <div className="flex items-center gap-3 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, email or organisation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
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

        {/* Practice Summary Chips */}
        <div className="flex flex-wrap gap-2 mt-2">
          {practiceGroups.slice(0, 6).map(([practice, count]) => (
            <Badge
              key={practice}
              variant="secondary"
              className="bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Building2 className="w-3 h-3 mr-1" />
              {practice}: {count}
            </Badge>
          ))}
          {practiceGroups.length > 6 && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-500">
              +{practiceGroups.length - 6} more
            </Badge>
          )}
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-auto mt-4 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Organisation</TableHead>
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
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-slate-500"
                  >
                    {searchTerm ? "No users match your search" : "No users found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
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
            Showing {filteredUsers.length} of {users.length} users with NRES
            access
          </span>
          <span className="text-xs">
            Data refreshes automatically
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
