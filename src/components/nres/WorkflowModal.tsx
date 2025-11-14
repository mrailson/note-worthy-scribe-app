import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import workflowDiagram from "@/assets/nres-workflow-diagram.png";

interface WorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkflowModal = ({ open, onOpenChange }: WorkflowModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl text-[#003087]">
            Neighbourhood - Across Practice Results Management
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="diagram" className="h-[calc(95vh-8rem)] flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
            <TabsTrigger value="diagram">Workflow Diagram</TabsTrigger>
            <TabsTrigger value="details">How It Works</TabsTrigger>
          </TabsList>
          
          <TabsContent value="diagram" className="flex-1 overflow-y-auto m-0 px-2">
            <img 
              src={workflowDiagram} 
              alt="Neighbourhood Across Practice Results Management Workflow" 
              className="w-full h-auto rounded-lg shadow-sm"
            />
          </TabsContent>
          
          <TabsContent value="details" className="flex-1 overflow-y-auto m-0 px-2 prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <div>
                <h3 className="text-xl font-bold text-[#003087] mb-3">
                  Neighbourhood Test Results Management – Proposed Operating Model
                </h3>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-lg font-semibold text-[#003087] dark:text-blue-300 mb-2">1. Core Principle</h4>
                <p className="text-base leading-relaxed">
                  Results follow the <strong>PATIENT</strong> — not the clinician and not the hub.<br/>
                  Wherever a patient is seen in the neighbourhood (hub or another practice), their results are automatically routed back to their home GP practice for review and action.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border-2 border-slate-300 dark:border-slate-700">
                <h4 className="text-2xl font-bold text-[#003087] dark:text-blue-300 mb-5">2. How It Works – Step-By-Step</h4>
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">1️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">Patient attends another practice or hub service</p>
                      <p className="text-base text-muted-foreground">Example: A Towcester Medical Centre (TMC) patient books an Enhanced Access appointment at Brackley Hub.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">2️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">Tests are ordered in the hub</p>
                      <p className="text-base text-muted-foreground">Blood tests, imaging, swabs, or other investigations requested during the consultation.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">3️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">AI captures the patient's home practice + named GP</p>
                      <p className="text-base text-muted-foreground">Using demographics from the clinical system. Ensures correct routing before results are returned.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">4️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">Results are auto-routed back to the home practice</p>
                      <ul className="text-base text-muted-foreground list-disc ml-5 mt-2 space-y-1">
                        <li>Results DO NOT go to the clinician who saw the patient.</li>
                        <li>Results DO NOT stay with the hub.</li>
                        <li>They return directly to TMC, as if they were requested by TMC.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">5️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">AI assigns responsibility</p>
                      <p className="text-base text-muted-foreground mb-2">Automatically assigns the result to:</p>
                      <ul className="text-base text-muted-foreground list-disc ml-5 space-y-1">
                        <li>the named GP, or</li>
                        <li>the home practice duty inbox, depending on practice preference.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">6️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">Governance safety net</p>
                      <ul className="text-base text-muted-foreground list-disc ml-5 space-y-1">
                        <li>48 hours → alert to home practice admin/PM</li>
                        <li>72 hours → alert escalates to Clinical Lead</li>
                        <li>96 hours → escalation to PCN Director / governance</li>
                      </ul>
                      <p className="text-base font-semibold mt-2 text-foreground">This ensures zero lost results.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <span className="text-3xl font-bold">7️⃣</span>
                    <div>
                      <p className="text-lg font-semibold mb-1">Real-time dashboard</p>
                      <ul className="text-base text-muted-foreground list-disc ml-5 space-y-1">
                        <li>Shows all outstanding hub-generated results by practice.</li>
                        <li>Highlights overdue items and escalation status.</li>
                        <li>Provides a neighbourhood-wide accountability view.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">3. Benefits</h4>
                <ul className="space-y-1 text-sm">
                  <li>✓ <strong>Guaranteed governance:</strong> No results lost between hub and practice.</li>
                  <li>✓ <strong>Consistent, safe workflow</strong> across 7 practices.</li>
                  <li>✓ <strong>Supports cross-practice working</strong> without increasing risk.</li>
                  <li>✓ <strong>Data stays within</strong> each patient's own GP home practice.</li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2">4. Required Enablers (Critical)</h4>
                <p className="text-sm mb-2">To deliver this safely, the model requires:</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="font-semibold">🔵 Full interface access to EMIS Web and SystmOne</p>
                    <ul className="list-disc ml-8">
                      <li>IM1 / EMIS Partner APIs</li>
                      <li>TPP SystmOne IM1 / Client Integration</li>
                      <li>GP Connect messaging where appropriate</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">🔵 ICB support for enabling these interfaces</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Without ICS/ICB assistance to unlock supplier access:<br/>
                    → the automated routing cannot be implemented<br/>
                    → and a safe regional results-management model is not possible
                  </p>
                  <p className="text-sm font-bold mt-2 text-red-900 dark:text-red-200">
                    This is the single most important dependency.
                  </p>
                </div>
              </div>

              <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                <h4 className="text-lg font-semibold text-[#003087] dark:text-blue-200 mb-2">5. Summary</h4>
                <p className="text-sm leading-relaxed">
                  The proposed solution delivers a safe, smart, automated neighbourhood-level test results workflow that eliminates risk, supports hub models, and strengthens clinical governance — but only if the ICB approves and enables clinical-system integration.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
