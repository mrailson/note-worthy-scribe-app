import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { DashboardHeader } from "@/components/nres/DashboardHeader";
import { MetricCard } from "@/components/nres/MetricCard";
import { PriorityActionsPanel } from "@/components/nres/PriorityActionsPanel";
import { ConsultationsTable } from "@/components/nres/ConsultationsTable";
import { PerformanceChart } from "@/components/nres/PerformanceChart";
import { EscalationsLog } from "@/components/nres/EscalationsLog";
import { PatientDetailModal } from "@/components/nres/PatientDetailModal";
import { mockConsultations, mockMetrics, mockPracticePerformance, mockEscalations } from "@/data/nresMockData";
import { HubConsultation } from "@/types/nresTypes";
import { FileText, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NRESDashboard = () => {
  const { toast } = useToast();
  const [selectedPractice, setSelectedPractice] = useState('All Practices');
  const [dateRange, setDateRange] = useState('today');
  const [consultations, setConsultations] = useState(mockConsultations);
  const [metrics, setMetrics] = useState(mockMetrics);
  const [selectedConsultation, setSelectedConsultation] = useState<HubConsultation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleRefresh = useCallback(() => {
    // Simulate data refresh with slight variations
    setConsultations([...mockConsultations]);
    setMetrics({ ...mockMetrics });
    
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

  return (
    <div className="min-h-screen bg-[#F0F4F5]">
      <Header />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        <DashboardHeader
          selectedPractice={selectedPractice}
          onPracticeChange={setSelectedPractice}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onManualRefresh={handleRefresh}
        />

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Outstanding Results"
            value={filteredMetrics.outstanding}
            subtitle="Awaiting review"
            tooltip="Total number of hub consultation results currently awaiting GP review. Includes all pending, overdue, and critical results."
            variant="default"
            icon={<FileText className="h-8 w-8" />}
            onClick={() => {}}
          />
          
          <MetricCard
            title="Overdue Reviews"
            value={filteredMetrics.overdue}
            subtitle="Require urgent action"
            tooltip="Results overdue for review (>48 hours). These require immediate attention and have triggered automated escalation protocols."
            variant={filteredMetrics.overdue > 0 ? "danger" : "success"}
            icon={<AlertTriangle className="h-8 w-8" />}
            pulse={filteredMetrics.overdue > 0}
            onClick={() => {}}
          />

          <MetricCard
            title="On-Time Performance"
            value={`${filteredMetrics.onTimePercentage}%`}
            subtitle="Target: 95%"
            tooltip="Percentage of results reviewed within 48 hours. ICB target is 95% compliance. Current performance is tracked in real-time."
            variant={filteredMetrics.onTimePercentage >= 95 ? "success" : "warning"}
            icon={<TrendingUp className="h-8 w-8" />}
            trend={filteredMetrics.trend}
            onClick={() => {}}
          />

          <MetricCard
            title="Zero Lost Results"
            value={filteredMetrics.zeroLostDays}
            subtitle="consecutive days"
            tooltip="Days since last lost result. Every hub consultation result is automatically tracked from receipt to review. Mathematical impossibility of lost results with this system."
            variant="success"
            icon={<CheckCircle2 className="h-8 w-8" />}
            onClick={() => {}}
          />
        </div>

        {/* Priority Actions Panel - Full Width */}
        <div className="w-full">
          <PriorityActionsPanel
            consultations={filteredConsultations}
            onViewDetails={handleConsultationClick}
          />
        </div>

        {/* Consultations Table - Full Width */}
        <div className="w-full bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#001847] mb-4">NRES Consultations (Patients seen by non home practice)</h2>
          <ConsultationsTable
            consultations={filteredConsultations}
            onRowClick={handleConsultationClick}
          />
        </div>

        {/* Bottom Row - Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PerformanceChart data={mockPracticePerformance} />
          <EscalationsLog events={mockEscalations} />
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-muted-foreground pb-4">
          <p>NHS Rural East & South Neighbourhood • Real-time Results Management</p>
        </div>
      </div>

      {/* Patient Detail Modal */}
      <PatientDetailModal
        consultation={selectedConsultation}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};

export default NRESDashboard;
