import React, { useState, useCallback } from 'react';
import { practices as defaultPractices, statusConfig, calculatePracticeTotals, StaffMember, RecruitmentPractice } from '@/data/nresRecruitmentData';
import { useRecruitmentConfig } from '@/hooks/useRecruitmentConfig';
import { useAuth } from '@/contexts/AuthContext';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { InfoTooltip } from '@/components/nres/InfoTooltip';
import { RecruitmentAuditDialog } from './RecruitmentAuditDialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Pencil, Save, X, Plus, Trash2, History, Info } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_OPTIONS: StaffMember['status'][] = ['recruited', 'confirmed', 'offered', 'potential', 'tbc', 'outstanding'];

const NRESWorkforceRecruitmentTracker = () => {
  const { practices, isLoading, updateConfig } = useRecruitmentConfig();
  const { user, isSystemAdmin } = useAuth();
  const canEdit = isSystemAdmin || (user?.email && NRES_ADMIN_EMAILS.includes(user.email));

  const [viewMode, setViewMode] = useState('neighbourhood');
  const [seasonFilter, setSeasonFilter] = useState('combined');
  const [expandedPractice, setExpandedPractice] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editPractices, setEditPractices] = useState<RecruitmentPractice[]>([]);
  const [originalPractices, setOriginalPractices] = useState<RecruitmentPractice[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

  // Cost-based GP→ANP/ACP conversion: GP £11k/session, ANP ~£55k/yr FT
  const GP_SESSION_ANNUAL = 11000;
  const ACP_ANNUAL_SALARY = 55000;
  const sessionsToACPWte = (sessions: number) => (sessions * GP_SESSION_ANNUAL / ACP_ANNUAL_SALARY).toFixed(2);
  const sessionsToACPHours = (sessions: number) => (sessions * GP_SESSION_ANNUAL / ACP_ANNUAL_SALARY * 37.5).toFixed(1);

  const activePractices = isEditing ? editPractices : practices;

  const calculatePracticeTotalsLocal = (practice: RecruitmentPractice) => calculatePracticeTotals(practice, seasonFilter);

  const calculateNeighbourhoodTotals = () => {
    const totals: any = { recruited: 0, confirmed: 0, offered: 0, potential: 0, tbc: 0, outstanding: 0, gp: 0, acp: 0, buyBack: 0, buyBackACP: 0, required: 0 };
    activePractices.forEach(p => {
      const pt = calculatePracticeTotalsLocal(p);
      Object.keys(pt.byStatus).forEach(k => totals[k] += pt.byStatus[k]);
      totals.gp += pt.byType.gp;
      totals.acp += pt.byType.acp;
      totals.buyBack += pt.byType.buyBack;
      totals.required += pt.required;
      const acpBuyBack = p.workforce.buyBack.filter(s =>
        s.name.toLowerCase().includes('anp') || s.name.toLowerCase().includes('acp') ||
        s.notes?.toLowerCase().includes('anp') || s.notes?.toLowerCase().includes('acp')
      ).reduce((sum, s) => sum + s.sessions, 0);
      totals.buyBackACP += acpBuyBack;
    });
    const totalFilled = totals.recruited + totals.confirmed + totals.offered;
    const totalPipeline = totals.potential + totals.tbc;
    const totalOutstanding = totals.outstanding;
    return { ...totals, totalFilled, totalPipeline, totalOutstanding, totalPlanned: totalFilled + totalPipeline + totalOutstanding, filledPercent: Math.round((totalFilled / totals.required) * 100), pipelinePercent: Math.round((totalPipeline / totals.required) * 100) };
  };

  const neighbourhoodTotals = calculateNeighbourhoodTotals();

  // --- Edit mode handlers ---
  const startEditing = () => {
    setEditPractices(JSON.parse(JSON.stringify(practices)));
    setOriginalPractices(JSON.parse(JSON.stringify(practices)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditPractices([]);
    setOriginalPractices([]);
  };

  const updateStaffField = (practiceIdx: number, category: 'gp' | 'acp' | 'buyBack', staffIdx: number, field: keyof StaffMember, value: any) => {
    setEditPractices(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      (next[practiceIdx].workforce[category][staffIdx] as any)[field] = value;
      next[practiceIdx].workforce[category][staffIdx].lastUpdated = new Date().toISOString();
      return next;
    });
  };

  const addStaff = (practiceIdx: number, category: 'gp' | 'acp' | 'buyBack') => {
    setEditPractices(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const newStaff: StaffMember = {
        name: '',
        sessions: 0,
        status: 'outstanding',
        type: category === 'buyBack' ? 'Buy-Back' : 'New Recruit',
        notes: '',
        lastUpdated: new Date().toISOString(),
      };
      next[practiceIdx].workforce[category].push(newStaff);
      return next;
    });
  };

  const deleteStaff = (practiceIdx: number, category: 'gp' | 'acp' | 'buyBack', staffIdx: number) => {
    setEditPractices(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[practiceIdx].workforce[category].splice(staffIdx, 1);
      return next;
    });
  };

  const saveChanges = async () => {
    if (!user?.email) return;
    // Build audit entries by diffing original vs edited
    const auditEntries: any[] = [];
    const now = new Date().toISOString();

    for (let pi = 0; pi < editPractices.length; pi++) {
      const ep = editPractices[pi];
      const op = originalPractices[pi];
      const practiceName = ep.name;

      for (const cat of ['gp', 'acp', 'buyBack'] as const) {
        const origStaff = op.workforce[cat];
        const editStaff = ep.workforce[cat];

        // Detect added staff (extra items at end or new names)
        const origNames = new Set(origStaff.map(s => s.name));
        editStaff.forEach(s => {
          if (!origNames.has(s.name) || (s.name === '' && !origNames.has(''))) {
            if (s.name) {
              auditEntries.push({ timestamp: now, user_email: user.email, action: 'Added', practice_name: practiceName, staff_name: s.name, field: 'Staff', old_value: null, new_value: `${s.sessions} sessions, ${s.status}` });
            }
          }
        });

        // Detect deleted staff
        const editNames = new Set(editStaff.map(s => s.name));
        origStaff.forEach(s => {
          if (!editNames.has(s.name)) {
            auditEntries.push({ timestamp: now, user_email: user.email, action: 'Deleted', practice_name: practiceName, staff_name: s.name, field: 'Staff', old_value: `${s.sessions} sessions, ${s.status}`, new_value: null });
          }
        });

        // Detect edits on matching staff (by index for simplicity)
        const minLen = Math.min(origStaff.length, editStaff.length);
        for (let si = 0; si < minLen; si++) {
          const os = origStaff[si];
          const es = editStaff[si];
          if (os.name === es.name || (origStaff.length === editStaff.length)) {
            const staffName = es.name || os.name || 'Unknown';
            if (os.name !== es.name) auditEntries.push({ timestamp: now, user_email: user.email, action: 'Edited', practice_name: practiceName, staff_name: staffName, field: 'Name', old_value: os.name, new_value: es.name });
            if (os.sessions !== es.sessions) auditEntries.push({ timestamp: now, user_email: user.email, action: 'Edited', practice_name: practiceName, staff_name: staffName, field: 'Sessions', old_value: String(os.sessions), new_value: String(es.sessions) });
            if (os.status !== es.status) auditEntries.push({ timestamp: now, user_email: user.email, action: 'Edited', practice_name: practiceName, staff_name: staffName, field: 'Status', old_value: os.status, new_value: es.status });
            if (os.type !== es.type) auditEntries.push({ timestamp: now, user_email: user.email, action: 'Edited', practice_name: practiceName, staff_name: staffName, field: 'Type', old_value: os.type, new_value: es.type });
            if ((os.notes || '') !== (es.notes || '')) auditEntries.push({ timestamp: now, user_email: user.email, action: 'Edited', practice_name: practiceName, staff_name: staffName, field: 'Notes', old_value: os.notes || '', new_value: es.notes || '' });
          }
        }
      }
    }

    // Write audit entries
    if (auditEntries.length > 0) {
      await supabase.from('nres_recruitment_audit' as any).insert(auditEntries as any);
    }

    // Save config
    const success = await updateConfig(editPractices);
    if (success) {
      setIsEditing(false);
      setEditPractices([]);
      setOriginalPractices([]);
    }
  };

  // --- Sort ---
  const handleSort = (column: string) => {
    if (sortColumn === column) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('asc'); }
  };

  const getSortedPractices = () => {
    return [...activePractices].sort((a, b) => {
      const totalsA = calculatePracticeTotalsLocal(a);
      const totalsB = calculatePracticeTotalsLocal(b);
      let valueA: any, valueB: any;
      switch (sortColumn) {
        case 'name': valueA = a.name; valueB = b.name; break;
        case 'required': valueA = totalsA.required; valueB = totalsB.required; break;
        case 'filled': valueA = totalsA.totalFilled; valueB = totalsB.totalFilled; break;
        case 'pipeline': valueA = totalsA.totalPipeline; valueB = totalsB.totalPipeline; break;
        case 'outstanding': valueA = totalsA.totalOutstanding; valueB = totalsB.totalOutstanding; break;
        case 'progress': valueA = ((totalsA.totalFilled + totalsA.totalPipeline) / totalsA.required) * 100; valueB = ((totalsB.totalFilled + totalsB.totalPipeline) / totalsB.required) * 100; break;
        default: valueA = a.name; valueB = b.name;
      }
      if (typeof valueA === 'string') return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  };

  // --- Sub-components ---
  const SortableHeader = ({ column, label, align = 'center', style = {} }: any) => (
    <th className={`${align === 'left' ? 'text-left' : 'text-center'} p-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none transition-colors`} onClick={() => handleSort(column)} style={style}>
      <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <span className="text-gray-400">{sortColumn === column ? (column === 'progress' ? (sortDirection === 'asc' ? '↑ action' : '↓ best') : (sortDirection === 'asc' ? '↑' : '↓')) : '↕'}</span>
      </div>
    </th>
  );

  const ProgressBar = ({ filled, pipeline, outstanding, required, showLabels = true }: any) => {
    const filledPct = Math.min((filled / required) * 100, 100);
    const pipelinePct = Math.min((pipeline / required) * 100, 100 - filledPct);
    const outstandingPct = Math.min((outstanding / required) * 100, 100 - filledPct - pipelinePct);
    return (
      <div className="w-full">
        <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
          {filledPct > 0 && <div className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all" style={{ width: `${filledPct}%` }}>{filledPct >= 10 && `${Math.round(filledPct)}%`}</div>}
          {pipelinePct > 0 && <div className="bg-amber-400 h-full flex items-center justify-center text-xs text-amber-900 font-medium transition-all" style={{ width: `${pipelinePct}%` }}>{pipelinePct >= 10 && `${Math.round(pipelinePct)}%`}</div>}
          {outstandingPct > 0 && <div className="bg-red-400 h-full flex items-center justify-center text-xs text-white font-medium transition-all" style={{ width: `${outstandingPct}%` }}>{outstandingPct >= 10 && `${Math.round(outstandingPct)}%`}</div>}
        </div>
        {showLabels && (
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>{filled + pipeline + outstanding} / {required} sessions planned</span>
            <span>{required - filled - pipeline - outstanding > 0 ? `${required - filled - pipeline - outstanding} gap` : '✓ Covered'}</span>
          </div>
        )}
      </div>
    );
  };

  const StatusBadge = ({ status, sessions }: { status: string; sessions: number }) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgLight} ${config.textColor} ${config.border} border`}>
        <span className={`w-2 h-2 rounded-full ${config.color} mr-1.5`}></span>
        {sessions} sessions • {config.label}
      </span>
    );
  };

  // Staff row - view mode
  const StaffRow = ({ staff, type }: { staff: StaffMember; type: string }) => {
    const config = statusConfig[staff.status];
    const isACPRole = type === 'acp' || (type === 'buyBack' && (staff.name.toLowerCase().includes('anp') || staff.name.toLowerCase().includes('acp') || staff.notes?.toLowerCase().includes('anp') || staff.notes?.toLowerCase().includes('acp')));
    const hoursValue = isACPRole ? sessionsToACPHours(staff.sessions) : null;
    const wteValue = isACPRole ? sessionsToACPWte(staff.sessions) : null;
    const roleLabel = type === 'gp' ? 'GP' : type === 'acp' ? 'ACP/ANP' : 'Buy-Back';

    return (
      <div className={`flex items-center justify-between p-3 rounded-lg ${config.bgLight} ${config.border} border mb-2`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white font-bold text-sm`}>{staff.sessions}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{staff.name}</span>
              {staff.notes && <InfoTooltip content={staff.notes} />}
            </div>
            <div className="text-xs text-gray-500">
              {staff.type} • {roleLabel}
              {isACPRole && staff.sessions > 0 && <span className="ml-1 text-purple-600 font-medium">({hoursValue} hrs = {wteValue} WTE)</span>}
            </div>
            {staff.lastUpdated && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Updated: {format(new Date(staff.lastUpdated), "dd/MM/yy HH:mm")}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <StatusBadge status={staff.status} sessions={staff.sessions} />
            {isACPRole && staff.sessions > 0 && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{hoursValue} hrs ({wteValue} WTE)</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Staff row - edit mode
  const EditableStaffRow = ({ staff, practiceIdx, category, staffIdx }: { staff: StaffMember; practiceIdx: number; category: 'gp' | 'acp' | 'buyBack'; staffIdx: number }) => {
    const config = statusConfig[staff.status];
    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg ${config.bgLight} ${config.border} border mb-2`}>
        <input className="flex-1 min-w-0 px-2 py-1 text-sm border rounded bg-white" placeholder="Name" value={staff.name} onChange={e => updateStaffField(practiceIdx, category, staffIdx, 'name', e.target.value)} />
        <input className="w-16 px-2 py-1 text-sm border rounded bg-white text-center" type="number" min={0} value={staff.sessions} onChange={e => updateStaffField(practiceIdx, category, staffIdx, 'sessions', Number(e.target.value))} />
        <select className="px-2 py-1 text-xs border rounded bg-white" value={staff.status} onChange={e => updateStaffField(practiceIdx, category, staffIdx, 'status', e.target.value)}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
        </select>
        <input className="w-24 px-2 py-1 text-xs border rounded bg-white" placeholder="Type" value={staff.type} onChange={e => updateStaffField(practiceIdx, category, staffIdx, 'type', e.target.value)} />
        <input className="w-32 px-2 py-1 text-xs border rounded bg-white" placeholder="Notes" value={staff.notes || ''} onChange={e => updateStaffField(practiceIdx, category, staffIdx, 'notes', e.target.value)} />
        <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deleteStaff(practiceIdx, category, staffIdx)} title="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>
    );
  };

  // Practice card
  const PracticeCard = ({ practice, practiceIdx }: { practice: RecruitmentPractice; practiceIdx: number }) => {
    const totals = calculatePracticeTotalsLocal(practice);
    const isExpanded = expandedPractice === practice.id;

    const renderCategory = (label: string, icon: string, bgClass: string, textClass: string, category: 'gp' | 'acp' | 'buyBack', staffList: StaffMember[], sessionCount: number) => {
      if (!isEditing && staffList.length === 0) return null;
      return (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className={`w-6 h-6 ${bgClass} rounded-full flex items-center justify-center ${textClass} text-xs`}>{icon}</span>
            {label} Sessions ({sessionCount})
            {category === 'acp' && sessionCount > 0 && <span className="text-purple-600 font-normal">= {sessionsToACPWte(sessionCount)} WTE ({sessionsToACPHours(sessionCount)} hrs/wk)</span>}
          </h4>
          {isEditing ? (
            <>
              {staffList.map((staff, i) => <EditableStaffRow key={i} staff={staff} practiceIdx={practiceIdx} category={category} staffIdx={i} />)}
              <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1" onClick={() => addStaff(practiceIdx, category)}>
                <Plus className="h-3 w-3" /> Add {label}
              </button>
            </>
          ) : (
            staffList.map((staff, i) => <StaffRow key={i} staff={staff} type={category} />)
          )}
        </div>
      );
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedPractice(isExpanded ? null : practice.id)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-12 rounded-full ${totals.filledPercent >= 80 ? 'bg-green-500' : totals.filledPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">{practice.name}</h3>
                <div className="text-sm text-gray-500">{practice.listSize.toLocaleString()} patients • {practice.percentTotal}% • {practice.hubSpoke}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{totals.totalFilled}<span className="text-gray-400">/{totals.required}</span></div>
              <div className="text-sm text-gray-500">sessions filled</div>
            </div>
          </div>
          <ProgressBar filled={totals.totalFilled} pipeline={totals.totalPipeline} outstanding={totals.totalOutstanding} required={totals.required} />
          <div className="flex flex-wrap gap-2 mt-3">
            {totals.byStatus.recruited + totals.byStatus.confirmed > 0 && <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">✓ {totals.byStatus.recruited + totals.byStatus.confirmed} confirmed</span>}
            {totals.byStatus.offered > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">📤 {totals.byStatus.offered} offered</span>}
            {totals.byStatus.potential > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">💭 {totals.byStatus.potential} potential</span>}
            {totals.byStatus.tbc > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">⏳ {totals.byStatus.tbc} TBC</span>}
            {totals.byStatus.outstanding > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">🔍 {totals.byStatus.outstanding} recruiting</span>}
            {totals.byType.buyBack > 0 && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">🔄 {totals.byType.buyBack} buy-back</span>}
          </div>
          <div className="flex items-center justify-center mt-3 text-gray-400">
            <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
        {isExpanded && (
          <div className="border-t border-gray-200 p-4 bg-gray-50" onClick={e => e.stopPropagation()}>
            {renderCategory('GP', 'GP', 'bg-blue-100', 'text-blue-600', 'gp', practice.workforce.gp, totals.byType.gp)}
            {renderCategory('ACP/ANP', 'ACP', 'bg-purple-100', 'text-purple-600', 'acp', practice.workforce.acp, totals.byType.acp)}
            {renderCategory('Buy-Back', 'BB', 'bg-gray-200', 'text-gray-600', 'buyBack', practice.workforce.buyBack, totals.byType.buyBack)}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center"><p className="text-gray-500">Loading recruitment data…</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-900 mb-1">
              <span className="font-bold">Notewell AI</span><span>✦</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">NRES Workforce Recruitment Tracker</h1>
            <p className="text-amber-800">Session planning and recruitment status</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{neighbourhoodTotals.totalFilled}</div>
            <div className="text-amber-800">of {neighbourhoodTotals.required} sessions filled</div>
          </div>
        </div>
      </div>

      {/* Admin toolbar */}
      {canEdit && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)} className="gap-1.5">
            <History className="h-4 w-4" /> Audit
          </Button>
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing} className="gap-1.5"><X className="h-4 w-4" /> Cancel</Button>
              <Button size="sm" onClick={saveChanges} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"><Save className="h-4 w-4" /> Save</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5"><Pencil className="h-4 w-4" /> Edit Data</Button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <button onClick={() => setViewMode('practice')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'practice' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>By Practice</button>
            <button onClick={() => { setViewMode('neighbourhood'); setSeasonFilter('combined'); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'neighbourhood' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Neighbourhood Summary</button>
          </div>
          {viewMode === 'practice' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Season:</span>
              {['combined', 'non-winter', 'winter'].map(s => (
                <button key={s} onClick={() => setSeasonFilter(s)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${seasonFilter === s ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s === 'non-winter' ? '☀️ Non-Winter' : s === 'winter' ? '❄️ Winter' : '📊 Combined'}
                </button>
              ))}
            </div>
          )}
          {viewMode === 'neighbourhood' && <div className="text-sm text-gray-500 italic">📊 Showing combined (blended average) figures</div>}
        </div>
      </div>

      {/* Neighbourhood Progress Bar */}
      {viewMode === 'neighbourhood' && (
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Neighbourhood Workforce Coverage</h3>
          <ProgressBar filled={neighbourhoodTotals.totalFilled} pipeline={neighbourhoodTotals.totalPipeline} outstanding={neighbourhoodTotals.totalOutstanding} required={neighbourhoodTotals.required} />
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-gray-700">Status Key:</span>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500"></span><span className="text-gray-600">Recruited/Confirmed</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span><span className="text-gray-600">Offered</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span><span className="text-gray-600">Potential</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span><span className="text-gray-600">TBC/Expected</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-gray-600">Outstanding (Recruiting)</span></div>
        </div>
      </div>

      {viewMode === 'neighbourhood' ? (
        <div className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Total Required</div>
              <div className="text-3xl font-bold text-gray-900">{neighbourhoodTotals.required}</div>
              <div className="text-sm text-gray-500">sessions/week</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
              <div className="text-sm text-green-600 mb-1">Filled (Recruited/Offered/Buy-Back)</div>
              <div className="text-3xl font-bold text-green-700">{neighbourhoodTotals.totalFilled}</div>
              <div className="text-sm text-green-600">{neighbourhoodTotals.filledPercent}% secured</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-200">
              <div className="text-sm text-amber-600 mb-1">Pipeline (TBC/Potential)</div>
              <div className="text-3xl font-bold text-amber-700">{neighbourhoodTotals.totalPipeline}</div>
              <div className="text-sm text-amber-600">{neighbourhoodTotals.pipelinePercent}% expected</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200">
              <div className="text-sm text-red-600 mb-1">Outstanding (Recruiting)</div>
              <div className="text-3xl font-bold text-red-700">{neighbourhoodTotals.totalOutstanding}</div>
              <div className="text-sm text-red-600">active recruitment</div>
            </div>
          </div>

          {/* By role type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3"><span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">GP</span><span className="font-semibold text-gray-900">GP Sessions</span></div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{neighbourhoodTotals.gp}</div>
              <div className="text-sm text-gray-500">sessions planned across all practices</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3"><span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">ACP</span><span className="font-semibold text-gray-900">ACP/ANP Sessions</span></div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{neighbourhoodTotals.acp}</div>
              <div className="text-sm text-gray-500">GP-eq sessions = <span className="text-purple-600 font-semibold">{sessionsToACPWte(neighbourhoodTotals.acp)} WTE ({sessionsToACPHours(neighbourhoodTotals.acp)} hrs/wk)</span></div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3"><span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">BB</span><span className="font-semibold text-gray-900">Buy-Back Sessions</span></div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{neighbourhoodTotals.buyBack}</div>
              <div className="text-sm text-gray-500">
                existing staff via buy-back scheme
                {neighbourhoodTotals.buyBackACP > 0 && <div className="text-purple-600 font-medium mt-1">incl. ACP/ANP: {neighbourhoodTotals.buyBackACP} GP-eq sessions = {sessionsToACPWte(neighbourhoodTotals.buyBackACP)} WTE ({sessionsToACPHours(neighbourhoodTotals.buyBackACP)} hrs/wk)</div>}
              </div>
            </div>
          </div>

          {/* Practice comparison table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200"><h3 className="font-semibold text-gray-900">Practice-by-Practice Comparison</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader column="name" label="Practice" align="left" />
                    <SortableHeader column="required" label="Required" />
                    <SortableHeader column="filled" label="Filled" />
                    <SortableHeader column="pipeline" label="Pipeline" />
                    <SortableHeader column="outstanding" label="Outstanding" />
                    <SortableHeader column="progress" label="Progress" style={{ width: '30%' }} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getSortedPractices().map(practice => {
                    const totals = calculatePracticeTotalsLocal(practice);
                    return (
                      <tr key={practice.id} className="hover:bg-gray-50">
                        <td className="p-3"><div className="font-medium text-gray-900">{practice.name}</div><div className="text-xs text-gray-500">{practice.listSize.toLocaleString()} • {practice.percentTotal}%</div></td>
                        <td className="p-3 text-center font-semibold text-gray-900">{totals.required}</td>
                        <td className="p-3 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">{totals.totalFilled}</span></td>
                        <td className="p-3 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm">{totals.totalPipeline}</span></td>
                        <td className="p-3 text-center"><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${totals.totalOutstanding > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'} font-semibold text-sm`}>{totals.totalOutstanding}</span></td>
                        <td className="p-3"><ProgressBar filled={totals.totalFilled} pipeline={totals.totalPipeline} outstanding={totals.totalOutstanding} required={totals.required} showLabels={false} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td className="p-3 font-bold text-gray-900">TOTAL</td>
                    <td className="p-3 text-center font-bold text-gray-900">{neighbourhoodTotals.required}</td>
                    <td className="p-3 text-center font-bold text-green-700">{neighbourhoodTotals.totalFilled}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{neighbourhoodTotals.totalPipeline}</td>
                    <td className="p-3 text-center font-bold text-red-700">{neighbourhoodTotals.totalOutstanding}</td>
                    <td className="p-3"><ProgressBar filled={neighbourhoodTotals.totalFilled} pipeline={neighbourhoodTotals.totalPipeline} outstanding={neighbourhoodTotals.totalOutstanding} required={neighbourhoodTotals.required} showLabels={false} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activePractices.map((practice, idx) => (
            <PracticeCard key={practice.id} practice={practice} practiceIdx={idx} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>NRES Workforce Recruitment Tracker • Programme Board</p>
        <p className="mt-1">Contact: Malcolm Railson (Digital & Transformation Lead) | Amanda Palin (PCN Development Manager)</p>
      </div>

      {/* Audit dialog */}
      <RecruitmentAuditDialog open={auditOpen} onOpenChange={setAuditOpen} />
    </div>
  );
};

export default NRESWorkforceRecruitmentTracker;
