import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, Palette } from 'lucide-react';
import { useResponsibilities } from '@/hooks/useResponsibilities';
import { CATEGORY_COLOURS } from '@/types/responsibilityTypes';
import { cn } from '@/lib/utils';

export function CategoryManager() {
  const { categories, createCategory, updateCategory, deleteCategory, saving } = useResponsibilities();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; description: string; colour: string } | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', colour: 'blue' });

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', colour: 'blue' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: typeof categories[0]) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      description: category.description || '',
      colour: category.colour,
    });
    setFormData({
      name: category.name,
      description: category.description || '',
      colour: category.colour,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    if (editingCategory) {
      await updateCategory(editingCategory.id, formData);
    } else {
      await createCategory(formData);
    }
    
    setIsDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', colour: 'blue' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      await deleteCategory(id);
    }
  };

  const getColourClass = (colour: string) => {
    const colourObj = CATEGORY_COLOURS.find(c => c.value === colour);
    return colourObj?.class || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Categories
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Edit Category' : 'Create Category'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., HR, IT, Quality"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Colour</Label>
                  <Select 
                    value={formData.colour} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, colour: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-4 h-4 rounded", getColourClass(formData.colour))} />
                          {CATEGORY_COLOURS.find(c => c.value === formData.colour)?.label}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_COLOURS.map(colour => (
                        <SelectItem key={colour.value} value={colour.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-4 h-4 rounded", colour.class)} />
                            {colour.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={saving || !formData.name.trim()}
                  >
                    {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No categories created yet. Add your first category to organise responsibilities.
            </p>
          ) : (
            <div className="grid gap-3">
              {categories.map(category => (
                <div 
                  key={category.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-4 h-4 rounded", getColourClass(category.colour))} />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenEdit(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Setup Info */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Follow these steps to set up your responsibility tracker:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Create categories to organise your responsibilities (e.g., HR, IT, Quality)</li>
            <li>Go to the <strong>Responsibilities</strong> tab and add your practice responsibilities</li>
            <li>Assign responsibilities to roles or team members</li>
            <li>View and manage tasks in the <strong>Calendar</strong> or <strong>By Role</strong> views</li>
          </ol>
          <p className="text-muted-foreground">
            Suggested categories based on typical practice management areas:
          </p>
          <div className="flex flex-wrap gap-2">
            {['HR', 'IT/Facilities', 'Contracts/Quality', 'Finance', 'Health & Safety', 'Clinical'].map(cat => (
              <span key={cat} className="px-2 py-1 bg-muted rounded text-sm">{cat}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
