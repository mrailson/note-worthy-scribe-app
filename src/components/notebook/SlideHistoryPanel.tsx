import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Presentation, Download, Copy, Trash2, Loader2, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { usePresentationHistory, PresentationSession } from "@/hooks/usePresentationHistory";
import { generateEnhancedPowerPoint } from "@/utils/enhancedPresentationGenerator";
import { getTemplateById } from "@/utils/presentationTemplates";
import { toast } from "sonner";

interface SlideHistoryPanelProps {
  onLoadSession: (session: PresentationSession) => void;
}

export const SlideHistoryPanel = ({ onLoadSession }: SlideHistoryPanelProps) => {
  const { sessions, loading, deleteSession, duplicateSession } = usePresentationHistory();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.title.toLowerCase().includes(query) ||
      session.topic.toLowerCase().includes(query) ||
      session.presentation_type.toLowerCase().includes(query)
    );
  });

  const handleDelete = async (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleDownload = async (session: PresentationSession) => {
    setDownloadingId(session.id);
    try {
      const template = getTemplateById(session.template_id);
      if (!template) {
        toast.error("Template not found");
        return;
      }

      const presentationContent = {
        title: session.title,
        slides: session.slides
      };

      const metadata = {
        topic: session.topic,
        presentationType: session.presentation_type,
        slideCount: session.slide_count,
        complexityLevel: session.complexity_level,
        generatedAt: session.created_at
      };

      await generateEnhancedPowerPoint({
        template: session.background_image ? { ...template, backgroundImage: session.background_image } : template,
        content: presentationContent,
        metadata,
        slideImages: session.slide_images
      });

      toast.success("PowerPoint downloaded successfully!");
    } catch (error) {
      console.error("Error downloading presentation:", error);
      toast.error("Failed to download presentation");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDuplicate = async (sessionId: string) => {
    await duplicateSession(sessionId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search presentations by title, topic, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Presentation className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No presentations found</h3>
            <p className="text-sm text-muted-foreground text-center">
              {searchQuery ? "Try adjusting your search query" : "Create your first presentation to see it here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="grid gap-4">
            {filteredSessions.map((session) => (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Presentation className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{session.title}</CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{session.presentation_type}</Badge>
                        <Badge variant="outline">{session.template_id.replace(/-/g, ' ')}</Badge>
                        <Badge variant="outline">{session.slide_count} slides</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(session.created_at), 'dd MMM yyyy, HH:mm')}</span>
                    </div>
                    {session.source_documents && session.source_documents.length > 0 && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{session.source_documents.slice(0, 2).join(', ')}
                          {session.source_documents.length > 2 && ` +${session.source_documents.length - 2} more`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => onLoadSession(session)}
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <Presentation className="w-4 h-4 mr-2" />
                      Load & Edit
                    </Button>
                    <Button
                      onClick={() => handleDownload(session)}
                      variant="outline"
                      size="sm"
                      disabled={downloadingId === session.id}
                    >
                      {downloadingId === session.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDuplicate(session.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(session.id)}
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Presentation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this presentation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
