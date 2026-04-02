import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { ENNDashboardHeader } from "@/components/enn/ENNDashboardHeader";
import { MetricCard } from "@/components/nres/MetricCard";
import { PriorityActionsPanel } from "@/components/nres/PriorityActionsPanel";
import { ConsultationsTable } from "@/components/nres/ConsultationsTable";
import { PerformanceChart } from "@/components/nres/PerformanceChart";
import { EscalationsLog } from "@/components/nres/EscalationsLog";
import { PatientDetailModal } from "@/components/nres/PatientDetailModal";
import { WorkflowModal } from "@/components/nres/WorkflowModal";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ENNPracticeOverview } from "@/components/enn/ENNPracticeOverview";
import { ENNHubSummary } from "@/components/enn/ENNHubSummary";
import { ENNWinterAccessPanel } from "@/components/enn/ENNWinterAccessPanel";
import { ennMockConsultations, ennMockMetrics, ennMockPracticePerformance, ennMockEscalations } from "@/data/ennMockData";
import { useENNData } from "@/hooks/useENNData";
import { HubConsultation } from "@/types/nresTypes";
import { FileText, AlertTriangle, TrendingUp, CheckCircle2, Info, LayoutGrid, ListChecks, Table2, BarChart3, Bell, Building2, Users, Snowflake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsIPhone } from "@/hooks/use-mobile";

const ENNDashboard = () => {
  const { toast } = useToast();
  const isIPhone = useIsIPhone();
  const [selectedPractice, setSelectedPractice] = useState('All Practices');
  const [dateRange, setDateRange] = useState('today');
  const [consultations, setConsultations] = useState(ennMockConsultations);
  const [metrics, setMetrics] = useState(ennMockMetrics);
  const [selectedConsultation, setSelectedConsultation] = useState<HubConsultation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const { hubs, practiceData, getPracticesForHub, getHubForPractice, totalBudget, isLoading: ennDataLoading } = useENNData();

  const handleRefresh = useCallback(() => {
    setConsultations([...ennMockConsultations]);
    setMetrics({ ...ennMockMetrics });
    toast({
      title: "Dashboard Updated",
      description: "Latest data loaded successfully",
      duration: 2000,
    });
  }, [toast]);

  const handleConsultationClick = (consultation: HubConsultation) => {
    setSelectedConsultation(consultation);
    setModalOpen(true);
  };

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

  const getHubName = (practiceId: string): string => {
    const hub = getHubForPractice(practiceId);
    return hub?.hub_name || 'Unassigned';
  };

  return (
    <div className={`min-h-screen bg-[#F0F4F5] ${isIPhone ? 'pb-safe' : ''}`}>
      <Header />
      
      <div className={`container mx-auto py-6 space-y-4 ${isIPhone ? 'px-2' : 'px-4 space-y-6'}`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="practices" className="gap-2">
              <Users className="w-4 h-4" />
              Practice Overview
            </TabsTrigger>
            <TabsTrigger value="hubs" className="gap-2">
              <Building2 className="w-4 h-4" />
              Hub Reporting
            </TabsTrigger>
            <TabsTrigger value="winter" className="gap-2">
              <Snowflake className="w-4 h-4" />
              Winter Access
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Mock-up Dashboard:</strong> This is a demonstration interface with sample data. 
                Full integration with clinical systems is required for live data and operational features.
              </AlertDescription>
            </Alert>

            <ENNDashboardHeader
              selectedPractice={selectedPractice}
              onPracticeChange={setSelectedPractice}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onManualRefresh={handleRefresh}
              isIPhone={isIPhone}
            />

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
                  tooltip="Total number of hub consultation results currently awaiting GP review."
                  variant="default"
                  icon={<FileText className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  onClick={() => setWorkflowModalOpen(true)}
                  isCompact={isIPhone}
                />
                <MetricCard
                  title="Overdue Reviews"
                  value={filteredMetrics.overdue}
                  subtitle="Require urgent action"
                  tooltip="Results overdue for review (>48 hours). These require immediate attention."
                  variant={filteredMetrics.overdue > 0 ? "danger" : "success"}
                  icon={<AlertTriangle className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  pulse={filteredMetrics.overdue > 0}
                  isCompact={isIPhone}
                />
                <MetricCard
                  title="On-Time Performance"
                  value={`${filteredMetrics.onTimePercentage}%`}
                  subtitle="Target: 95%"
                  tooltip="Percentage of results reviewed within 48 hours."
                  variant={filteredMetrics.onTimePercentage >= 95 ? "success" : "warning"}
                  icon={<TrendingUp className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  trend={filteredMetrics.trend}
                  isCompact={isIPhone}
                />
                <MetricCard
                  title="Zero Lost Results"
                  value={filteredMetrics.zeroLostDays}
                  subtitle="consecutive days"
                  tooltip="Days since last lost result. Every hub consultation result is tracked from receipt to review."
                  variant="success"
                  icon={<CheckCircle2 className={isIPhone ? "h-6 w-6" : "h-8 w-8"} />}
                  isCompact={isIPhone}
                />
              </div>
            </CollapsibleCard>

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

            <CollapsibleCard 
              title="ENN Consultations (Patients seen by non home practice)" 
              icon={<Table2 className="h-5 w-5" />}
              defaultOpen={true}
            >
              <ConsultationsTable
                consultations={filteredConsultations}
                onRowClick={handleConsultationClick}
                isIPhone={isIPhone}
              />
            </CollapsibleCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CollapsibleCard 
                title="Practice Performance" 
                icon={<BarChart3 className="h-5 w-5" />}
                defaultOpen={true}
              >
                <PerformanceChart data={ennMockPracticePerformance} isIPhone={isIPhone} />
              </CollapsibleCard>
              
              <CollapsibleCard 
                title="Escalations Log" 
                icon={<Bell className="h-5 w-5" />}
                defaultOpen={true}
              >
                <EscalationsLog events={ennMockEscalations} />
              </CollapsibleCard>
            </div>

            <div className="text-center text-sm text-muted-foreground pb-4">
              <p>East Northants Neighbourhood — 3Sixty Care Partnership • Real-time Results Management</p>
              <p className="text-xs mt-1">Transformation Manager: Rebecca Gane — Rebecca.Gane@nhft.nhs.uk — 07599 233655</p>
            </div>
          </TabsContent>

          <TabsContent value="practices">
            <ENNPracticeOverview 
              practices={practiceData}
              getHubName={getHubName}
              isLoading={ennDataLoading}
            />
          </TabsContent>

          <TabsContent value="hubs">
            <ENNHubSummary
              hubs={hubs}
              getPracticesForHub={getPracticesForHub}
              totalBudget={totalBudget}
              isLoading={ennDataLoading}
            />
          </TabsContent>

          <TabsContent value="winter">
            <ENNWinterAccessPanel
              practices={practiceData}
              isLoading={ennDataLoading}
            />
          </TabsContent>
        </Tabs>
      </div>

      <PatientDetailModal
        consultation={selectedConsultation}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <WorkflowModal
        open={workflowModalOpen}
        onOpenChange={setWorkflowModalOpen}
      />
    </div>
  );
};

export default ENNDashboard;
