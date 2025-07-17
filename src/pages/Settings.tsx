import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { AttendeeManager } from "@/components/AttendeeManager";
import { PracticeManager } from "@/components/PracticeManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Users, Building, BookOpen, Search, Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface NHSTerm {
  id: string;
  term: string;
  definition: string;
  is_master: boolean;
  user_id: string | null;
  created_at: string;
}

export default function Settings() {
  const { user } = useAuth();
  
  // NHS Terms state
  const [terms, setTerms] = useState<NHSTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<NHSTerm[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<NHSTerm | null>(null);
  const [newTerm, setNewTerm] = useState({ term: "", definition: "" });

  // Fetch NHS terms
  const fetchTerms = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('nhs_terms')
        .select('*')
        .order('term', { ascending: true });

      if (error) throw error;
      setTerms(data || []);
    } catch (error) {
      console.error('Error fetching terms:', error);
      toast.error('Failed to load NHS terms');
    } finally {
      setLoading(false);
    }
  };

  // Filter terms based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTerms(terms);
    } else {
      const filtered = terms.filter(term =>
        term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.definition.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTerms(filtered);
    }
  }, [terms, searchQuery]);

  // Fetch terms on mount
  useEffect(() => {
    fetchTerms();
  }, [user]);

  // Add new term
  const handleAddTerm = async () => {
    if (!user || !newTerm.term.trim() || !newTerm.definition.trim()) {
      toast.error('Please fill in both term and definition');
      return;
    }

    try {
      const { error } = await supabase
        .from('nhs_terms')
        .insert({
          term: newTerm.term.trim(),
          definition: newTerm.definition.trim(),
          user_id: user.id,
          is_master: false
        });

      if (error) throw error;

      toast.success('Term added successfully');
      setNewTerm({ term: "", definition: "" });
      setShowAddForm(false);
      fetchTerms();
    } catch (error) {
      console.error('Error adding term:', error);
      toast.error('Failed to add term');
    }
  };

  // Update term
  const handleUpdateTerm = async (termId: string, updatedTerm: { term: string; definition: string }) => {
    if (!user || !updatedTerm.term.trim() || !updatedTerm.definition.trim()) {
      toast.error('Please fill in both term and definition');
      return;
    }

    try {
      const { error } = await supabase
        .from('nhs_terms')
        .update({
          term: updatedTerm.term.trim(),
          definition: updatedTerm.definition.trim()
        })
        .eq('id', termId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Term updated successfully');
      setEditingTerm(null);
      fetchTerms();
    } catch (error) {
      console.error('Error updating term:', error);
      toast.error('Failed to update term');
    }
  };

  // Delete term
  const handleDeleteTerm = async (termId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('nhs_terms')
        .delete()
        .eq('id', termId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Term deleted successfully');
      fetchTerms();
    } catch (error) {
      console.error('Error deleting term:', error);
      toast.error('Failed to delete term');
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} onHelp={() => {}} />
      
      <div className="container mx-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your attendees and practice details</p>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="attendees" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="attendees" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees
              </TabsTrigger>
              <TabsTrigger value="practices" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Practices
              </TabsTrigger>
              <TabsTrigger value="nhs-terms" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                NHS Terms
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendees" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Attendee Management
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Manage your regular meeting attendees. You can add frequently attending colleagues 
                    and mark some as default attendees for new meetings.
                  </p>
                </CardHeader>
              </Card>
              <AttendeeManager />
            </TabsContent>

            <TabsContent value="practices" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Practice Management
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Manage your practice details. You can set up multiple practices if you work 
                    across different locations or set one as your default practice for all meetings.
                  </p>
                </CardHeader>
              </Card>
              <PracticeManager />
            </TabsContent>

            <TabsContent value="nhs-terms" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    NHS Terminology
                  </CardTitle>
                  <p className="text-muted-foreground">
                    View master NHS terminology and manage your personal definitions.
                  </p>
                </CardHeader>
              </Card>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading NHS terms...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Search and Add Controls */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Search NHS terms..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Button
                          onClick={() => setShowAddForm(!showAddForm)}
                          variant="outline"
                          className="shrink-0"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Personal Term
                        </Button>
                      </div>

                      {/* Add Term Form */}
                      {showAddForm && (
                        <div className="mt-6 p-4 border rounded-lg bg-muted/20">
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Term</label>
                              <Input
                                placeholder="Enter NHS term"
                                value={newTerm.term}
                                onChange={(e) => setNewTerm({ ...newTerm, term: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Definition</label>
                              <Textarea
                                placeholder="Enter definition"
                                value={newTerm.definition}
                                onChange={(e) => setNewTerm({ ...newTerm, definition: e.target.value })}
                                rows={3}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleAddTerm} size="sm">
                                Add Term
                              </Button>
                              <Button 
                                onClick={() => {
                                  setShowAddForm(false);
                                  setNewTerm({ term: "", definition: "" });
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Terms Display */}
                  <div className="space-y-6">
                    {/* Master Terms */}
                    {filteredTerms.filter(term => term.is_master).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Master NHS Terms</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Official NHS terminology definitions
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {filteredTerms
                              .filter(term => term.is_master)
                              .map((term) => (
                                <div key={term.id} className="border-b border-border pb-4 last:border-b-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-foreground">{term.term}</h3>
                                        <Badge variant="secondary" className="text-xs">Master</Badge>
                                      </div>
                                      <p className="text-muted-foreground text-sm">{term.definition}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Personal Terms */}
                    {filteredTerms.filter(term => !term.is_master).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Your Personal Terms</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Terms you've added for your own reference
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {filteredTerms
                              .filter(term => !term.is_master)
                              .map((term) => (
                                <div key={term.id} className="border-b border-border pb-4 last:border-b-0">
                                  {editingTerm?.id === term.id ? (
                                    <div className="space-y-4">
                                      <div>
                                        <label className="text-sm font-medium">Term</label>
                                        <Input
                                          defaultValue={term.term}
                                          onChange={(e) => setEditingTerm({ ...editingTerm, term: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Definition</label>
                                        <Textarea
                                          defaultValue={term.definition}
                                          onChange={(e) => setEditingTerm({ ...editingTerm, definition: e.target.value })}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleUpdateTerm(term.id, {
                                            term: editingTerm.term,
                                            definition: editingTerm.definition
                                          })}
                                          size="sm"
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          onClick={() => setEditingTerm(null)}
                                          variant="outline"
                                          size="sm"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h3 className="font-semibold text-foreground">{term.term}</h3>
                                          <Badge variant="outline" className="text-xs">Personal</Badge>
                                        </div>
                                        <p className="text-muted-foreground text-sm">{term.definition}</p>
                                      </div>
                                      <div className="flex gap-2 ml-4">
                                        <Button
                                          onClick={() => setEditingTerm(term)}
                                          variant="ghost"
                                          size="sm"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          onClick={() => handleDeleteTerm(term.id)}
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* No Results */}
                    {filteredTerms.length === 0 && (
                      <Card>
                        <CardContent className="text-center py-8">
                          <p className="text-muted-foreground">
                            {searchQuery.trim() 
                              ? `No terms found matching "${searchQuery}"`
                              : "No NHS terms available. Add your first personal term above."
                            }
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};