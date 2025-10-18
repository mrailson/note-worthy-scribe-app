import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, MessageSquare, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const FeedbackResults = () => {
  const { data: feedbackData, isLoading, refetch } = useQuery({
    queryKey: ["feedback-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_manager_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const calculateStats = () => {
    if (!feedbackData || feedbackData.length === 0) {
      return {
        totalSubmissions: 0,
        complaintsAvgUse: 0,
        complaintsAvgUsefulness: 0,
        meetingsAvgUse: 0,
        meetingsAvgUsefulness: 0,
        complaintsUseDistribution: { yes: 0, maybe: 0, no: 0 },
        meetingsUseDistribution: { yes: 0, maybe: 0, no: 0 },
      };
    }

    const totalSubmissions = feedbackData.length;
    
    const complaintsUseSum = feedbackData.reduce((sum, item) => sum + item.would_use_complaints_system, 0);
    const complaintsUsefulnessSum = feedbackData.reduce((sum, item) => sum + item.complaints_system_usefulness, 0);
    const meetingsUseSum = feedbackData.reduce((sum, item) => sum + item.would_use_meeting_manager, 0);
    const meetingsUsefulnessSum = feedbackData.reduce((sum, item) => sum + item.meeting_manager_usefulness, 0);

    const complaintsUseDistribution = {
      yes: feedbackData.filter(item => item.would_use_complaints_system >= 7).length,
      maybe: feedbackData.filter(item => item.would_use_complaints_system >= 4 && item.would_use_complaints_system < 7).length,
      no: feedbackData.filter(item => item.would_use_complaints_system < 4).length,
    };

    const meetingsUseDistribution = {
      yes: feedbackData.filter(item => item.would_use_meeting_manager >= 7).length,
      maybe: feedbackData.filter(item => item.would_use_meeting_manager >= 4 && item.would_use_meeting_manager < 7).length,
      no: feedbackData.filter(item => item.would_use_meeting_manager < 4).length,
    };

    return {
      totalSubmissions,
      complaintsAvgUse: complaintsUseSum / totalSubmissions,
      complaintsAvgUsefulness: complaintsUsefulnessSum / totalSubmissions,
      meetingsAvgUse: meetingsUseSum / totalSubmissions,
      meetingsAvgUsefulness: meetingsUsefulnessSum / totalSubmissions,
      complaintsUseDistribution,
      meetingsUseDistribution,
    };
  };

  const stats = calculateStats();

  const getScoreColor = (score: number, max: number = 10) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 40) return "text-amber-600";
    return "text-red-600";
  };

  const commentsWithText = feedbackData?.filter(item => item.comments && item.comments.trim() !== "") || [];

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Feedback Results
            </h1>
            <p className="text-muted-foreground mt-2">
              Aggregate feedback from practice managers across the region
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="text-centre py-12">
            <p className="text-muted-foreground">Loading feedback data...</p>
          </div>
        ) : stats.totalSubmissions === 0 ? (
          <Card>
            <CardContent className="p-12 text-centre">
              <p className="text-muted-foreground">No feedback submissions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Overall Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Overall Statistics
                </CardTitle>
                <CardDescription>
                  Based on {stats.totalSubmissions} submission{stats.totalSubmissions !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-centre">
                  <div className="text-5xl font-bold text-primary">
                    {stats.totalSubmissions}
                  </div>
                  <p className="text-muted-foreground mt-2">Total Responses</p>
                </div>
              </CardContent>
            </Card>

            {/* Complaints System Scores */}
            <Card>
              <CardHeader>
                <CardTitle>Complaints Manager System</CardTitle>
                <CardDescription>Interest and usefulness ratings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Would Use This System</span>
                    <span className={`text-sm font-bold ${getScoreColor(stats.complaintsAvgUse)}`}>
                      {stats.complaintsAvgUse.toFixed(1)}/10
                    </span>
                  </div>
                  <Progress value={(stats.complaintsAvgUse / 10) * 100} className="h-3" />
                  
                  <div className="flex gap-2 mt-3">
                    <Badge variant="default" className="bg-green-600">
                      Yes: {stats.complaintsUseDistribution.yes}
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-600">
                      Maybe: {stats.complaintsUseDistribution.maybe}
                    </Badge>
                    <Badge variant="outline" className="border-red-600 text-red-600">
                      No: {stats.complaintsUseDistribution.no}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Usefulness Rating</span>
                    <span className={`text-sm font-bold ${getScoreColor(stats.complaintsAvgUsefulness, 5)}`}>
                      {stats.complaintsAvgUsefulness.toFixed(1)}/5
                    </span>
                  </div>
                  <Progress value={(stats.complaintsAvgUsefulness / 5) * 100} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Meeting Manager Scores */}
            <Card>
              <CardHeader>
                <CardTitle>Meeting Notes Manager System</CardTitle>
                <CardDescription>Interest and usefulness ratings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Would Use This System</span>
                    <span className={`text-sm font-bold ${getScoreColor(stats.meetingsAvgUse)}`}>
                      {stats.meetingsAvgUse.toFixed(1)}/10
                    </span>
                  </div>
                  <Progress value={(stats.meetingsAvgUse / 10) * 100} className="h-3" />
                  
                  <div className="flex gap-2 mt-3">
                    <Badge variant="default" className="bg-green-600">
                      Yes: {stats.meetingsUseDistribution.yes}
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-600">
                      Maybe: {stats.meetingsUseDistribution.maybe}
                    </Badge>
                    <Badge variant="outline" className="border-red-600 text-red-600">
                      No: {stats.meetingsUseDistribution.no}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Usefulness Rating</span>
                    <span className={`text-sm font-bold ${getScoreColor(stats.meetingsAvgUsefulness, 5)}`}>
                      {stats.meetingsAvgUsefulness.toFixed(1)}/5
                    </span>
                  </div>
                  <Progress value={(stats.meetingsAvgUsefulness / 5) * 100} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Anonymous Comments */}
            {commentsWithText.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Anonymous Comments
                  </CardTitle>
                  <CardDescription>
                    Feedback from practice managers ({commentsWithText.length} comment{commentsWithText.length !== 1 ? 's' : ''})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {commentsWithText.map((item) => (
                      <Card key={item.id} className="bg-muted/50">
                        <CardContent className="p-4">
                          <p className="text-sm whitespace-pre-wrap">{item.comments}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Submitted {format(new Date(item.created_at), "d MMMM yyyy 'at' HH:mm")}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackResults;
