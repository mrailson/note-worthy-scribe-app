import { useState } from 'react';
import { Plus, Hospital, Trash2, Edit2, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useReferralDestinations } from '@/hooks/useReferralDestinations';
import { ReferralDestination } from '@/types/referral';

interface DestinationFormData {
  hospital_name: string;
  department: string;
  contact_name: string;
  email: string;
  phone: string;
  specialty_keywords: string;
}

const emptyFormData: DestinationFormData = {
  hospital_name: '',
  department: '',
  contact_name: '',
  email: '',
  phone: '',
  specialty_keywords: ''
};

export const ReferralDestinationsManager = () => {
  const { destinations, isLoading, addDestination, updateDestination, deleteDestination } = useReferralDestinations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DestinationFormData>(emptyFormData);

  const handleOpenDialog = (destination?: ReferralDestination) => {
    if (destination) {
      setEditingId(destination.id);
      setFormData({
        hospital_name: destination.hospital_name,
        department: destination.department,
        contact_name: destination.contact_name || '',
        email: destination.email || '',
        phone: destination.phone || '',
        specialty_keywords: destination.specialty_keywords?.join(', ') || ''
      });
    } else {
      setEditingId(null);
      setFormData(emptyFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(emptyFormData);
  };

  const handleSubmit = async () => {
    if (!formData.hospital_name.trim() || !formData.department.trim()) {
      return;
    }

    const destinationData = {
      hospital_name: formData.hospital_name.trim(),
      department: formData.department.trim(),
      contact_name: formData.contact_name.trim() || undefined,
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      specialty_keywords: formData.specialty_keywords.trim() 
        ? formData.specialty_keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        : undefined
    };

    if (editingId) {
      await updateDestination(editingId, destinationData);
    } else {
      await addDestination(destinationData);
    }
    
    handleCloseDialog();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this referral destination?')) {
      await deleteDestination(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hospital className="h-5 w-5" />
              Referral Destinations
            </CardTitle>
            <CardDescription>
              Manage hospitals, departments and contacts for referrals. These will be suggested when creating referrals in GP Scribe.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Destination
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Referral Destination' : 'Add Referral Destination'}
                </DialogTitle>
                <DialogDescription>
                  Enter the hospital, department and contact details for referrals.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hospital_name">Hospital Name *</Label>
                  <Input
                    id="hospital_name"
                    value={formData.hospital_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, hospital_name: e.target.value }))}
                    placeholder="e.g., Northampton General Hospital"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="e.g., Cardiology, Orthopaedics"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    placeholder="e.g., Dr John Smith"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="referrals@ngh.nhs.uk"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="01onal 123456"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty_keywords">Specialty Keywords</Label>
                  <Input
                    id="specialty_keywords"
                    value={formData.specialty_keywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialty_keywords: e.target.value }))}
                    placeholder="cardiology, heart, cardiac, chest pain"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords to help auto-match this destination when creating referrals
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!formData.hospital_name.trim() || !formData.department.trim()}
                >
                  {editingId ? 'Save Changes' : 'Add Destination'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading destinations...</p>
          </div>
        ) : destinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No referral destinations yet</p>
            <p className="text-sm text-muted-foreground">
              Add hospitals and departments to speed up your referral workflow
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Keywords</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {destinations.map((dest) => (
                  <TableRow key={dest.id}>
                    <TableCell className="font-medium">{dest.hospital_name}</TableCell>
                    <TableCell>{dest.department}</TableCell>
                    <TableCell>
                      {dest.contact_name && (
                        <div className="text-sm">{dest.contact_name}</div>
                      )}
                      {dest.email && (
                        <div className="text-xs text-muted-foreground">{dest.email}</div>
                      )}
                      {dest.phone && (
                        <div className="text-xs text-muted-foreground">{dest.phone}</div>
                      )}
                      {!dest.contact_name && !dest.email && !dest.phone && (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {dest.specialty_keywords?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {dest.specialty_keywords.slice(0, 3).map((kw, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                          {dest.specialty_keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{dest.specialty_keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(dest)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(dest.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
