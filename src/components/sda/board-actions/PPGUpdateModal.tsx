import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, Users, CheckCircle2, ArrowRight, MessageSquare } from "lucide-react";

interface PPGUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PPGUpdateModal = ({ open, onOpenChange }: PPGUpdateModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#005EB8] text-white hover:bg-[#004C93]">
                  Action 007
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  Latest Update
                </Badge>
              </div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Programme Board – Quick Update
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>13 January 2026</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Section 1: PPG Representation & Engagement */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[#005EB8]/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-[#005EB8]" />
              </div>
              <h3 className="font-semibold text-slate-900">PPG Representation & Engagement</h3>
            </div>
            
            <div className="pl-10 space-y-3 text-sm text-slate-700">
              <p>
                Practice Managers have agreed that <span className="font-medium text-slate-900">Helen Barrett</span> will 
                be asked to facilitate a joint PPG meeting involving PPG representatives from all participating practices.
              </p>
              
              <p>
                The purpose of the meeting is to support early cross-PPG engagement, shared understanding of the 
                SDA Pilot, and coordination of non-voting PPG input at Programme Board level.
              </p>
              
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                <p className="font-medium text-blue-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Meeting: Monday 19 January 2026
                </p>
                <p className="text-blue-800">
                  <span className="font-medium">Attendees:</span> Malcolm Railson, Mark [Surname], and Amanda Taylor 
                  are meeting with Helen to:
                </p>
                <ul className="list-disc ml-5 space-y-1 text-blue-800">
                  <li>Confirm whether she is happy to undertake this facilitation as part of her role within the MRes SDA Pilot</li>
                  <li>Agree scope, expectations, and practical arrangements for the PPG meeting</li>
                </ul>
              </div>
              
              <p className="text-slate-600 italic">
                Following this discussion, confirmation and next steps will be fed back to practices.
              </p>
            </div>
          </div>

          <Separator />

          {/* Section 2: Governance & Programme Position */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-700" />
              </div>
              <h3 className="font-semibold text-slate-900">Governance & Programme Position</h3>
            </div>
            
            <div className="pl-10 space-y-3 text-sm text-slate-700">
              <p>
                PPG members remain <span className="font-medium text-slate-900">non-voting attendees</span> of the Programme Board.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="font-medium text-slate-800 mb-2">The agreed approach aims to:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Reduce administrative burden on individual practices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Avoid perceived practice-level bias in PPG selection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Encourage peer-led PPG collaboration across the pilot footprint</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 3: Next Steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-green-700" />
              </div>
              <h3 className="font-semibold text-slate-900">Next Steps</h3>
            </div>
            
            <div className="pl-10 space-y-2 text-sm">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Meeting with Helen Barrett</p>
                  <p className="text-green-700">19 January 2026</p>
                </div>
              </div>
              
              <ul className="list-disc ml-5 space-y-1 text-slate-700">
                <li>Confirm facilitation arrangements and proposed PPG meeting structure</li>
                <li>Update to be provided to practices and included in the next Programme Board update</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
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
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#005EB8] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
    >
      <MessageSquare className="h-3 w-3" />
      <span>View Update</span>
    </button>
  );
};
