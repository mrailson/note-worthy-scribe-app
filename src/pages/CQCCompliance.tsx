import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Shield, 
  Heart, 
  Users, 
  Clock, 
  Award, 
  AlertTriangle, 
  FileText, 
  MessageSquare,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import EnhancedCQCAI from "@/components/EnhancedCQCAI";
import CQCDomainCard from "@/components/CQCDomainCard";
import CQCAlertsPanel from "@/components/CQCAlertsPanel";

interface CQCDomain {
  name: string;
  description: string;
  percentage: number;
  status: 'compliant' | 'warning' | 'critical';
  gaps: string[];
}

interface ComplianceAlert {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: string;
  due_date?: string;
}

interface PracticeSettings {
  next_inspection_date?: string;
  last_inspection_date?: string;
  current_rating?: string;
}

const CQCCompliance = () => {
  const { user, loading: authLoading, hasModuleAccess } = useAuth();
  const [loading, setLoading] = useState(true);

  // Show login form if not authenticated
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <LoginForm />;
  }

  // Check if user has access to CQC compliance
  if (!hasModuleAccess('cqc_compliance')) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto p-6">
          <Alert className="max-w-md mx-auto">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              You don't have access to the CQC Compliance service. Please contact your administrator to enable this feature.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  const handleNewMeeting = () => {
    // Navigation logic for new meeting
  };
  const [domains, setDomains] = useState<CQCDomain[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [showMoreDomains, setShowMoreDomains] = useState(false);

  const domainIcons = {
    safe: Shield,
    effective: Heart,
    caring: Users,
    responsive: Clock,
    well_led: Award
  };

  const getDaysUntilInspection = () => {
    if (!practiceSettings.next_inspection_date) return null;
    const today = new Date();
    const inspectionDate = new Date(practiceSettings.next_inspection_date);
    const diffTime = inspectionDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'critical': return XCircle;
      default: return AlertTriangle;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load mock data for demonstration
      // In production, this would query the actual CQC tables
      const mockDomains: CQCDomain[] = [
        {
          name: 'safe',
          description: 'People are protected from abuse and avoidable harm',
          percentage: 85,
          status: 'warning',
          gaps: ['Fire Drill logs missing', 'Infection Control Policy update required']
        },
        {
          name: 'effective',
          description: 'Care, treatment and support achieves good outcomes',
          percentage: 100,
          status: 'compliant',
          gaps: []
        },
        {
          name: 'caring',
          description: 'Staff involve and treat people with compassion',
          percentage: 100,
          status: 'compliant',
          gaps: []
        },
        {
          name: 'responsive',
          description: 'Services are organised to meet people\'s needs',
          percentage: 80,
          status: 'warning',
          gaps: ['Patient feedback report missing']
        },
        {
          name: 'well_led',
          description: 'Leadership, management and governance assures delivery',
          percentage: 70,
          status: 'critical',
          gaps: ['Staff appraisals overdue', 'Business continuity plan review needed']
        }
      ];

      const mockAlerts: ComplianceAlert[] = [
        {
          id: '1',
          title: 'Policy Expiring Soon',
          message: 'Infection Control Policy expires in 7 days',
          priority: 'high',
          type: 'policy_expiry',
          due_date: '2024-02-07'
        },
        {
          id: '2',
          title: 'Training Overdue',
          message: '3 staff members have overdue mandatory training',
          priority: 'medium',
          type: 'training',
          due_date: '2024-01-31'
        },
        {
          id: '3',
          title: 'Fire Drill Required',
          message: 'Quarterly fire drill not completed',
          priority: 'high',
          type: 'safety_drill'
        }
      ];

      const mockSettings: PracticeSettings = {
        next_inspection_date: '2024-05-15',
        last_inspection_date: '2022-03-20',
        current_rating: 'Good'
      };

      setDomains(mockDomains);
      setAlerts(mockAlerts);
      setPracticeSettings(mockSettings);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const daysUntilInspection = getDaysUntilInspection();

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">CQC Compliance Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your practice's compliance status and prepare for inspections
            </p>
          </div>
          <Button 
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Ask CQC Assistant
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Inspection</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {daysUntilInspection ? `${daysUntilInspection} days` : 'Not scheduled'}
              </div>
              <p className="text-xs text-muted-foreground">
                {practiceSettings.next_inspection_date ? 
                  `Due: ${new Date(practiceSettings.next_inspection_date).toLocaleDateString()}` : 
                  'Set your inspection date'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Rating</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{practiceSettings.current_rating || 'Not rated'}</div>
              <p className="text-xs text-muted-foreground">
                Last inspection: {practiceSettings.last_inspection_date ? 
                  new Date(practiceSettings.last_inspection_date).toLocaleDateString() : 
                  'Never'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alerts.length}</div>
              <p className="text-xs text-muted-foreground">
                {alerts.filter(a => a.priority === 'urgent' || a.priority === 'high').length} high priority
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CQC Domains Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                CQC Domain Compliance
              </h2>
              <p className="text-muted-foreground">
                Traffic light system for the five CQC domains
              </p>
            </div>
          </div>

          {/* Display first 2 domains, then show more button */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {domains.slice(0, showMoreDomains ? domains.length : 2).map((domain, index) => (
              <CQCDomainCard key={domain.name} domain={domain} index={index} />
            ))}
          </div>

          {domains.length > 2 && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setShowMoreDomains(!showMoreDomains)}
                className="flex items-center gap-2"
              >
                {showMoreDomains ? 'Show Less' : `Show ${domains.length - 2} More Domains`}
                <ChevronDown className={`h-4 w-4 transition-transform ${showMoreDomains ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          )}
        </div>

        {/* Alerts & Tasks Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CQCAlertsPanel alerts={alerts} />
          </div>
          
          {/* Overall Compliance Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Overall Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {Math.round(domains.reduce((acc, domain) => acc + domain.percentage, 0) / domains.length)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Average Compliance</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Compliant Domains</span>
                    <span className="font-medium text-green-600">
                      {domains.filter(d => d.status === 'compliant').length}/{domains.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Critical Issues</span>
                    <span className="font-medium text-red-600">
                      {domains.filter(d => d.status === 'critical').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>High Priority Alerts</span>
                    <span className="font-medium text-orange-600">
                      {alerts.filter(a => a.priority === 'urgent' || a.priority === 'high').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced CQC AI Assistant */}
        {chatOpen && (
          <div className="max-w-none mb-8">
            <EnhancedCQCAI 
              practiceContext={{
                complianceStatus: domains.reduce((acc, domain) => {
                  acc[domain.name] = domain.percentage;
                  return acc;
                }, {} as Record<string, number>),
                recentAlerts: alerts.slice(0, 3),
                policies: [],
                practiceSettings
              }}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-20 flex-col">
                <FileText className="h-6 w-6 mb-2" />
                Upload Policy
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <Shield className="h-6 w-6 mb-2" />
                Add Evidence
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <CheckCircle className="h-6 w-6 mb-2" />
                Self Assessment
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <Calendar className="h-6 w-6 mb-2" />
                Set Inspection Date
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CQCCompliance;