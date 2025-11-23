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
              className="w-full rounded-lg border shadow-lg"
              poster={videoUrl}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UsingAiNhs;
