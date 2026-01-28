import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Image, Presentation, FileText, Activity, Mic, Languages } from 'lucide-react';
import { GenieUsageReport } from './GenieUsageReport';
import { ImageUsageReport } from './ImageUsageReport';
import { PresentationUsageReport } from './PresentationUsageReport';
import { PolicyUsageReport } from './PolicyUsageReport';
import { MeetingUsageReport } from './MeetingUsageReport';
import { GPScribeStats } from './GPScribeStats';
import { TranslationUsageReport } from './TranslationUsageReport';

export const AI4GPServicesOverview = () => {
  const [activeTab, setActiveTab] = useState('genie');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Pilot Usage Report
          </CardTitle>
          <CardDescription>
            Pilot usage statistics across all AI-powered services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
              <TabsTrigger value="genie" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Overview</span>
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
              <TabsTrigger value="policies" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Notewell Policies</span>
                <span className="sm:hidden">Policies</span>
              </TabsTrigger>
              <TabsTrigger value="meetings" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Meeting Service</span>
                <span className="sm:hidden">Meetings</span>
              </TabsTrigger>
              <TabsTrigger value="scribe" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">GP Scribe</span>
                <span className="sm:hidden">Scribe</span>
              </TabsTrigger>
              <TabsTrigger value="translation" className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline">Translation</span>
                <span className="sm:hidden">Trans</span>
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

            <TabsContent value="policies" className="mt-6">
              <PolicyUsageReport />
            </TabsContent>

            <TabsContent value="meetings" className="mt-6">
              <MeetingUsageReport />
            </TabsContent>

            <TabsContent value="scribe" className="mt-6">
              <GPScribeStats />
            </TabsContent>

            <TabsContent value="translation" className="mt-6">
              <TranslationUsageReport />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};