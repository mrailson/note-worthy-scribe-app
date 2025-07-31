import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import EnhancedCQCAI from "@/components/EnhancedCQCAI";

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<CQCDomain[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

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

  const handleChatMessage = async () => {
    if (!currentMessage.trim() || chatLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: currentMessage,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setChatLoading(true);

    try {
      // Prepare practice context
      const practiceContext = {
        complianceStatus: domains.reduce((acc, domain) => {
          acc[domain.name] = domain.percentage;
          return acc;
        }, {} as Record<string, number>),
        recentAlerts: alerts.slice(0, 3),
        policies: [] // Would be populated from actual data
      };

      const response = await supabase.functions.invoke('cqc-ai-assistant', {
        body: {
          messages: [...chatMessages, userMessage],
          practiceContext
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: response.data.response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get AI response');
    } finally {
      setChatLoading(false);
    }
  };

  const exportChatSession = () => {
    const chatData = {
      session_date: new Date().toISOString(),
      messages: chatMessages,
      practice_context: {
        domains: domains.map(d => ({ name: d.name, percentage: d.percentage })),
        alerts_count: alerts.length
      }
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cqc-chat-session-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
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
    );
  }

  const daysUntilInspection = getDaysUntilInspection();

  return (
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CQC Domains */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                CQC Domain Compliance
              </CardTitle>
              <CardDescription>
                Traffic light system for the five CQC domains
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {domains.map((domain) => {
                const Icon = domainIcons[domain.name as keyof typeof domainIcons];
                const StatusIcon = getStatusIcon(domain.status);
                
                return (
                  <div key={domain.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <div>
                          <div className="font-medium capitalize">{domain.name.replace('_', '-')}</div>
                          <div className="text-sm text-muted-foreground">{domain.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${getStatusColor(domain.status).replace('bg-', 'text-')}`} />
                        <span className="font-medium">{domain.percentage}%</span>
                      </div>
                    </div>
                    <Progress value={domain.percentage} className="h-2" />
                    {domain.gaps.length > 0 && (
                      <div className="text-sm text-red-600">
                        Gaps: {domain.gaps.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Alerts & Tasks */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alerts & Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert) => (
                <Alert key={alert.id}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <span>{alert.title}</span>
                    <Badge variant={getPriorityColor(alert.priority)}>
                      {alert.priority}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    {alert.message}
                    {alert.due_date && (
                      <div className="text-xs mt-1">
                        Due: {new Date(alert.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced CQC AI Assistant */}
      {chatOpen && (
        <EnhancedCQCAI 
          practiceContext={{
            complianceStatus: domains.reduce((acc, domain) => {
              acc[domain.name] = domain.percentage;
              return acc;
            }, {} as Record<string, number>),
            recentAlerts: alerts.slice(0, 3),
            policies: [], // Would be populated from actual data
            practiceSettings
          }}
          onClose={() => setChatOpen(false)}
        />
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
  );
};

export default CQCCompliance;