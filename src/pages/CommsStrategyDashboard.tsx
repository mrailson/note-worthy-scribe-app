import { useState } from "react";
import { Header } from "@/components/Header";
import { CommsStrategyHeader } from "@/components/nres/comms/CommsStrategyHeader";
import { CommsMetricCard } from "@/components/nres/comms/CommsMetricCard";
import { CommsPlansTable } from "@/components/nres/comms/CommsPlansTable";
import { mockCommsPlans, mockCommsEvents, mockCommsMetrics } from "@/data/commsStrategyMockData";
import { CommsPlan } from "@/types/commsStrategyTypes";
import { toast } from "@/hooks/use-toast";

export default function CommsStrategyDashboard() {
  const [selectedPractice, setSelectedPractice] = useState('All Practices');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState<CommsPlan | null>(null);

  // Filter plans based on selected practice
  const filteredPlans = mockCommsPlans.filter(plan => 
    selectedPractice === 'All Practices' || plan.practice === selectedPractice || plan.practice === 'All Practices'
  );

  // Calculate filtered metrics
  const filteredMetrics = {
    totalActivePlans: filteredPlans.length,
    onTrack: filteredPlans.filter(p => p.currentStatus === 'on-track').length,
    atRisk: filteredPlans.filter(p => p.currentStatus === 'at-risk').length,
    offTrack: filteredPlans.filter(p => p.currentStatus === 'off-track').length,
    onTrackChange: mockCommsMetrics.onTrackChange,
    atRiskChange: mockCommsMetrics.atRiskChange,
    offTrackChange: mockCommsMetrics.offTrackChange,
  };

  const handleRefresh = () => {
    toast({
      title: "Dashboard Refreshed",
      description: "Communication plans data has been updated",
    });
  };

  const handleAddPlan = () => {
    toast({
      title: "Add New Plan",
      description: "Plan creation modal would open here",
    });
  };

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Downloading communication plans data as CSV...",
    });
  };

  const handleViewDetails = (plan: CommsPlan) => {
    setSelectedPlan(plan);
    toast({
      title: "View Plan Details",
      description: `Opening details for: ${plan.planName}`,
    });
  };

  const handleAddEvent = (plan: CommsPlan) => {
    toast({
      title: "Add Event",
      description: `Add event modal would open for: ${plan.planName}`,
    });
  };

  const handleUpdateStatus = (plan: CommsPlan) => {
    toast({
      title: "Update Status",
      description: `Update status modal would open for: ${plan.planName}`,
    });
  };

  const handleViewReference = () => {
    window.open('https://claude.site/public/artifacts/8e3c3eac-c391-4a84-a0c5-d481fb7a061a', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#F0F4F5]">
      <Header />
      <CommsStrategyHeader
        selectedPractice={selectedPractice}
        onPracticeChange={setSelectedPractice}
        selectedDateRange={selectedDateRange}
        onDateRangeChange={setSelectedDateRange}
        onRefresh={handleRefresh}
        onAddPlan={handleAddPlan}
        onExport={handleExport}
        onViewReference={handleViewReference}
      />

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <CommsMetricCard
            title="Total Active Plans"
            value={filteredMetrics.totalActivePlans}
            tooltip="Total number of active communication initiatives and plans"
            variant="default"
          />
          <CommsMetricCard
            title="On Track"
            value={filteredMetrics.onTrack}
            tooltip="Plans progressing as expected with no significant issues"
            variant="success"
            trend={filteredMetrics.onTrackChange}
          />
          <CommsMetricCard
            title="At Risk"
            value={filteredMetrics.atRisk}
            tooltip="Plans experiencing delays or challenges that may impact delivery"
            variant="warning"
            trend={filteredMetrics.atRiskChange}
          />
          <CommsMetricCard
            title="Off Track"
            value={filteredMetrics.offTrack}
            tooltip="Plans significantly delayed or requiring urgent intervention"
            variant="danger"
            trend={filteredMetrics.offTrackChange}
          />
        </div>

        {/* Plans Table */}
        <div>
          <h2 className="text-lg font-semibold text-[#003087] mb-4">
            Communication Plans
          </h2>
          <CommsPlansTable
            plans={filteredPlans}
            events={mockCommsEvents}
            onViewDetails={handleViewDetails}
            onAddEvent={handleAddEvent}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      </div>
    </div>
  );
}
