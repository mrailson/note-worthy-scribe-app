import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Hospital, TrendingUp, TrendingDown, Activity, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Practice keys matching ennPopulationData colour palette */
const PRACTICES = [
  { key: "harborough", name: "Harborough Fields", color: "#005EB8" },
  { key: "parklands", name: "Parklands", color: "#003087" },
  { key: "spinney", name: "Spinney Brook", color: "#41B6E6" },
  { key: "oundle", name: "Oundle", color: "#768692" },
  { key: "cottons", name: "The Cottons", color: "#0072CE" },
  { key: "rushden", name: "Rushden", color: "#AE2573" },
  { key: "neneValley", name: "Nene Valley", color: "#00A499" },
  { key: "meadows", name: "The Meadows", color: "#330072" },
  { key: "higham", name: "Higham Ferrers", color: "#ED8B00" },
  { key: "marshalls", name: "Marshalls Road", color: "#DA291C" },
] as const;

type PracticeKey = (typeof PRACTICES)[number]["key"];

interface MonthRow {
  month: string;
  shortMonth: string;
  [key: string]: string | number;
}

/** Raw CUCC attendance data (Apr 2024 – Feb 2025, 11 months) */
const CUCC_DATA: MonthRow[] = [
  { month: "April 2024", shortMonth: "Apr", harborough: 163, parklands: 139, spinney: 96, oundle: 84, cottons: 91, rushden: 109, neneValley: 62, meadows: 43, higham: 63, marshalls: 36 },
  { month: "May 2024", shortMonth: "May", harborough: 155, parklands: 128, spinney: 105, oundle: 79, cottons: 82, rushden: 98, neneValley: 55, meadows: 48, higham: 52, marshalls: 30 },
  { month: "June 2024", shortMonth: "Jun", harborough: 148, parklands: 121, spinney: 89, oundle: 72, cottons: 78, rushden: 92, neneValley: 51, meadows: 39, higham: 48, marshalls: 28 },
  { month: "July 2024", shortMonth: "Jul", harborough: 141, parklands: 118, spinney: 92, oundle: 68, cottons: 85, rushden: 87, neneValley: 48, meadows: 42, higham: 45, marshalls: 25 },
  { month: "August 2024", shortMonth: "Aug", harborough: 152, parklands: 125, spinney: 98, oundle: 75, cottons: 88, rushden: 95, neneValley: 53, meadows: 45, higham: 50, marshalls: 29 },
  { month: "September 2024", shortMonth: "Sep", harborough: 145, parklands: 130, spinney: 101, oundle: 80, cottons: 90, rushden: 102, neneValley: 58, meadows: 47, higham: 55, marshalls: 32 },
  { month: "October 2024", shortMonth: "Oct", harborough: 168, parklands: 142, spinney: 112, oundle: 88, cottons: 95, rushden: 115, neneValley: 65, meadows: 52, higham: 60, marshalls: 38 },
  { month: "November 2024", shortMonth: "Nov", harborough: 175, parklands: 148, spinney: 118, oundle: 92, cottons: 102, rushden: 120, neneValley: 70, meadows: 55, higham: 65, marshalls: 40 },
  { month: "December 2024", shortMonth: "Dec", harborough: 185, parklands: 155, spinney: 125, oundle: 98, cottons: 108, rushden: 128, neneValley: 75, meadows: 58, higham: 70, marshalls: 42 },
  { month: "January 2025", shortMonth: "Jan", harborough: 180, parklands: 150, spinney: 120, oundle: 95, cottons: 105, rushden: 125, neneValley: 72, meadows: 56, higham: 68, marshalls: 41 },
  { month: "February 2025", shortMonth: "Feb", harborough: 160, parklands: 135, spinney: 108, oundle: 82, cottons: 92, rushden: 105, neneValley: 60, meadows: 46, higham: 58, marshalls: 33 },
];

/** Annual SDA appointment allocation per practice */
const SDA_ALLOCATIONS: Record<PracticeKey, number> = {
  harborough: 11597,
  parklands: 11283,
  spinney: 9562,
  oundle: 8785,
  cottons: 7767,
  rushden: 7578,
  neneValley: 5737,
  meadows: 5255,
  higham: 4616,
  marshalls: 2617,
};

type SortField = "practice" | "total" | "avg" | "sda" | string;
type SortDir = "asc" | "desc";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold text-slate-800 mb-2 border-b pb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums">{p.value?.toLocaleString()}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t font-semibold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

const ENNCUCCAttendance = () => {
  const [selectedPractice, setSelectedPractice] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const practiceMonthlyTotals = useMemo(() => {
    return PRACTICES.map((p) => {
      const monthlyValues = CUCC_DATA.map((m) => Number(m[p.key]) || 0);
      const total = monthlyValues.reduce((s, v) => s + v, 0);
      return { ...p, total, avg: Math.round(total / CUCC_DATA.length), monthlyValues };
    });
  }, []);

  // Compute metrics based on selected practice or all
  const { displayTotal, displayAvg, highestMonth, lowestMonth } = useMemo(() => {
    if (selectedPractice === "all") {
      const mv = CUCC_DATA.map((m) => PRACTICES.reduce((s, p) => s + (Number(m[p.key]) || 0), 0));
      const total = mv.reduce((s, v) => s + v, 0);
      const hIdx = mv.indexOf(Math.max(...mv));
      const lIdx = mv.indexOf(Math.min(...mv));
      return { displayTotal: total, displayAvg: Math.round(total / mv.length), displayMonthlyValues: mv, highestMonth: { value: mv[hIdx], label: CUCC_DATA[hIdx].month }, lowestMonth: { value: mv[lIdx], label: CUCC_DATA[lIdx].month } };
    }
    const mv = CUCC_DATA.map((m) => Number(m[selectedPractice]) || 0);
    const total = mv.reduce((s, v) => s + v, 0);
    const hIdx = mv.indexOf(Math.max(...mv));
    const lIdx = mv.indexOf(Math.min(...mv));
    return { displayTotal: total, displayAvg: Math.round(total / mv.length), displayMonthlyValues: mv, highestMonth: { value: mv[hIdx], label: CUCC_DATA[hIdx].month }, lowestMonth: { value: mv[lIdx], label: CUCC_DATA[lIdx].month } };
  }, [selectedPractice]);

  const monthlyTotals = CUCC_DATA.map((m) =>
    PRACTICES.reduce((s, p) => s + (Number(m[p.key]) || 0), 0)
  );

  const chartData = CUCC_DATA.map((m) => {
    const row: any = { name: m.shortMonth + " '" + m.month.split(" ")[1].slice(2), fullMonth: m.month };
    if (selectedPractice === "all") {
      PRACTICES.forEach((p) => { row[p.key] = Number(m[p.key]) || 0; });
    } else {
      row[selectedPractice] = Number(m[selectedPractice]) || 0;
    }
    return row;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortedPractices = useMemo(() => {
    const arr = [...practiceMonthlyTotals];
    arr.sort((a, b) => {
      let aVal: number | string, bVal: number | string;
      if (sortField === "practice") { aVal = a.name; bVal = b.name; }
      else if (sortField === "total") { aVal = a.total; bVal = b.total; }
      else if (sortField === "avg") { aVal = a.avg; bVal = b.avg; }
      else if (sortField === "sda") { aVal = SDA_ALLOCATIONS[a.key]; bVal = SDA_ALLOCATIONS[b.key]; }
      else {
        const mIdx = CUCC_DATA.findIndex((m) => m.shortMonth === sortField);
        aVal = mIdx >= 0 ? a.monthlyValues[mIdx] : 0;
        bVal = mIdx >= 0 ? b.monthlyValues[mIdx] : 0;
      }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return arr;
  }, [practiceMonthlyTotals, sortField, sortDir]);

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:bg-slate-100 ${className || ""}`} onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-[#005EB8]" : "text-slate-400"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-[#005EB8]">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Attendances</p>
            <p className="text-xl font-bold text-[#005EB8]">{displayTotal.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Apr 2024 – Feb 2025</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#00A499]">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Monthly Average</p>
            <p className="text-xl font-bold text-[#00A499]">{displayAvg.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">across {CUCC_DATA.length} months</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#AE2573]">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Highest Month</p>
            <p className="text-xl font-bold text-[#AE2573]">{highestMonth.value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{highestMonth.label}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#768692]">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Lowest Month</p>
            <p className="text-xl font-bold text-[#768692]">{lowestMonth.value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{lowestMonth.label}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Hospital className="w-5 h-5 text-[#005EB8]" />
              <CardTitle className="text-base">Corby Urgent Care Centre — Monthly Attendances by Practice</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedPractice} onValueChange={setSelectedPractice}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Practices (Stacked)</SelectItem>
                  {PRACTICES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-[#005EB8] border-blue-200 shrink-0">
                <Activity className="w-3 h-3 mr-1" /> {CUCC_DATA.length} months
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                {selectedPractice === "all" ? (
                  <>
                    {PRACTICES.map((p) => (
                      <Bar key={p.key} dataKey={p.key} name={p.name} stackId="a" fill={p.color} />
                    ))}
                  </>
                ) : (
                  <Bar
                    dataKey={selectedPractice}
                    name={PRACTICES.find((p) => p.key === selectedPractice)?.name}
                    fill={PRACTICES.find((p) => p.key === selectedPractice)?.color}
                    radius={[4, 4, 0, 0]}
                  />
                )}
                {selectedPractice !== "all" && <Legend />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Breakdown by Practice</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <SortHeader field="practice" className="sticky left-0 bg-slate-50 z-10 min-w-[140px]">Practice</SortHeader>
                  {CUCC_DATA.map((m) => (
                    <SortHeader key={m.shortMonth} field={m.shortMonth} className="text-center min-w-[50px]">{m.shortMonth}</SortHeader>
                  ))}
                  <SortHeader field="total" className="text-center bg-blue-50 min-w-[60px]">Total</SortHeader>
                  <SortHeader field="avg" className="text-center min-w-[50px]">Avg</SortHeader>
                  <SortHeader field="sda" className="text-center bg-amber-50 min-w-[70px]">SDA Alloc.</SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPractices.map((p) => (
                  <TableRow key={p.key} className="hover:bg-slate-50">
                    <TableCell className="sticky left-0 bg-white z-10 font-medium text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    </TableCell>
                    {p.monthlyValues.map((v, i) => (
                      <TableCell key={i} className="text-center text-xs tabular-nums">{v}</TableCell>
                    ))}
                    <TableCell className="text-center text-xs font-semibold tabular-nums bg-blue-50">{p.total.toLocaleString()}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{p.avg}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums bg-amber-50">{SDA_ALLOCATIONS[p.key].toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-slate-100 font-semibold border-t-2">
                  <TableCell className="sticky left-0 bg-slate-100 z-10 text-xs">Neighbourhood Total</TableCell>
                  {monthlyTotals.map((t, i) => (
                    <TableCell key={i} className="text-center text-xs tabular-nums">{t.toLocaleString()}</TableCell>
                  ))}
                  <TableCell className="text-center text-xs tabular-nums bg-blue-100">{monthlyTotals.reduce((s, v) => s + v, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center text-xs tabular-nums">{Math.round(monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length)}</TableCell>
                  <TableCell className="text-center text-xs tabular-nums bg-amber-100">74,846</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ENNCUCCAttendance;
