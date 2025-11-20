import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCSORegistration } from '@/hooks/useCSORegistration';
import { downloadCertificatePDF } from '@/utils/generateCSOCertificatePDF';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Download, Share2, Home } from 'lucide-react';
import { toast } from 'sonner';

interface Certificate {
  id: string;
  certificate_number: string;
  issued_date: string;
  pdf_url: string | null;
}

export default function CSOCertificate() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { registration } = useCSORegistration();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchOrGenerateCertificate = async () => {
      if (!assessmentId) return;

      try {
        // First, get the assessment to find the registration_id
        const { data: assessment, error: assessmentError } = await supabase
          .from('cso_assessments')
          .select('registration_id, passed')
          .eq('id', assessmentId)
          .single();

        if (assessmentError || !assessment) {
          throw new Error('Assessment not found');
        }

        if (!assessment.passed) {
          throw new Error('Assessment must be passed to view certificate');
        }

        // Get registration details
        const { data: reg, error: regError } = await supabase
          .from('cso_registrations')
          .select('*')
          .eq('id', assessment.registration_id)
          .single();

        if (regError || !reg) {
          throw new Error('Registration not found');
        }

        // Check if certificate already exists
        const { data: existing, error: fetchError } = await supabase
          .from('cso_certificates')
          .select('*')
          .eq('assessment_id', assessmentId)
          .maybeSingle();

        if (existing && !fetchError) {
          setCertificate(existing);
          setIsLoading(false);
          return;
        }

        // Generate new certificate
        setIsGenerating(true);
        const { data, error } = await supabase.functions.invoke('generate-cso-certificate', {
          body: {
            assessmentId,
            registrationId: assessment.registration_id
          }
        });

        if (error) throw error;

        setCertificate(data.certificate);
        toast.success('Certificate generated successfully!');
      } catch (error: any) {
        console.error('Error with certificate:', error);
        toast.error(error.message || 'Failed to generate certificate');
        navigate('/cso-training-dashboard');
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
      }
    };

    fetchOrGenerateCertificate();
  }, [assessmentId, navigate]);

  const handleDownload = () => {
    if (!certificate || !registration) return;

    downloadCertificatePDF({
      candidateName: registration.full_name,
      gmcNumber: registration.gmc_number,
      certificateNumber: certificate.certificate_number,
      completionDate: new Date(certificate.issued_date)
    });
  };

  if (isLoading || isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isGenerating ? 'Generating your certificate...' : 'Loading certificate...'}
          </p>
        </div>
      </div>
    );
  }

  if (!certificate || !registration) {
    return null;
  }

  const formattedDate = new Date(certificate.issued_date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="outline" onClick={() => navigate('/cso-training-dashboard')} className="mb-4">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>

          <div className="text-center">
            <Award className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Certificate of Completion</h1>
            <p className="text-muted-foreground">
              Congratulations on completing the Clinical Safety Officer Level 1 Training
            </p>
          </div>
        </div>

        {/* Certificate Preview */}
        <Card className="p-12 mb-8 border-primary shadow-2xl">
          <div className="text-center space-y-6">
            <div className="border-b-2 border-primary pb-4">
              <h2 className="text-2xl font-bold text-primary">PCN Services Limited</h2>
            </div>

            <div>
              <h3 className="text-3xl font-bold mb-2">Certificate of Completion</h3>
              <p className="text-xl text-primary">Clinical Safety Officer Level 1 Training</p>
            </div>

            <div className="py-6">
              <p className="text-lg mb-4">This is to certify that</p>
              <p className="text-3xl font-bold mb-2">{registration.full_name}</p>
              <p className="text-muted-foreground">GMC Number: {registration.gmc_number}</p>
            </div>

            <p className="text-lg max-w-2xl mx-auto">
              Has successfully completed the Clinical Safety Officer Level 1 Training Programme
            </p>

            <div className="pt-6 space-y-2">
              <p className="font-semibold">Certificate Number: {certificate.certificate_number}</p>
              <p className="text-muted-foreground">Date of Completion: {formattedDate}</p>
              <p className="text-sm text-primary font-medium">This certificate does not expire</p>
            </div>

            <div className="pt-6 border-t">
              <p className="font-semibold mb-2">Issued by PCN Services Limited</p>
              <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
                This training programme covers DCB0129, DCB0160, Hazard Identification, Risk Assessment, 
                Safety Case Reports, and Incident Management in accordance with NHS Digital clinical safety standards.
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" onClick={handleDownload}>
            <Download className="h-5 w-5 mr-2" />
            Download PDF
          </Button>

          <Button size="lg" variant="outline" onClick={() => {
            const url = window.location.href;
            navigator.clipboard.writeText(url);
            toast.success('Certificate link copied to clipboard');
          }}>
            <Share2 className="h-5 w-5 mr-2" />
            Share Certificate
          </Button>

          <Button size="lg" variant="outline" onClick={() => navigate('/cso-training-dashboard')}>
            Return to Dashboard
          </Button>
        </div>

        {/* LinkedIn Sharing Tip */}
        <Card className="mt-8 p-6 bg-muted/50">
          <h3 className="font-semibold mb-2">Share Your Achievement</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add this certification to your professional profile to showcase your clinical safety expertise.
          </p>
          <div className="flex gap-2 text-sm">
            <div className="flex-1">
              <p className="font-medium mb-1">Certification Name:</p>
              <p className="text-muted-foreground">Clinical Safety Officer Level 1</p>
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Issuing Organisation:</p>
              <p className="text-muted-foreground">PCN Services Limited</p>
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Issue Date:</p>
              <p className="text-muted-foreground">{formattedDate}</p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Official Sensitive - For authorised use only</p>
        </div>
      </div>
    </div>
  );
}
