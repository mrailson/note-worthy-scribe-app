import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import type { BoardMember, CreateBoardMemberData } from "@/types/boardMembers";

interface BoardMemberManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BoardMemberManagement = ({ open, onOpenChange }: BoardMemberManagementProps) => {
  const { members, createMember, updateMember, deleteMember } = useBoardMembers();
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateBoardMemberData>({
    name: "",
    role: "",
    group_name: "",
    email: "",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({ name: "", role: "", group_name: "", email: "", is_active: true });
    setEditingMember(null);
    setShowForm(false);
  };

  const handleEdit = (member: BoardMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      role: member.role || "",
      group_name: member.group_name || "",
      email: member.email || "",
      is_active: member.is_active,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      await updateMember.mutateAsync({ id: editingMember.id, ...formData });
    } else {
      await createMember.mutateAsync(formData);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      await deleteMember.mutateAsync(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Manage Board Members</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showForm ? (
            <>
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No board members yet. Add your first member above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.role || "-"}</TableCell>
                          <TableCell>{member.group_name || "-"}</TableCell>
                          <TableCell>
                            <Switch
                              checked={member.is_active}
                              onCheckedChange={(checked) =>
                                updateMember.mutate({ id: member.id, is_active: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(member)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(member.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {editingMember ? "Edit Member" : "Add New Member"}
                </h3>
                <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr Mark Gray"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Board Chair"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group_name">Group</Label>
                  <Input
                    id="group_name"
                    value={formData.group_name}
                    onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                    placeholder="e.g. Clinical, Admin"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingMember ? "Update" : "Add"} Member
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
