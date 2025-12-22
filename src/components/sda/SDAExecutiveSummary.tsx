import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, PoundSterling, FileCheck, User } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const populationData = [
  { name: "The Parks Medical", value: 22689, color: "#005EB8" },
  { name: "Brackley Medical", value: 16128, color: "#41B6E6" },
  { name: "Springfield Surgery", value: 12649, color: "#768692" },
  { name: "Towcester Medical", value: 11439, color: "#003087" },
  { name: "Bugbrooke Surgery", value: 10773, color: "#0072CE" },
  { name: "Brook Health", value: 8983, color: "#AE2573" },
  { name: "Denton Village", value: 6277, color: "#00A499" },
];

const appointmentData = [
  { name: "Remote", percentage: 50, color: "#005EB8" },
  { name: "Hub", percentage: 30, color: "#41B6E6" },
  { name: "Spoke", percentage: 20, color: "#768692" },
];

export const SDAExecutiveSummary = () => {
  return (
    <div className="space-y-6">
      {/* Header with SRO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Executive Dashboard</h2>
          <p className="text-slate-600">Northamptonshire Rural East & South Neighbourhood</p>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200">
          <div className="w-10 h-10 rounded-full bg-[#005EB8] flex items-center justify-center text-white font-bold">
            N
          </div>
          <div>
            <p className="font-semibold text-slate-900">Dr Mark Gray</p>
            <p className="text-sm text-slate-500">Senior Responsible Owner</p>
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Patient List Size</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">88,938</p>
                <p className="text-sm text-slate-600 mt-1">7 Practice Partners Across Neighbourhood</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-[#005EB8]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Annual Capacity</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">73,775</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  50% Remote Assumption
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Contract Value</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">£2.34m</p>
                <p className="text-sm text-slate-600 mt-1">Equates to £26.33 per patient</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                <PoundSterling className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Governance Status</p>
                <p className="text-3xl font-bold text-green-600 mt-1">SIGNED</p>
                <p className="text-sm text-slate-600 mt-1">Data Sharing Agreement Complete</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Population Mix Chart */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Practice Population Mix</CardTitle>
            <p className="text-sm text-slate-500">Source: April 25 List Size</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={populationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent, value }) => `${name} ${(percent * 100).toFixed(1)}% (${value.toLocaleString()})`}
                    labelLine={false}
                  >
                    {populationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), 'Patients']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Appointment Allocation */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Appointment Allocation Model</CardTitle>
            <p className="text-sm text-slate-500">Mandatory Split</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appointmentData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Allocation']} />
                  <Bar dataKey="percentage" radius={[0, 8, 8, 0]}>
                    {appointmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-8 mt-4">
              {appointmentData.map((item) => (
                <div key={item.name} className="text-center">
                  <p className="text-2xl font-bold" style={{ color: item.color }}>{item.percentage}%</p>
                  <p className="text-sm text-slate-600">{item.name.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
