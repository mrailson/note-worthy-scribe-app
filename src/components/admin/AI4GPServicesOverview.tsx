import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Image, Presentation } from 'lucide-react';
import { GenieUsageReport } from './GenieUsageReport';
import { ImageUsageReport } from './ImageUsageReport';
import { PresentationUsageReport } from './PresentationUsageReport';

export const AI4GPServicesOverview = () => {
  const [activeTab, setActiveTab] = useState('genie');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI4GP Services Overview
          </CardTitle>
          <CardDescription>
            Pilot usage statistics across all AI-powered services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="genie" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">Genie Chats</span>
                <span className="sm:hidden">Genie</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">Image Studio</span>
                <span className="sm:hidden">Images</span>
              </TabsTrigger>
              <TabsTrigger value="presentations" className="flex items-center gap-2">
                <Presentation className="h-4 w-4" />
                <span className="hidden sm:inline">Presentations</span>
                <span className="sm:hidden">PPT</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="genie" className="mt-6">
              <GenieUsageReport />
            </TabsContent>

            <TabsContent value="images" className="mt-6">
              <ImageUsageReport />
            </TabsContent>

            <TabsContent value="presentations" className="mt-6">
              <PresentationUsageReport />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
