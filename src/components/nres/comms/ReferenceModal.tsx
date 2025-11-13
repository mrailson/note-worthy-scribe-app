import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReferenceModal = ({ open, onOpenChange }: ReferenceModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[90vh] p-6">
        <DialogHeader>
          <DialogTitle className="text-[#003087]">NRES Comms Strategy Reference</DialogTitle>
        </DialogHeader>
        <div className="w-full h-full overflow-hidden">
          <iframe 
            src="https://claude.site/public/artifacts/8e3c3eac-c391-4a84-a0c5-d481fb7a061a/embed" 
            title="Claude Artifact" 
            width="100%" 
            height="100%" 
            frameBorder="0" 
            allow="clipboard-write" 
            allowFullScreen
            className="rounded-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
