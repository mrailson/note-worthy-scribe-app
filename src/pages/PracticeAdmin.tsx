import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { PracticeUserManagement } from '@/components/PracticeUserManagement';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const PracticeAdmin = () => {
  const { user } = useAuth();

  return (
    <ProtectedRoute requiredModule="practice_manager_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <PracticeUserManagement />
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default PracticeAdmin;