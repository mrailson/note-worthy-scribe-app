import { useState } from 'react';
import { PowerPointGenerator } from '@/components/PowerPointGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Presentation } from 'lucide-react';
import type { UploadedFile } from '@/types/ai4gp';

interface SlideDeckPanelProps {
  uploadedFiles: UploadedFile[];
}

export const SlideDeckPanel = ({ uploadedFiles }: SlideDeckPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Slide Deck</CardTitle>
          <CardDescription>
            Generate professional PowerPoint presentations from your documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setIsOpen(true)}
            size="lg"
            className="w-full"
          >
            <Presentation className="h-5 w-5 mr-2" />
            Open PowerPoint Generator
          </Button>

          {uploadedFiles.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Tip: Your uploaded documents can be used as context for generating slides.
                The PowerPoint generator will have access to your {uploadedFiles.length} uploaded document{uploadedFiles.length > 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <PowerPointGenerator
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </div>
  );
};
