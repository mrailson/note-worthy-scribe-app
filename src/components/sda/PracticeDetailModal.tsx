import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Building2, PoundSterling, Sun, Snowflake, SlidersHorizontal, Users } from "lucide-react";
import { SystmOneIcon } from "@/components/icons/SystmOneIcon";
import { EmisIcon } from "@/components/icons/EmisIcon";
import { PracticeKey } from "@/hooks/useEstatesConfig";

interface PracticeData {
  practice: string;
  subPractices?: string[];
  listSize: number;
  role: string;
  system: string;
  note?: string;
  key: PracticeKey;
  totalSessions: number;
}

interface CapacityData {
  rate: string;
  weeks: number;
  apptsPerWeek: number;
  sessionsPerWeek: number;
  sessionLength: string;
  f2fRequired: number;
  remoteRequired: number;
}

interface PracticeDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practice: PracticeData;
  totalListSize: number;
  capacityNonWinter: CapacityData;
  capacityWinter: CapacityData;
  activeSplit: number;
  viewMode: "sessions" | "appointments";
}

export const PracticeDetailModal = ({
  open,
  onOpenChange,
  practice,
  totalListSize,
  capacityNonWinter,
  capacityWinter,
  activeSplit,
  viewMode,
}: PracticeDetailModalProps) => {
  const [localSplit, setLocalSplit] = useState(activeSplit);
  const remoteSplit = 100 - localSplit;
  const multiplier = viewMode === "appointments" ? 12 : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";
  const pct = ((practice.listSize / totalListSize) * 100).toFixed(1);

  // Financial calculations
  const monthlyBudget = Math.round(practice.listSize * 2.19);
  const budget75 = Math.round(monthlyBudget * 9);
  const annualTarget = Math.round(74301 * (practice.listSize / totalListSize));

  // Seasonal calculations using local slider
  const nwTotal = capacityNonWinter.sessionsPerWeek * (practice.listSize / totalListSize);
  const nwF2f = nwTotal * (localSplit / 100);
  const nwRemote = nwTotal * (remoteSplit / 100);
  const nwRate = ((nwTotal * 12) / practice.listSize * 1000).toFixed(1);

  const wTotal = capacityWinter.sessionsPerWeek * (practice.listSize / totalListSize);
  const wF2f = wTotal * (localSplit / 100);
  const wRemote = wTotal * (remoteSplit / 100);
  const wRate = ((wTotal * 12) / practice.listSize * 1000).toFixed(1);

  // F2F from room matrix
  const f2fFromRooms = practice.totalSessions;

  // Reset local slider when modal opens with new activeSplit
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setLocalSplit(activeSplit);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(48rem, calc(100vw - 4rem))' }}>
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-xl font-bold text-[#003087]">
              {practice.practice}
            </DialogTitle>
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
            <div className="flex items-center gap-1">
              {practice.system === "EMIS" ? <EmisIcon size="sm" /> : <SystmOneIcon size="sm" />}
            </div>
          </div>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {practice.subPractices && (
              <span className="mr-2">{practice.subPractices.join(", ")} · </span>
            )}
            <span className="font-medium text-slate-700">{practice.listSize.toLocaleString()}</span> patients ({pct}% of neighbourhood)
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Financial Summary */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <PoundSterling className="w-4 h-4 text-[#003087]" />
            <h3 className="font-semibold text-[#003087] text-sm">Financial Summary</h3>
          </div>
          <div className="bg-[#F0F4F5] rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Monthly SDA Allocation</p>
                <p className="text-xl font-bold text-slate-900">£{monthlyBudget.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">9-Month Budget (75%)</p>
                <p className="text-xl font-bold text-slate-900">£{budget75.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Annual Appointment Target</p>
                <p className="text-xl font-bold text-slate-900">{annualTarget.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Seasonal Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-4 h-4 text-[#003087]" />
            <h3 className="font-semibold text-[#003087] text-sm">Seasonal Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Non-Winter */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sun className="w-4 h-4 text-amber-500" />
                <h4 className="font-semibold text-slate-800 text-sm">Non-Winter</h4>
                <Badge variant="outline" className="text-[10px] ml-auto">39 wks</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Weekly Requirement</span>
                  <span className="font-semibold text-slate-900">{(nwTotal * multiplier).toFixed(1)} {unitLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">F2F</span>
                  <span className="font-semibold text-green-700">{(nwF2f * multiplier).toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-600">Remote</span>
                  <span className="font-semibold text-indigo-700">{(nwRemote * multiplier).toFixed(1)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Rate per 1,000</span>
                  <span className="text-slate-500">{nwRate}</span>
                </div>
              </div>
            </div>

            {/* Winter */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Snowflake className="w-4 h-4 text-blue-500" />
                <h4 className="font-semibold text-slate-800 text-sm">Winter</h4>
                <Badge variant="outline" className="text-[10px] ml-auto">13 wks</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Weekly Requirement</span>
                  <span className="font-semibold text-slate-900">{(wTotal * multiplier).toFixed(1)} {unitLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">F2F</span>
                  <span className="font-semibold text-green-700">{(wF2f * multiplier).toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-600">Remote</span>
                  <span className="font-semibold text-indigo-700">{(wRemote * multiplier).toFixed(1)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Rate per 1,000</span>
                  <span className="text-slate-500">{wRate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Room-Based On-Site Capacity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-[#003087]" />
            <h3 className="font-semibold text-[#003087] text-sm">On-Site Capacity (from Room Matrix)</h3>
          </div>
          <div className="bg-[#F0F4F5] rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">F2F Sessions Available/Week</p>
                <p className="text-2xl font-bold text-green-700">{f2fFromRooms}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">F2F Appointments Available/Week</p>
                <p className="text-2xl font-bold text-green-700">{f2fFromRooms * 12}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Resource Mix Slider */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-[#003087]" />
            <h3 className="font-semibold text-[#003087] text-sm">Resource Mix Explorer</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Adjust the F2F / Remote split to explore different resource allocations. Changes are exploratory only.
          </p>

          {/* Slider */}
          <div className="bg-[#F0F4F5] rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700">F2F: {localSplit}%</span>
              <span className="text-sm font-medium text-indigo-700">Remote: {remoteSplit}%</span>
            </div>
            <Slider
              value={[localSplit]}
              onValueChange={(v) => setLocalSplit(v[0])}
              min={0}
              max={100}
              step={5}
              className="my-3"
            />
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant={localSplit === 50 ? "default" : "outline"}
                onClick={() => setLocalSplit(50)}
                className="text-xs"
              >
                50 / 50
              </Button>
              <Button
                size="sm"
                variant={localSplit === 75 ? "default" : "outline"}
                onClick={() => setLocalSplit(75)}
                className="text-xs"
              >
                75 / 25
              </Button>
              <Button
                size="sm"
                variant={localSplit === 100 ? "default" : "outline"}
                onClick={() => setLocalSplit(100)}
                className="text-xs"
              >
                100 / 0
              </Button>
            </div>
          </div>

          {/* Live-updating F2F / Remote boxes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
              <p className="text-xs font-medium text-green-700 mb-1">F2F (On-Site)</p>
              <p className="text-3xl font-bold text-green-800">
                {viewMode === "appointments"
                  ? Math.round(nwF2f * 12).toLocaleString()
                  : nwF2f.toFixed(1)
                }
              </p>
              <p className="text-xs text-green-600 mt-1">
                non-winter {unitLabel}/week
              </p>
              <Separator className="my-2" />
              <p className="text-lg font-bold text-green-700">
                {viewMode === "appointments"
                  ? Math.round(wF2f * 12).toLocaleString()
                  : wF2f.toFixed(1)
                }
              </p>
              <p className="text-xs text-green-500">winter {unitLabel}/week</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 text-center">
              <p className="text-xs font-medium text-indigo-700 mb-1">Remote</p>
              <p className="text-3xl font-bold text-indigo-800">
                {viewMode === "appointments"
                  ? Math.round(nwRemote * 12).toLocaleString()
                  : nwRemote.toFixed(1)
                }
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                non-winter {unitLabel}/week
              </p>
              <Separator className="my-2" />
              <p className="text-lg font-bold text-indigo-700">
                {viewMode === "appointments"
                  ? Math.round(wRemote * 12).toLocaleString()
                  : wRemote.toFixed(1)
                }
              </p>
              <p className="text-xs text-indigo-500">winter {unitLabel}/week</p>
            </div>
          </div>
        </div>

        {practice.note && (
          <>
            <Separator />
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> {practice.note}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
