import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Monitor, Laptop, Settings, Phone, HelpCircle, Clock, ClipboardList, BarChart3, FileText, AlertTriangle, Users, Calendar, TrendingUp, Download, PoundSterling } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import gpConnectEmisBooking from "@/assets/gp-connect-emis-booking.png";
import gpConnectSystmoneConfig from "@/assets/gp-connect-systmone-config.png";

// Digital Task and Finish Action Log Data
const digitalTfActions = [
  { id: 2, description: "Scope the cost and level of work required for GP system write-back into NARP re patient PNG flags", owner: "Matt Hutton", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 3, description: "Scope options around a manual vs automatic patient flagging mechanism", owner: "Matt Hutton", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 4, description: "Work up the potential costs of additional ICE licenses, or complexities where an individual works across multiple surgeries", owner: "Clare Craven", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 5, description: "Add a member from the PCT to the T&F group", owner: "Ellie Wagg", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 7, description: "Work through the technical capability within ICE re routing for results", owner: "Clare Craven", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 8, description: "Review the SLAs in place for ICE account creation and management.", owner: "Clare Craven", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 9, description: "Set up a futures page to host shared documents", owner: "Kirstie Watson", organisation: "", dueDate: "", status: "", dateCompleted: "" },
  { id: 11, description: "Clarify if the True Hub model requires separate CQC registration and how it impacts reporting", owner: "Ellie Wagg", organisation: "ICB", dueDate: "", status: "", dateCompleted: "" },
  { id: 12, description: "CM speaking to Oxford colleges to ensure that OUH can see Northamptonshire SC records", owner: "Claire Mansfield", organisation: "ICB", dueDate: "", status: "", dateCompleted: "" },
  { id: 13, description: "Malcolm and Sue to share estimate of staffing numbers for ICE licenses (see ref 4)", owner: "Malcolm Railson/Sue Williams", organisation: "NRES Manager/ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 14, description: "Malcolm and Sue to share SOP for test results (see ref 7)", owner: "", organisation: "", dueDate: "", status: "", dateCompleted: "" },
];

export const SDADigitalIntegration = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Digital Interoperability Proof of Concept</h2>
        <p className="text-slate-600 mt-1">
          Verification evidence for cross-system clinical booking using GP Connect between EMIS and SystmOne (TPP) sites.
        </p>
      </div>

      {/* Evidence Cards */}
      <CollapsibleCard
        title="GP Connect Technical Evidence"
        icon={<Monitor className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Exhibit 1 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Exhibit 1: System Configuration (NRES Mapping)</h3>
            <img 
              src={gpConnectSystmoneConfig} 
              alt="SystmOne GP Remote Booking - NRES SDA configuration showing available rotas at Brackley Medical Centre"
              className="w-full rounded-lg border border-slate-200 shadow-sm"
            />
          </div>

          {/* Exhibit 2 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Exhibit 2: Confirmed Cross-Provider Booking</h3>
            <img 
              src={gpConnectEmisBooking} 
              alt="EMIS Web GP Connect Appointments - Cross-provider booking at Brackley Medical Centre showing NRES SDA appointments"
              className="w-full rounded-lg border border-slate-200 shadow-sm"
            />
          </div>
        </div>
      </CollapsibleCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Status */}
        <CollapsibleCard
          title="Verification Complete"
          icon={<CheckCircle2 className="w-5 h-5" />}
          className="bg-gradient-to-br from-green-50 to-emerald-50"
          badge={<Badge className="bg-green-600">100% ACCESS GRANTED</Badge>}
        >
          <p className="text-sm text-green-700">
            <strong>Confirmed:</strong> Alex Whitehead, Malcolm Railson, and Amanda Taylor have successfully verified functional clinical system access across all 7 practice clinical environments. All Data Sharing Agreements (DSAs) have been completed and signed.
          </p>
        </CollapsibleCard>

        {/* Remote Hardware Strategy */}
        <CollapsibleCard
          title="Remote Hardware Strategy"
          icon={<Laptop className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Central Procurement</h4>
                <p className="text-sm text-slate-600">Laptops for all remote SDA staff managed centrally (Malcolm Railson?).</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Clinical-Grade Config</h4>
                <p className="text-sm text-slate-600">Pre-configured VPNs and local EMIS/TPP shortcuts for home sessions.</p>
              </div>
            </div>

            {/* Hardware & Software Cost Estimate */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-amber-800 mb-2">Hardware & Software Costs (Project Budget Item)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-700">£1,200</p>
                  <p className="text-sm text-amber-600">per laptop (Software & Hardware)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-700">8-10</p>
                  <p className="text-sm text-amber-600">laptops required</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200 text-center">
                <p className="text-sm text-amber-700">
                  <strong>Estimated Total:</strong> £9,600 - £12,000
                </p>
              </div>
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* System Access Summary */}
      <CollapsibleCard
        title="System Access Matrix"
        icon={<Settings className="w-5 h-5" />}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { system: "SystmOne (TPP)", status: "Active", practices: 5, color: "bg-blue-50" },
              { system: "EMIS Web", status: "Active", practices: 2, color: "bg-cyan-50" },
              { system: "GP Connect", status: "Verified", practices: 7, color: "bg-green-50" },
              { system: "Ardem & Gem VPN", status: "Always On", practices: 7, color: "bg-purple-50" },
            ].map((item, index) => (
              <div key={index} className={`${item.color} rounded-lg p-4 text-center`}>
                <p className="text-sm text-slate-500 font-medium">{item.system}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{item.practices}</p>
                <p className="text-xs text-slate-500">practices</p>
                <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>

          {/* Practice breakdown */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-semibold text-slate-900 mb-3">Practice System Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-[#005EB8]"></div>
                  <h5 className="font-semibold text-slate-900">SystmOne (TPP) - 5 Practices</h5>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-5">
                  <li>Brackley Medical Centre</li>
                  <li>The Parks (Roade, Blisworth, Hanslope, Grange Park)</li>
                  <li>Brook Health Centre</li>
                  <li>Denton Surgery</li>
                  <li>Bugbrooke Surgery</li>
                </ul>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-600"></div>
                  <h5 className="font-semibold text-slate-900">EMIS Web - 2 Practices</h5>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-5">
                  <li>Springfield Surgery</li>
                  <li>Towcester Medical Centre</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Hardware note */}
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-slate-700">
              <strong>Hardware Access:</strong> All 7 practices clinical systems are accessible via standard Ardem & Gem Build Laptops with always-on VPN configuration.
            </p>
          </div>
        </div>
      </CollapsibleCard>

      {/* IT & Telephony Q&A */}
      <CollapsibleCard
        title="IT & Telephony - Key Questions"
        icon={<Phone className="w-5 h-5" />}
      >
        <div className="space-y-6">
          {/* Question 1 - Triage Systems */}
          <div className="border-l-4 border-[#005EB8] pl-4">
            <div className="flex items-start gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-slate-900">How will practice triage systems feed into the appointments?</h4>
            </div>
            <p className="text-sm text-slate-600 ml-7 mb-3">
              <span className="italic text-amber-600">Answer pending - to be confirmed with clinical leads</span>
            </p>
            <div className="ml-7 bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h5 className="font-semibold text-purple-900 mb-2 text-sm">Options for Programme Board to Consider:</h5>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">A.</span>
                  <span><strong>Centralised Triage Hub:</strong> Single triage team reviews all online/phone contacts and books directly into SDA slots across practices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">B.</span>
                  <span><strong>Practice-Led Triage:</strong> Each practice triages their own patients but can book into neighbourhood-wide SDA slots when appropriate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">C.</span>
                  <span><strong>Hybrid Model:</strong> Practice triage for registered patients; centralised overflow triage for high-demand periods</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">D.</span>
                  <span><strong>Other:</strong> Alternative approach to be proposed by the Board</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Question 2 - Cross-Practice Care */}
          <div className="border-l-4 border-[#005EB8] pl-4">
            <div className="flex items-start gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-slate-900">If patients are seen at a different practice:</h4>
            </div>
            <div className="ml-7 space-y-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who is responsible for follow-up?</p>
                <p className="text-sm text-slate-600 mt-1 mb-2">
                  <span className="italic text-amber-600">Answer pending - governance to be agreed</span>
                </p>
                <div className="bg-purple-50 rounded p-3 border border-purple-200">
                  <h6 className="font-semibold text-purple-900 mb-1 text-xs">Options for Board:</h6>
                  <ul className="text-xs text-slate-700 space-y-1">
                    <li><span className="font-semibold text-purple-700">A.</span> Seeing clinician completes acute episode; registered practice handles ongoing care</li>
                    <li><span className="font-semibold text-purple-700">B.</span> All follow-up returns to registered practice with clear handover protocol</li>
                    <li><span className="font-semibold text-purple-700">C.</span> Time-limited follow-up (e.g., 72hrs) with seeing clinician, then handover</li>
                    <li><span className="font-semibold text-purple-700">D.</span> Other: Alternative approach to be proposed by the Board</li>
                  </ul>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who orders pathology?</p>
                <p className="text-sm text-slate-600 mt-1 mb-2">
                  <span className="italic text-amber-600">Answer pending - governance to be agreed</span>
                </p>
                <div className="bg-purple-50 rounded p-3 border border-purple-200">
                  <h6 className="font-semibold text-purple-900 mb-1 text-xs">Options for Board:</h6>
                  <ul className="text-xs text-slate-700 space-y-1">
                    <li><span className="font-semibold text-purple-700">A.</span> Seeing clinician orders and actions results (requires cross-practice permissions)</li>
                    <li><span className="font-semibold text-purple-700">B.</span> Registered practice orders on behalf with shared task in clinical system</li>
                    <li><span className="font-semibold text-purple-700">C.</span> Seeing clinician orders; results route to registered practice for action</li>
                    <li><span className="font-semibold text-purple-700">D.</span> Other: Alternative approach to be proposed by the Board</li>
                  </ul>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who handles referrals?</p>
                <p className="text-sm text-slate-600 mt-1 mb-2">
                  <span className="italic text-amber-600">Answer pending - governance to be agreed</span>
                </p>
                <div className="bg-purple-50 rounded p-3 border border-purple-200">
                  <h6 className="font-semibold text-purple-900 mb-1 text-xs">Options for Board:</h6>
                  <ul className="text-xs text-slate-700 space-y-1">
                    <li><span className="font-semibold text-purple-700">A.</span> Seeing clinician makes referral using patient's registered practice code</li>
                    <li><span className="font-semibold text-purple-700">B.</span> Referral tasked to registered practice to process</li>
                    <li><span className="font-semibold text-purple-700">C.</span> Centralised referral hub processes all SDA-generated referrals</li>
                    <li><span className="font-semibold text-purple-700">D.</span> Other: Alternative approach to be proposed by the Board</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Question 3 - Telephony Hub */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-start gap-2 mb-2">
              <Phone className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-slate-900">Telephony Hub Requirement</h4>
            </div>
            <div className="ml-7 space-y-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-600">UPDATE - 23rd Jan 2026</Badge>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Current Status:</strong> 6 of 7 practices are on <strong>Surgery Connect</strong> phone system.
                  </p>
                  <p>
                    <strong>Outstanding:</strong> Denton Village Surgery is on a different provider.
                  </p>
                  <p>
                    <strong>Action Taken:</strong> Met with X-ON (Surgery Connect parent company) on 18th December 2025. Requested they fund the transfer of Denton Village Surgery to Surgery Connect (buy-out cost from existing provider).
                  </p>
                </div>
              </div>

              {/* X-ON Commercial Proposal */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-300">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h5 className="font-semibold text-slate-900">X-ON Commercial Proposal Received</h5>
                    <Badge className="bg-green-600 text-xs">15th January 2026</Badge>
                  </div>
                  <a 
                    href="/documents/X-ON_Intelligent_Care_Navigation_Proposal_NRES_Jan2026.pdf" 
                    download="X-ON_Intelligent_Care_Navigation_Proposal_NRES_Jan2026.pdf"
                    className="flex items-center gap-2 bg-[#005EB8] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#004494] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Proposal
                  </a>
                </div>
                <p className="text-sm text-slate-700 mb-3">
                  Following negotiations, X-ON has submitted an updated commercial proposal for the <strong>Intelligent Care Navigation System</strong>. Key terms include:
                </p>
                
                <div className="bg-white rounded-lg p-3 mb-3 border border-green-200">
                  <h6 className="font-semibold text-slate-900 text-sm mb-2">Key Commercial Terms:</h6>
                  <ul className="text-sm text-slate-700 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span><strong>17.7% discount</strong> from RRP across all products</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>X-ON will fund <strong>Denton Village Surgery telephony buy-out in full</strong> (£6,434.79 inc. VAT)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span><strong>Two-month rental-free period</strong> (£13,708.87 concession)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span>36-month contract term</span>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center gap-3 p-3 bg-blue-100 rounded-lg border border-blue-300 mb-3">
                  <PoundSterling className="w-5 h-5 text-blue-700" />
                  <div>
                    <p className="text-blue-900 font-semibold">Annual Cost: £82,253.22</p>
                    <p className="text-blue-700 text-xs">(~£6,854/month for 6 practices)</p>
                  </div>
                </div>
              </div>

              {/* Products Included */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h5 className="font-semibold text-slate-900 mb-2">Products Included in Proposal</h5>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Surgery Assist</strong> - AI-powered 24/7 digital front door with multilingual support
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Surgery Insights</strong> - Unified analytics dashboard
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Omni-Consult</strong> - Voice/Web/Staff consultation forms
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Surgery Intellect</strong> - AI Scribe (TORTUS technology, UKCA Class I medical device)
                    </div>
                  </li>
                </ul>
                <p className="text-xs text-slate-500 mt-2 italic">Note: Surgery Connect telephony for Denton is a separate proposal (buy-out funded by X-ON)</p>
              </div>

              {/* Next Steps */}
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <h5 className="font-semibold text-amber-900 text-sm mb-2">Next Steps:</h5>
                <ul className="text-sm text-amber-800 space-y-1 list-disc ml-4">
                  <li>Walk-through meeting to be scheduled with X-ON</li>
                  <li>Formal evaluation against NRES requirements</li>
                  <li>Decision on commercial package</li>
                </ul>
                <p className="text-sm text-amber-800 mt-2">
                  <strong>Lead Contacts:</strong> Alex and Malcolm to provide ongoing updates on IT/practical setup progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* SDA Pilot Reporting Plan */}
      <CollapsibleCard
        title="SDA Pilot Reporting Plan (Draft)"
        icon={<BarChart3 className="w-5 h-5" />}
        badge={<Badge className="bg-amber-500">DRAFT - For Programme Board Approval</Badge>}
      >
        <div className="space-y-6">
          {/* Document Status Header */}
          <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg p-4 border border-blue-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#005EB8]" />
                <div>
                  <h4 className="font-semibold text-slate-900">NRES SDA Pilot Reporting Plan</h4>
                  <p className="text-sm text-slate-600">Version 1.3 | January 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a 
                  href="/documents/NRES_SDA_Pilot_Reporting_Plan.docx" 
                  download="NRES_SDA_Pilot_Reporting_Plan.docx"
                  className="flex items-center gap-2 bg-[#005EB8] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#004494] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download DOCX
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm mt-3 pt-3 border-t border-blue-200">
              <div className="text-center">
                <p className="font-bold text-[#005EB8]">88,938</p>
                <p className="text-slate-500">Patients</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#005EB8]">7</p>
                <p className="text-slate-500">Practices</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#005EB8]">£2.34M</p>
                <p className="text-slate-500">Contract</p>
              </div>
            </div>
          </div>

          {/* KPI Framework */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#005EB8]" />
              KPI Framework Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { category: "Access & Utilisation", metrics: ["Slot Utilisation ≥85%", "DNA Rate <5%", "Same-Day Access ≥70%", "Time to Appointment <4hrs"], color: "bg-blue-50 border-blue-200" },
                { category: "Clinical System Connectivity", metrics: ["SystmOne Booking Rate (Monitor)", "GP Connect Success ≥98%", "Cross-System DNA Variance <2%"], color: "bg-cyan-50 border-cyan-200" },
                { category: "Risk Stratification & Continuity", metrics: ["RED Flag Continuity ≥80%", "RED Flag SDA Diversion <10%", "Risk Flag Currency ≥95%"], color: "bg-red-50 border-red-200" },
                { category: "Workforce & Capacity", metrics: ["GP/ANP Sessions Delivered ≥95%", "Skill Mix Ratio (Monitor)", "Unfilled Sessions <5%"], color: "bg-purple-50 border-purple-200" },
                { category: "Quality & Outcomes", metrics: ["Patient Satisfaction ≥90%", "Consultation Outcome Rate ≥75%", "Safety Events = 0"], color: "bg-green-50 border-green-200" },
                { category: "Financial", metrics: ["Cost per Appointment (Monitor)", "Budget Variance ±5%", "Activity vs Contract ≥95%"], color: "bg-amber-50 border-amber-200" },
              ].map((kpi, index) => (
                <div key={index} className={`${kpi.color} rounded-lg p-4 border`}>
                  <h5 className="font-semibold text-slate-900 text-sm mb-2">{kpi.category}</h5>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {kpi.metrics.map((metric, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-slate-400">•</span>
                        {metric}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Reporting Schedule */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#005EB8]" />
              Reporting Schedule
            </h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Report</TableHead>
                    <TableHead className="font-semibold">Audience</TableHead>
                    <TableHead className="font-semibold">Frequency</TableHead>
                    <TableHead className="font-semibold">Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { report: "Operational Dashboard", audience: "Practice Managers, PCN Team", frequency: "Real-time / Daily", owner: "NRES Development Manager" },
                    { report: "Weekly Activity Report", audience: "Programme Board, Practices", frequency: "Weekly (Monday)", owner: "NRES Development Manager" },
                    { report: "Monthly Performance Report", audience: "ICB, Programme Board", frequency: "Monthly (by 10th)", owner: "Programme Board Chair" },
                    { report: "Quarterly Evaluation Report", audience: "ICB Board, NHS England", frequency: "Quarterly", owner: "Programme Board" },
                    { report: "Annual Review & Business Case", audience: "ICB, NHS England, Commissioners", frequency: "Annually", owner: "Programme Board" },
                  ].map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-sm">{row.report}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.audience}</TableCell>
                      <TableCell className="text-sm">{row.frequency}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.owner}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Escalation Thresholds */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Escalation Thresholds
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-red-600">RED Triggers</Badge>
                </div>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• Slot utilisation &lt;70% for 2 consecutive weeks</li>
                  <li>• DNA rate &gt;10% for 2 consecutive weeks</li>
                  <li>• Any patient safety incident</li>
                  <li>• GP Connect failure rate &gt;5%</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-amber-500">AMBER Triggers</Badge>
                </div>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• Budget variance &gt;10%</li>
                  <li>• Unfilled sessions &gt;10% for any week</li>
                  <li>• Patient satisfaction &lt;85%</li>
                  <li>• RED flag continuity &lt;70%</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Risk Stratification Routing */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#005EB8]" />
              Risk Stratification Routing
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-center">
                <Badge className="bg-red-600 mb-2">RED Flag</Badge>
                <p className="text-sm font-medium text-slate-900">Continuity of Care</p>
                <p className="text-xs text-slate-600 mt-1">Named GP / Usual Clinician</p>
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
                <Badge className="bg-amber-500 mb-2">AMBER Flag</Badge>
                <p className="text-sm font-medium text-slate-900">SDA with Review</p>
                <p className="text-xs text-slate-600 mt-1">Care Coordinator Review</p>
              </div>
              <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
                <Badge className="bg-green-600 mb-2">GREEN Flag</Badge>
                <p className="text-sm font-medium text-slate-900">Standard SDA</p>
                <p className="text-xs text-slate-600 mt-1">Any Available Clinician</p>
              </div>
            </div>
          </div>

          {/* Programme Board Questions */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Programme Board Questions - Clarification Required
            </h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-100/50">
                    <TableHead className="w-12 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Question</TableHead>
                    <TableHead className="w-28 font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: 1, question: "Who will own and produce the weekly activity reports? NRES Development Manager specified - is this role confirmed and resourced?", status: "To Confirm" },
                    { id: 2, question: "Where will the operational dashboard be hosted? SystmOne? Separate BI tool? Access for all practices?", status: "To Confirm" },
                    { id: 3, question: "How will GP Connect booking failures be escalated? Technical support pathway for the 2 EMIS practices?", status: "To Confirm" },
                    { id: 4, question: "Who validates and maintains the Risk Stratification Flags? Practice-level or centralised responsibility?", status: "To Confirm" },
                    { id: 5, question: "Monthly data submission process - who submits to ICB and in what format? Template required?", status: "To Confirm" },
                    { id: 6, question: "How will prescribing data be attributed to NAS appointments? Link to Prescribing Achievement Framework tracking?", status: "To Confirm" },
                    { id: 7, question: "Data sharing agreements between practices - are these complete for reporting purposes?", status: "Confirmed" },
                    { id: 8, question: "Quarterly evaluation report - who conducts the evaluation? Internal or external?", status: "To Confirm" },
                    { id: 9, question: "Sample dashboard views in document - are these to be implemented in a BI tool, or indicative only?", status: "To Confirm" },
                  ].map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.id}</TableCell>
                      <TableCell className="text-sm text-slate-700">{item.question}</TableCell>
                      <TableCell>
                        {item.status === "Confirmed" ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Confirmed
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <HelpCircle className="w-3 h-3 mr-1" />
                            To Confirm
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            Source: NRES_SDA_Pilot_Reporting_Plan.docx v1.2 | Last updated: December 2025
          </p>
        </div>
      </CollapsibleCard>

      {/* Digital Task and Finish Action Log */}
      <CollapsibleCard
        title="Digital Task & Finish Group - Action Log"
        icon={<ClipboardList className="w-5 h-5" />}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-20 font-semibold">Action ID</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="w-44 font-semibold">Owner</TableHead>
                <TableHead className="w-28 font-semibold">Due Date</TableHead>
                <TableHead className="w-28 font-semibold">Status</TableHead>
                <TableHead className="w-32 font-semibold">Date Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {digitalTfActions.map((action) => (
                <TableRow key={action.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{action.id}</TableCell>
                  <TableCell className="text-sm text-slate-700">{action.description}</TableCell>
                  <TableCell className="text-sm">
                    {action.owner ? (
                      <div>
                        <span>{action.owner}</span>
                        {action.organisation && (
                          <span className="text-xs text-slate-500 block">({action.organisation})</span>
                        )}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{action.dueDate || "-"}</TableCell>
                  <TableCell>
                    {action.status === "In progress" ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">In progress</Badge>
                    ) : action.status ? (
                      <Badge variant="outline">{action.status}</Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{action.dateCompleted || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Next Meeting:</span> 22nd January 2026
          </p>
          <p className="text-sm text-slate-600">
            Updates will be available on the Notewell NRES portal and at the next Programme Board meeting.
          </p>
          <p className="text-xs text-slate-500 italic">
            Last updated: 12 January 2026
          </p>
        </div>
      </CollapsibleCard>
    </div>
  );
};
