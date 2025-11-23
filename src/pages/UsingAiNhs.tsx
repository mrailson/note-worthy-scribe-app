import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Shield } from 'lucide-react';

const UsingAiNhs = () => {
  const videoUrl = "https://dphcnbricafkbtizkoal.supabase.co/storage/v1/object/public/demo-videos/AI_in_the_Clinic.mp4";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Using AI in your GP Practice and the CSO Role (explainer video and CSO training links)</CardTitle>
            <CardDescription>
              Learn about using AI technology in clinical practice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Start by Watching this Video to understand what the CSO Role is and why it's needed</h3>
              <div className="aspect-video w-full rounded-lg overflow-hidden border shadow-lg bg-black flex items-center justify-center">
                <video
                  src={videoUrl}
                  controls
                  preload="metadata"
                  className="w-full h-full"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              
              <p className="text-sm text-muted-foreground mt-2">
                If the video still doesn't play, <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">open it in a new tab or download it here</a>.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-xl font-semibold">To Begin your CSO Training, please complete the following courses - Stage 1 and Intermediate eLFH are free:</h3>
              
              <Card className="p-4 bg-accent/5 border-accent">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Stage 1 - Essentials of Digital Clinical Safety</h4>
                    <p className="text-sm text-muted-foreground">Complete the official e-Learning for Healthcare (e-LfH) module</p>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://portal.e-lfh.org.uk/Component/Details/794802', '_blank')}
                  >
                    Access e-LfH Portal
                  </Button>
                </div>
              </Card>

              <Card className="p-4 bg-accent/5 border-accent">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Shield className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Intermediate - Digital Clinical Safety</h4>
                    <p className="text-sm text-muted-foreground">Advanced topics in clinical safety management</p>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://portal.e-lfh.org.uk/Component/Details/[URL_NEEDED]', '_blank')}
                  >
                    Access e-LfH Portal
                  </Button>
                </div>
              </Card>

              <Card className="p-4 bg-accent/5 border-accent">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">CSO Practitioner Course</h4>
                    <p className="text-sm text-muted-foreground">Foundation clinical safety training - £408</p>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://ethos.co.im/training-and-event/foundation-clinical-safety-training-december/', '_blank')}
                  >
                    Book Course
                  </Button>
                </div>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UsingAiNhs;
