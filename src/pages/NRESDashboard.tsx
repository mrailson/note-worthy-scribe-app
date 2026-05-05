import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { DashboardHeader } from "@/components/nres/DashboardHeader";
import { MetricCard } from "@/components/nres/MetricCard";
import { PriorityActionsPanel } from "@/components/nres/PriorityActionsPanel";
import { ConsultationsTable } from "@/components/nres/ConsultationsTable";
import { PerformanceChart } from "@/components/nres/PerformanceChart";
import { EscalationsLog } from "@/components/nres/EscalationsLog";
import { WorkflowModal } from "@/components/nres/WorkflowModal";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NRESHoursTracker } from "@/components/nres/hours-tracker/NRESHoursTracker";
import { NRESDigitalAndFinance } from "@/components/nres/NRESDigitalAndFinance";
import { NRESDocumentVault } from "@/components/nres/vault/NRESDocumentVault";
import { mockConsultations, mockMetrics, mockPracticePerformance, mockEscalations } from "@/data/nresMockData";
import { FileText, AlertTriangle, TrendingUp, CheckCircle2, Info, Presentation, LayoutGrid, ListChecks, Table2, BarChart3, Bell, Clock, FolderLock, Monitor, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useIsIPhone } from "@/hooks/use-mobile";

const NRESDashboard = () => {
  const { toast } = useToast();
  const isIPhone = useIsIPhone();
  const [selectedPractice, setSelectedPractice] = useState('All Practices');
  const [dateRange, setDateRange] = useState('today');
  const [consultations, setConsultations] = useState(mockConsultations);
  const [metrics, setMetrics] = useState(mockMetrics);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleRefresh = useCallback(() => {
    setConsultations([...mockConsultations]);
    setMetrics({ ...mockMetrics });
    
    toast({
      title: "Dashboard Updated",
      description: "Latest data loaded successfully",
      duration: 2000,
    });
  }, [toast]);

  const handleConsultationClick = () => setWorkflowModalOpen(true);

  const filteredConsultations = selectedPractice === 'All Practices'
    ? consultations
    : consultations.filter(c => c.homePractice === selectedPractice);

  const filteredMetrics = {
    outstanding: filteredConsultations.filter(c => c.status !== 'reviewed').length,
    overdue: filteredConsultations.filter(c => c.status === 'overdue' || c.status === 'critical').length,
    onTimePercentage: metrics.onTimePercentage,
    zeroLostDays: metrics.zeroLostDays,
    trend: metrics.trend as 'up' | 'down' | 'stable'
  };

  return (
    <div className={`min-h-screen bg-[#F0F4F5] ${isIPhone ? 'pb-safe' : ''}`}>
      <Header />
      
      <div className={`container mx-auto py-6 space-y-4 ${isIPhone ? 'px-2' : 'px-4 space-y-6'}`}>
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="digital" className="gap-2">
              <Monitor className="w-4 h-4" />
              IT &amp; Reporting
            </TabsTrigger>
            <TabsTrigger value="hours-tracker" className="gap-2">
              <Clock className="w-4 h-4" />
              SDA Claims
            </TabsTrigger>
            <TabsTrigger value="document-vault" className="gap-2">
              <FolderLock className="w-4 h-4" />
              Document Vault Home
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            {/* Mock-up Warning Banner */}
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Mock-up Dashboard:</strong> This is a demonstration interface with no real functionality. 
                Full integration with SystmOne and EMIS is required for live data and operational features.
              </AlertDescription>
            </Alert>

            {/* Sub-page links */}
            <div className="flex justify-end gap-2 flex-wrap">
              <Link to="/nres/time-tracker">
                <Button variant="outline" size="sm">
                  <Clock className="w-4 h-4 mr-2" />
                  Time Tracker
                </Button>
              </Link>
              <Link to="/nres/population-risk">
                <Button variant="outline" size="sm">
                  <Activity className="w-4 h-4 mr-2" />
                  Population Risk
                  <span className="ml-2 text-[10px] font-semibold bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded">PoC</span>
                </Button>
              </Link>
              <Link to="/nres-presentation">
                <Button variant="outline" size="sm">
                  <Presentation className="w-4 h-4 mr-2" />
                  View NRES Presentation
                </Button>
              </Link>
            </div>

            <DashboardHeader
              selectedPractice={selectedPractice}
              onPracticeChange={setSelectedPractice}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onManualRefresh={handleRefresh}
              isIPhone={isIPhone}
            />

            {/* Metric Cards Row - Collapsible */}
            <CollapsibleCard 
              title="Key Metrics" 
              icon={<LayoutGrid className="h-5 w-5" />}
              defaultOpen={true}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Outstanding Results"
                  value={filteredMetrics.outstanding}
                  subtitle="Awaiting review"
                  tooltip="Total number of hub consultation results currently awaiting GP review. Includes all pending, overdue, and critical results."
                  variant="default"
                  icon={<FileText className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  onClick={() => setWorkflowModalOpen(true)}
                  isCompact={isIPhone}
                />
                
                <MetricCard
                  title="Overdue Reviews"
                  value={filteredMetrics.overdue}
                  subtitle="Require urgent action"
                  tooltip="Results overdue for review (>48 hours). These require immediate attention and have triggered automated escalation protocols."
                  variant={filteredMetrics.overdue > 0 ? "danger" : "success"}
                  icon={<AlertTriangle className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  pulse={filteredMetrics.overdue > 0}
                  onClick={() => {}}
                  isCompact={isIPhone}
                />

                <MetricCard
                  title="On-Time Performance"
                  value={`${filteredMetrics.onTimePercentage}%`}
                  subtitle="Target: 95%"
                  tooltip="Percentage of results reviewed within 48 hours. ICB target is 95% compliance. Current performance is tracked in real-time."
                  variant={filteredMetrics.onTimePercentage >= 95 ? "success" : "warning"}
                  icon={<TrendingUp className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  trend={filteredMetrics.trend}
                  onClick={() => {}}
                  isCompact={isIPhone}
                />

                <MetricCard
                  title="Zero Lost Results"
                  value={filteredMetrics.zeroLostDays}
                  subtitle="consecutive days"
                  tooltip="Days since last lost result. Every hub consultation result is automatically tracked from receipt to review. Mathematical impossibility of lost results with this system."
                  variant="success"
                  icon={<CheckCircle2 className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  onClick={() => {}}
                  isCompact={isIPhone}
                />
              </div>
            </CollapsibleCard>

            {/* Priority Actions Panel - Collapsible */}
            <CollapsibleCard 
              title="Priority Actions" 
              icon={<ListChecks className="h-5 w-5" />}
              defaultOpen={true}
            >
              <PriorityActionsPanel
                consultations={filteredConsultations}
                onViewDetails={handleConsultationClick}
              />
            </CollapsibleCard>

            {/* Consultations Table - Collapsible */}
            <CollapsibleCard 
              title="NRES Consultations (Patients seen by non home practice)" 
              icon={<Table2 className="h-5 w-5" />}
              defaultOpen={true}
            >
              <ConsultationsTable
                consultations={filteredConsultations}
                onRowClick={handleConsultationClick}
                isIPhone={isIPhone}
              />
            </CollapsibleCard>

            {/* Bottom Row - Charts - Collapsible */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CollapsibleCard 
                title="Practice Performance" 
                icon={<BarChart3 className="h-5 w-5" />}
                defaultOpen={true}
              >
                <PerformanceChart data={mockPracticePerformance} isIPhone={isIPhone} />
              </CollapsibleCard>
              
              <CollapsibleCard 
                title="Escalations Log" 
                icon={<Bell className="h-5 w-5" />}
                defaultOpen={true}
              >
                <EscalationsLog events={mockEscalations} />
              </CollapsibleCard>
            </div>

            {/* Footer Info */}
            <div className="text-center text-sm text-muted-foreground pb-4">
              <p>NHS Rural East & South Neighbourhood • Real-time Results Management</p>
            </div>
          </TabsContent>

          <TabsContent value="digital">
            <NRESDigitalAndFinance />
          </TabsContent>

          <TabsContent value="hours-tracker">
            <NRESHoursTracker />
          </TabsContent>

          <TabsContent value="document-vault">
            <NRESDocumentVault />
          </TabsContent>
        </Tabs>
      </div>

      {/* Workflow Modal */}
      <WorkflowModal
        open={workflowModalOpen}
        onOpenChange={setWorkflowModalOpen}
      />
    </div>
  );
};

export default NRESDashboard;
