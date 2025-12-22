import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, MapPin, FileText, Sun, Snowflake } from "lucide-react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const roomAuditData = [
  { practice: "Towcester Medical Centre", rooms: 8, role: "HUB" },
  { practice: "Brackley Medical Centre", rooms: 6, role: "HUB" },
  { practice: "The Parks*", rooms: 5, role: "HUB" },
  { practice: "Cogenhoe & Wollaston", rooms: 4, role: "SPOKE" },
  { practice: "Denton Surgery", rooms: 2, role: "SPOKE" },
  { practice: "Brook Health Centre", rooms: 3, role: "TBC" },
  { practice: "Bugbrooke Surgery", rooms: 2, role: "SPOKE" },
];

const seasonalityData = [
  { week: "W1", summer: 14.2, winter: 17.8 },
  { week: "W2", summer: 13.8, winter: 18.1 },
  { week: "W3", summer: 14.5, winter: 18.5 },
  { week: "W4", summer: 13.9, winter: 19.2 },
  { week: "W5", summer: 14.1, winter: 18.9 },
  { week: "W6", summer: 14.3, winter: 18.2 },
  { week: "W7", summer: 13.7, winter: 17.9 },
  { week: "W8", summer: 14.0, winter: 18.4 },
];

export const SDAEstatesCapacity = () => {
  const [season, setSeason] = useState<"summer" | "winter">("winter");

  return (
    <div className="space-y-6">
      {/* Room Audit Table */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">Clinical Estate Room Audit</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Hub Target Met
              </Badge>
              <span className="text-sm text-slate-500">Update: 23 Dec 2025</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practice Entity</TableHead>
                <TableHead className="text-center">Available Rooms</TableHead>
                <TableHead className="text-center">Role Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomAuditData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.practice}</TableCell>
                  <TableCell className="text-center">{row.rooms}</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={
                        row.role === "HUB" 
                          ? "bg-blue-50 text-blue-700 border-blue-200" 
                          : row.role === "SPOKE" 
                            ? "bg-slate-50 text-slate-700 border-slate-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {row.role}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              * Includes: Roade, Blisworth, Hanslope, Grange Park (The Parks)
            </p>
            <Button variant="link" className="text-[#005EB8]">
              <FileText className="w-4 h-4 mr-1" />
              View Mapping Docs
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonality Chart */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900">Seasonality Impact</CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant={season === "summer" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSeason("summer")}
                  className={season === "summer" ? "bg-amber-500 hover:bg-amber-600" : ""}
                >
                  <Sun className="w-4 h-4 mr-1" />
                  Summer
                </Button>
                <Button 
                  variant={season === "winter" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSeason("winter")}
                  className={season === "winter" ? "bg-blue-500 hover:bg-blue-600" : ""}
                >
                  <Snowflake className="w-4 h-4 mr-1" />
                  Winter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seasonalityData}>
                  <XAxis dataKey="week" />
                  <YAxis domain={[12, 20]} tickFormatter={(v) => `${v}`} />
                  <Tooltip formatter={(value: number) => [`${value} per 1,000`, 'Appointments']} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="summer" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    dot={season === "summer"}
                    opacity={season === "summer" ? 1 : 0.3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="winter" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={season === "winter"}
                    opacity={season === "winter" ? 1 : 0.3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Winter assumptions (Nov-Jan) target 18.2 appts per 1,000 population weekly.
            </p>
          </CardContent>
        </Card>

        {/* Hub Location & Finance Info */}
        <div className="space-y-4">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#005EB8]" />
                Estates Audit Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-24 bg-slate-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-slate-400">[Estate Map Placeholder]</span>
              </div>
              <p className="text-sm text-slate-600">
                Scoping used to determine Neighbourhood clinical room deficit.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">Hub Location Scoping</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                3 potential Primary Hubs identified: <strong>Towcester, Brackley, and The Parks.</strong> Smaller practices (Denton, Bugbrooke) will book into these Hubs to manage volume overflow.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">Finance: Non-GMS Rent Case</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Brackley have submitted costs for the rent of non-GMS space on-site.
              </p>
              <p className="text-sm text-slate-600 mt-2">
                <strong>Status:</strong> Awaiting ICB funding decision (using standard GMS rent values).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
