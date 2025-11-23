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
            <CardTitle className="text-3xl">AI in the NHS Clinic</CardTitle>
            <CardDescription>
              Learn about using AI technology in clinical practice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <video 
              src={videoUrl}
              controls 
              preload="metadata"
              className="w-full rounded-lg border shadow-lg"
            >
              Your browser does not support the video tag.
            </video>
            
            <p className="text-sm text-muted-foreground">
              If the video doesn't play, <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">open it in a new tab or download it here</a>.
            </p>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-xl font-semibold">Related Training Modules</h3>
              
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UsingAiNhs;
