import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HubConsultation } from "@/types/nresTypes";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { useState } from "react";
import { Search, ArrowUpDown, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ConsultationsTableProps {
  consultations: HubConsultation[];
  onRowClick: (consultation: HubConsultation) => void;
  isIPhone?: boolean;
}

export const ConsultationsTable = ({ consultations, onRowClick, isIPhone = false }: ConsultationsTableProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [practiceFilter, setPracticeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'receivedAt' | 'hoursElapsed'>('receivedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredConsultations = consultations
    .filter(c => {
      const matchesSearch = 
        c.patientInitials.toLowerCase().includes(search.toLowerCase()) ||
        c.testType.toLowerCase().includes(search.toLowerCase()) ||
        c.clinician.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesPractice = practiceFilter === 'all' || c.homePractice === practiceFilter;

      return matchesSearch && matchesStatus && matchesPractice;
    })
    .sort((a, b) => {
      const aVal = sortField === 'receivedAt' ? a.receivedAt.getTime() : a.hoursElapsed;
      const bVal = sortField === 'receivedAt' ? b.receivedAt.getTime() : b.hoursElapsed;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const uniquePractices = Array.from(new Set(consultations.map(c => c.homePractice))).sort();

  const toggleSort = (field: 'receivedAt' | 'hoursElapsed') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Mobile card-based view for iPhone
  if (isIPhone) {
    return (
      <div className="space-y-3">
        {/* Filters - stacked vertically on iPhone */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients, tests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={practiceFilter} onValueChange={setPracticeFilter}>
              <SelectTrigger className="flex-1 text-sm">
                <SelectValue placeholder="Practice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Practices</SelectItem>
                {uniquePractices.map(practice => (
                  <SelectItem key={practice} value={practice}>{practice}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Consultation Cards */}
        <div className="space-y-2">
          {filteredConsultations.length === 0 ? (
            <Card className="p-4 text-center text-muted-foreground text-sm">
              No consultations found
            </Card>
          ) : (
            filteredConsultations.map(consultation => (
              <Card 
                key={consultation.id}
                className="p-3 cursor-pointer hover:bg-[#F0F4F5] transition-colors active:scale-[0.98]"
                onClick={() => onRowClick(consultation)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm">{consultation.patientInitials}</p>
                    <p className="text-xs text-muted-foreground">{consultation.patientDOB}</p>
                  </div>
                  <StatusBadge status={consultation.status} />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{consultation.homePractice}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium text-foreground">{consultation.hoursElapsed}h elapsed</span>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <span>{consultation.testType}</span>
                  <span className="mx-2">•</span>
                  <span>{format(consultation.receivedAt, 'HH:mm dd/MM')}</span>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Showing {filteredConsultations.length} of {consultations.length}
        </div>
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients, tests, clinicians..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={practiceFilter} onValueChange={setPracticeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter practice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Practices</SelectItem>
            {uniquePractices.map(practice => (
              <SelectItem key={practice} value={practice}>{practice}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#005EB8] hover:bg-[#005EB8]">
              <TableHead className="text-[#003087]">Patient</TableHead>
              <TableHead className="text-[#003087]">Home Practice</TableHead>
              <TableHead className="text-[#003087]">Hub Practice</TableHead>
              <TableHead className="text-[#003087]">Clinician</TableHead>
              <TableHead className="text-[#003087]">Test Type</TableHead>
              <TableHead className="text-[#003087]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('receivedAt')}
                  className="text-[#003087] hover:text-[#003087] hover:bg-white/10 p-0"
                >
                  Received <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-[#003087]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('hoursElapsed')}
                  className="text-[#003087] hover:text-[#003087] hover:bg-white/10 p-0"
                >
                  Time <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-[#003087]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConsultations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No consultations found
                </TableCell>
              </TableRow>
            ) : (
              filteredConsultations.map(consultation => (
                <TableRow 
                  key={consultation.id}
                  className="cursor-pointer hover:bg-[#F0F4F5] transition-colors"
                  onClick={() => onRowClick(consultation)}
                >
                  <TableCell className="font-medium">
                    <div>
                      <p className="font-semibold">{consultation.patientInitials}</p>
                      <p className="text-xs text-muted-foreground">{consultation.patientDOB}</p>
                    </div>
                  </TableCell>
                  <TableCell>{consultation.homePractice}</TableCell>
                  <TableCell>{consultation.hubPractice}</TableCell>
                  <TableCell>{consultation.clinician}</TableCell>
                  <TableCell>{consultation.testType}</TableCell>
                  <TableCell>
                    <p className="text-sm">{format(consultation.receivedAt, 'HH:mm')}</p>
                    <p className="text-xs text-muted-foreground">{format(consultation.receivedAt, 'dd/MM/yyyy')}</p>
                  </TableCell>
                  <TableCell className="font-semibold">{consultation.hoursElapsed}h</TableCell>
                  <TableCell>
                    <StatusBadge status={consultation.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredConsultations.length} of {consultations.length} consultations
      </div>
    </div>
  );
};
