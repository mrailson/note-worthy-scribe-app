import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Monitor, Laptop, Settings, Phone, HelpCircle, Clock, ClipboardList } from "lucide-react";
import gpConnectEmisBooking from "@/assets/gp-connect-emis-booking.png";
import gpConnectSystmoneConfig from "@/assets/gp-connect-systmone-config.png";

// Digital Task and Finish Action Log Data
const digitalTfActions = [
  { id: 2, description: "Scope the cost and level of work required for GP system write-back into NARP re patient PNG flags", owner: "Kirstie Watson", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 3, description: "Scope options around a manual vs automatic patient flagging mechanism", owner: "Kirstie Watson", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 4, description: "Work up the potential costs of additional ICE licenses, or complexities where an individual works across multiple surgeries", owner: "Clare Craven", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 5, description: "Add a member from the PCT to the T&F group", owner: "Ellie Wagg", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 7, description: "Work through the technical capability within ICE re routing for results", owner: "Clare Craven", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 8, description: "Review the SLAs in place for ICE account creation and management", owner: "Clare Craven", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 9, description: "Set up a futures page to host shared documents", owner: "Kirstie Watson", dueDate: "", status: "", dateCompleted: "" },
  { id: 11, description: "Clarify if the True Hub model requires separate CQC registration and how it impacts reporting", owner: "Ellie Wagg", dueDate: "", status: "", dateCompleted: "" },
  { id: 12, description: "CM speaking to Oxford colleges to ensure that OUH can see Northamptonshire SC records", owner: "Claire Mansfield", dueDate: "", status: "", dateCompleted: "" },
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
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#005EB8]" />
            GP Connect Technical Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Status */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-green-800">Verification Complete</h3>
                  <Badge className="bg-green-600">100% ACCESS GRANTED</Badge>
                </div>
                <p className="text-sm text-green-700">
                  <strong>Confirmed:</strong> Alex Whitehead, Malcolm Railson, and Amanda Taylor have successfully verified functional clinical system access across all 7 practice clinical environments. All Data Sharing Agreements (DSAs) have been completed and signed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remote Hardware Strategy */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Laptop className="w-5 h-5 text-[#005EB8]" />
              Remote Hardware Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Central Procurement</h4>
                <p className="text-sm text-slate-600">Laptops for all remote SDA staff managed centrally by PML.</p>
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
          </CardContent>
        </Card>
      </div>

      {/* System Access Summary */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#005EB8]" />
            System Access Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
        </CardContent>
      </Card>

      {/* IT & Telephony Q&A */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#005EB8]" />
            IT & Telephony - Key Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
                  <Badge className="bg-green-600">UPDATE - 23rd Dec 2024</Badge>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Current Status:</strong> 6 of 7 practices are on <strong>Surgery Connect</strong> phone system.
                  </p>
                  <p>
                    <strong>Outstanding:</strong> Denton Village Surgery is on a different provider.
                  </p>
                  <p>
                    <strong>Action Taken:</strong> Met with X-ON (Surgery Connect parent company) on 18th December 2024. Requested they fund the transfer of Denton Village Surgery to Surgery Connect (buy-out cost from existing provider).
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700 font-medium">Awaiting response from X-ON as at 23rd December 2024</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-semibold text-slate-900 mb-2">X-ON Suite Capabilities (Potential Benefits)</h5>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    AI Scribe functionality
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Enhanced reporting capabilities
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    AI Voice Agents (coming soon)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Other high-quality developments beneficial for Neighbourhood and SDA model
                  </li>
                </ul>
                <p className="text-xs text-slate-500 mt-2 italic">Full applicability to our model TBC</p>
              </div>

              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Lead Contacts:</strong> Alex and Malcolm to provide ongoing updates on IT/practical setup progress.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digital Task and Finish Action Log */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#005EB8]" />
            Digital Task & Finish Group - Action Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-20 font-semibold">Action ID</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="w-36 font-semibold">Owner</TableHead>
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
                    <TableCell className="text-sm">{action.owner}</TableCell>
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
          <p className="text-xs text-slate-500 mt-4 italic">
            Last updated: 22nd December 2024
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
