import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useResponsibilities } from '@/hooks/useResponsibilities';
import { ResponsibilityForm } from './ResponsibilityForm';
import { AssignmentForm } from './AssignmentForm';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  UserPlus,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Responsibility } from '@/types/responsibilityTypes';

export function ResponsibilityList() {
  const { 
    responsibilities, 
    categories,
    loading, 
    archiveResponsibility 
  } = useResponsibilities();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [editingResponsibility, setEditingResponsibility] = useState<Responsibility | null>(null);
  const [assigningResponsibility, setAssigningResponsibility] = useState<Responsibility | null>(null);

  const filteredResponsibilities = responsibilities.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || r.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getFrequencyLabel = (type: string, value: number | null) => {
    switch (type) {
      case 'annual': return 'Annual';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'weekly': return 'Weekly';
      case 'one-off': return 'One-off';
      case 'custom': return `Every ${value} months`;
      default: return type;
    }
  };

  const getCategoryColour = (categoryId: string | null) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return 'bg-gray-500';
    switch (cat.colour) {
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-green-500';
      case 'purple': return 'bg-purple-500';
      case 'amber': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      case 'teal': return 'bg-teal-500';
      case 'pink': return 'bg-pink-500';
      case 'indigo': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const handleEdit = (responsibility: Responsibility) => {
    setEditingResponsibility(responsibility);
    setIsFormOpen(true);
  };

  const handleAssign = (responsibility: Responsibility) => {
    setAssigningResponsibility(responsibility);
    setIsAssignOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to archive this responsibility?')) {
      await archiveResponsibility(id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingResponsibility(null);
  };

  const handleAssignClose = () => {
    setIsAssignOpen(false);
    setAssigningResponsibility(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search responsibilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingResponsibility(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Responsibility
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingResponsibility ? 'Edit Responsibility' : 'Add New Responsibility'}
              </DialogTitle>
            </DialogHeader>
            <ResponsibilityForm 
              responsibility={editingResponsibility}
              onSuccess={handleFormClose}
              onCancel={handleFormClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Button>
        {categories.map(cat => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className="flex items-center gap-2"
          >
            <div className={cn("w-2 h-2 rounded-full", getCategoryColour(cat.id))} />
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Responsibilities list */}
      {filteredResponsibilities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {responsibilities.length === 0 
                ? 'No responsibilities defined yet. Add your first one!'
                : 'No responsibilities match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredResponsibilities.map(responsibility => (
            <Card key={responsibility.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-3 h-3 rounded-full", getCategoryColour(responsibility.category_id))} />
                      <h3 className="font-semibold truncate">{responsibility.title}</h3>
                      {responsibility.is_mandatory && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Mandatory
                        </Badge>
                      )}
                    </div>
                    {responsibility.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {responsibility.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        <Calendar className="h-3 w-3 mr-1" />
                        {getFrequencyLabel(responsibility.frequency_type, responsibility.frequency_value)}
                      </Badge>
                      {responsibility.category && (
                        <Badge variant="outline">{responsibility.category.name}</Badge>
                      )}
                      {responsibility.typical_due_month && (
                        <Badge variant="outline">
                          Due: Month {responsibility.typical_due_month}
                          {responsibility.typical_due_day && `, Day ${responsibility.typical_due_day}`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAssign(responsibility)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEdit(responsibility)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(responsibility.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assignment Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Assign: {assigningResponsibility?.title}
            </DialogTitle>
          </DialogHeader>
          {assigningResponsibility && (
            <AssignmentForm 
              responsibility={assigningResponsibility}
              onSuccess={handleAssignClose}
              onCancel={handleAssignClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
