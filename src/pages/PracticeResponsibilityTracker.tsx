import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ResponsibilityTrackerDashboard } from '@/components/responsibility-tracker/ResponsibilityTrackerDashboard';

const PracticeResponsibilityTracker = () => {
  return (
    <ProtectedRoute requiredModule="practice_manager_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <ResponsibilityTrackerDashboard />
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default PracticeResponsibilityTracker;
