import { Header } from '@/components/Header';
import { FridgeManagement } from '@/components/FridgeManagement';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const PracticeAdminFridges = () => {
  return (
    <ProtectedRoute requiredModule="fridge_monitoring_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <FridgeManagement />
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default PracticeAdminFridges;