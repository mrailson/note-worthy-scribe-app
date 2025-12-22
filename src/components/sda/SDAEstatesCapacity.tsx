import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, MapPin, Sun, Snowflake, Building2, Clock, Users, Calendar, LayoutGrid, CalendarDays } from "lucide-react";
import { useState } from "react";

// Room availability data by session
const sessionData = [
  { session: "Monday AM", theParks: 1, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 1, total: 7 },
  { session: "Monday PM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 3, total: 11 },
  { session: "Tuesday AM", theParks: 5, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 0, total: 11 },
  { session: "Tuesday PM", theParks: 6, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 2, total: 14 },
  { session: "Wednesday AM", theParks: 0, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 1, total: 6 },
  { session: "Wednesday PM", theParks: 0, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 4, total: 9 },
  { session: "Thursday AM", theParks: 4, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 0, total: 9 },
  { session: "Thursday PM", theParks: 4, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 0, total: 10 },
  { session: "Friday AM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 2, total: 10 },
  { session: "Friday PM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 4, total: 12 },
];

// Practice summary data with list sizes
const practiceSummary = [
  { 
    practice: "The Parks", 
    subPractices: ["Roade", "Blisworth", "Grange Park", "Hanslope"],
    totalSessions: 29,
    listSize: 15680,
    role: "HUB",
    system: "SystmOne"
  },
  { practice: "Towcester Medical Centre", totalSessions: 17, listSize: 22850, role: "SPOKE", system: "EMIS" },
  { practice: "Brackley Medical Centre", totalSessions: 20, listSize: 18420, role: "HUB", system: "SystmOne", note: "Non-GMS rent required" },
  { practice: "Springfield Surgery", totalSessions: 10, listSize: 12340, role: "SPOKE", system: "EMIS" },
  { practice: "Brook Health Centre", totalSessions: 10, listSize: 8450, role: "TBC", system: "SystmOne", note: "Non-GMS rent required, likely Spoke" },
  { practice: "Bugbrooke Medical Practice", totalSessions: 10, listSize: 6890, role: "SPOKE", system: "SystmOne" },
  { practice: "Denton Village", totalSessions: 3, listSize: 4308, role: "SPOKE", system: "SystmOne", note: "Tue/Fri full day, Thu PM" },
];

const totalListSize = practiceSummary.reduce((sum, p) => sum + p.listSize, 0);

// Capacity planning data
const capacityData = {
  nonWinter: {
    rate: "15.2 per 1,000",
    weeks: 39,
    apptsPerWeek: 1352,
    sessionsPerWeek: 112.7,
    sessionLength: "4h 10m",
    f2fRequired: 56.35,
    remoteRequired: 56.35
  },
  winter: {
    rate: "18.2 per 1,000",
    weeks: 13,
    apptsPerWeek: 1619,
    sessionsPerWeek: 134.9,
    sessionLength: "4h 10m",
    f2fRequired: 67.45,
    remoteRequired: 67.45
  }
};

const getCellColor = (value: number) => {
  if (value === 0) return "bg-red-100 text-red-700";
  if (value >= 3) return "bg-green-100 text-green-700";
  return "bg-amber-50 text-amber-700";
};

export const SDAEstatesCapacity = () => {
  const [season, setSeason] = useState<"winter" | "nonWinter">("winter");
  const [viewMode, setViewMode] = useState<"sessions" | "appointments">("sessions");
  const currentCapacity = season === "winter" ? capacityData.winter : capacityData.nonWinter;
  const totalWeeklySessions = sessionData.reduce((sum, row) => sum + row.total, 0);
  const multiplier = viewMode === "appointments" ? 12 : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 text-[#005EB8] mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">7</p>
            <p className="text-sm text-slate-600">Practice Sites</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{totalWeeklySessions}</p>
            <p className="text-sm text-slate-600">Sessions/Week</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">4h 10m</p>
            <p className="text-sm text-slate-600">Per Session</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">12</p>
            <p className="text-sm text-slate-600">Appts/Session</p>
          </CardContent>
        </Card>
      </div>

      {/* Practice Summary */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">Practice Estate Summary</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Weekly session availability by practice</p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {totalWeeklySessions} Total Sessions
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {practiceSummary.map((practice, index) => (
              <div 
                key={index} 
                className={`rounded-xl p-4 border ${
                  practice.role === "HUB" 
                    ? "bg-blue-50 border-blue-200" 
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{practice.practice}</h4>
                    {practice.subPractices && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {practice.subPractices.join(", ")}
                      </p>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      practice.role === "HUB" 
                        ? "bg-[#005EB8] text-white border-[#005EB8]" 
                        : "bg-slate-200 text-slate-700 border-slate-300"
                    }
                  >
                    {practice.role}
                  </Badge>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{practice.totalSessions}</p>
                    <p className="text-xs text-slate-500">sessions/week</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {practice.system}
                  </Badge>
                </div>
                {practice.note && (
                  <p className="text-xs text-amber-600 mt-2 italic">{practice.note}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Availability Matrix */}
      <Card className="bg-white border-0 shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Room Availability Matrix</CardTitle>
          <p className="text-sm text-slate-500">Available clinical rooms by day and session</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Session</TableHead>
                  <TableHead className="text-center font-semibold">
                    <div>The Parks</div>
                    <div className="text-xs font-normal text-slate-400">4 sites</div>
                  </TableHead>
                  <TableHead className="text-center font-semibold">Springfield</TableHead>
                  <TableHead className="text-center font-semibold">Brackley</TableHead>
                  <TableHead className="text-center font-semibold">Brook</TableHead>
                  <TableHead className="text-center font-semibold">Bugbrooke</TableHead>
                  <TableHead className="text-center font-semibold">Denton</TableHead>
                  <TableHead className="text-center font-semibold">Towcester</TableHead>
                  <TableHead className="text-center font-semibold bg-slate-100">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionData.map((row, index) => (
                  <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <TableCell className="font-medium">{row.session}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.theParks)}`}>{row.theParks}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.springfield)}`}>{row.springfield}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.brackley)}`}>{row.brackley}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.brook)}`}>{row.brook}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.bugbrooke)}`}>{row.bugbrooke}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.denton)}`}>{row.denton}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.towcester)}`}>{row.towcester}</TableCell>
                    <TableCell className="text-center font-bold bg-slate-100">{row.total}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell>Weekly Total</TableCell>
                  <TableCell className="text-center">29</TableCell>
                  <TableCell className="text-center">10</TableCell>
                  <TableCell className="text-center">20</TableCell>
                  <TableCell className="text-center">10</TableCell>
                  <TableCell className="text-center">10</TableCell>
                  <TableCell className="text-center">3</TableCell>
                  <TableCell className="text-center">17</TableCell>
                  <TableCell className="text-center bg-[#005EB8] text-white">{totalWeeklySessions}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Capacity Planning */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-900">Capacity Planning</CardTitle>
            <div className="flex flex-wrap gap-2">
              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode("sessions")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === "sessions" 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Sessions
                </button>
                <button 
                  onClick={() => setViewMode("appointments")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === "appointments" 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Appointments
                </button>
              </div>
              
              {/* Season Toggle */}
              <div className="flex gap-1">
                <button 
                  onClick={() => setSeason("nonWinter")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    season === "nonWinter" 
                      ? "bg-amber-500 text-white" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  Non-Winter
                </button>
                <button 
                  onClick={() => setSeason("winter")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    season === "winter" 
                      ? "bg-blue-500 text-white" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Snowflake className="w-4 h-4" />
                  Winter
                </button>
              </div>
            </div>
          </div>
          {viewMode === "appointments" && (
            <p className="text-sm text-slate-500 mt-2">
              Showing appointments (1 session = 12 appointments)
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500">Rate</p>
              <p className="text-xl font-bold text-slate-900">{currentCapacity.rate}</p>
              <p className="text-xs text-slate-400">patients</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500">Appointments/Week</p>
              <p className="text-xl font-bold text-slate-900">{currentCapacity.apptsPerWeek.toLocaleString()}</p>
              <p className="text-xs text-slate-400">required</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500 capitalize">{unitLabel}/Week</p>
              <p className="text-xl font-bold text-slate-900">
                {viewMode === "appointments" 
                  ? Math.round(currentCapacity.sessionsPerWeek * 12).toLocaleString()
                  : currentCapacity.sessionsPerWeek
                }
              </p>
              <p className="text-xs text-slate-400">total needed</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500">Duration</p>
              <p className="text-xl font-bold text-slate-900">{currentCapacity.weeks}</p>
              <p className="text-xs text-slate-400">weeks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">
                Face-to-Face {viewMode === "appointments" ? "Appointments" : "Sessions"} Required
              </h4>
              <p className="text-3xl font-bold text-green-700">
                {viewMode === "appointments" 
                  ? Math.round(currentCapacity.f2fRequired * 12).toLocaleString()
                  : currentCapacity.f2fRequired
                }
              </p>
              <p className="text-sm text-green-600">{unitLabel} per week (50% split)</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">
                Remote {viewMode === "appointments" ? "Appointments" : "Sessions"} Required
              </h4>
              <p className="text-3xl font-bold text-blue-700">
                {viewMode === "appointments" 
                  ? Math.round(currentCapacity.remoteRequired * 12).toLocaleString()
                  : currentCapacity.remoteRequired
                }
              </p>
              <p className="text-sm text-blue-600">{unitLabel} per week (50% split)</p>
            </div>
          </div>

          {/* Practice Breakdown by List Size */}
          <div className="mt-6">
            <h4 className="font-semibold text-slate-900 mb-3">
              {viewMode === "appointments" ? "Appointments" : "Sessions"} Required by Practice (Based on List Size)
            </h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Practice</TableHead>
                    <TableHead className="text-right">List Size</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                    <TableHead className="text-right">
                      {viewMode === "appointments" ? "Appts" : "Sessions"}/Week
                    </TableHead>
                    <TableHead className="text-right">F2F (50%)</TableHead>
                    <TableHead className="text-right">Remote (50%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practiceSummary.map((practice, index) => {
                    const percentage = (practice.listSize / totalListSize) * 100;
                    const practiceSessionsNeeded = currentCapacity.sessionsPerWeek * (practice.listSize / totalListSize);
                    const displayValue = viewMode === "appointments" ? practiceSessionsNeeded * 12 : practiceSessionsNeeded;
                    const f2fValue = displayValue / 2;
                    const remoteValue = displayValue / 2;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {practice.practice}
                          {practice.subPractices && (
                            <span className="text-xs text-slate-400 ml-1">({practice.subPractices.length} sites)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{practice.listSize.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-semibold">{Math.round(displayValue).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-700">{Math.round(f2fValue).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-blue-700">{Math.round(remoteValue).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-slate-100 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totalListSize.toLocaleString()}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                    <TableCell className="text-right">
                      {viewMode === "appointments" 
                        ? Math.round(currentCapacity.sessionsPerWeek * 12).toLocaleString()
                        : currentCapacity.sessionsPerWeek
                      }
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {viewMode === "appointments" 
                        ? Math.round(currentCapacity.f2fRequired * 12).toLocaleString()
                        : currentCapacity.f2fRequired
                      }
                    </TableCell>
                    <TableCell className="text-right text-blue-700">
                      {viewMode === "appointments" 
                        ? Math.round(currentCapacity.remoteRequired * 12).toLocaleString()
                        : currentCapacity.remoteRequired
                      }
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> 1 session = 12 × 15 min appointments (F2F and Virtual). Initially 15 mins for virtual appointments but the board may change to 10 mins at a later date.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#005EB8]" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
              <strong>Brackley Medical Centre & Brook Health Centre:</strong> Non-GMS space requires rent
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
              <strong>Denton Village:</strong> Available Tuesday or Friday full day and afternoon on Thursday
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></span>
              <strong>The Parks:</strong> Combined availability from Roade, Blisworth, Grange Park and Hanslope
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
