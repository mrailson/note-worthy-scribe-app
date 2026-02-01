import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Trash2, 
  Edit, 
  FileText, 
  Clock, 
  Receipt, 
  PoundSterling,
  Calendar,
  TrendingUp,
  Upload,
  Download,
  Building
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';

interface DevelopmentCost {
  id: string;
  user_id: string;
  cost_date: string;
  cost_type: string;
  category: string;
  description: string | null;
  amount: number;
  hours: number | null;
  hourly_rate: number | null;
  vendor: string | null;
  invoice_reference: string | null;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const COST_CATEGORIES = [
  'Lovable Platform',
  'AI API Costs',
  'Supabase',
  'Domain & Hosting',
  'Design & Assets',
  'Development Time',
  'Consulting',
  'Testing',
  'Documentation',
  'Training',
  'Other'
] as const;

const COST_TYPES = [
  { value: 'invoice', label: 'Invoice', icon: Receipt },
  { value: 'time', label: 'Time Entry', icon: Clock },
  { value: 'subscription', label: 'Subscription', icon: Building },
  { value: 'other', label: 'Other', icon: FileText }
] as const;

export const DevelopmentCosts = () => {
  const { user } = useAuth();
  const [costs, setCosts] = useState<DevelopmentCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCost, setEditingCost] = useState<DevelopmentCost | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    cost_date: format(new Date(), 'yyyy-MM-dd'),
    cost_type: 'invoice' as string,
    category: '',
    description: '',
    amount: '',
    hours: '',
    hourly_rate: '50',
    vendor: '',
    invoice_reference: '',
    notes: ''
  });

  useEffect(() => {
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('development_costs')
        .select('*')
        .order('cost_date', { ascending: false });

      if (error) throw error;
      setCosts(data || []);
    } catch (error) {
      console.error('Error fetching development costs:', error);
      toast.error('Failed to load development costs');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      cost_date: format(new Date(), 'yyyy-MM-dd'),
      cost_type: 'invoice',
      category: '',
      description: '',
      amount: '',
      hours: '',
      hourly_rate: '50',
      vendor: '',
      invoice_reference: '',
      notes: ''
    });
    setUploadedFile(null);
    setEditingCost(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (cost: DevelopmentCost) => {
    setEditingCost(cost);
    setFormData({
      cost_date: cost.cost_date,
      cost_type: cost.cost_type,
      category: cost.category,
      description: cost.description || '',
      amount: cost.amount.toString(),
      hours: cost.hours?.toString() || '',
      hourly_rate: cost.hourly_rate?.toString() || '50',
      vendor: cost.vendor || '',
      invoice_reference: cost.invoice_reference || '',
      notes: cost.notes || ''
    });
    setShowAddModal(true);
  };

  const handleFileUpload = (files: File[]) => {
    if (files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  const uploadFileToStorage = async (file: File): Promise<{ path: string; name: string } | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `development-costs/${fileName}`;

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (error) throw error;
      return { path: filePath, name: file.name };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setSaving(true);

      let filePath = editingCost?.file_path || null;
      let fileName = editingCost?.file_name || null;

      // Upload file if provided
      if (uploadedFile) {
        const uploadResult = await uploadFileToStorage(uploadedFile);
        if (uploadResult) {
          filePath = uploadResult.path;
          fileName = uploadResult.name;
        }
      }

      // Calculate amount for time entries
      let amount = parseFloat(formData.amount) || 0;
      if (formData.cost_type === 'time' && formData.hours) {
        const hours = parseFloat(formData.hours);
        const rate = parseFloat(formData.hourly_rate) || 50;
        amount = hours * rate;
      }

      const costData = {
        user_id: user.id,
        cost_date: formData.cost_date,
        cost_type: formData.cost_type,
        category: formData.category,
        description: formData.description || null,
        amount,
        hours: formData.hours ? parseFloat(formData.hours) : null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        vendor: formData.vendor || null,
        invoice_reference: formData.invoice_reference || null,
        file_path: filePath,
        file_name: fileName,
        notes: formData.notes || null
      };

      if (editingCost) {
        const { error } = await supabase
          .from('development_costs')
          .update(costData)
          .eq('id', editingCost.id);

        if (error) throw error;
        toast.success('Cost entry updated');
      } else {
        const { error } = await supabase
          .from('development_costs')
          .insert(costData);

        if (error) throw error;
        toast.success('Cost entry added');
      }

      setShowAddModal(false);
      resetForm();
      fetchCosts();
    } catch (error) {
      console.error('Error saving cost:', error);
      toast.error('Failed to save cost entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cost entry?')) return;

    try {
      const { error } = await supabase
        .from('development_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Cost entry deleted');
      fetchCosts();
    } catch (error) {
      console.error('Error deleting cost:', error);
      toast.error('Failed to delete cost entry');
    }
  };

  // Calculate totals
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalHours = costs.filter(c => c.cost_type === 'time').reduce((sum, c) => sum + Number(c.hours || 0), 0);
  const invoiceTotal = costs.filter(c => c.cost_type === 'invoice').reduce((sum, c) => sum + Number(c.amount), 0);
  const timeTotal = costs.filter(c => c.cost_type === 'time').reduce((sum, c) => sum + Number(c.amount), 0);
  const subscriptionTotal = costs.filter(c => c.cost_type === 'subscription').reduce((sum, c) => sum + Number(c.amount), 0);

  // Group by category
  const categoryTotals = costs.reduce((acc, cost) => {
    acc[cost.category] = (acc[cost.category] || 0) + Number(cost.amount);
    return acc;
  }, {} as Record<string, number>);

  // Group by month
  const monthlyTotals = costs.reduce((acc, cost) => {
    const month = format(parseISO(cost.cost_date), 'MMM yyyy');
    acc[month] = (acc[month] || 0) + Number(cost.amount);
    return acc;
  }, {} as Record<string, number>);

  const getCostTypeIcon = (type: string) => {
    const found = COST_TYPES.find(t => t.value === type);
    return found ? found.icon : FileText;
  };

  const getCostTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'invoice': return 'default';
      case 'time': return 'secondary';
      case 'subscription': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Notewell AI Development Costs
          </h2>
          <p className="text-muted-foreground">
            Open book tracking of all development expenses since June 2025
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-primary" />
              Total Investment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalCosts.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{costs.length} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-500" />
              Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{invoiceTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{costs.filter(c => c.cost_type === 'invoice').length} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              Time Invested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)} hrs</div>
            <p className="text-xs text-muted-foreground">£{timeTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })} value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building className="h-4 w-4 text-purple-500" />
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{subscriptionTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{costs.filter(c => c.cost_type === 'subscription').length} subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              Since June 2025
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(monthlyTotals).length} months</div>
            <p className="text-xs text-muted-foreground">of development</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([category, total]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="font-medium">{category}</span>
                    <span className="text-muted-foreground">£{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              {Object.keys(categoryTotals).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No costs recorded yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Breakdown by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(monthlyTotals)
                .slice(0, 12)
                .map(([month, total]) => (
                  <div key={month} className="flex items-center justify-between">
                    <span className="font-medium">{month}</span>
                    <span className="text-muted-foreground">£{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              {Object.keys(monthlyTotals).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No costs recorded yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Cost Entries</CardTitle>
          <CardDescription>Complete transparent record of all development costs</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading costs...</div>
          ) : costs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cost entries yet. Click "Add Entry" to start tracking.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.map((cost) => {
                    const TypeIcon = getCostTypeIcon(cost.cost_type);
                    return (
                      <TableRow key={cost.id}>
                        <TableCell className="font-mono text-sm">
                          {format(parseISO(cost.cost_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getCostTypeBadgeVariant(cost.cost_type)} className="flex items-center gap-1 w-fit">
                            <TypeIcon className="h-3 w-3" />
                            {cost.cost_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{cost.category}</TableCell>
                        <TableCell className="max-w-xs truncate">{cost.description}</TableCell>
                        <TableCell>{cost.vendor || '-'}</TableCell>
                        <TableCell className="text-right">
                          {cost.hours ? `${cost.hours}h` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          £{Number(cost.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cost.invoice_reference || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(cost)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(cost.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCost ? 'Edit Cost Entry' : 'Add Cost Entry'}</DialogTitle>
            <DialogDescription>
              Record an invoice, time entry, or subscription cost
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_date">Date</Label>
                <Input
                  id="cost_date"
                  type="date"
                  value={formData.cost_date}
                  onChange={(e) => setFormData({ ...formData, cost_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_type">Type</Label>
                <Select
                  value={formData.cost_type}
                  onValueChange={(value) => setFormData({ ...formData, cost_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COST_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the cost"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor / Source</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g., Lovable, OpenAI, Supabase"
              />
            </div>

            {formData.cost_type === 'time' ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    placeholder="50.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calculated Amount</Label>
                  <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-muted-foreground">
                    £{((parseFloat(formData.hours) || 0) * (parseFloat(formData.hourly_rate) || 50)).toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (£)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invoice_reference">Invoice / Reference Number</Label>
              <Input
                id="invoice_reference"
                value={formData.invoice_reference}
                onChange={(e) => setFormData({ ...formData, invoice_reference: e.target.value })}
                placeholder="e.g., INV-2025-001"
              />
            </div>

            <div className="space-y-2">
              <Label>Attachment (Invoice/Receipt)</Label>
              <SimpleFileUpload
                onFileUpload={handleFileUpload}
                multiple={false}
                maxSize={10}
              />
              {uploadedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {uploadedFile.name}
                </p>
              )}
              {editingCost?.file_name && !uploadedFile && (
                <p className="text-sm text-muted-foreground">
                  Current file: {editingCost.file_name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formData.category}>
                {saving ? 'Saving...' : editingCost ? 'Update Entry' : 'Add Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
