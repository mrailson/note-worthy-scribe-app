import React, { useState } from 'react';

const NRESWorkforceRecruitmentTracker = () => {
  const [viewMode, setViewMode] = useState('neighbourhood'); // 'practice' or 'neighbourhood'
  const [seasonFilter, setSeasonFilter] = useState('combined'); // 'winter', 'non-winter', 'combined'
  const [expandedPractice, setExpandedPractice] = useState(null);
  const [sortColumn, setSortColumn] = useState('name'); // 'name', 'required', 'filled', 'pipeline', 'outstanding'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // WTE Calculation: 1 session = 4 hrs 10 mins = 4.167 hrs, 1 WTE = 37.5 hrs/week
  const SESSION_HOURS = 4.167; // 4 hours 10 minutes
  const WTE_HOURS = 37.5;
  const sessionsToHours = (sessions) => (sessions * SESSION_HOURS).toFixed(1);
  const sessionsToWTE = (sessions) => ((sessions * SESSION_HOURS) / WTE_HOURS).toFixed(2);

  // Practice data with recruitment status
  const practices = [
    {
      id: 'parks',
      name: 'The Parks MC',
      listSize: 22827,
      percentTotal: 25.5,
      sessionsRequired: { winter: 35, nonWinter: 29, combined: 30 },
      clinicalSystem: 'SystmOne',
      hubSpoke: 'HUB',
      workforce: {
        gp: [
          { name: 'Dr Aamir Badshah', sessions: 4, status: 'offered', type: 'New Recruit', notes: 'Offer underway' }
        ],
        acp: [],
        buyBack: [
          { name: 'Existing Staff Pool', sessions: 26, status: 'confirmed', type: 'Buy-Back', notes: 'All remaining sessions via buy-back of existing staff' }
        ]
      }
    },
    {
      id: 'brackley',
      name: 'Brackley MC',
      listSize: 16212,
      percentTotal: 18.1,
      sessionsRequired: { winter: 25, nonWinter: 21, combined: 22 },
      clinicalSystem: 'SystmOne',
      hubSpoke: 'HUB',
      workforce: {
        gp: [
          { name: 'Dr Charlotte', sessions: 5, status: 'recruited', type: 'New Recruit', notes: 'In post' },
          { name: 'Dr Rajan', sessions: 7, status: 'potential', type: 'New Recruit', notes: 'Potential offer' },
          { name: 'GP Vacancy', sessions: 3, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting' }
        ],
        acp: [],
        buyBack: [
          { name: 'Existing ANP Staff', sessions: 7, status: 'confirmed', type: 'Buy-Back', notes: 'Balance via ANP buy-back' }
        ]
      }
    },
    {
      id: 'springfield',
      name: 'Springfield Surgery',
      listSize: 12611,
      percentTotal: 14.1,
      sessionsRequired: { winter: 19, nonWinter: 16, combined: 17 },
      clinicalSystem: 'EMIS',
      hubSpoke: 'SPOKE',
      workforce: {
        gp: [
          { name: 'Dr TE', sessions: 2, status: 'confirmed', type: 'Buy-Back', notes: 'Existing staff' },
          { name: 'Dr VW', sessions: 2, status: 'tbc', type: 'Buy-Back', notes: 'Existing GP - 1-2 sessions TBC' },
          { name: 'GP Vacancy', sessions: 7, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 7 session GP' }
        ],
        acp: [
          { name: 'ACP/ANP Vacancy', sessions: 6, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 6 session ACP/ANP' }
        ],
        buyBack: []
      }
    },
    {
      id: 'towcester',
      name: 'Towcester MC',
      listSize: 11748,
      percentTotal: 13.1,
      sessionsRequired: { winter: 18, nonWinter: 15, combined: 16 },
      clinicalSystem: 'EMIS',
      hubSpoke: 'SPOKE',
      workforce: {
        gp: [
          { name: 'New GP 1', sessions: 6, status: 'tbc', type: 'New Recruit', notes: 'Expected to join - TBC' },
          { name: 'New GP 2', sessions: 6, status: 'tbc', type: 'New Recruit', notes: 'Expected to join - TBC' },
          { name: 'GP Vacancy', sessions: 4, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting up to 4 further sessions' }
        ],
        acp: [
          { name: 'ACP/ANP (Balance)', sessions: 0, status: 'tbc', type: 'New Recruit', notes: 'Balance will be ACP/ANP - TBC' }
        ],
        buyBack: []
      }
    },
    {
      id: 'bugbrooke',
      name: 'Bugbrooke Surgery',
      listSize: 10788,
      percentTotal: 12.0,
      sessionsRequired: { winter: 16, nonWinter: 14, combined: 14 },
      clinicalSystem: 'SystmOne',
      hubSpoke: 'SPOKE',
      workforce: {
        gp: [
          { name: 'New GP', sessions: 5, status: 'tbc', type: 'New Recruit', notes: 'GP joining - TBC' },
          { name: 'GP Vacancy', sessions: 4, status: 'outstanding', type: 'New Recruit', notes: 'Job advert online' }
        ],
        acp: [
          { name: 'ACP/ANP (Balance)', sessions: 5, status: 'outstanding', type: 'New Recruit', notes: 'Balance will be ACP/ANP' }
        ],
        buyBack: []
      }
    },
    {
      id: 'brook',
      name: 'Brook Health Centre',
      listSize: 9069,
      percentTotal: 10.1,
      sessionsRequired: { winter: 14, nonWinter: 11, combined: 12 },
      clinicalSystem: 'SystmOne',
      hubSpoke: 'SPOKE',
      workforce: {
        gp: [
          { name: 'Dr Sam Cullen', sessions: 2, status: 'offered', type: 'New Recruit', notes: 'Just offered - Thursday' },
          { name: 'GP Vacancy', sessions: 6, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 6 session GP' }
        ],
        acp: [
          { name: 'ACP/ANP Vacancy', sessions: 4, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 4 session ACP/ANP' }
        ],
        buyBack: []
      }
    },
    {
      id: 'denton',
      name: 'Denton Village Surgery',
      listSize: 6329,
      percentTotal: 7.1,
      sessionsRequired: { winter: 10, nonWinter: 8, combined: 8 },
      clinicalSystem: 'SystmOne',
      hubSpoke: 'SPOKE',
      workforce: {
        gp: [
          { name: 'GP Vacancy', sessions: 8, status: 'outstanding', type: 'New Recruit', notes: 'Job advert online - recruiting 8 session GP' }
        ],
        acp: [],
        buyBack: []
      }
    }
  ];

  // Status styling
  const statusConfig = {
    recruited: { label: 'Recruited', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-200' },
    confirmed: { label: 'Confirmed', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-200' },
    offered: { label: 'Offered', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', border: 'border-blue-200' },
    potential: { label: 'Potential', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', border: 'border-purple-200' },
    tbc: { label: 'TBC/Expected', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50', border: 'border-amber-200' },
    outstanding: { label: 'Outstanding', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', border: 'border-red-200' }
  };

  // Calculate totals for a practice
  const calculatePracticeTotals = (practice) => {
    const allStaff = [...practice.workforce.gp, ...practice.workforce.acp, ...practice.workforce.buyBack];
    
    const byStatus = {
      recruited: 0,
      confirmed: 0,
      offered: 0,
      potential: 0,
      tbc: 0,
      outstanding: 0
    };
    
    const byType = {
      gp: 0,
      acp: 0,
      buyBack: 0
    };

    practice.workforce.gp.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + s.sessions;
      byType.gp += s.sessions;
    });
    practice.workforce.acp.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + s.sessions;
      byType.acp += s.sessions;
    });
    practice.workforce.buyBack.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + s.sessions;
      byType.buyBack += s.sessions;
    });

    const totalFilled = byStatus.recruited + byStatus.confirmed + byStatus.offered;
    const totalPipeline = byStatus.potential + byStatus.tbc;
    const totalOutstanding = byStatus.outstanding;
    const totalPlanned = totalFilled + totalPipeline + totalOutstanding;
    
    const seasonKey = seasonFilter === 'winter' ? 'winter' : seasonFilter === 'non-winter' ? 'nonWinter' : 'combined';
    const required = practice.sessionsRequired[seasonKey];

    return {
      byStatus,
      byType,
      totalFilled,
      totalPipeline,
      totalOutstanding,
      totalPlanned,
      required,
      gap: required - totalPlanned,
      filledPercent: Math.round((totalFilled / required) * 100),
      pipelinePercent: Math.round((totalPipeline / required) * 100),
      outstandingPercent: Math.round((totalOutstanding / required) * 100)
    };
  };

  // Calculate neighbourhood totals
  const calculateNeighbourhoodTotals = () => {
    const totals = {
      recruited: 0,
      confirmed: 0,
      offered: 0,
      potential: 0,
      tbc: 0,
      outstanding: 0,
      gp: 0,
      acp: 0,
      buyBack: 0,
      buyBackACP: 0, // Track ACP/ANP buy-back separately
      required: 0
    };

    practices.forEach(p => {
      const pt = calculatePracticeTotals(p);
      Object.keys(pt.byStatus).forEach(k => totals[k] += pt.byStatus[k]);
      totals.gp += pt.byType.gp;
      totals.acp += pt.byType.acp;
      totals.buyBack += pt.byType.buyBack;
      totals.required += pt.required;
      
      // Calculate ACP/ANP buy-back sessions
      const acpBuyBack = p.workforce.buyBack.filter(s => 
        s.name.toLowerCase().includes('anp') || s.name.toLowerCase().includes('acp') || 
        s.notes?.toLowerCase().includes('anp') || s.notes?.toLowerCase().includes('acp')
      ).reduce((sum, s) => sum + s.sessions, 0);
      totals.buyBackACP += acpBuyBack;
    });

    const totalFilled = totals.recruited + totals.confirmed + totals.offered;
    const totalPipeline = totals.potential + totals.tbc;
    const totalOutstanding = totals.outstanding;

    return {
      ...totals,
      totalFilled,
      totalPipeline,
      totalOutstanding,
      totalPlanned: totalFilled + totalPipeline + totalOutstanding,
      filledPercent: Math.round((totalFilled / totals.required) * 100),
      pipelinePercent: Math.round((totalPipeline / totals.required) * 100)
    };
  };

  const neighbourhoodTotals = calculateNeighbourhoodTotals();

  // Sort handler
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sorted practices for table
  const getSortedPractices = () => {
    return [...practices].sort((a, b) => {
      const totalsA = calculatePracticeTotals(a);
      const totalsB = calculatePracticeTotals(b);
      
      let valueA, valueB;
      switch (sortColumn) {
        case 'name':
          valueA = a.name;
          valueB = b.name;
          break;
        case 'required':
          valueA = totalsA.required;
          valueB = totalsB.required;
          break;
        case 'filled':
          valueA = totalsA.totalFilled;
          valueB = totalsB.totalFilled;
          break;
        case 'pipeline':
          valueA = totalsA.totalPipeline;
          valueB = totalsB.totalPipeline;
          break;
        case 'outstanding':
          valueA = totalsA.totalOutstanding;
          valueB = totalsB.totalOutstanding;
          break;
        case 'progress':
          // Sort by coverage percentage (filled + pipeline) - best = most green+amber, worst = most red
          valueA = ((totalsA.totalFilled + totalsA.totalPipeline) / totalsA.required) * 100;
          valueB = ((totalsB.totalFilled + totalsB.totalPipeline) / totalsB.required) * 100;
          break;
        default:
          valueA = a.name;
          valueB = b.name;
      }
      
      if (typeof valueA === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  };

  // Sortable header component
  const SortableHeader = ({ column, label, align = 'center', style = {} }) => (
    <th 
      className={`${align === 'left' ? 'text-left' : 'text-center'} p-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none transition-colors`}
      onClick={() => handleSort(column)}
      style={style}
    >
      <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <span className="text-gray-400">
          {sortColumn === column ? (
            column === 'progress' 
              ? (sortDirection === 'asc' ? '↑ action' : '↓ best')
              : (sortDirection === 'asc' ? '↑' : '↓')
          ) : '↕'}
        </span>
      </div>
    </th>
  );

  // Progress bar component
  const ProgressBar = ({ filled, pipeline, outstanding, required, showLabels = true }) => {
    const filledPct = Math.min((filled / required) * 100, 100);
    const pipelinePct = Math.min((pipeline / required) * 100, 100 - filledPct);
    const outstandingPct = Math.min((outstanding / required) * 100, 100 - filledPct - pipelinePct);
    
    return (
      <div className="w-full">
        <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
          {filledPct > 0 && (
            <div 
              className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
              style={{ width: `${filledPct}%` }}
            >
              {filledPct >= 10 && `${Math.round(filledPct)}%`}
            </div>
          )}
          {pipelinePct > 0 && (
            <div 
              className="bg-amber-400 h-full flex items-center justify-center text-xs text-amber-900 font-medium transition-all"
              style={{ width: `${pipelinePct}%` }}
            >
              {pipelinePct >= 10 && `${Math.round(pipelinePct)}%`}
            </div>
          )}
          {outstandingPct > 0 && (
            <div 
              className="bg-red-400 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
              style={{ width: `${outstandingPct}%` }}
            >
              {outstandingPct >= 10 && `${Math.round(outstandingPct)}%`}
            </div>
          )}
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

  // Status badge component
  const StatusBadge = ({ status, sessions }) => {
    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgLight} ${config.textColor} ${config.border} border`}>
        <span className={`w-2 h-2 rounded-full ${config.color} mr-1.5`}></span>
        {sessions} sessions • {config.label}
      </span>
    );
  };

  // Staff row component
  const StaffRow = ({ staff, type }) => {
    const config = statusConfig[staff.status];
    // Show WTE for ACP type OR for buy-back that contains ANP/ACP in name or notes
    const isACPRole = type === 'acp' || (type === 'buyBack' && (staff.name.toLowerCase().includes('anp') || staff.name.toLowerCase().includes('acp') || staff.notes?.toLowerCase().includes('anp') || staff.notes?.toLowerCase().includes('acp')));
    const hoursValue = isACPRole ? sessionsToHours(staff.sessions) : null;
    const wteValue = isACPRole ? sessionsToWTE(staff.sessions) : null;
    
    const roleLabel = type === 'gp' ? 'GP' : type === 'acp' ? 'ACP/ANP' : 'Buy-Back';
    
    return (
      <div className={`flex items-center justify-between p-3 rounded-lg ${config.bgLight} ${config.border} border mb-2`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white font-bold text-sm`}>
            {staff.sessions}
          </div>
          <div>
            <div className="font-medium text-gray-900">{staff.name}</div>
            <div className="text-xs text-gray-500">
              {staff.type} • {roleLabel}
              {isACPRole && staff.sessions > 0 && <span className="ml-1 text-purple-600 font-medium">({hoursValue} hrs = {wteValue} WTE)</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <StatusBadge status={staff.status} sessions={staff.sessions} />
            {isACPRole && staff.sessions > 0 && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                {hoursValue} hrs ({wteValue} WTE)
              </span>
            )}
          </div>
          {staff.notes && <div className="text-xs text-gray-500 mt-1 max-w-48">{staff.notes}</div>}
        </div>
      </div>
    );
  };

  // Practice card component
  const PracticeCard = ({ practice }) => {
    const totals = calculatePracticeTotals(practice);
    const isExpanded = expandedPractice === practice.id;
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpandedPractice(isExpanded ? null : practice.id)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-12 rounded-full ${totals.filledPercent >= 80 ? 'bg-green-500' : totals.filledPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">{practice.name}</h3>
                <div className="text-sm text-gray-500">
                  {practice.listSize.toLocaleString()} patients • {practice.percentTotal}% • {practice.hubSpoke}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{totals.totalFilled}<span className="text-gray-400">/{totals.required}</span></div>
              <div className="text-sm text-gray-500">sessions filled</div>
            </div>
          </div>
          
          <ProgressBar 
            filled={totals.totalFilled} 
            pipeline={totals.totalPipeline} 
            outstanding={totals.totalOutstanding}
            required={totals.required}
          />
          
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {totals.byStatus.recruited + totals.byStatus.confirmed > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                ✓ {totals.byStatus.recruited + totals.byStatus.confirmed} confirmed
              </span>
            )}
            {totals.byStatus.offered > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                📤 {totals.byStatus.offered} offered
              </span>
            )}
            {totals.byStatus.potential > 0 && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                💭 {totals.byStatus.potential} potential
              </span>
            )}
            {totals.byStatus.tbc > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                ⏳ {totals.byStatus.tbc} TBC
              </span>
            )}
            {totals.byStatus.outstanding > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                🔍 {totals.byStatus.outstanding} recruiting
              </span>
            )}
            {totals.byType.buyBack > 0 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                🔄 {totals.byType.buyBack} buy-back
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-center mt-3 text-gray-400">
            <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            {practice.workforce.gp.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs">GP</span>
                  GP Sessions ({totals.byType.gp})
                </h4>
                {practice.workforce.gp.map((staff, i) => (
                  <StaffRow key={i} staff={staff} type="gp" />
                ))}
              </div>
            )}
            
            {practice.workforce.acp.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-xs">ACP</span>
                  ACP/ANP Sessions ({totals.byType.acp})
                  <span className="text-purple-600 font-normal">= {sessionsToHours(totals.byType.acp)} hrs ({sessionsToWTE(totals.byType.acp)} WTE)</span>
                </h4>
                {practice.workforce.acp.map((staff, i) => (
                  <StaffRow key={i} staff={staff} type="acp" />
                ))}
              </div>
            )}
            
            {practice.workforce.buyBack.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-xs">BB</span>
                  Buy-Back Sessions ({totals.byType.buyBack})
                  {(() => {
                    const acpBuyBack = practice.workforce.buyBack.filter(s => 
                      s.name.toLowerCase().includes('anp') || s.name.toLowerCase().includes('acp') || 
                      s.notes?.toLowerCase().includes('anp') || s.notes?.toLowerCase().includes('acp')
                    ).reduce((sum, s) => sum + s.sessions, 0);
                    return acpBuyBack > 0 ? (
                      <span className="text-purple-600 font-normal">incl. ACP/ANP: {sessionsToHours(acpBuyBack)} hrs ({sessionsToWTE(acpBuyBack)} WTE)</span>
                    ) : null;
                  })()}
                </h4>
                {practice.workforce.buyBack.map((staff, i) => (
                  <StaffRow key={i} staff={staff} type="buyBack" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-900 mb-1">
              <span className="font-bold">Notewell AI</span>
              <span>✦</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">NRES Workforce Recruitment Tracker</h1>
            <p className="text-amber-800">Session planning and recruitment status as at 23 February 2026</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{neighbourhoodTotals.totalFilled}</div>
            <div className="text-amber-800">of {neighbourhoodTotals.required} sessions filled</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <button
              onClick={() => setViewMode('practice')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'practice' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              By Practice
            </button>
            <button
              onClick={() => {
                setViewMode('neighbourhood');
                setSeasonFilter('combined'); // Always use combined for neighbourhood view
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'neighbourhood' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Neighbourhood Summary
            </button>
          </div>
          
          {viewMode === 'practice' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Season:</span>
              {['combined', 'non-winter', 'winter'].map(s => (
                <button
                  key={s}
                  onClick={() => setSeasonFilter(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${seasonFilter === s ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s === 'non-winter' ? '☀️ Non-Winter' : s === 'winter' ? '❄️ Winter' : '📊 Combined'}
                </button>
              ))}
            </div>
          )}
          
          {viewMode === 'neighbourhood' && (
            <div className="text-sm text-gray-500 italic">
              📊 Showing combined (blended average) figures
            </div>
          )}
        </div>
      </div>

      {/* Neighbourhood Progress Bar - shown above legend in neighbourhood view */}
      {viewMode === 'neighbourhood' && (
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Neighbourhood Workforce Coverage</h3>
          <ProgressBar 
            filled={neighbourhoodTotals.totalFilled} 
            pipeline={neighbourhoodTotals.totalPipeline} 
            outstanding={neighbourhoodTotals.totalOutstanding}
            required={neighbourhoodTotals.required}
          />
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-gray-700">Status Key:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-600">Recruited/Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-gray-600">Offered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="text-gray-600">Potential</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-gray-600">TBC/Expected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-gray-600">Outstanding (Recruiting)</span>
          </div>
        </div>
      </div>

      {viewMode === 'neighbourhood' ? (
        /* Neighbourhood Summary View */
        <div className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Total Required</div>
              <div className="text-3xl font-bold text-gray-900">{neighbourhoodTotals.required}</div>
              <div className="text-sm text-gray-500">sessions/week</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
              <div className="text-sm text-green-600 mb-1">Filled (Recruited/Offered)</div>
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
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">GP</span>
                <span className="font-semibold text-gray-900">GP Sessions</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{neighbourhoodTotals.gp}</div>
              <div className="text-sm text-gray-500">sessions planned across all practices</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">ACP</span>
                <span className="font-semibold text-gray-900">ACP/ANP Sessions</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{neighbourhoodTotals.acp}</div>
              <div className="text-sm text-gray-500">sessions = <span className="text-purple-600 font-semibold">{sessionsToHours(neighbourhoodTotals.acp)} hrs ({sessionsToWTE(neighbourhoodTotals.acp)} WTE)</span></div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">BB</span>
                <span className="font-semibold text-gray-900">Buy-Back Sessions</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{neighbourhoodTotals.buyBack}</div>
              <div className="text-sm text-gray-500">
                existing staff via buy-back scheme
                {neighbourhoodTotals.buyBackACP > 0 && (
                  <div className="text-purple-600 font-medium mt-1">
                    incl. ACP/ANP: {neighbourhoodTotals.buyBackACP} sessions = {sessionsToHours(neighbourhoodTotals.buyBackACP)} hrs ({sessionsToWTE(neighbourhoodTotals.buyBackACP)} WTE)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Practice comparison table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Practice-by-Practice Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader column="name" label="Practice" align="left" />
                    <SortableHeader column="required" label="Required" />
                    <SortableHeader column="filled" label="Filled" />
                    <SortableHeader column="pipeline" label="Pipeline" />
                    <SortableHeader column="outstanding" label="Outstanding" />
                    <SortableHeader column="progress" label="Progress" style={{width: '30%'}} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getSortedPractices().map(practice => {
                    const totals = calculatePracticeTotals(practice);
                    return (
                      <tr key={practice.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-900">{practice.name}</div>
                          <div className="text-xs text-gray-500">{practice.listSize.toLocaleString()} • {practice.percentTotal}%</div>
                        </td>
                        <td className="p-3 text-center font-semibold text-gray-900">{totals.required}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                            {totals.totalFilled}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm">
                            {totals.totalPipeline}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${totals.totalOutstanding > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'} font-semibold text-sm`}>
                            {totals.totalOutstanding}
                          </span>
                        </td>
                        <td className="p-3">
                          <ProgressBar 
                            filled={totals.totalFilled} 
                            pipeline={totals.totalPipeline} 
                            outstanding={totals.totalOutstanding}
                            required={totals.required}
                            showLabels={false}
                          />
                        </td>
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
                    <td className="p-3">
                      <ProgressBar 
                        filled={neighbourhoodTotals.totalFilled} 
                        pipeline={neighbourhoodTotals.totalPipeline} 
                        outstanding={neighbourhoodTotals.totalOutstanding}
                        required={neighbourhoodTotals.required}
                        showLabels={false}
                      />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Practice View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {practices.map(practice => (
            <PracticeCard key={practice.id} practice={practice} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>NRES Workforce Recruitment Tracker • Data as at 23 February 2026 • Programme Board</p>
        <p className="mt-1">Contact: Malcolm Railson (Digital & Transformation Lead) | Amanda Palin (PCN Development Manager)</p>
      </div>
    </div>
  );
};

export default NRESWorkforceRecruitmentTracker;
