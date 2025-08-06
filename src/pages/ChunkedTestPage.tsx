import React from 'react';
import { Header } from '@/components/Header';
import ChunkedTranscriptionTest from '@/components/ChunkedTranscriptionTest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TestTube2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ChunkedTestPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/gp-scribe')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to GP Scribe
          </Button>
        </div>

        <Card className="shadow-medium border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-primary" />
              Chunked Transcription Testing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>This is a testing interface for the chunked transcription system. Use this to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Test how speech is split into 5-second chunks</li>
                  <li>Examine how sentences are reconstructed across chunk boundaries</li>
                  <li>Compare raw chunked output vs AI-cleaned transcript</li>
                  <li>Test continuous recording for extended periods</li>
                </ul>
              </div>
              
              <ChunkedTranscriptionTest />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChunkedTestPage;