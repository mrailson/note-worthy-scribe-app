import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Users, CheckCircle2, ArrowRight, MessageSquare, X } from "lucide-react";

interface PPGUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PPGUpdateModal = ({ open, onOpenChange }: PPGUpdateModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0 gap-0 bg-white border-0 shadow-2xl [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-5 bg-gradient-to-r from-[#005EB8] to-[#003d75] text-white relative">
          {/* Custom close button in white circle */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-md hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-[#005EB8]" />
          </button>
          
          <div className="flex items-start justify-between pr-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  Action 007
                </Badge>
                <Badge className="bg-emerald-500/90 text-white border-0 hover:bg-emerald-500">
                  Latest Update
                </Badge>
              </div>
              <DialogTitle className="text-xl font-semibold text-white">
                Programme Board – Quick Update
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-blue-100">
                <Calendar className="h-4 w-4" />
                <span>13 January 2026</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-6 space-y-6 bg-slate-50">
          
          {/* Section 1: PPG Representation & Engagement */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-[#005EB8]/5 to-transparent border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-[#005EB8] flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">PPG Representation & Engagement</h3>
            </div>
            
            <div className="p-5 space-y-4 text-sm text-slate-700 leading-relaxed">
              <p>
                Practice Managers have suggested that <span className="font-semibold text-slate-900">Helen Barrett</span> will 
                be asked to facilitate a joint PPG meeting involving PPG representatives from all participating practices.
              </p>
              
              <p>
                The purpose of the meeting is to support early cross-PPG engagement, shared understanding of the 
                SDA Pilot, and coordination of non-voting PPG input at Programme Board level.
              </p>
              
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[#005EB8]">
                  <Calendar className="h-4 w-4" />
                  <span>Meeting: Monday 19 January 2026</span>
                </div>
                <p className="text-slate-700">
                  <span className="font-medium">Attendees:</span> Malcolm Railson, Dr Mark Gray, and Amanda Taylor 
                  are meeting with Helen to:
                </p>
                <ul className="space-y-2 text-slate-700 ml-1">
                  <li className="flex items-start gap-2">
                    <span className="text-[#005EB8] mt-1">•</span>
                    <span>Confirm whether she is happy to undertake this facilitation as part of her role within the NRES SDA Pilot</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#005EB8] mt-1">•</span>
                    <span>Agree scope, expectations, and practical arrangements for the PPG meeting</span>
                  </li>
                </ul>
              </div>
              
              <p className="text-slate-500 italic text-sm">
                Following this discussion, confirmation and next steps will be fed back to practices.
              </p>
            </div>
          </div>

          {/* Section 2: Governance & Programme Position */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-50 to-transparent border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Governance & Programme Position</h3>
            </div>
            
            <div className="p-5 space-y-4 text-sm text-slate-700 leading-relaxed">
              <p>
                PPG members remain <span className="font-semibold text-slate-900">non-voting attendees</span> of the Programme Board.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="font-medium text-slate-800 mb-3">The agreed approach aims to:</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span>Reduce administrative burden on individual practices</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span>Avoid perceived practice-level bias in PPG selection</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span>Encourage peer-led PPG collaboration across the pilot footprint</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: Next Steps */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-50 to-transparent border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                <ArrowRight className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Next Steps</h3>
            </div>
            
            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-emerald-50/50 border border-emerald-200/60 rounded-xl">
                <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-900">Meeting with Helen Barrett</p>
                  <p className="text-emerald-700">19 January 2026</p>
                </div>
              </div>
              
              <ul className="space-y-2 text-slate-700 ml-1">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>Confirm facilitation arrangements and proposed PPG meeting structure</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>Update to be provided to practices and included in the next Programme Board update</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end">
          <Button 
            onClick={() => onOpenChange(false)}
            className="bg-[#005EB8] hover:bg-[#004C93] text-white px-6"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Trigger button component for use in the notes column
interface PPGUpdateTriggerProps {
  onClick: () => void;
}

export const PPGUpdateTrigger = ({ onClick }: PPGUpdateTriggerProps) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#005EB8] bg-blue-50 hover:bg-[#005EB8] hover:text-white border border-blue-200 hover:border-[#005EB8] rounded-md transition-all duration-200 shadow-sm"
    >
      <MessageSquare className="h-3 w-3" />
      <span>View Update</span>
    </button>
  );
};
