import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import ContractorManagement from "@/components/ContractorManagement";
import { LoginForm } from "@/components/LoginForm";

const ContractorFinder = () => {
  const { user, loading } = useAuth();

  const handleNewMeeting = () => {
    // Navigation logic for new meeting
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <ContractorManagement />
      </div>
    </div>
  );
};

export default ContractorFinder;