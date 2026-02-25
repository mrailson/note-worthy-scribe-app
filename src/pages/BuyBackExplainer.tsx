import React, { useState } from 'react';

const BuyBackExplainer = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const colors = {
    primary: '#0D9488',
    primaryLight: '#14B8A6',
    primaryBg: '#F0FDFA',
    accent: '#0891B2',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    text: '#1F2937',
    textLight: '#6B7280',
    border: '#E5E7EB',
    white: '#FFFFFF',
    cardBg: '#FAFAFA'
  };

  const TabButton = ({ id, label, icon }: { id: string; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
        activeTab === id 
          ? 'text-white shadow-md' 
          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
      }`}
      style={activeTab === id ? { backgroundColor: colors.primary } : {}}
    >
      {icon}
      {label}
    </button>
  );

  const KeyMessage = () => (
    <div className="rounded-xl p-6 mb-6 border-2" style={{ backgroundColor: colors.primaryBg, borderColor: colors.primary }}>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full" style={{ backgroundColor: colors.primary }}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold mb-2" style={{ color: colors.primary }}>Key Message: SNO Oversight, Not ICB</h3>
          <p className="text-gray-700 text-base leading-relaxed">
            The <strong>SNO (Sub-Neighbourhood Lead)</strong> confirms acceptance of buy-back arrangements 
            with practices. The ICB is <strong>not</strong> policing these arrangements — this is managed 
            through the <strong>SNO-Practice relationship</strong>.
          </p>
        </div>
      </div>
    </div>
  );

  const OverviewTab = () => (
    <div className="space-y-6">
      <KeyMessage />
      
      <h3 className="text-xl font-bold text-gray-800 mb-4">What is Buy-Back?</h3>
      <p className="text-gray-600 mb-6">
        Buy-back allows practices to use <strong>existing staff</strong> for Same Day Access (SDA) work, 
        with their costs funded from the neighbourhood allocation — instead of recruiting new staff.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: colors.primaryBg }}>
              <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-800">Part A: SDA</h4>
          </div>
          <p className="text-gray-600 text-sm">
            <strong>FUNDED</strong> — Same Day Access appointments at neighbourhood level
          </p>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-800">Part B: LTC</h4>
          </div>
          <p className="text-gray-600 text-sm">
            <strong>UNFUNDED</strong> — Released capacity for Long Term Conditions
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold text-amber-800 mb-1">The Golden Rule</p>
            <p className="text-amber-700 text-sm">
              Buy-back money is for <strong>Part A (SDA) only</strong>. Staff cannot do Part B work 
              during funded hours — not even one minute.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const RulesTab = () => (
    <div className="space-y-4">
      <KeyMessage />
      
      <h3 className="text-xl font-bold text-gray-800 mb-4">Simple Rules</h3>
      
      {[
        { icon: '💰', title: 'Money is for SDA only', desc: 'Cannot be used for LTC/Part B work' },
        { icon: '📅', title: 'From 1st April onwards', desc: 'No retrospective claims for previous investments' },
        { icon: '📉', title: 'Reduces your recruitment target', desc: 'Buy back 1 WTE = recruit 1 less externally' },
        { icon: '✅', title: 'Must evidence backfill first', desc: 'Payment held until you prove additionality' },
        { icon: '⚖️', title: '50/50 GP balance at neighbourhood level', desc: 'Not per practice — allows flexibility' },
      ].map((rule, i) => (
        <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-start gap-4">
          <span className="text-2xl">{rule.icon}</span>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800">{rule.title}</h4>
            <p className="text-gray-600 text-sm">{rule.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const ProcessTab = () => (
    <div className="space-y-6">
      <KeyMessage />
      
      <h3 className="text-xl font-bold text-gray-800 mb-4">Buy-Back Process</h3>
      
      <div className="relative">
        {[
          { step: 1, title: 'Identify staff for buy-back', desc: 'Existing staff member moves to SDA work' },
          { step: 2, title: 'Staff begins 100% SDA work', desc: 'From 1st April — SDA only, no LTC' },
          { step: 3, title: 'WTE target reduces', desc: 'Neighbourhood recruitment need decreases' },
          { step: 4, title: 'Payment HELD', desc: 'Cannot claim yet — pending evidence', highlight: true },
          { step: 5, title: 'Recruit/redeploy backfill', desc: 'Create Part B capacity replacement' },
          { step: 6, title: 'Evidence to SNO', desc: 'SNO confirms additionality achieved', sno: true },
          { step: 7, title: 'Payment RELEASED', desc: 'Buy-back funds flow to practice', success: true },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-4 mb-4">
            <div className="flex flex-col items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  item.highlight ? 'bg-amber-500' : item.success ? 'bg-green-500' : item.sno ? 'bg-cyan-600' : ''
                }`}
                style={!item.highlight && !item.success && !item.sno ? { backgroundColor: colors.primary } : {}}
              >
                {item.step}
              </div>
              {i < 6 && <div className="w-0.5 h-8 bg-gray-200 mt-2"></div>}
            </div>
            <div className={`flex-1 rounded-lg p-3 ${
              item.highlight ? 'bg-amber-50 border border-amber-200' : 
              item.success ? 'bg-green-50 border border-green-200' : 
              item.sno ? 'bg-cyan-50 border border-cyan-200' : 
              'bg-gray-50'
            }`}>
              <h4 className={`font-semibold ${
                item.highlight ? 'text-amber-800' : 
                item.success ? 'text-green-800' : 
                item.sno ? 'text-cyan-800' : 
                'text-gray-800'
              }`}>{item.title}</h4>
              <p className={`text-sm ${
                item.highlight ? 'text-amber-700' : 
                item.success ? 'text-green-700' : 
                item.sno ? 'text-cyan-700' : 
                'text-gray-600'
              }`}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const QuickRefTab = () => (
    <div className="space-y-6">
      <KeyMessage />
      
      <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Reference</h3>
      
      <div className="grid gap-3">
        {[
          { scenario: 'ANP moves 100% to SDA Hub', permitted: true, note: 'Evidence backfill first' },
          { scenario: 'GP adds 2 sessions for SDA', permitted: true, note: 'Those sessions = SDA only' },
          { scenario: 'Mix SDA & LTC in same session', permitted: false, note: 'Must be separate' },
          { scenario: 'Claim for work before April', permitted: false, note: 'No retrospective claims' },
          { scenario: 'Use SDA money for LTC staff', permitted: false, note: 'Part A money only' },
          { scenario: 'Claim before recruiting backfill', permitted: false, note: 'Evidence required first' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              item.permitted ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {item.permitted ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{item.scenario}</p>
              <p className="text-sm text-gray-500">{item.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Buy-Back Explained</h1>
          <p className="text-gray-500">A simplified guide for practices</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          <TabButton id="overview" label="Overview" icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          } />
          <TabButton id="rules" label="Simple Rules" icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          } />
          <TabButton id="process" label="Process" icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          } />
          <TabButton id="quickref" label="Quick Ref" icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          } />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'rules' && <RulesTab />}
          {activeTab === 'process' && <ProcessTab />}
          {activeTab === 'quickref' && <QuickRefTab />}
        </div>

        <div className="text-center mt-6 text-sm text-gray-400">
          NRES • Buy-Back Guide
        </div>
      </div>
    </div>
  );
};

export default BuyBackExplainer;
