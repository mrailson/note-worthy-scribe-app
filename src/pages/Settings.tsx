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
import { Settings as SettingsIcon, Users, Building, BookOpen, Search, Plus, Pencil, Trash2, X, Clock, HelpCircle, Mail, Globe, Github, ExternalLink, BarChart3, Calendar, Timer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  
  // Meeting retention policy state
  const [retentionPolicy, setRetentionPolicy] = useState<string>('forever');
  const [retentionLoading, setRetentionLoading] = useState(false);
  
  // Usage statistics state
  const [usageStats, setUsageStats] = useState({
    lastLogin: null as string | null,
    currentMonth: { meetings: 0, hours: 0 },
    lastMonth: { meetings: 0, hours: 0 },
    last12Months: { meetings: 0, hours: 0 }
  });
  const [statsLoading, setStatsLoading] = useState(false);

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

  // Fetch terms, retention policy, and usage stats on mount
  useEffect(() => {
    fetchTerms();
    fetchRetentionPolicy();
    fetchUsageStats();
  }, [user]);

  // Fetch retention policy
  const fetchRetentionPolicy = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('meeting_retention_policy')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.meeting_retention_policy) {
        setRetentionPolicy(data.meeting_retention_policy);
      }
    } catch (error) {
      console.error('Error fetching retention policy:', error);
    }
  };

  // Update retention policy
  const handleRetentionPolicyChange = async (value: string) => {
    if (!user) return;

    setRetentionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ meeting_retention_policy: value })
        .eq('user_id', user.id);

      if (error) throw error;

      setRetentionPolicy(value);
      toast.success('Meeting retention policy updated successfully');
    } catch (error) {
      console.error('Error updating retention policy:', error);
      toast.error('Failed to update retention policy');
    } finally {
      setRetentionLoading(false);
    }
  };

  // Fetch usage statistics
  const fetchUsageStats = async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      // Get user's last_sign_in_at from auth metadata
      const { data: authData } = await supabase.auth.getUser();
      const lastLogin = authData.user?.last_sign_in_at || null;

      // Calculate date ranges
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const last12MonthsStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);

      // Fetch meetings for different periods
      const [currentMonthData, lastMonthData, last12MonthsData] = await Promise.all([
        // Current month
        supabase
          .from('meetings')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString()),

        // Last month  
        supabase
          .from('meetings')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .gte('created_at', lastMonthStart.toISOString())
          .lt('created_at', currentMonthStart.toISOString()),

        // Last 12 months
        supabase
          .from('meetings')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .gte('created_at', last12MonthsStart.toISOString())
      ]);

      const calculateStats = (meetings: any[]) => ({
        meetings: meetings.length,
        hours: Math.round((meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / 60) * 10) / 10
      });

      setUsageStats({
        lastLogin,
        currentMonth: calculateStats(currentMonthData.data || []),
        lastMonth: calculateStats(lastMonthData.data || []),
        last12Months: calculateStats(last12MonthsData.data || [])
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

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
      <Header onNewMeeting={() => {}} />
      
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
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                General
              </TabsTrigger>
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
              <TabsTrigger value="help" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Help & About
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Meeting Retention Policy
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Choose how long to keep your meeting records in the system.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="retention-policy">Meeting Data Retention</Label>
                      <Select
                        value={retentionPolicy}
                        onValueChange={handleRetentionPolicyChange}
                        disabled={retentionLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select retention policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forever">Keep Forever</SelectItem>
                          <SelectItem value="after_email">Delete as soon as I have emailed the notes to me</SelectItem>
                          <SelectItem value="1_week">Delete after 1 week</SelectItem>
                          <SelectItem value="1_month">Delete after 1 month</SelectItem>
                          <SelectItem value="1_year">Delete after 1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">
                        <strong>Current setting:</strong> {
                          retentionPolicy === 'forever' ? 'Keep Forever (default)' :
                          retentionPolicy === 'after_email' ? 'Delete after emailing notes' :
                          retentionPolicy === '1_week' ? 'Delete after 1 week' :
                          retentionPolicy === '1_month' ? 'Delete after 1 month' :
                          retentionPolicy === '1_year' ? 'Delete after 1 year' : 'Keep Forever'
                        }
                      </p>
                      <p>
                        This setting affects all future meetings. Existing meetings will not be automatically deleted unless you change this setting.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Usage Statistics Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Usage Statistics
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Your account activity and meeting usage overview.
                  </p>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted-foreground">Loading statistics...</div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Last Login */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Account Activity</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Last login: </span>
                          {usageStats.lastLogin ? (
                            <span>{new Date(usageStats.lastLogin).toLocaleString()}</span>
                          ) : (
                            <span>Unknown</span>
                          )}
                        </div>
                      </div>

                      {/* Meeting Statistics */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Meeting Statistics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Current Month */}
                          <div className="p-4 border rounded-lg bg-accent/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">Current Month</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold text-primary">
                                {usageStats.currentMonth.meetings}
                              </div>
                              <div className="text-xs text-muted-foreground">meetings</div>
                              <div className="flex items-center gap-1 text-sm">
                                <Timer className="h-3 w-3" />
                                <span>{usageStats.currentMonth.hours}h</span>
                              </div>
                            </div>
                          </div>

                          {/* Last Month */}
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">Last Month</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold">
                                {usageStats.lastMonth.meetings}
                              </div>
                              <div className="text-xs text-muted-foreground">meetings</div>
                              <div className="flex items-center gap-1 text-sm">
                                <Timer className="h-3 w-3" />
                                <span>{usageStats.lastMonth.hours}h</span>
                              </div>
                            </div>
                          </div>

                          {/* Last 12 Months */}
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <BarChart3 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">Last 12 Months</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold">
                                {usageStats.last12Months.meetings}
                              </div>
                              <div className="text-xs text-muted-foreground">meetings</div>
                              <div className="flex items-center gap-1 text-sm">
                                <Timer className="h-3 w-3" />
                                <span>{usageStats.last12Months.hours}h</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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

            <TabsContent value="help" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Help & About
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Information about Notewell AI Meeting Notes Service and how to get help.
                  </p>
                </CardHeader>
              </Card>

              {/* About Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About Notewell AI</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">What is Notewell AI?</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Notewell AI is a comprehensive meeting notes service designed specifically for healthcare professionals. 
                      It provides AI-powered transcription, intelligent meeting summaries, and automated action item tracking 
                      to help you focus on what matters most - patient care and collaboration.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Key Features</h4>
                    <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
                      <li>Real-time meeting transcription with speaker identification</li>
                      <li>AI-generated meeting summaries with action items and key decisions</li>
                      <li>Support for multiple meeting types (Patient meetings, PCN meetings, ICB meetings, etc.)</li>
                      <li>Attendee and practice management</li>
                      <li>NHS terminology database</li>
                      <li>Secure data handling with configurable retention policies</li>
                      <li>Meeting history and search functionality</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Version Information</h4>
                    <p className="text-muted-foreground text-sm">
                      Notewell AI Meeting Notes Service v1.0.0
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Help Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Getting Help</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Quick Start Guide</h4>
                    <div className="text-muted-foreground text-sm space-y-2">
                      <p><strong>1. Set up your profile:</strong> Add your practice details and regular attendees in the Settings tabs.</p>
                      <p><strong>2. Start a meeting:</strong> Click "Start New Meeting" and configure your meeting settings.</p>
                      <p><strong>3. Record or import:</strong> Use live recording or import an audio file for transcription.</p>
                      <p><strong>4. Review results:</strong> Check your transcript, generate summaries, and export or email your notes.</p>
                      <p><strong>5. Manage history:</strong> Access all your meetings in the Meeting History section.</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Support Resources</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Email Support</p>
                          <p className="text-xs text-muted-foreground">malcolm.railson@nhs.net</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Documentation</p>
                          <Button variant="link" className="p-0 h-auto text-xs" asChild>
                            <a href="https://docs.notewell.ai" target="_blank" rel="noopener noreferrer">
                              Visit our documentation site
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Github className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">GitHub</p>
                          <Button variant="link" className="p-0 h-auto text-xs" asChild>
                            <a href="https://github.com/notewell-ai" target="_blank" rel="noopener noreferrer">
                              Report issues or contribute
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Privacy & Security</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Notewell AI is designed with healthcare data security in mind. All meeting data is encrypted in transit and at rest. 
                      You have full control over your data retention policies and can delete your data at any time. We comply with relevant 
                      healthcare data protection regulations.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">System Requirements</h4>
                    <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
                      <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
                      <li>Microphone access for live recording</li>
                      <li>Stable internet connection</li>
                      <li>JavaScript enabled</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};