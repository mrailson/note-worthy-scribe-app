import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function CSOTestCertificate() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTestCertificate = async () => {
    setIsGenerating(true);
    try {
      // Generate unique test data
      const timestamp = Date.now();
      const uniqueGmc = String(1000000 + Math.floor(Math.random() * 8999999)); // 7-digit number
      
      // Create test registration
      const { data: registration, error: regError } = await supabase
        .from('cso_registrations')
        .insert({
          full_name: 'Dr Test User',
          gmc_number: uniqueGmc,
          email: `test${timestamp}@example.com`,
          practice_name: 'Test Practice',
          practice_address: '123 Test Street',
          practice_postcode: 'TE1 1ST'
        })
        .select()
        .single();

      if (regError) throw regError;

      // Create passing assessment
      const { data: assessment, error: assessError } = await supabase
        .from('cso_assessments')
        .insert({
          registration_id: registration.id,
          attempt_number: 1,
          questions_answered: {},
          score: 10,
          total_questions: 10,
          percentage: 100,
          passed: true,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (assessError) throw assessError;

      toast.success('Test assessment created!');
      
      // Navigate to certificate page
      navigate(`/cso-certificate/${assessment.id}`);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to generate test certificate');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="p-8 max-w-md">
        <h1 className="text-2xl font-bold mb-4">CSO Certificate Test</h1>
        <p className="text-muted-foreground mb-6">
          This will create a test registration and passing assessment, then show the certificate.
        </p>
        <Button 
          onClick={generateTestCertificate} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Test Certificate'}
        </Button>
      </Card>
    </div>
  );
}
