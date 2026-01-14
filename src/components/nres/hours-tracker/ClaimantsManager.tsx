import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useNRESClaimants, NRESClaimant } from '@/hooks/useNRESClaimants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ClaimantsManager() {
  const { claimants, loading, saving, addClaimant, updateClaimant, deleteClaimant } = useNRESClaimants();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClaimant, setEditingClaimant] = useState<NRESClaimant | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState<'gp' | 'pm'>('gp');

  const resetForm = () => {
    setName('');
    setRole('gp');
    setEditingClaimant(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    const result = await addClaimant(name.trim(), role);
    if (result) {
      resetForm();
      setIsAddOpen(false);
    }
  };

  const handleEdit = (claimant: NRESClaimant) => {
    setEditingClaimant(claimant);
    setName(claimant.name);
    setRole(claimant.role);
  };

  const handleUpdate = async () => {
    if (!editingClaimant || !name.trim()) return;
    const result = await updateClaimant(editingClaimant.id, { name: name.trim(), role });
    if (result) {
      resetForm();
    }
  };

  const handleToggleActive = async (claimant: NRESClaimant) => {
    await updateClaimant(claimant.id, { is_active: !claimant.is_active });
  };

  const handleDelete = async (id: string) => {
    await deleteClaimant(id);
  };

  const getRateLabel = (role: string) => {
    return role === 'gp' ? '£100/hr' : '£50/hr';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Manage Claimants
            <Badge variant="secondary" className="ml-2">{claimants.length}</Badge>
          </CardTitle>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Claimant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Claimant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="claimant-name" className="text-sm">Name</Label>
                  <Input
                    id="claimant-name"
                    placeholder="Enter claimant name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="claimant-role" className="text-sm">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as 'gp' | 'pm')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gp">GP (£100/hr)</SelectItem>
                      <SelectItem value="pm">Practice Manager (£50/hr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={saving || !name.trim()}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Claimant
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {claimants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No claimants added yet. Add your first claimant to start tracking hours for GPs and Practice Managers.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Rate</TableHead>
                <TableHead className="text-xs">Active</TableHead>
                <TableHead className="text-xs w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claimants.map((claimant) => (
                <TableRow key={claimant.id} className={!claimant.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{claimant.name}</TableCell>
                  <TableCell>
                    <Badge variant={claimant.role === 'gp' ? 'default' : 'secondary'}>
                      {claimant.role === 'gp' ? 'GP' : 'PM'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{getRateLabel(claimant.role)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={claimant.is_active}
                      onCheckedChange={() => handleToggleActive(claimant)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(claimant)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Claimant</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{claimant.name}"? This won't affect existing hours entries.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(claimant.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingClaimant} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Claimant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name" className="text-sm">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-role" className="text-sm">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'gp' | 'pm')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gp">GP (£100/hr)</SelectItem>
                    <SelectItem value="pm">Practice Manager (£50/hr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
