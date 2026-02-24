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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Users, Clock } from "lucide-react";
import { useNRESPeople, PeopleAuditEntry } from "@/contexts/NRESPeopleContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProgrammePerson, ProgrammeGroup } from "@/data/nresPeopleDirectory";
import { format } from "date-fns";

interface PeopleDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PeopleDirectoryDialog: React.FC<PeopleDirectoryDialogProps> = ({ open, onOpenChange }) => {
  const { people, groups, addPerson, updatePerson, deletePerson, addGroup, updateGroup, deleteGroup, auditLog } = useNRESPeople();
  const { user } = useAuth();
  const userEmail = user?.email ?? "unknown";

  // Person form state
  const [editing, setEditing] = useState<ProgrammePerson | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [role, setRole] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Group form state
  const [editingGroup, setEditingGroup] = useState<ProgrammeGroup | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAbbreviation, setGroupAbbreviation] = useState("");
  const [groupEmail, setGroupEmail] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupIsActive, setGroupIsActive] = useState(true);

  const [showAudit, setShowAudit] = useState(false);

  // Person form helpers
  const resetPersonForm = () => {
    setName(""); setInitials(""); setRole(""); setOrganisation(""); setEmail(""); setIsActive(true);
    setEditing(null); setIsAdding(false);
  };

  const startEditPerson = (person: ProgrammePerson) => {
    setEditing(person); setIsAdding(false);
    setName(person.name); setInitials(person.initials); setRole(person.role);
    setOrganisation(person.organisation); setEmail(person.email || ""); setIsActive(person.isActive);
  };

  const handleSavePerson = () => {
    if (!name.trim() || !initials.trim()) return;
    const data = { name: name.trim(), initials: initials.trim(), role: role.trim(), organisation: organisation.trim(), email: email.trim() || undefined, isActive };
    if (editing) {
      updatePerson(editing.id, data, userEmail);
    } else {
      addPerson(data, userEmail);
    }
    resetPersonForm();
  };

  // Group form helpers
  const resetGroupForm = () => {
    setGroupName(""); setGroupAbbreviation(""); setGroupEmail(""); setGroupDescription("");
    setGroupMemberIds([]); setGroupIsActive(true); setEditingGroup(null); setIsAddingGroup(false);
  };

  const startEditGroup = (group: ProgrammeGroup) => {
    setEditingGroup(group); setIsAddingGroup(false);
    setGroupName(group.name); setGroupAbbreviation(group.abbreviation);
    setGroupEmail(group.email); setGroupDescription(group.description);
    setGroupMemberIds([...group.memberIds]); setGroupIsActive(group.isActive);
  };

  const handleSaveGroup = () => {
    if (!groupName.trim() || !groupAbbreviation.trim()) return;
    const data = {
      name: groupName.trim(), abbreviation: groupAbbreviation.trim(), email: groupEmail.trim(),
      description: groupDescription.trim(), memberIds: groupMemberIds, isActive: groupIsActive,
    };
    if (editingGroup) {
      updateGroup(editingGroup.id, data, userEmail);
    } else {
      addGroup(data, userEmail);
    }
    resetGroupForm();
  };

  const toggleMember = (personId: string) => {
    setGroupMemberIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[calc(100vh-8rem)] overflow-y-auto bg-white border shadow-xl rounded-xl">
        <DialogHeader className="px-8 sm:px-10 pt-2">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#005EB8]" />
            People Directory
          </DialogTitle>
          <DialogDescription>Manage programme board members, groups, and stakeholders.</DialogDescription>
        </DialogHeader>

        <div className="px-8 sm:px-10 space-y-4">
          <Tabs defaultValue="individuals">
            <TabsList>
              <TabsTrigger value="individuals">Individuals</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>

            {/* ===== INDIVIDUALS TAB ===== */}
            <TabsContent value="individuals" className="space-y-4">
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold w-[60px]">Initials</TableHead>
                      <TableHead className="text-xs font-semibold">Name</TableHead>
                      <TableHead className="text-xs font-semibold">Email</TableHead>
                      <TableHead className="text-xs font-semibold">Role</TableHead>
                      <TableHead className="text-xs font-semibold w-[60px]">Active</TableHead>
                      <TableHead className="w-[70px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people.map((person) => (
                      <TableRow key={person.id} className="text-sm">
                        <TableCell className="font-mono font-medium">{person.initials}</TableCell>
                        <TableCell>{person.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{person.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{person.role}</TableCell>
                        <TableCell>
                          <Badge variant={person.isActive ? "default" : "secondary"} className={person.isActive ? "bg-green-600 text-xs" : "text-xs"}>
                            {person.isActive ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditPerson(person)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { deletePerson(person.id, userEmail); if (editing?.id === person.id) resetPersonForm(); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
                      <Label className="text-xs">Email</Label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@nhs.uk" type="email" className="bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role title" className="bg-white" />
                    </div>
                    <div className="space-y-1 col-span-2">
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
                      <Button variant="outline" size="sm" onClick={resetPersonForm}>Cancel</Button>
                      <Button size="sm" onClick={handleSavePerson} disabled={!name.trim() || !initials.trim()}>
                        {editing ? "Save" : "Add"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!isAdding && !editing && (
                <Button variant="outline" size="sm" onClick={() => { resetPersonForm(); setIsAdding(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Add Person
                </Button>
              )}
            </TabsContent>

            {/* ===== GROUPS TAB ===== */}
            <TabsContent value="groups" className="space-y-4">
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold w-[60px]">Abbr</TableHead>
                      <TableHead className="text-xs font-semibold">Name</TableHead>
                      <TableHead className="text-xs font-semibold">Email</TableHead>
                      <TableHead className="text-xs font-semibold w-[70px]">Members</TableHead>
                      <TableHead className="text-xs font-semibold w-[60px]">Active</TableHead>
                      <TableHead className="w-[70px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow key={group.id} className="text-sm">
                        <TableCell className="font-mono font-medium">{group.abbreviation}</TableCell>
                        <TableCell>{group.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{group.email || "—"}</TableCell>
                        <TableCell className="text-center">{group.memberIds.length}</TableCell>
                        <TableCell>
                          <Badge variant={group.isActive ? "default" : "secondary"} className={group.isActive ? "bg-green-600 text-xs" : "text-xs"}>
                            {group.isActive ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditGroup(group)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { deleteGroup(group.id, userEmail); if (editingGroup?.id === group.id) resetGroupForm(); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {(isAddingGroup || editingGroup) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">{editingGroup ? "Edit Group" : "Add Group"}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Group Name *</Label>
                      <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Programme Managers" className="bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Abbreviation *</Label>
                      <Input value={groupAbbreviation} onChange={(e) => setGroupAbbreviation(e.target.value)} placeholder="e.g. PMs" className="bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Group Email</Label>
                      <Input value={groupEmail} onChange={(e) => setGroupEmail(e.target.value)} placeholder="group@nhs.uk" type="email" className="bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Brief purpose" className="bg-white" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Members</Label>
                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                      {people.filter((p) => p.isActive).map((person) => (
                        <label key={person.id} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
                          <Checkbox
                            checked={groupMemberIds.includes(person.id)}
                            onCheckedChange={() => toggleMember(person.id)}
                          />
                          {person.initials} - {person.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={groupIsActive} onCheckedChange={setGroupIsActive} />
                      <Label className="text-xs">Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={resetGroupForm}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveGroup} disabled={!groupName.trim() || !groupAbbreviation.trim()}>
                        {editingGroup ? "Save" : "Add"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!isAddingGroup && !editingGroup && (
                <Button variant="outline" size="sm" onClick={() => { resetGroupForm(); setIsAddingGroup(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Add Group
                </Button>
              )}
            </TabsContent>
          </Tabs>

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
