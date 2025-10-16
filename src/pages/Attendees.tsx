import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { AttendeeManager } from '@/components/AttendeeManager';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

const Attendees = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Helmet>
          <title>Attendees - Notewell AI</title>
          <meta name="description" content="Manage meeting attendees and create attendee templates" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Please log in to manage attendees</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Helmet>
        <title>Manage Attendees - Notewell AI</title>
        <meta name="description" content="Manage meeting attendees, add contact details, and create reusable attendee templates" />
        <meta name="keywords" content="meeting attendees, contact management, meeting templates, NHS meetings" />
      </Helmet>
      
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Attendee Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your meeting attendees, add contact details, and create reusable templates for common meeting groups.
          </p>
        </div>

        <AttendeeManager showTemplateManagement={true} />
      </div>
    </div>
  );
};

export default Attendees;
