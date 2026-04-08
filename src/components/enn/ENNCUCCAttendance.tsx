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
  { month: "April 2025", shortMonth: "Apr", harborough: 125, parklands: 89, spinney: 123, oundle: 160, cottons: 160, rushden: 174, neneValley: 147, meadows: 93, higham: 51, marshalls: 55 },
  { month: "May 2025", shortMonth: "May", harborough: 121, parklands: 91, spinney: 115, oundle: 177, cottons: 144, rushden: 132, neneValley: 126, meadows: 107, higham: 59, marshalls: 28 },
  { month: "June 2025", shortMonth: "Jun", harborough: 124, parklands: 79, spinney: 106, oundle: 157, cottons: 153, rushden: 113, neneValley: 100, meadows: 91, higham: 44, marshalls: 29 },
  { month: "July 2025", shortMonth: "Jul", harborough: 128, parklands: 71, spinney: 2, oundle: 183, cottons: 166, rushden: 116, neneValley: 101, meadows: 116, higham: 49, marshalls: 37 },
  { month: "August 2025", shortMonth: "Aug", harborough: 99, parklands: 93, spinney: 99, oundle: 174, cottons: 143, rushden: 98, neneValley: 109, meadows: 93, higham: 55, marshalls: 40 },
  { month: "September 2025", shortMonth: "Sep", harborough: 106, parklands: 82, spinney: 120, oundle: 180, cottons: 175, rushden: 119, neneValley: 114, meadows: 95, higham: 63, marshalls: 41 },
  { month: "October 2025", shortMonth: "Oct", harborough: 100, parklands: 88, spinney: 112, oundle: 172, cottons: 153, rushden: 107, neneValley: 110, meadows: 102, higham: 46, marshalls: 30 },
  { month: "November 2025", shortMonth: "Nov", harborough: 77, parklands: 81, spinney: 103, oundle: 159, cottons: 137, rushden: 121, neneValley: 82, meadows: 101, higham: 41, marshalls: 30 },
  { month: "December 2025", shortMonth: "Dec", harborough: 92, parklands: 75, spinney: 103, oundle: 204, cottons: 202, rushden: 120, neneValley: 97, meadows: 96, higham: 38, marshalls: 33 },
  { month: "January 2026", shortMonth: "Jan", harborough: 118, parklands: 51, spinney: 99, oundle: 134, cottons: 162, rushden: 134, neneValley: 101, meadows: 112, higham: 37, marshalls: 26 },
  { month: "February 2026", shortMonth: "Feb", harborough: 95, parklands: 63, spinney: 99, oundle: 165, cottons: 146, rushden: 128, neneValley: 110, meadows: 109, higham: 26, marshalls: 27 },
];

/** Annual SDA appointment allocation per practice */
const SDA_ALLOCATIONS: Record<PracticeKey, number> = {
  harborough: 11604,
  parklands: 11290,
  spinney: 9569,
  oundle: 8792,
  cottons: 7773,
  rushden: 7583,
  neneValley: 5740,
  meadows: 5258,
  higham: 4619,
  marshalls: 2618,
};

type SortField = "practice" | "total" | "avg" | "sda" | string;
type SortDir = "asc" | "desc";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold text-slate-800 mb-2 border-b pb-1">{label}</p>
      {[...payload].reverse().map((p: any) => (
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
            <p className="text-[10px] text-muted-foreground">Apr 2025 – Feb 2026</p>
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
