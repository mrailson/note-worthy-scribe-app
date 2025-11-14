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
          <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
            <TabsTrigger value="diagram">Workflow Diagram</TabsTrigger>
            <TabsTrigger value="details">How It Works</TabsTrigger>
            <TabsTrigger value="integration">Clinical System Integration</TabsTrigger>
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

              <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-2 border-green-300 dark:border-green-800">
                <h4 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-4">3. Benefits</h4>
                <ul className="space-y-3 text-base">
                  <li className="flex gap-2"><span className="text-xl">✓</span><span><strong>Guaranteed governance:</strong> No results lost between hub and practice.</span></li>
                  <li className="flex gap-2"><span className="text-xl">✓</span><span><strong>Consistent, safe workflow</strong> across 7 practices.</span></li>
                  <li className="flex gap-2"><span className="text-xl">✓</span><span><strong>Supports cross-practice working</strong> without increasing risk.</span></li>
                  <li className="flex gap-2"><span className="text-xl">✓</span><span><strong>Data stays within</strong> each patient's own GP home practice.</span></li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-6 rounded-lg border-2 border-amber-300 dark:border-amber-800">
                <h4 className="text-2xl font-bold text-amber-800 dark:text-amber-300 mb-4">4. Required Enablers (Critical)</h4>
                <p className="text-base mb-4 font-medium">To deliver this safely, the model requires:</p>
                <div className="space-y-4 text-base">
                  <div>
                    <p className="font-bold text-lg mb-2">🔵 Full interface access to EMIS Web and SystmOne</p>
                    <ul className="list-disc ml-8 space-y-1">
                      <li>IM1 / EMIS Partner APIs</li>
                      <li>TPP SystmOne IM1 / Client Integration</li>
                      <li>GP Connect messaging where appropriate</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-lg">🔵 ICB support for enabling these interfaces</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded border-2 border-red-300 dark:border-red-800">
                  <p className="text-base font-semibold text-red-800 dark:text-red-300 leading-relaxed">
                    Without ICS/ICB assistance to unlock supplier access:<br/>
                    → the automated routing cannot be implemented<br/>
                    → and a safe regional results-management model is not possible
                  </p>
                  <p className="text-base font-bold mt-3 text-red-900 dark:text-red-200">
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

          <TabsContent value="integration" className="flex-1 overflow-y-auto m-0 px-2 prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <div>
                <h3 className="text-xl font-bold text-[#003087] mb-3">
                  Clinical System Integration Approach
                </h3>
              </div>

              {/* Section 1: Scope and Strategy */}
              <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <h4 className="text-2xl font-bold text-[#003087] dark:text-blue-300 mb-4">1. Scope and Integration Strategy</h4>
                <p className="text-base leading-relaxed mb-3">
                  Notewell AI is designed to sit <strong>alongside</strong> existing clinical systems (EMIS, TPP SystmOne, others) as a documentation and workflow support layer, not as a replacement EPR.
                </p>
                <div className="mt-4 space-y-3">
                  <p className="text-base font-semibold">Our core principles for integration are:</p>
                  <ul className="space-y-2 list-disc ml-6 text-base">
                    <li>GP practice remains <strong>data controller</strong>; PCN Services Ltd (Notewell AI) acts as <strong>data processor</strong>.</li>
                    <li>We use <strong>nationally endorsed integration routes only</strong> – primarily IM1, GP Connect (FHIR) and vendor partner APIs.</li>
                    <li>We avoid any "shadow EHR". Notewell generates structured outputs (consultation summaries, letters, tasks) that are <strong>filed into the clinical system</strong>, not held in isolation.</li>
                  </ul>
                </div>
                <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded border border-blue-300 dark:border-blue-700">
                  <p className="text-base font-semibold mb-2">We describe the approach in three layers:</p>
                  <ul className="space-y-2 text-base">
                    <li><strong>Baseline (no APIs)</strong> – clinician copies the Notewell summary into EMIS/SystmOne manually (already workable now).</li>
                    <li><strong>Phase 1 Integration</strong> – read-only context via GP Connect / IM1 where enabled.</li>
                    <li><strong>Phase 2 Integration</strong> – write-back of structured consultation summaries/documents via EMIS Partner API / IM1 and SystmOne IM1 / Client Integration / GP Connect Update Record.</li>
                  </ul>
                </div>
              </div>

              {/* Section 2: EMIS Web Integration */}
              <div className="bg-emerald-50 dark:bg-emerald-950 p-6 rounded-lg border-2 border-emerald-200 dark:border-emerald-800">
                <h4 className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mb-4">2. EMIS Web Integration</h4>
                
                <div className="mb-5">
                  <h5 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-3">2.1 Integration mechanisms</h5>
                  <p className="text-base mb-3">We plan to support EMIS via:</p>
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-emerald-300 dark:border-emerald-700">
                      <p className="font-bold text-base mb-2">📌 EMIS Partner API (EMIS Open / Transaction / Partner)</p>
                      <p className="text-base mb-2">Exposed via EMIS Partner Programme and, for NHS wide use, the IM1 commercial model.</p>
                      <p className="text-base font-semibold mb-1">Supports:</p>
                      <ul className="list-disc ml-6 space-y-1 text-base">
                        <li>Selecting the active patient (from EMIS)</li>
                        <li>Reading key demographics and coded data</li>
                        <li>Filing a consultation / attachment back into EMIS (e.g. FileRecord)</li>
                      </ul>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-emerald-300 dark:border-emerald-700">
                      <p className="font-bold text-base mb-2">📌 NHS IM1 Interface Mechanism 1</p>
                      <p className="text-base">National standard allowing third-party systems to read, bulk extract and write data into principal GP systems, including EMIS Web.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-emerald-300 dark:border-emerald-700">
                      <p className="font-bold text-base mb-2">📌 GP Connect APIs (via Spine)</p>
                      <p className="text-base mb-2">For cross-setting use cases (e.g. federations, neighbourhood services).</p>
                      <ul className="list-disc ml-6 space-y-1 text-base">
                        <li><strong>Access Record: Structured / HTML</strong> – read a patient's coded or HTML GP record</li>
                        <li><strong>Access Document</strong> – pull unstructured docs such as discharge summaries, letters, etc.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-3">2.2 Proposed technical pattern (EMIS)</h5>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded border-l-4 border-blue-500">
                      <p className="font-bold text-lg mb-2">Phase 1 – Context-only (no write-back)</p>
                      <ul className="list-disc ml-6 space-y-1 text-base">
                        <li>User opens patient in EMIS Web.</li>
                        <li>Notewell runs in parallel (browser) and either:
                          <ul className="list-circle ml-6 mt-1">
                            <li>Uses EMIS Partner API / IM1 to confirm the active patient (NHS number, demographics) where enabled, or</li>
                            <li>Allows manual entry of patient details where integration is not yet switched on.</li>
                          </ul>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded border-l-4 border-green-500">
                      <p className="font-bold text-lg mb-2">Phase 2 – Consultation summary filing</p>
                      <p className="text-base mb-3">For practices that approve full integration:</p>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="font-semibold text-base mb-1">📥 Data in</p>
                          <p className="text-base">(Optional) pull recent medications, problems, allergies via EMIS APIs or GP Connect Access Record for context.</p>
                        </div>

                        <div>
                          <p className="font-semibold text-base mb-1">⚙️ Processing in Notewell</p>
                          <p className="text-base mb-1">Notewell generates:</p>
                          <ul className="list-disc ml-6 text-base">
                            <li>A timestamped consultation note (EMIS-friendly format)</li>
                            <li>Optional structured fields (reason for contact, history, exam, plan, safety-netting)</li>
                          </ul>
                        </div>

                        <div>
                          <p className="font-semibold text-base mb-1">📤 Data out (write-back)</p>
                          <p className="text-base mb-2">Using EMIS Partner API / IM1 FileRecord-style operation:</p>
                          <ul className="list-disc ml-6 text-base space-y-1">
                            <li>File a PDF or text consultation summary as a document</li>
                            <li>Optionally insert a coded problem/diary entry if explicitly configured</li>
                          </ul>
                          <p className="text-base mt-2">The EMIS record shows this as "Notewell AI consultation summary" under the relevant section.</p>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-300 dark:border-amber-700">
                        <p className="font-semibold text-base mb-2">All write-back operations are:</p>
                        <ul className="list-disc ml-6 text-base space-y-1">
                          <li>Initiated by the user (no autonomous updates)</li>
                          <li>Logged by Notewell (audit log) and by EMIS (integration audit trail)</li>
                          <li>Controlled at practice level – practices can choose read-only or read+write modes</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: TPP SystmOne Integration */}
              <div className="bg-purple-50 dark:bg-purple-950 p-6 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                <h4 className="text-2xl font-bold text-purple-800 dark:text-purple-300 mb-4">3. TPP SystmOne Integration</h4>
                
                <div className="mb-5">
                  <h5 className="text-lg font-bold text-purple-800 dark:text-purple-300 mb-3">3.1 Integration mechanisms</h5>
                  <p className="text-base mb-3">We plan to use:</p>
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-purple-300 dark:border-purple-700">
                      <p className="font-bold text-base mb-2">📌 IM1 Pairing Integration Process</p>
                      <p className="text-base">TPP directs third-party integrators through IM1 Pairing and a SCAL (Supplier Conformance Assessment List).</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-purple-300 dark:border-purple-700">
                      <p className="font-bold text-base mb-2">📌 SystmOne Client Integration API</p>
                      <p className="text-base mb-2">Socket-based client integration that can:</p>
                      <ul className="list-disc ml-6 space-y-1 text-base">
                        <li>discover the active patient</li>
                        <li>search records</li>
                        <li>extract data</li>
                        <li>add new data (e.g. consultations, diary entries)</li>
                      </ul>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-purple-300 dark:border-purple-700">
                      <p className="font-bold text-base mb-2">📌 GP Connect (for SystmOne practices)</p>
                      <p className="text-base mb-2">As with EMIS, we use GP Connect to:</p>
                      <ul className="list-disc ml-6 space-y-1 text-base">
                        <li>read structured/HTML records</li>
                        <li>optionally use Update Record to file a consultation summary (similar to community pharmacy models)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="text-lg font-bold text-purple-800 dark:text-purple-300 mb-3">3.2 Proposed technical pattern (SystmOne)</h5>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded border-l-4 border-blue-500">
                      <p className="font-bold text-lg mb-2">Phase 1 – Side-by-side workflow</p>
                      <ul className="list-disc ml-6 space-y-1 text-base">
                        <li>Clinician has SystmOne open; Notewell runs in the browser</li>
                        <li>Patient context is matched via:
                          <ul className="list-circle ml-6 mt-1">
                            <li>IM1/Client Integration active patient lookup, or</li>
                            <li>Manual confirmation (NHS number/date of birth)</li>
                          </ul>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded border-l-4 border-green-500">
                      <p className="font-bold text-lg mb-2">Phase 2 – Structured write-back</p>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="font-semibold text-base mb-1">📥 Data in</p>
                          <p className="text-base">Use SystmOne IM1/Client Integration or GP Connect Access Record to provide recent medications, problem list, and allergies as read-only context.</p>
                        </div>

                        <div>
                          <p className="font-semibold text-base mb-1">⚙️ Processing</p>
                          <p className="text-base">Notewell generates a structured consultation summary in a SystmOne-friendly style (problems, history, exam, plan, safety netting).</p>
                        </div>

                        <div>
                          <p className="font-semibold text-base mb-1">📤 Data out</p>
                          <p className="text-base mb-2">Via Client Integration API or IM1:</p>
                          <ul className="list-disc ml-6 text-base space-y-1">
                            <li>File a consultation note into the clinical record</li>
                            <li>Optionally attach the Notewell PDF/text summary as a document</li>
                          </ul>
                          <p className="text-base mt-2">Via GP Connect Update Record (where commissioned) to send a consultation summary message back to the GP system.</p>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-300 dark:border-amber-700">
                        <p className="text-base">Again, all updates are <strong>user-triggered</strong> and appear clearly as originating from <strong>Notewell AI</strong>.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Other GP Clinical Systems */}
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border-2 border-slate-300 dark:border-slate-700">
                <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-300 mb-4">4. Other GP Clinical Systems (Vision, others)</h4>
                <div className="space-y-3 text-base">
                  <p className="leading-relaxed">
                    For other GP systems (e.g. Cegedim Vision):
                  </p>
                  <ul className="list-disc ml-6 space-y-2">
                    <li>Where available, we will use the same <strong>IM1 Interface Mechanism</strong> approach and/or <strong>GP Connect</strong> as the underlying integration route.</li>
                  </ul>
                  <div className="mt-3 p-4 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                    <p className="font-semibold mb-2">Notewell treats these systems as:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>A <strong>source of context</strong> via GP Connect (read-only)</li>
                      <li>A <strong>destination for documents</strong> via GP Connect Update Record or local vendor APIs (consultation summary documents)</li>
                    </ul>
                  </div>
                  <p className="mt-3 text-base font-medium p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                    In all cases, the practice can still operate with a <strong>"copy–paste only"</strong> model if formal API integration is not commissioned or not yet available.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
