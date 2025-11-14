import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import workflowDiagram from "@/assets/nres-workflow-diagram.png";

interface WorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkflowModal = ({ open, onOpenChange }: WorkflowModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[#003087]">
            Neighbourhood - Across Practice Results Management
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <img 
            src={workflowDiagram} 
            alt="Neighbourhood Across Practice Results Management Workflow" 
            className="w-full h-auto rounded-lg shadow-sm"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
