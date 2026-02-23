import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Plus, Users, Clock } from "lucide-react";
import { useNRESPeople, PeopleAuditEntry } from "@/contexts/NRESPeopleContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProgrammePerson } from "@/data/nresPeopleDirectory";
import { format } from "date-fns";

interface PeopleDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PeopleDirectoryDialog: React.FC<PeopleDirectoryDialogProps> = ({ open, onOpenChange }) => {
  const { people, addPerson, updatePerson, deletePerson, auditLog } = useNRESPeople();
  const { user } = useAuth();
  const userEmail = user?.email ?? "unknown";

  const [editing, setEditing] = useState<ProgrammePerson | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [role, setRole] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName("");
    setInitials("");
    setRole("");
    setOrganisation("");
    setIsActive(true);
    setEditing(null);
    setIsAdding(false);
  };

  const startEdit = (person: ProgrammePerson) => {
    setEditing(person);
    setIsAdding(false);
    setName(person.name);
    setInitials(person.initials);
    setRole(person.role);
    setOrganisation(person.organisation);
    setIsActive(person.isActive);
  };

  const startAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!name.trim() || !initials.trim()) return;
    if (editing) {
      updatePerson(editing.id, { name: name.trim(), initials: initials.trim(), role: role.trim(), organisation: organisation.trim(), isActive }, userEmail);
    } else {
      addPerson({ name: name.trim(), initials: initials.trim(), role: role.trim(), organisation: organisation.trim(), isActive }, userEmail);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    deletePerson(id, userEmail);
    if (editing?.id === id) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[calc(100vh-8rem)] overflow-y-auto bg-white border shadow-xl rounded-xl">
        <DialogHeader className="px-8 sm:px-10 pt-2">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#005EB8]" />
            People Directory
          </DialogTitle>
          <DialogDescription>Manage programme board members and stakeholders.</DialogDescription>
        </DialogHeader>

        <div className="px-8 sm:px-10 space-y-4">
          {/* People Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold w-[60px]">Initials</TableHead>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Role</TableHead>
                  <TableHead className="text-xs font-semibold">Organisation</TableHead>
                  <TableHead className="text-xs font-semibold w-[60px]">Active</TableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.id} className="text-sm">
                    <TableCell className="font-mono font-medium">{person.initials}</TableCell>
                    <TableCell>{person.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{person.role}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{person.organisation}</TableCell>
                    <TableCell>
                      <Badge variant={person.isActive ? "default" : "secondary"} className={person.isActive ? "bg-green-600 text-xs" : "text-xs"}>
                        {person.isActive ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(person)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(person.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Add/Edit Form */}
          {(isAdding || editing) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">{editing ? "Edit Person" : "Add Person"}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Initials *</Label>
                  <Input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="e.g. MJG" className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role title" className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Organisation</Label>
                  <Input value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Organisation" className="bg-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label className="text-xs">Active</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={!name.trim() || !initials.trim()}>
                    {editing ? "Save" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isAdding && !editing && (
            <Button variant="outline" size="sm" onClick={startAdd}>
              <Plus className="h-3 w-3 mr-1" /> Add Person
            </Button>
          )}

          {/* Audit Log */}
          {auditLog.length > 0 && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowAudit(!showAudit)} className="text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                Audit Trail ({auditLog.length})
              </Button>
              {showAudit && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="px-3 py-2 text-xs text-slate-600">
                      <span className="font-medium">{entry.action}</span> {entry.personName}
                      {entry.field && <span> — {entry.field}: {entry.oldValue} → {entry.newValue}</span>}
                      <span className="text-muted-foreground ml-2">
                        {format(entry.timestamp, "dd/MM/yy HH:mm")} by {entry.userEmail}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-8 sm:px-10 pb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
