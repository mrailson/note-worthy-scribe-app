import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquareWarning } from "lucide-react";
import { SDAFeedbackModal } from "./SDAFeedbackModal";

interface SDAFeedbackButtonProps {
  currentSection: string;
}

export const SDAFeedbackButton = ({ currentSection }: SDAFeedbackButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback or Problem?</span>
        <span className="sm:hidden">Feedback</span>
      </Button>
      <SDAFeedbackModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        currentSection={currentSection}
      />
    </>
  );
};
