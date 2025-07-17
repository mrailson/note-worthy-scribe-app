import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, BookOpen, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";


interface NHSTerm {
  id: string;
  term: string;
  definition: string;
  is_master: boolean;
  user_id: string | null;
  created_at: string;
}

export default function NHSTerminology() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [terms, setTerms] = useState<NHSTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<NHSTerm[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<NHSTerm | null>(null);
  const [newTerm, setNewTerm] = useState({ term: "", definition: "" });

  useEffect(() => {
    if (user) {
      fetchTerms();
    }
  }, [user]);

  useEffect(() => {
    const filtered = terms.filter(
      (term) =>
        term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.definition.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTerms(filtered);
  }, [terms, searchQuery]);

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from("nhs_terms")
        .select("*")
        .order("is_master", { ascending: false })
        .order("term", { ascending: true });

      if (error) throw error;
      setTerms(data || []);
    } catch (error) {
      console.error("Error fetching terms:", error);
      toast({
        title: "Error",
        description: "Failed to fetch NHS terminology",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTerm = async () => {
    if (!newTerm.term.trim() || !newTerm.definition.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please fill in both term and definition",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("nhs_terms").insert({
        term: newTerm.term.trim(),
        definition: newTerm.definition.trim(),
        user_id: user?.id,
        is_master: false,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Term added successfully",
      });

      setNewTerm({ term: "", definition: "" });
      setShowAddForm(false);
      fetchTerms();
    } catch (error: any) {
      console.error("Error adding term:", error);
      if (error.code === "23505") {
        toast({
          title: "Duplicate Term",
          description: "This term already exists in your personal list",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add term",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpdateTerm = async () => {
    if (!editingTerm || !editingTerm.term.trim() || !editingTerm.definition.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please fill in both term and definition",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("nhs_terms")
        .update({
          term: editingTerm.term.trim(),
          definition: editingTerm.definition.trim(),
        })
        .eq("id", editingTerm.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Term updated successfully",
      });

      setEditingTerm(null);
      fetchTerms();
    } catch (error) {
      console.error("Error updating term:", error);
      toast({
        title: "Error",
        description: "Failed to update term",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTerm = async (termId: string) => {
    try {
      const { error } = await supabase.from("nhs_terms").delete().eq("id", termId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Term deleted successfully",
      });

      fetchTerms();
    } catch (error) {
      console.error("Error deleting term:", error);
      toast({
        title: "Error",
        description: "Failed to delete term",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">Loading NHS terminology...</div>
        </div>
      </div>
    );
  }

  const masterTerms = filteredTerms.filter((term) => term.is_master);
  const userTerms = filteredTerms.filter((term) => !term.is_master);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Page Header with Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            size="sm"
          >
            ← Back
          </Button>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">NHS Terminology</h1>
            </div>
            <p className="text-muted-foreground mt-2">
              Master terminology and your personal definitions for NHS GP Practice and PCN terms
            </p>
          </div>
          
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>

        {/* Search and Add */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search terms and definitions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Personal Term
              </Button>
            </div>

            {/* Add New Term Form */}
            {showAddForm && (
              <div className="mt-6 p-4 border rounded-lg bg-accent/30">
                <h3 className="text-lg font-semibold mb-4">Add New Personal Term</h3>
                <div className="space-y-4">
                  <Input
                    placeholder="Term (e.g., CCG)"
                    value={newTerm.term}
                    onChange={(e) => setNewTerm({ ...newTerm, term: e.target.value })}
                  />
                  <Textarea
                    placeholder="Definition"
                    value={newTerm.definition}
                    onChange={(e) => setNewTerm({ ...newTerm, definition: e.target.value })}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleAddTerm}>Save Term</Button>
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Master Terms Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Master NHS Terminology ({masterTerms.length})
              <Badge variant="secondary">Global</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {masterTerms.map((term) => (
                <div key={term.id} className="p-4 border rounded-lg bg-accent/10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-primary">{term.term}</h3>
                        <Badge variant="outline" className="text-xs">Master</Badge>
                      </div>
                      <p className="text-muted-foreground">{term.definition}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Personal Terms Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Your Personal Terms ({userTerms.length})
              <Badge variant="default">Personal</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userTerms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No personal terms yet</p>
                <p className="text-sm">Add your own NHS terminology definitions above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userTerms.map((term) => (
                  <div key={term.id} className="p-4 border rounded-lg">
                    {editingTerm?.id === term.id ? (
                      <div className="space-y-4">
                        <Input
                          value={editingTerm.term}
                          onChange={(e) => setEditingTerm({ ...editingTerm, term: e.target.value })}
                        />
                        <Textarea
                          value={editingTerm.definition}
                          onChange={(e) => setEditingTerm({ ...editingTerm, definition: e.target.value })}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdateTerm}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTerm(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-primary">{term.term}</h3>
                            <Badge variant="outline" className="text-xs">Personal</Badge>
                          </div>
                          <p className="text-muted-foreground">{term.definition}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTerm(term)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTerm(term.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}