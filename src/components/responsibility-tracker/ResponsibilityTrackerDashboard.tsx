import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, List, Calendar, Users, Settings } from 'lucide-react';
import { DashboardOverview } from './DashboardOverview';
import { ResponsibilityList } from './ResponsibilityList';
import { PracticeCalendarView } from './PracticeCalendarView';
import { RoleFilteredView } from './RoleFilteredView';
import { CategoryManager } from './CategoryManager';

export function ResponsibilityTrackerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Responsibility Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Manage and track practice responsibilities, assignments and deadlines
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="responsibilities" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Responsibilities</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="by-role" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">By Role</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="responsibilities" className="mt-6">
          <ResponsibilityList />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <PracticeCalendarView />
        </TabsContent>

        <TabsContent value="by-role" className="mt-6">
          <RoleFilteredView />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <CategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
