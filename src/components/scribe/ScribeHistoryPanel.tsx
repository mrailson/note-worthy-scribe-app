import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScribeSession } from "@/types/scribe";
import { History, Trash2, FileText, Clock, Loader2, ArrowLeft, Copy, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { TranscriptDisplay } from "./TranscriptDisplay";

interface ScribeHistoryPanelProps {
  sessions: ScribeSession[];
  isLoading: boolean;
  currentSession: ScribeSession | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  onClearCurrentSession: () => void;
}

export const ScribeHistoryPanel = ({
  sessions,
  isLoading,
  currentSession,
  onLoadSession,
  onDeleteSession,
  onRefresh,
  onClearCurrentSession,
}: ScribeHistoryPanelProps) => {

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Loading session history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show session detail view
  if (currentSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClearCurrentSession}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{currentSession.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(currentSession.createdAt), 'EEEE, d MMMM yyyy \'at\' HH:mm')}
                </p>
              </div>
              <Badge variant="secondary">{currentSession.status}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentSession.duration ? `${Math.floor(currentSession.duration)} min` : '0 min'}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {currentSession.wordCount || 0} words
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="consultation" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="consultation">F2F Consultation</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>
              
              <TabsContent value="consultation" className="mt-4">
                {/* SOAP Notes */}
                {currentSession.soapNote && (
                  <div className="space-y-3">
                    <Accordion type="multiple" defaultValue={['S', 'O', 'A', 'P']} className="space-y-2">
                      <AccordionItem value="S" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center">S</span>
                            <span className="font-medium">Subjective (History)</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="flex justify-end mb-2">
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(currentSession.soapNote!.S, 'Subjective')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentSession.soapNote.S}</p>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="O" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold flex items-center justify-center">O</span>
                            <span className="font-medium">Objective (Examination)</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="flex justify-end mb-2">
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(currentSession.soapNote!.O, 'Objective')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentSession.soapNote.O}</p>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="A" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center">A</span>
                            <span className="font-medium">Assessment</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="flex justify-end mb-2">
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(currentSession.soapNote!.A, 'Assessment')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentSession.soapNote.A}</p>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="P" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold flex items-center justify-center">P</span>
                            <span className="font-medium">Plan</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="flex justify-end mb-2">
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(currentSession.soapNote!.P, 'Plan')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentSession.soapNote.P}</p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
                {!currentSession.soapNote && (
                  <p className="text-muted-foreground text-center py-8">No consultation notes available</p>
                )}
              </TabsContent>
              
              <TabsContent value="transcript" className="mt-4">
                {currentSession.transcript ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Recorded on {format(new Date(currentSession.createdAt), "EEEE, d MMMM yyyy 'at' HH:mm")}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(currentSession.transcript, 'Transcript')}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <ScrollArea className="h-[400px] rounded-xl border bg-gradient-to-b from-amber-50/50 to-white dark:from-slate-900/50 dark:to-slate-950 shadow-inner">
                      <TranscriptDisplay transcript={currentSession.transcript} />
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No transcript available</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No sessions yet</p>
            <p className="text-sm">Start recording to create your first session</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Session History
        </h2>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {sessions.map((session) => (
            <Card 
              key={session.id} 
              className="hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => onLoadSession(session.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base line-clamp-1">
                      {session.title}
                    </CardTitle>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.duration ? `${Math.floor(session.duration)}m` : '0m'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {session.wordCount || 0} words
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.status === 'completed' ? 'secondary' : 'outline'}>
                      {session.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  {format(new Date(session.createdAt), 'dd MMM yyyy, HH:mm')}
                </p>
                {session.transcript && (
                  <p className="text-sm text-foreground/70 line-clamp-2 mb-3">
                    {session.transcript.substring(0, 150)}...
                  </p>
                )}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoadSession(session.id);
                    }}
                  >
                    View Session
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this session and all its data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => onDeleteSession(session.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
