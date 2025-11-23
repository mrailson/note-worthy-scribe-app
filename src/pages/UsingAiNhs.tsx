import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
          <CardContent>
            <video 
              controls 
              preload="metadata"
              className="w-full rounded-lg border shadow-lg"
              crossOrigin="anonymous"
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            <p className="text-sm text-muted-foreground mt-4">
              If the video doesn't play, <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">download it here</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UsingAiNhs;
