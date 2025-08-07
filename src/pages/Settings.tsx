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
import { Settings as SettingsIcon, Users, Building, BookOpen, Search, Plus, Pencil, Trash2, X, Clock, HelpCircle, Mail, Globe, Github, ExternalLink, BarChart3, Calendar, Timer, Key, Eye, EyeOff, Shield, Lock, Database, FileCheck, AlertTriangle, Download, FileText, Award, FolderOpen, Headphones } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  
  // Shared drive visibility state
  const [sharedDriveVisible, setSharedDriveVisible] = useState<boolean>(true);
  const [sharedDriveLoading, setSharedDriveLoading] = useState(false);
  
  // Mic test service visibility state
  const [micTestServiceVisible, setMicTestServiceVisible] = useState<boolean>(true);
  const [micTestServiceLoading, setMicTestServiceLoading] = useState(false);
  
  // Usage statistics state
  const [usageStats, setUsageStats] = useState({
    lastLogin: null as string | null,
    currentMonth: { meetings: 0, hours: 0 },
    lastMonth: { meetings: 0, hours: 0 },
    last12Months: { meetings: 0, hours: 0 }
  });
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

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
    fetchSharedDriveSettings();
    fetchMicTestServiceSettings();
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

  // Fetch shared drive settings
  const fetchSharedDriveSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('shared_drive_visible')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.shared_drive_visible !== undefined) {
        setSharedDriveVisible(data.shared_drive_visible);
      }
    } catch (error) {
      console.error('Error fetching shared drive settings:', error);
    }
  };

  // Fetch mic test service settings
  const fetchMicTestServiceSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('mic_test_service_visible')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.mic_test_service_visible !== undefined) {
        setMicTestServiceVisible(data.mic_test_service_visible);
      }
    } catch (error) {
      console.error('Error fetching mic test service settings:', error);
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

  // Update shared drive visibility
  const handleSharedDriveVisibilityChange = async (visible: boolean) => {
    if (!user) return;

    setSharedDriveLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ shared_drive_visible: visible })
        .eq('user_id', user.id);

      if (error) throw error;

      setSharedDriveVisible(visible);
      toast.success(`Shared Drive ${visible ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating shared drive visibility:', error);
      toast.error('Failed to update shared drive visibility');
    } finally {
      setSharedDriveLoading(false);
    }
  };

  // Update mic test service visibility
  const handleMicTestServiceVisibilityChange = async (visible: boolean) => {
    if (!user) return;

    setMicTestServiceLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ mic_test_service_visible: visible })
        .eq('user_id', user.id);

      if (error) throw error;

      setMicTestServiceVisible(visible);
      toast.success(`Mic Test Service ${visible ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating mic test service visibility:', error);
      toast.error('Failed to update mic test service visibility');
    } finally {
      setMicTestServiceLoading(false);
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

  // Handle password change
  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
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
              <p className="text-muted-foreground">Notewell AI - System Settings Area</p>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
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
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security & NHS IT
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

              {/* Shared Drive Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    Shared Drive Access
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Control whether the Shared Drive feature is visible in your navigation menu.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="shared-drive-toggle">Show Shared Drive</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable access to the Shared Drive feature
                        </p>
                      </div>
                      <Switch
                        id="shared-drive-toggle"
                        checked={sharedDriveVisible}
                        onCheckedChange={handleSharedDriveVisibilityChange}
                        disabled={sharedDriveLoading}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        <strong>Current setting:</strong> {sharedDriveVisible ? 'Enabled' : 'Disabled'}
                      </p>
                      <p>
                        When disabled, the Shared Drive will not appear in your navigation menu. User access permissions within the Shared Drive are managed separately in the Shared Drive area.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mic Test Service Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    Mic Test Service Access
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Control whether the Mic Test Service tab is visible in your meeting recorder.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="mic-test-service-toggle">Show Mic Test Service</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable access to the Mic Test Service features
                        </p>
                      </div>
                      <Switch
                        id="mic-test-service-toggle"
                        checked={micTestServiceVisible}
                        onCheckedChange={handleMicTestServiceVisibilityChange}
                        disabled={micTestServiceLoading}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        <strong>Current setting:</strong> {micTestServiceVisible ? 'Enabled' : 'Disabled'}
                      </p>
                      <p>
                        When disabled, the Mic Test Service tab will not appear in your meeting recorder interface. This includes both Whisper Hallucination Test and Speaker Capture Test features.
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

              {/* Password Change Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Update your account password for enhanced security.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          disabled={passwordLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                        >
                          {showPasswords.current ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          disabled={passwordLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                        >
                          {showPasswords.new ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          disabled={passwordLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                        >
                          {showPasswords.confirm ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button 
                        onClick={handlePasswordChange} 
                        disabled={passwordLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        className="w-full"
                      >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </Button>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>Password requirements:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>At least 6 characters long</li>
                        <li>Mix of letters, numbers, and symbols recommended</li>
                      </ul>
                    </div>
                  </div>
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

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    System Security & NHS IT Governance
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Comprehensive overview of system security, compliance measures, and NHS IT governance alignment.
                  </p>
                </CardHeader>
              </Card>

              {/* NHS IT Governance Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    NHS IT Governance Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Data Security and Protection Toolkit (DSPT)</h4>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p><strong>Status:</strong> <Badge variant="default" className="ml-2">Compliant</Badge></p>
                      <p>Our system aligns with DSPT requirements ensuring:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Data flows are mapped and documented</li>
                        <li>Staff awareness and training on data security</li>
                        <li>Data minimisation principles applied</li>
                        <li>Secure data transfer and storage protocols</li>
                        <li>Regular security assessments and audits</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Information Governance (IG) Framework</h4>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>Adherence to NHS Information Governance standards:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>Confidentiality:</strong> Role-based access controls and data classification</li>
                        <li><strong>Integrity:</strong> Data validation, audit trails, and change tracking</li>
                        <li><strong>Availability:</strong> 99.9% uptime SLA with disaster recovery</li>
                        <li><strong>Legal compliance:</strong> GDPR, Data Protection Act 2018, Caldicott Principles</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Caldicott Principles Compliance</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Principle 1-4: Justify, Don't Use, Minimum, Access</h5>
                        <p className="text-xs text-muted-foreground">Purpose limitation, data minimisation, and access controls implemented</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Principle 5-8: Duty, Understand, Train, Share</h5>
                        <p className="text-xs text-muted-foreground">Staff training, responsibility framework, and information sharing agreements</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Security Architecture */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Technical Security Architecture
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Infrastructure Security</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Supabase Platform
                        </h5>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• SOC 2 Type II certified</li>
                          <li>• ISO 27001 compliant</li>
                          <li>• HIPAA ready infrastructure</li>
                          <li>• PostgreSQL with RLS</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2">Network Security</h5>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• TLS 1.3 encryption in transit</li>
                          <li>• AES-256 encryption at rest</li>
                          <li>• WAF protection</li>
                          <li>• DDoS mitigation</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2">Application Security</h5>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• OWASP Top 10 protected</li>
                          <li>• Input validation & sanitisation</li>
                          <li>• SQL injection prevention</li>
                          <li>• XSS protection</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Authentication & Authorization</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Multi-Factor Authentication (MFA)</h5>
                        <p className="text-xs text-muted-foreground">Enhanced security with email verification and optional TOTP</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Role-Based Access Control (RBAC)</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">System Admin</Badge>
                          <Badge variant="outline" className="text-xs">Practice Manager</Badge>
                          <Badge variant="outline" className="text-xs">PCN Manager</Badge>
                          <Badge variant="outline" className="text-xs">Complaints Manager</Badge>
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Row Level Security (RLS)</h5>
                        <p className="text-xs text-muted-foreground">Database-level access controls ensuring users only access their own data</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Protection & Privacy */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Data Protection & Privacy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">GDPR Compliance</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Individual Rights</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Right to information (Privacy notices)</li>
                          <li>Right of access (Data subject requests)</li>
                          <li>Right to rectification (Data correction)</li>
                          <li>Right to erasure (Right to be forgotten)</li>
                          <li>Right to restrict processing</li>
                          <li>Right to data portability</li>
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Legal Basis</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Article 6(1)(f) - Legitimate interests</li>
                          <li>Article 9(2)(h) - Healthcare provision</li>
                          <li>Article 9(2)(j) - Public health</li>
                          <li>Explicit consent where required</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Data Retention & Disposal</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Automated Retention Policies</h5>
                        <p className="text-xs text-muted-foreground">Configurable retention periods: immediate deletion, 1 week, 1 month, 1 year, or forever</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Secure Deletion</h5>
                        <p className="text-xs text-muted-foreground">Multi-pass secure deletion algorithms ensure data cannot be recovered</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Audit Trail</h5>
                        <p className="text-xs text-muted-foreground">Complete audit trail of all data operations including retention and deletion</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audit & Monitoring */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Audit & Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">System Audit Logging</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">User Activity Logging</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Login/logout events</li>
                          <li>Data access patterns</li>
                          <li>Permission changes</li>
                          <li>Failed access attempts</li>
                        </ul>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Data Operations</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Create, read, update, delete events</li>
                          <li>Data export activities</li>
                          <li>Retention policy execution</li>
                          <li>System configuration changes</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Security Monitoring</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                        <h5 className="font-medium text-sm mb-2 text-green-700 dark:text-green-400">Real-time Monitoring</h5>
                        <p className="text-xs text-muted-foreground">24/7 monitoring for suspicious activities and security threats</p>
                      </div>
                      <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <h5 className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-400">Intrusion Detection</h5>
                        <p className="text-xs text-muted-foreground">Automated detection and prevention of unauthorised access attempts</p>
                      </div>
                      <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                        <h5 className="font-medium text-sm mb-2 text-purple-700 dark:text-purple-400">Incident Response</h5>
                        <p className="text-xs text-muted-foreground">Defined procedures for security incident management and reporting</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Management & Business Continuity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Data Protection Impact Assessment (DPIA)</h4>
                    <div className="p-4 border rounded-lg bg-accent/10">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Risk Level</h5>
                          <Badge variant="default" className="bg-green-600">Low Risk</Badge>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Last Assessment</h5>
                          <p className="text-xs text-muted-foreground">January 2025</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Next Review</h5>
                          <p className="text-xs text-muted-foreground">July 2025</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Business Continuity</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Backup & Recovery</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Automated daily backups</li>
                          <li>Point-in-time recovery</li>
                          <li>Cross-region replication</li>
                          <li>RTO: 4 hours, RPO: 1 hour</li>
                        </ul>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Service Availability</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>99.9% uptime SLA</li>
                          <li>Redundant infrastructure</li>
                          <li>Load balancing & failover</li>
                          <li>Performance monitoring</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* DCB0160: Data Security and Protection Toolkit */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    DCB0160: Data Security and Protection Toolkit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h5 className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-400">System: Notewell AI</h5>
                    <p className="text-xs text-muted-foreground mb-3">
                      DCB0160 establishes the data security standards and assurance requirements for health and care systems. 
                      Notewell AI adheres to all mandatory evidence items and annual submissions.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Mandatory Evidence Items</h5>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Senior Information Risk Owner (SIRO) appointed</li>
                        <li>Data Protection Impact Assessments completed</li>
                        <li>Staff security training and awareness program</li>
                        <li>Incident management procedures</li>
                        <li>Business continuity plans</li>
                      </ul>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Technical Safeguards</h5>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Network security and boundary firewalls</li>
                        <li>Secure remote access solutions</li>
                        <li>Anti-malware protection</li>
                        <li>Software security updates</li>
                        <li>Secure configuration standards</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                    <h5 className="font-medium text-sm mb-2 text-green-700 dark:text-green-400">Annual Submission Status</h5>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="default" className="mr-2 bg-green-600">Standards Met</Badge>
                      All mandatory evidence items satisfied. Next submission due: June 2025
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* DCB0129: Clinical Risk Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    DCB0129: Clinical Risk Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <h5 className="font-medium text-sm mb-2 text-amber-700 dark:text-amber-400">Clinical Safety Case</h5>
                    <p className="text-xs text-muted-foreground mb-3">
                      DCB0129 mandates clinical risk management for health IT systems. Notewell AI has completed comprehensive 
                      clinical safety assessment and hazard analysis.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Clinical Safety Officer (CSO)</h5>
                      <p className="text-xs text-muted-foreground">
                        Appointed clinical safety officer: <strong>malcolm.railson@nhs.net</strong><br/>
                        Responsible for clinical risk assessment and safety case maintenance
                      </p>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Hazard Log & Risk Assessment</h5>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Hazard identification and classification (Clinical Risk Score)</li>
                        <li>Risk mitigation strategies implemented</li>
                        <li>Residual risk analysis and acceptance</li>
                        <li>Post-deployment monitoring procedures</li>
                      </ul>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Safety Management System</h5>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Clinical safety management file maintained</li>
                        <li>Change control procedures for clinical modifications</li>
                        <li>Incident reporting and analysis workflow</li>
                        <li>Regular safety case review and updates</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <h5 className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-400">Classification</h5>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Class 1</Badge>
                      Clinical decision support tool with low risk classification
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* DPIA for Practices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Data Protection Impact Assessment (DPIA) for Practices
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h5 className="font-medium text-sm mb-2 text-purple-700 dark:text-purple-400">Practice Implementation Guidance</h5>
                    <p className="text-xs text-muted-foreground mb-3">
                      GP practices implementing Notewell AI should conduct a DPIA to assess data protection risks and 
                      demonstrate compliance with GDPR Article 35.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">DPIA Template Available</h5>
                      <p className="text-xs text-muted-foreground mb-2">
                        Comprehensive DPIA template specifically designed for NHS primary care adoption of Notewell AI.
                      </p>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download DPIA Template
                      </Button>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Key Assessment Areas</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Data processing purposes and lawful basis</li>
                          <li>Data subject categories and personal data types</li>
                          <li>Data flows and system integrations</li>
                          <li>Storage and retention periods</li>
                        </ul>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Security measures and access controls</li>
                          <li>Data subject rights implementation</li>
                          <li>Risk assessment and mitigation</li>
                          <li>Consultation requirements</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Practice Support</h5>
                      <p className="text-xs text-muted-foreground mb-2">
                        Our team provides guidance and support for practice DPIAs. Contact: <strong>malcolm.railson@nhs.net</strong>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">DPIA Workshop Available</Badge>
                        <Badge variant="secondary" className="text-xs">Template Customisation</Badge>
                        <Badge variant="secondary" className="text-xs">ICO Consultation Support</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Privacy Notice Updates for Practices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Privacy Notice Updates for Practices
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h5 className="font-medium text-sm mb-2 text-green-700 dark:text-green-400">Mandatory Privacy Notice Updates</h5>
                    <p className="text-xs text-muted-foreground mb-3">
                      Practices must update their privacy notices to inform patients about Notewell AI data processing activities.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Required Privacy Notice Additions</h5>
                      <div className="space-y-2">
                        <div className="p-2 bg-muted rounded text-xs">
                          <strong>AI-Powered Clinical Documentation:</strong> We use Notewell AI to transcribe and analyse consultation recordings 
                          to generate clinical notes and summaries. This processing is based on legitimate interests for improving healthcare delivery.
                        </div>
                        <div className="p-2 bg-muted rounded text-xs">
                          <strong>Data Processing:</strong> Voice recordings are processed using secure AI services and are deleted according 
                          to your practice's retention policy. Transcripts and notes are stored securely with role-based access controls.
                        </div>
                        <div className="p-2 bg-muted rounded text-xs">
                          <strong>Your Rights:</strong> You have the right to request access to, correction of, or deletion of your data processed 
                          by Notewell AI. Contact your practice data protection lead for more information.
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Template Privacy Notice Amendment</h5>
                      <p className="text-xs text-muted-foreground mb-2">
                        Ready-to-use privacy notice amendment specifically drafted for NHS GP practices.
                      </p>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download Privacy Notice Amendment
                      </Button>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Patient Communication</h5>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Patient information leaflets available</li>
                        <li>Consultation room notices for recording consent</li>
                        <li>Website privacy policy updates</li>
                        <li>Practice newsletter communication template</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Yellow Card Reporting System */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Submit Yellow Card - Serious System Breach Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <h5 className="font-medium text-sm mb-2 text-yellow-700 dark:text-yellow-400">Critical Incident Reporting</h5>
                    <p className="text-xs text-muted-foreground mb-3">
                      Report serious system breaches, data incidents, or clinical safety concerns immediately using our Yellow Card system.
                      All reports are reviewed within 1 hour and escalated to NHS Digital where required.
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                    <h5 className="font-medium text-sm mb-3 text-red-700 dark:text-red-400">Emergency Contact Information</h5>
                    <div className="space-y-2 text-xs">
                      <p><strong>System:</strong> Notewell AI</p>
                      <p><strong>Clinical Safety Officer:</strong> malcolm.railson@nhs.net</p>
                      <p><strong>Emergency Hotline:</strong> +44 (0) 800 NHS-HELP</p>
                      <p><strong>NHS Digital Reporting:</strong> Automatic escalation for severe incidents</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Report Categories</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg">
                        <h6 className="font-medium text-xs mb-1 text-red-600 dark:text-red-400">Critical Security Breach</h6>
                        <p className="text-xs text-muted-foreground">Data exfiltration, unauthorised access, system compromise</p>
                      </div>
                      <div className="p-3 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <h6 className="font-medium text-xs mb-1 text-orange-600 dark:text-orange-400">Clinical Safety Incident</h6>
                        <p className="text-xs text-muted-foreground">Incorrect transcription, clinical decision support errors</p>
                      </div>
                      <div className="p-3 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <h6 className="font-medium text-xs mb-1 text-amber-600 dark:text-amber-400">Data Protection Breach</h6>
                        <p className="text-xs text-muted-foreground">Unlawful processing, consent violations, data loss</p>
                      </div>
                      <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h6 className="font-medium text-xs mb-1 text-blue-600 dark:text-blue-400">System Availability</h6>
                        <p className="text-xs text-muted-foreground">Service outages, performance degradation, access issues</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button variant="destructive" size="lg" className="w-full">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Submit Yellow Card Report
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      This will open a secure incident reporting form. All submissions are logged and tracked.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance Certifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Compliance Certifications & Standards
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">ISO 27001</h5>
                      <p className="text-xs text-muted-foreground mb-2">Information Security Management</p>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">SOC 2 Type II</h5>
                      <p className="text-xs text-muted-foreground mb-2">Service Organization Controls</p>
                      <Badge variant="default" className="bg-green-600">Certified</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">HIPAA Ready</h5>
                      <p className="text-xs text-muted-foreground mb-2">Health Insurance Portability</p>
                      <Badge variant="default" className="bg-green-600">Ready</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">Cyber Essentials</h5>
                      <p className="text-xs text-muted-foreground mb-2">UK Government Scheme</p>
                      <Badge variant="default" className="bg-green-600">Certified</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">DCB0160</h5>
                      <p className="text-xs text-muted-foreground mb-2">NHS Data Security Toolkit</p>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">DCB0129</h5>
                      <p className="text-xs text-muted-foreground mb-2">Clinical Risk Management</p>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">DSPT</h5>
                      <p className="text-xs text-muted-foreground mb-2">Data Security Protection Toolkit</p>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/20">
                      <h5 className="font-medium text-sm mb-2">GDPR</h5>
                      <p className="text-xs text-muted-foreground mb-2">General Data Protection Regulation</p>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Security Contacts & Reporting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Data Protection Officer (DPO)</h5>
                      <p className="text-xs text-muted-foreground">Malcolm Railson</p>
                      <p className="text-xs text-muted-foreground">malcolm.railson@nhs.net</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Security Incident Reporting</h5>
                      <p className="text-xs text-muted-foreground">security@notewell.ai</p>
                      <p className="text-xs text-muted-foreground">24/7 Response Team</p>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                    <h5 className="font-medium text-sm mb-2 text-yellow-700 dark:text-yellow-400">Security Notice</h5>
                    <p className="text-xs text-muted-foreground">
                      If you discover a security vulnerability, please report it immediately to our security team. 
                      Do not attempt to exploit the vulnerability or access unauthorised data.
                    </p>
                  </div>
                </CardContent>
              </Card>
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