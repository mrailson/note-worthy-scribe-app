import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { ComplexCareHeader } from "@/components/nres/complex-care/ComplexCareHeader";
import { StatisticsGrid } from "@/components/nres/complex-care/StatisticsGrid";
import { PatientLeagueTable } from "@/components/nres/complex-care/PatientLeagueTable";
import { InsightsPanel } from "@/components/nres/complex-care/InsightsPanel";
import { ExemptPatientModal } from "@/components/nres/complex-care/ExemptPatientModal";
import { BookingModal } from "@/components/nres/complex-care/BookingModal";
import { mockComplexCarePatients, mockStatistics, mockInsights } from "@/data/complexCareMockData";
import { ComplexCarePatient, ConditionFilterType } from "@/types/complexCareTypes";
import { useToast } from "@/hooks/use-toast";

const ProactiveComplexCareDashboard = () => {
  const { toast } = useToast();
  const [selectedPractice, setSelectedPractice] = useState('All Practices');
  const [selectedFilter, setSelectedFilter] = useState<ConditionFilterType>('all');
  const [patients, setPatients] = useState(mockComplexCarePatients);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [exemptModalOpen, setExemptModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<ComplexCarePatient | null>(null);

  // Filter patients by practice
  const practiceFilteredPatients = selectedPractice === 'All Practices'
    ? patients
    : patients.filter(p => p.practice === selectedPractice);

  // Filter patients by condition
  const getFilteredPatients = useCallback(() => {
    let filtered = practiceFilteredPatients.filter(p => !p.exempted);

    if (selectedFilter === 'all') {
      return filtered;
    }

    const conditionMap: Record<ConditionFilterType, string[]> = {
      all: [],
      diabetes: ['T2DM'],
      cvd: ['CVD', 'IHD', 'CHF', 'AF'],
      respiratory: ['COPD'],
      renal: ['CKD'],
    };

    const targetConditions = conditionMap[selectedFilter];
    return filtered.filter(patient =>
      patient.conditions.some(c => targetConditions.includes(c.code))
    );
  }, [practiceFilteredPatients, selectedFilter]);

  const filteredPatients = getFilteredPatients();

  const handleExemptPatient = (patient: ComplexCarePatient) => {
    setSelectedPatient(patient);
    setExemptModalOpen(true);
  };

  const handleConfirmExemption = (reason: string, notes: string) => {
    if (!selectedPatient) return;

    // Mark patient as exempted
    setPatients(prev => prev.map(p =>
      p.id === selectedPatient.id
        ? { ...p, exempted: true, exemptionReason: reason, exemptionNotes: notes, exemptedAt: new Date() }
        : p
    ));

    toast({
      title: "Patient Exempted",
      description: `${selectedPatient.lastName}, ${selectedPatient.initials} has been removed from active monitoring. Next priority patient now visible.`,
      duration: 4000,
    });

    setSelectedPatient(null);
  };

  const handleBookReview = (patient: ComplexCarePatient) => {
    setSelectedPatient(patient);
    setBookingModalOpen(true);
  };

  const handleConfirmBooking = () => {
    if (!selectedPatient) return;

    // Update patient engagement status
    setPatients(prev => prev.map(p =>
      p.id === selectedPatient.id
        ? {
            ...p,
            engagementStatus: {
              status: 'active',
              color: 'green',
              message: 'Appt booked: 18/11/25',
            },
            nextAppointment: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          }
        : p
    ));

    toast({
      title: "Appointment Booked",
      description: `30-minute complex care review scheduled for ${selectedPatient.lastName}, ${selectedPatient.initials}. SMS confirmation sent to patient.`,
      duration: 4000,
    });

    setSelectedPatient(null);
  };

  const handleViewRecord = (patient: ComplexCarePatient) => {
    toast({
      title: "Opening Patient Record",
      description: `Opening EMIS record for ${patient.lastName}, ${patient.initials}...`,
      duration: 2000,
    });
  };


  return (
    <div className="min-h-screen bg-muted">
      <Header />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        <ComplexCareHeader
          selectedPractice={selectedPractice}
          onPracticeChange={setSelectedPractice}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          lastRefresh={lastRefresh}
        />

        {/* Statistics Grid */}
        <StatisticsGrid statistics={mockStatistics} />

        {/* Main League Table */}
        <PatientLeagueTable
          patients={filteredPatients}
          onBookReview={handleBookReview}
          onViewRecord={handleViewRecord}
          onExemptPatient={handleExemptPatient}
        />

        {/* Insights Panel */}
        <InsightsPanel insights={mockInsights} />

        {/* Footer Info */}
        <div className="text-center text-sm text-muted-foreground pb-4">
          <p className="font-semibold text-muted-foreground">NHS Rural East & South Neighbourhood • AI-Powered Proactive Care</p>
          <p className="text-xs mt-1 opacity-90">
            Live risk scoring • Automatic prioritization • Zero lost patients
          </p>
        </div>
      </div>

      {/* Modals */}
      <ExemptPatientModal
        open={exemptModalOpen}
        onOpenChange={setExemptModalOpen}
        patient={selectedPatient}
        onConfirm={handleConfirmExemption}
      />

      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        patient={selectedPatient}
        onConfirm={handleConfirmBooking}
      />
    </div>
  );
};

export default ProactiveComplexCareDashboard;
