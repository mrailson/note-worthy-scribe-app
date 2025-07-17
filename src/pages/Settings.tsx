import { useState } from "react";
import { Header } from "@/components/Header";
import { AttendeeManager } from "@/components/AttendeeManager";
import { PracticeManager } from "@/components/PracticeManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Users, Building } from "lucide-react";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} onHelp={() => {}} />
      
      <div className="container mx-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your attendees and practice details</p>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="attendees" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="attendees" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees
              </TabsTrigger>
              <TabsTrigger value="practices" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Practices
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendees" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Attendee Management
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Manage your regular meeting attendees. You can add frequently attending colleagues 
                    and mark some as default attendees for new meetings.
                  </p>
                </CardHeader>
              </Card>
              <AttendeeManager />
            </TabsContent>

            <TabsContent value="practices" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Practice Management
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Manage your practice details. You can set up multiple practices if you work 
                    across different locations or set one as your default practice for all meetings.
                  </p>
                </CardHeader>
              </Card>
              <PracticeManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};